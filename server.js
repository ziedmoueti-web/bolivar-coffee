#!/usr/bin/env node
/* ============================================================
   BOLIVAR COFFEE & LOUNGE — Production Server
   Express + Supabase PostgreSQL. Zero local persistence.
   ============================================================ */

require('dotenv').config();
const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const crypto = require('crypto');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3000;

/* ============================================================
   ENVIRONMENT VALIDATION
   ============================================================ */
const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'JWT_SECRET'];
const missing = required.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`\n❌ Missing required environment variables: ${missing.join(', ')}`);
  console.error('   Copy .env.example to .env and fill in your Supabase credentials.\n');
  process.exit(1);
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Supabase client with service role (server-side only, never exposed)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/* ============================================================
   SECURITY MIDDLEWARE
   ============================================================ */

// Helmet — security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disabled to preserve existing frontend
  crossOriginEmbedderPolicy: false,
}));

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// CORS — production-safe
app.use((req, res, next) => {
  const origin = NODE_ENV === 'production' ? FRONTEND_URL : '*';
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Static files (customer website)
app.use(express.static(__dirname, { extensions: ['html'], index: 'index.html' }));

/* ============================================================
   RATE LIMITING (simple in-memory)
   ============================================================ */
const rateLimits = {};

function rateLimit(key, maxRequests, windowMs) {
  const now = Date.now();
  if (!rateLimits[key]) rateLimits[key] = [];
  rateLimits[key] = rateLimits[key].filter(t => now - t < windowMs);
  if (rateLimits[key].length >= maxRequests) {
    return false;
  }
  rateLimits[key].push(now);
  return true;
}

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const key in rateLimits) {
    rateLimits[key] = rateLimits[key].filter(t => now - t < 600000);
    if (rateLimits[key].length === 0) delete rateLimits[key];
  }
}, 300000);

/* ============================================================
   INPUT SANITIZATION
   ============================================================ */
function sanitize(str, maxLen) {
  if (typeof str !== 'string') return '';
  return str.trim().substring(0, maxLen || 500).replace(/<[^>]*>/g, '');
}

function isValidPhone(phone) {
  return /^\+?[0-9\s\-()]{7,30}$/.test(phone);
}

/* ============================================================
   AUTH MIDDLEWARE
   ============================================================ */
async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    // Verify the user still exists and has admin role
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .eq('id', decoded.sub)
      .single();

    if (error || !profile || !['admin', 'staff'].includes(profile.role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.admin = profile;
    next();
  } catch (e) {
    if (e.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/* ============================================================
   AUTH ROUTES
   ============================================================ */
app.post('/api/auth/login', async (req, res) => {
  // Rate limit: 5 attempts per minute
  const ip = req.ip || req.connection.remoteAddress;
  if (!rateLimit(`login:${ip}`, 5, 60000)) {
    return res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
  }

  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    // Use Supabase Auth to sign in
    const { data, error } = await supabase.auth.signInWithPassword({
      email: sanitize(email, 254),
      password: password
    });

    if (error) throw error;

    // Check profile has admin role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile || !['admin', 'staff'].includes(profile.role)) {
      await supabase.auth.admin.signOut(data.session.access_token);
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Create our own JWT for the server
    const token = jwt.sign(
      { sub: profile.id, email: profile.email, role: profile.role },
      JWT_SECRET,
      { expiresIn: '7d', issuer: 'bolivar-coffee' }
    );

    res.json({
      token,
      user: { id: profile.id, email: profile.email, full_name: profile.full_name, role: profile.role }
    });
  } catch (err) {
    res.status(401).json({ error: 'Invalid email or password' });
  }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json(req.admin);
});

app.post('/api/auth/logout', authMiddleware, (req, res) => {
  res.json({ success: true });
});

/* ============================================================
   PUBLIC API — Menu & Categories
   ============================================================ */
app.get('/api/menu', async (req, res) => {
  try {
    const { category, featured } = req.query;
    let query = supabase
      .from('menu_items')
      .select('*, menu_categories!inner(id, name, slug)')
      .eq('is_available', true)
      .order('display_order');

    if (category) query = query.eq('menu_categories.slug', category);
    if (featured === '1') query = query.eq('is_featured', true);

    const { data, error } = await query;
    if (error) throw error;

    // Flatten category info
    const items = (data || []).map(item => ({
      ...item,
      category_name: item.menu_categories?.name || '',
      category_slug: item.menu_categories?.slug || '',
      menu_categories: undefined
    }));

    res.json(items);
  } catch (err) {
    console.error('Menu fetch error:', err.message);
    res.status(500).json({ error: 'Failed to load menu' });
  }
});

app.get('/api/categories', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('menu_categories')
      .select('*')
      .eq('is_active', true)
      .order('display_order');
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load categories' });
  }
});

