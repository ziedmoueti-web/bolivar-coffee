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
// Treat PORT=0 or garbage as "not set" so the .env value / default 3000 applies.
// (Some environments inject PORT=0; hosting platforms that set a real PORT still win.)
const PORT = Number(process.env.PORT) > 0 ? Number(process.env.PORT) : 3000;

// Demo mode — run the full site + dashboard with in-memory data, no Supabase.
// Off by default; enable with DEMO_MODE=true in .env. Never enable in production.
const DEMO_MODE = process.env.DEMO_MODE === 'true';

/* ============================================================
   ENVIRONMENT VALIDATION
   ============================================================ */
const required = DEMO_MODE
  ? ['JWT_SECRET'] // demo mode needs no Supabase credentials
  : ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'JWT_SECRET'];
const missing = required.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`\n❌ Missing required environment variables: ${missing.join(', ')}`);
  console.error('   Copy .env.example to .env and fill in your Supabase credentials.');
  console.error('   (Or set DEMO_MODE=true in .env to run with in-memory demo data instead.)\n');
  process.exit(1);
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Supabase client with service role (server-side only, never exposed).
// In demo mode this is swapped for an in-memory client (see demo-data.js).
const supabase = DEMO_MODE
  ? require('./demo-data').createDemoClient()
  : createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
   ADMIN API — Dashboard Stats
   ============================================================ */
app.get('/api/admin/dashboard', authMiddleware, async (req, res) => {
  try {
    const [menuResult, categoriesResult, reviewsResult, galleryResult] = await Promise.all([
      supabase.from('menu_items').select('id, is_available', { count: 'exact' }),
      supabase.from('menu_categories').select('id, is_active', { count: 'exact' }),
      supabase.from('reviews').select('id, is_approved', { count: 'exact' }),
      supabase.from('gallery_images').select('id', { count: 'exact', head: true })
    ]);

    const menuItems = menuResult.data || [];
    const reviews = reviewsResult.data || [];

    const stats = {
      menu_item_count: menuResult.count || 0,
      available_item_count: menuItems.filter(i => i.is_available).length,
      category_count: categoriesResult.count || 0,
      review_count: reviewsResult.count || 0,
      approved_review_count: reviews.filter(r => r.is_approved).length,
      pending_review_count: reviews.filter(r => !r.is_approved).length,
      gallery_count: galleryResult.count || 0
    };

    res.json(stats);
  } catch (err) {
    console.error('Dashboard error:', err.message);
    res.status(500).json({ error: 'Failed to load dashboard' });
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
  console.log(`   Supabase: ${DEMO_MODE ? '(demo — in-memory)' : SUPABASE_URL}`);
  if (DEMO_MODE) {
    console.log('');
    console.log('   ⚠  DEMO MODE — in-memory data, changes are lost on restart.');
    console.log('      Admin login: admin@demo.local / demo1234');
  }
  console.log('');
});