/* ============================================================
   PUBLIC API — Reviews (approved only)
   ============================================================ */
app.get('/api/reviews', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('is_approved', true)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load reviews' });
  }
});

app.post('/api/reviews', async (req, res) => {
  // Rate limit: 3 reviews per hour per IP
  const ip = req.ip || req.connection.remoteAddress;
  if (!rateLimit(`review:${ip}`, 3, 3600000)) {
    return res.status(429).json({ error: 'Too many reviews. Please try again later.' });
  }

  try {
    const { customer_name, rating, content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Review content is required' });
    }

    const { data, error } = await supabase
      .from('reviews')
      .insert({
        customer_name: sanitize(customer_name || 'Guest', 100),
        rating: Math.min(5, Math.max(1, parseInt(rating) || 5)),
        content: sanitize(content, 1000),
        source: 'website',
        is_approved: false
      })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

/* ============================================================
   PUBLIC API — Gallery
   ============================================================ */
app.get('/api/gallery', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('gallery_images')
      .select('*')
      .eq('is_active', true)
      .order('display_order');
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load gallery' });
  }
});

/* ============================================================
   PUBLIC API — Settings
   ============================================================ */
app.get('/api/settings', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('business_settings')
      .select('*');
    if (error) throw error;
    const settings = {};
    (data || []).forEach(r => { settings[r.key] = r.value; });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

/* ============================================================
   PUBLIC API — Create Order (SECURE: prices from database)
   ============================================================ */
app.post('/api/orders', async (req, res) => {
  // Rate limit: 10 orders per hour per IP
  const ip = req.ip || req.connection.remoteAddress;
  if (!rateLimit(`order:${ip}`, 10, 3600000)) {
    return res.status(429).json({ error: 'Too many orders. Please try again later.' });
  }

  try {
    const { customer_name, customer_phone, customer_notes, items } = req.body;

    // Validate required fields
    if (!customer_name || !customer_name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!customer_phone || !customer_phone.trim()) {
      return res.status(400).json({ error: 'Phone number is required' });
    }
    if (!isValidPhone(customer_phone)) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required' });
    }
    if (items.length > 50) {
      return res.status(400).json({ error: 'Too many items' });
    }

    // Validate each item
    for (const item of items) {
      if (!item.menu_item_id || !item.quantity) {
        return res.status(400).json({ error: 'Each item must have a menu_item_id and quantity' });
      }
      const qty = parseInt(item.quantity);
      if (isNaN(qty) || qty < 1 || qty > 100) {
        return res.status(400).json({ error: 'Invalid quantity' });
      }
    }

    // Fetch all referenced menu items from database (DO NOT TRUST CLIENT PRICES)
    const itemIds = [...new Set(items.map(i => i.menu_item_id))];
    const { data: menuItems, error: menuError } = await supabase
      .from('menu_items')
      .select('id, name, price, is_available')
      .in('id', itemIds);

    if (menuError) throw menuError;

    // Verify all items exist and are available
    const menuItemMap = {};
    (menuItems || []).forEach(mi => { menuItemMap[mi.id] = mi; });

    for (const item of items) {
      const menuItem = menuItemMap[item.menu_item_id];
      if (!menuItem) {
        return res.status(400).json({ error: `Menu item not found: ${item.menu_item_id}` });
      }
      if (!menuItem.is_available) {
        return res.status(400).json({ error: `"${menuItem.name}" is currently unavailable` });
      }
    }

    // Calculate totals using DATABASE prices
    let subtotal = 0;
    const orderItems = items.map(item => {
      const menuItem = menuItemMap[item.menu_item_id];
      const quantity = parseInt(item.quantity);
      const unitPrice = parseFloat(menuItem.price);
      const itemSubtotal = parseFloat((unitPrice * quantity).toFixed(3));
      subtotal += itemSubtotal;
      return {
        menu_item_id: item.menu_item_id,
        item_name_snapshot: menuItem.name,
        unit_price: unitPrice,
        quantity,
        subtotal: itemSubtotal
      };
    });

    const total = parseFloat(subtotal.toFixed(3));

    // Create order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_name: sanitize(customer_name, 100),
        customer_phone: sanitize(customer_phone, 30),
        customer_notes: sanitize(customer_notes || '', 500),
        subtotal,
        total,
        status: 'new'
      })
      .select('id, tracking_token, total, status, created_at')
      .single();

    if (orderError) throw orderError;

    // Create order items
    const orderItemsToInsert = orderItems.map(oi => ({
      order_id: order.id,
      ...oi
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItemsToInsert);

    if (itemsError) throw itemsError;

    res.json({
      id: order.id,
      tracking_token: order.tracking_token,
      total: order.total,
      status: order.status,
      created_at: order.created_at
    });
  } catch (err) {
    console.error('Order creation error:', err.message);
    res.status(500).json({ error: 'Failed to create order. Please try again.' });
  }
});

/* ============================================================
   PUBLIC API — Track Order by Token
   ============================================================ */
app.get('/api/orders/track/:token', async (req, res) => {
  try {
    const { token } = req.params;
    if (!token || token.length < 20) {
      return res.status(400).json({ error: 'Invalid tracking token' });
    }

    const { data: order, error } = await supabase
      .from('orders')
      .select('id, tracking_token, customer_name, status, total, created_at, updated_at')
      .eq('tracking_token', token)
      .single();

    if (error || !order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Fetch order items
    const { data: items } = await supabase
      .from('order_items')
      .select('item_name_snapshot, unit_price, quantity, subtotal')
      .eq('order_id', order.id);

    res.json({
      ...order,
      items: items || []
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to track order' });
  }
});

/* ============================================================
   ADMIN API — Dashboard Stats
   ============================================================ */
app.get('/api/admin/dashboard', authMiddleware, async (req, res) => {
  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    const [ordersResult, menuResult, todayResult] = await Promise.all([
      supabase.from('orders').select('id, status, total, created_at'),
      supabase.from('menu_items').select('id', { count: 'exact', head: true }),
      supabase.from('orders').select('id, total').gte('created_at', today + 'T00:00:00')
    ]);

    const orders = ordersResult.data || [];
    const stats = {
      total_orders: orders.length,
      pending_count: orders.filter(o => o.status === 'new').length,
      completed_count: orders.filter(o => o.status === 'completed').length,
      menu_item_count: menuResult.count || 0,
      total_revenue: orders.reduce((s, o) => s + (o.total || 0), 0),
      today_revenue: (todayResult.data || []).reduce((s, o) => s + (o.total || 0), 0),
      today_orders: (todayResult.data || []).length,
    };

    // Recent orders
    stats.recent_orders = orders
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 10);

    // Attach items to recent orders
    for (const o of stats.recent_orders) {
      const { data: items } = await supabase
        .from('order_items')
        .select('item_name_snapshot, quantity, subtotal')
        .eq('order_id', o.id);
      o.order_items = items || [];
    }

    // Best sellers
    const { data: allItems } = await supabase.from('order_items').select('item_name_snapshot, quantity, subtotal');
    const soldMap = {};
    (allItems || []).forEach(i => {
      if (!soldMap[i.item_name_snapshot]) soldMap[i.item_name_snapshot] = { menu_item_name: i.item_name_snapshot, times_ordered: 0, revenue: 0 };
      soldMap[i.item_name_snapshot].times_ordered += i.quantity;
      soldMap[i.item_name_snapshot].revenue += i.subtotal;
    });
    stats.best_sellers = Object.values(soldMap).sort((a, b) => b.times_ordered - a.times_ordered).slice(0, 5);

    // Daily revenue
    const { data: recentOrders } = await supabase
      .from('orders')
      .select('total, created_at')
      .gte('created_at', new Date(now - 30 * 86400000).toISOString());
    const revenueByDay = {};
    (recentOrders || []).forEach(o => {
      const day = (o.created_at || '').split('T')[0];
      if (!revenueByDay[day]) revenueByDay[day] = { day, orders: 0, revenue: 0 };
      revenueByDay[day].orders++;
      revenueByDay[day].revenue += o.total || 0;
    });
    stats.daily_revenue = Object.values(revenueByDay).sort((a, b) => b.day.localeCompare(a.day)).slice(0, 30);

    res.json(stats);
  } catch (err) {
    console.error('Dashboard error:', err.message);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

/* ============================================================
   ADMIN API — Orders Management
   ============================================================ */
app.get('/api/admin/orders', authMiddleware, async (req, res) => {
  try {
    const { status, search } = req.query;
    let query = supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (status && status !== 'all') query = query.eq('status', status);

    const { data: orders, error } = await query;
    if (error) throw error;

    // Search filter (post-fetch since Supabase doesn't do LIKE on all fields well)
    let filtered = orders || [];
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(o =>
        (o.customer_name || '').toLowerCase().includes(q) ||
        (o.customer_phone || '').includes(q) ||
        (o.tracking_token || '').includes(q)
      );
    }

    // Attach items
    for (const o of filtered) {
      const { data: items } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', o.id);
      o.order_items = items || [];
    }

    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load orders' });
  }
});

app.get('/api/admin/orders/:id', authMiddleware, async (req, res) => {
  try {
    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (error || !order) return res.status(404).json({ error: 'Order not found' });

    const { data: items } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', order.id);
    order.order_items = items || [];

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load order' });
  }
});

app.patch('/api/admin/orders/:id', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['new', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const { error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', req.params.id);
    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update order' });
  }
});

/* ============================================================
   ADMIN API — Menu Management
   ============================================================ */
app.get('/api/admin/menu', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*, menu_categories!inner(id, name, slug)')
      .order('display_order');
    if (error) throw error;
    const items = (data || []).map(item => ({
      ...item,
      category_name: item.menu_categories?.name || '',
      category_slug: item.menu_categories?.slug || '',
      menu_categories: undefined
    }));
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load menu' });
  }
});

app.post('/api/admin/menu', authMiddleware, async (req, res) => {
  try {
    const { name, description, price, category_id, image_url, is_available, is_featured, display_order } = req.body;
    if (!name || price === undefined || !category_id) {
      return res.status(400).json({ error: 'Name, price, and category are required' });
    }
    const { data, error } = await supabase
      .from('menu_items')
      .insert({
        name: sanitize(name, 200),
        description: sanitize(description || '', 500),
        price: Math.max(0, parseFloat(price) || 0),
        category_id,
        image_url: image_url || '',
        is_available: is_available !== false,
        is_featured: !!is_featured,
        display_order: parseInt(display_order) || 0
      })
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create menu item' });
  }
});

app.patch('/api/admin/menu/:id', authMiddleware, async (req, res) => {
  try {
    const updates = { ...req.body };
    if (updates.price !== undefined) updates.price = Math.max(0, parseFloat(updates.price) || 0);
    if (updates.name) updates.name = sanitize(updates.name, 200);
    if (updates.description) updates.description = sanitize(updates.description, 500);
    delete updates.id;
    delete updates.created_at;

    const { error } = await supabase
      .from('menu_items')
      .update(updates)
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update menu item' });
  }
});

app.delete('/api/admin/menu/:id', authMiddleware, async (req, res) => {
  try {
    const { error } = await supabase
      .from('menu_items')
      .delete()
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete menu item' });
  }
});

/* ============================================================
   ADMIN API — Reviews Management
   ============================================================ */
app.get('/api/admin/reviews', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load reviews' });
  }
});

app.patch('/api/admin/reviews/:id', authMiddleware, async (req, res) => {
  try {
    const updates = {};
    if (req.body.is_approved !== undefined) updates.is_approved = !!req.body.is_approved;
    if (req.body.is_featured !== undefined) updates.is_featured = !!req.body.is_featured;
    const { error } = await supabase
      .from('reviews')
      .update(updates)
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update review' });
  }
});

app.delete('/api/admin/reviews/:id', authMiddleware, async (req, res) => {
  try {
    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

/* ============================================================
   ADMIN API — Gallery Management
   ============================================================ */
app.get('/api/admin/gallery', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('gallery_images')
      .select('*')
      .order('display_order');
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load gallery' });
  }
});

app.post('/api/admin/gallery', authMiddleware, async (req, res) => {
  try {
    const { title, image_url, caption, display_order } = req.body;
    if (!image_url) return res.status(400).json({ error: 'Image URL is required' });
    const { data, error } = await supabase
      .from('gallery_images')
      .insert({
        title: sanitize(title || '', 200),
        image_url,
        caption: sanitize(caption || '', 200),
        display_order: parseInt(display_order) || 0,
        is_active: true
      })
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add gallery image' });
  }
});

app.patch('/api/admin/gallery/:id', authMiddleware, async (req, res) => {
  try {
    const updates = { ...req.body };
    delete updates.id;
    const { error } = await supabase
      .from('gallery_images')
      .update(updates)
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update gallery image' });
  }
});

app.delete('/api/admin/gallery/:id', authMiddleware, async (req, res) => {
  try {
    const { error } = await supabase
      .from('gallery_images')
      .delete()
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete gallery image' });
  }
});

/* ============================================================
   ADMIN API — Settings
   ============================================================ */
app.get('/api/admin/settings', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('business_settings')
      .select('*');
    if (error) throw error;
    const settings = {};
    (data || []).forEach(r => { settings[r.key] = r.value; });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

app.patch('/api/admin/settings', authMiddleware, async (req, res) => {
  try {
    const entries = Object.entries(req.body);
    for (const [key, value] of entries) {
      await supabase
        .from('business_settings')
        .upsert({ key, value: value || '', updated_at: new Date().toISOString() }, { onConflict: 'key' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

/* ============================================================
   ADMIN API — Categories
   ============================================================ */
app.get('/api/admin/categories', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('menu_categories')
      .select('*')
      .order('display_order');
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load categories' });
  }
});

/* ============================================================
   ADMIN API — File Upload (to Supabase Storage)
   ============================================================ */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
    }
  }
});

app.post('/api/admin/upload', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const ext = req.file.originalname.split('.').pop() || 'jpg';
    const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`;
    const bucket = req.body.bucket || 'menu-images';

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filename, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filename);

    res.json({ url: urlData.publicUrl, path: data.path });
  } catch (err) {
    console.error('Upload error:', err.message);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

/* ============================================================
   SPA FALLBACK
   ============================================================ */
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin', 'index.html')));
app.get('/admin/', (req, res) => res.sendFile(path.join(__dirname, 'admin', 'index.html')));
app.get('/order', (req, res) => res.sendFile(path.join(__dirname, 'order.html')));

/* ============================================================
   ERROR HANDLING
   ============================================================ */
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'File too large' });
  }
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

/* ============================================================
   START SERVER
   ============================================================ */
app.listen(PORT, () => {
  console.log(`\n☕ Bolivar Coffee server running at http://localhost:${PORT}`);
  console.log(`   Customer site:   http://localhost:${PORT}/`);
  console.log(`   Admin login:     http://localhost:${PORT}/admin/login.html`);
  console.log(`   Admin dashboard: http://localhost:${PORT}/admin/index.html`);
  console.log(`\n   Environment: ${NODE_ENV}`);
  console.log(`   Supabase: ${SUPABASE_URL}\n`);
});
