#!/usr/bin/env node
/* ============================================================
   BOLIVAR COFFEE & LOUNGE — Server
   Express + JSON file database. Zero native dependencies.
   ============================================================ */

const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'bolivar-coffee-secret-' + crypto.randomBytes(16).toString('hex');

/* ============================================================
   SEED DATA
   ============================================================ */
function seedIfEmpty() {
  if (db.count('menu_categories') > 0) return;
  console.log('🌱 Seeding database...');

  // Categories
  const cats = [
    { name: 'Coffee', slug: 'coffee', sort_order: 1 },
    { name: 'Breakfast', slug: 'breakfast', sort_order: 2 },
    { name: 'Crêpes', slug: 'crepes', sort_order: 3 },
    { name: 'Food', slug: 'food', sort_order: 4 },
    { name: 'Drinks', slug: 'drinks', sort_order: 5 },
    { name: 'Desserts', slug: 'desserts', sort_order: 6 },
    { name: 'Lounge', slug: 'lounge', sort_order: 7 },
  ];
  cats.forEach(c => db.insert('menu_categories', { ...c, is_active: true }));

  const catId = (slug) => db.get('menu_categories', c => c.slug === slug).id;

  // Menu items
  const items = [
    // Coffee
    { cat: 'coffee', name: 'Espresso', desc: 'Short, intense, velvety crema.', price: 3.5, img: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=700&q=80' },
    { cat: 'coffee', name: 'Café Crème', desc: 'Espresso softened with warm milk.', price: 4.5, img: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=700&q=80' },
    { cat: 'coffee', name: 'Cappuccino', desc: 'Equal parts espresso, milk and foam.', price: 5.0, img: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=700&q=80', featured: true },
    { cat: 'coffee', name: 'Latte', desc: 'Smooth espresso with silky steamed milk.', price: 5.0, img: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=700&q=80' },
    { cat: 'coffee', name: 'Flat White', desc: 'Double ristretto, velvety texture.', price: 5.5, img: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=700&q=80' },
    { cat: 'coffee', name: 'Café Filtre', desc: 'Slow-brewed and aromatic.', price: 4.0, img: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=700&q=80' },
    // Breakfast
    { cat: 'breakfast', name: 'Petit Déjeuner Continental', desc: 'Coffee or tea, fresh bread, butter and jam.', price: 8.0, img: 'https://images.unsplash.com/photo-1484723091739-30a097e8f929?auto=format&fit=crop&w=700&q=80' },
    { cat: 'breakfast', name: 'Petit Déjeuner Bolivar', desc: 'The house breakfast — generous and warm.', price: 12.0, img: 'https://images.unsplash.com/photo-1519677100203-a0e668c92439?auto=format&fit=crop&w=700&q=80', featured: true },
    { cat: 'breakfast', name: 'Pain & Viennoiserie', desc: 'Freshly baked, served warm.', price: 4.0, img: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=700&q=80' },
    { cat: 'breakfast', name: 'Œufs & Toast', desc: 'Eggs your way on toasted bread.', price: 7.0, img: 'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?auto=format&fit=crop&w=700&q=80' },
    { cat: 'breakfast', name: 'Avocado Toast', desc: 'Smashed avocado on toasted bread.', price: 9.0, img: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=700&q=80' },
    // Crêpes
    { cat: 'crepes', name: 'Crêpe Chocolat', desc: 'Warm crêpe filled with rich chocolate.', price: 6.0, img: 'https://images.unsplash.com/photo-1550507992-eb63ffee0847?auto=format&fit=crop&w=700&q=80', featured: true },
    { cat: 'crepes', name: 'Crêpe Sucre Citron', desc: 'The classic — sugar and lemon.', price: 4.0, img: 'https://images.unsplash.com/photo-1519677100203-a0e668c92439?auto=format&fit=crop&w=700&q=80' },
    { cat: 'crepes', name: 'Crêpe Fruits', desc: 'Seasonal fruit, lightly dusted.', price: 6.0, img: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=700&q=80' },
    { cat: 'crepes', name: 'Crêpe Salée', desc: 'Ham and cheese, gratinated.', price: 7.0, img: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=700&q=80' },
    // Food
    { cat: 'food', name: 'Escalope Pané', desc: 'Generous portions, praised by our guests.', price: 14.0, img: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=700&q=80', featured: true },
    { cat: 'food', name: 'Burger Bolivar', desc: 'House burger, served with fries.', price: 15.0, img: 'https://images.unsplash.com/photo-1551782450-a2132b4ba21d?auto=format&fit=crop&w=700&q=80' },
    { cat: 'food', name: 'Salade César', desc: 'Crisp leaves, parmesan, creamy dressing.', price: 10.0, img: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=700&q=80' },
    { cat: 'food', name: 'Plat du Jour', desc: "Ask our team for today's special.", price: 12.0, img: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=700&q=80' },
    { cat: 'food', name: 'Club Sandwich', desc: 'Triple-decker, served with fries.', price: 13.0, img: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=700&q=80' },
    // Drinks
    { cat: 'drinks', name: 'Thé à la Menthe', desc: 'Fresh mint tea, the Tunisian way.', price: 4.0, img: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=700&q=80' },
    { cat: 'drinks', name: 'Thé Vert', desc: 'Delicate and refreshing.', price: 4.0, img: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=700&q=80' },
    { cat: 'drinks', name: "Jus d'Orange Frais", desc: 'Squeezed to order.', price: 5.0, img: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=700&q=80' },
    { cat: 'drinks', name: 'Smoothie', desc: 'Fresh fruit blended with care.', price: 7.0, img: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=700&q=80' },
    { cat: 'drinks', name: 'Limonade', desc: 'Homemade lemonade, lightly sweet.', price: 5.0, img: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=700&q=80' },
    // Desserts
    { cat: 'desserts', name: 'Fondant au Chocolat', desc: 'Molten chocolate, warm from the oven.', price: 7.0, img: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=700&q=80' },
    { cat: 'desserts', name: 'Tiramisu', desc: 'Layered espresso-soaked classic.', price: 8.0, img: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=700&q=80' },
    { cat: 'desserts', name: 'Cheesecake', desc: 'Creamy, with a buttery base.', price: 8.0, img: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=700&q=80' },
    { cat: 'desserts', name: 'Gâteau du Jour', desc: "Ask our team for today's cake.", price: 6.0, img: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=700&q=80' },
    // Lounge
    { cat: 'lounge', name: 'Café Signature', desc: 'Our house blend, served slowly.', price: 6.0, img: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=700&q=80' },
    { cat: 'lounge', name: 'Thé Gourmand', desc: 'A pot of tea with a small sweet treat.', price: 8.0, img: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=700&q=80' },
    { cat: 'lounge', name: 'Chocolat Chaud', desc: 'Thick, dark and comforting.', price: 5.0, img: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=700&q=80' },
    { cat: 'lounge', name: 'Infusion', desc: 'A calming herbal infusion.', price: 4.0, img: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=700&q=80' },
  ];
  items.forEach((item, i) => {
    db.insert('menu_items', {
      category_id: catId(item.cat),
      name: item.name,
      description: item.desc,
      price: item.price,
      image_url: item.img,
      image_alt: item.name,
      is_available: true,
      is_featured: item.featured || false,
      sort_order: i + 1,
    });
  });

  // Reviews
  db.insert('reviews', { author_name: 'Google Review', rating: 5, content: 'Propreté, décor minimaliste avec une touche naturelle qui apporte fraîcheur et sérénité à l espace, serveurs polis et ambiance calme.', source: 'google', is_approved: true });
  db.insert('reviews', { author_name: 'Google Review', rating: 5, content: 'Petit déjeuner délicieux avec une bonne ambiance cozy.', source: 'google', is_approved: true });
  db.insert('reviews', { author_name: 'Google Review', rating: 5, content: 'Un passage pour déguster une tasse de thé et surprise c était superbe.', source: 'google', is_approved: true });

  // Gallery
  [
    { url: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=900&q=80', alt: 'Coffee', caption: 'Coffee', sort_order: 1 },
    { url: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=900&q=80', alt: 'Interior', caption: 'Interior', sort_order: 2 },
    { url: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=900&q=80', alt: 'Food', caption: 'Food', sort_order: 3 },
    { url: 'https://images.unsplash.com/photo-1521017432531-fbd92d768814?auto=format&fit=crop&w=900&q=80', alt: 'Lounge', caption: 'Lounge', sort_order: 4 },
    { url: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=900&q=80', alt: 'Espresso', caption: 'Espresso', sort_order: 5 },
    { url: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=900&q=80', alt: 'Moments', caption: 'Moments', sort_order: 6 },
    { url: 'https://images.unsplash.com/photo-1559925393-8be0ec4767c8?auto=format&fit=crop&w=900&q=80', alt: 'Atmosphere', caption: 'Atmosphere', sort_order: 7 },
    { url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=900&q=80', alt: 'Dessert', caption: 'Dessert', sort_order: 8 },
  ].forEach(g => db.insert('gallery_images', g));

  // Settings
  [
    ['business_name', 'Bolivar Coffee & Lounge'],
    ['phone', '+216 22 535 138'],
    ['phone_raw', '+21622535138'],
    ['address', '87 Av. de la République, Megrine 2033, Tunisia'],
    ['opening_hours', 'Monday — Sunday, 07:00 — 00:00'],
    ['instagram', 'https://www.instagram.com/bolivar_coffeee'],
    ['instagram_handle', '@bolivar_coffeee'],
    ['glovo_url', 'https://glovoapp.com/'],
    ['google_rating', '4.7'],
    ['google_review_count', '24'],
  ].forEach(([k, v]) => db.upsert('business_settings', { key: k, value: v }, 'key'));

  // Default admin
  const hash = bcrypt.hashSync('admin123', 10);
  db.insert('admins', { email: 'admin@bolivar.coffee', password_hash: hash, full_name: 'Admin', role: 'admin' });
  console.log('  ✅ Admin: admin@bolivar.coffee / admin123');
  console.log('  ✅ 33 menu items, 3 reviews, 8 gallery images seeded');
}

/* ============================================================
   MIDDLEWARE
   ============================================================ */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Uploads
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + crypto.randomBytes(4).toString('hex') + path.extname(file.originalname))
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Static files
app.use(express.static(__dirname, { extensions: ['html'], index: 'index.html' }));

/* ============================================================
   AUTH
   ============================================================ */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.admin = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const admin = db.get('admins', a => a.email === email);
  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) return res.status(401).json({ error: 'Invalid email or password' });
  const token = jwt.sign({ id: admin.id, email: admin.email, role: admin.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: admin.id, email: admin.email, full_name: admin.full_name, role: admin.role } });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const admin = db.getById('admins', req.admin.id);
  if (!admin) return res.status(404).json({ error: 'Not found' });
  res.json({ id: admin.id, email: admin.email, full_name: admin.full_name, role: admin.role });
});

/* ============================================================
   CATEGORIES
   ============================================================ */
app.get('/api/categories', (req, res) => {
  res.json(db.sorted('menu_categories', 'sort_order', true).filter(c => c.is_active));
});

app.post('/api/categories', authMiddleware, (req, res) => {
  const { name, slug, sort_order } = req.body;
  if (!name || !slug) return res.status(400).json({ error: 'Name and slug required' });
  const cat = db.insert('menu_categories', { name, slug, sort_order: sort_order || 0, is_active: true });
  res.json(cat);
});

app.put('/api/categories/:id', authMiddleware, (req, res) => {
  db.updateById('menu_categories', parseInt(req.params.id), req.body);
  res.json({ success: true });
});

app.delete('/api/categories/:id', authMiddleware, (req, res) => {
  db.deleteById('menu_categories', parseInt(req.params.id));
  res.json({ success: true });
});

/* ============================================================
   MENU ITEMS
   ============================================================ */
app.get('/api/menu', (req, res) => {
  const { category, featured, available } = req.query;
  let items = db.sorted('menu_items', 'sort_order', true);
  if (category) {
    const cat = db.get('menu_categories', c => c.slug === category);
    if (cat) items = items.filter(i => i.category_id === cat.id);
  }
  if (featured === '1') items = items.filter(i => i.is_featured);
  if (available === '1') items = items.filter(i => i.is_available);

  // Attach category info
  items = items.map(item => {
    const cat = db.getById('menu_categories', item.category_id);
    return { ...item, category_name: cat ? cat.name : '', category_slug: cat ? cat.slug : '' };
  });
  res.json(items);
});

app.get('/api/menu/:id', (req, res) => {
  const item = db.getById('menu_items', parseInt(req.params.id));
  if (!item) return res.status(404).json({ error: 'Not found' });
  const cat = db.getById('menu_categories', item.category_id);
  res.json({ ...item, category_name: cat ? cat.name : '', category_slug: cat ? cat.slug : '' });
});

app.post('/api/menu', authMiddleware, (req, res) => {
  const { name, description, price, category_id, image_url, image_alt, is_available, is_featured, sort_order } = req.body;
  if (!name || price === undefined || !category_id) return res.status(400).json({ error: 'Name, price, and category required' });
  const item = db.insert('menu_items', {
    name, description: description || '', price: parseFloat(price), category_id: parseInt(category_id),
    image_url: image_url || '', image_alt: image_alt || '',
    is_available: is_available !== false, is_featured: !!is_featured, sort_order: sort_order || 0
  });
  res.json(item);
});

app.put('/api/menu/:id', authMiddleware, (req, res) => {
  const id = parseInt(req.params.id);
  const updates = { ...req.body };
  if (updates.price !== undefined) updates.price = parseFloat(updates.price);
  if (updates.category_id !== undefined) updates.category_id = parseInt(updates.category_id);
  db.updateById('menu_items', id, updates);
  res.json({ success: true });
});

app.delete('/api/menu/:id', authMiddleware, (req, res) => {
  db.deleteById('menu_items', parseInt(req.params.id));
  res.json({ success: true });
});

/* ============================================================
   ORDERS
   ============================================================ */
app.get('/api/orders', authMiddleware, (req, res) => {
  const { status, search } = req.query;
  let orders = db.sorted('orders', 'created_at', false);
  if (status && status !== 'all') orders = orders.filter(o => o.status === status);
  if (search) {
    const q = search.toLowerCase();
    orders = orders.filter(o =>
      (o.customer_name || '').toLowerCase().includes(q) ||
      String(o.order_number).includes(q) ||
      (o.customer_phone || '').includes(q)
    );
  }
  orders = orders.map(o => ({ ...o, order_items: db.all('order_items', i => i.order_id === o.id) }));
  res.json(orders);
});

app.get('/api/orders/:id', (req, res) => {
  const order = db.getById('orders', parseInt(req.params.id));
  if (!order) return res.status(404).json({ error: 'Not found' });
  order.order_items = db.all('order_items', i => i.order_id === order.id);
  res.json(order);
});

app.post('/api/orders', (req, res) => {
  const { customer_name, customer_phone, notes, items } = req.body;
  if (!customer_name || !customer_phone || !items || !items.length) return res.status(400).json({ error: 'Name, phone, and items required' });
  let total = 0;
  items.forEach(i => { total += i.price * i.quantity; });
  const order = db.insert('orders', {
    order_number: db.nextOrderNumber(),
    customer_name, customer_phone, notes: notes || '',
    status: 'new', total: parseFloat(total.toFixed(3))
  });
  items.forEach(item => {
    db.insert('order_items', {
      order_id: order.id, menu_item_id: item.id, menu_item_name: item.name,
      quantity: item.quantity, unit_price: item.price, subtotal: parseFloat((item.price * item.quantity).toFixed(3))
    });
  });
  db.insert('notifications', {
    type: 'order', title: `New Order #${order.order_number}`,
    message: `${customer_name} placed an order — ${total.toFixed(3)} DT`,
    reference_id: order.id, is_read: false
  });
  res.json({ id: order.id, order_number: order.order_number, total: order.total });
});

app.patch('/api/orders/:id', authMiddleware, (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'Status required' });
  db.updateById('orders', parseInt(req.params.id), { status });
  res.json({ success: true });
});

/* ============================================================
   REVIEWS
   ============================================================ */
app.get('/api/reviews', (req, res) => {
  res.json(db.sorted('reviews', 'created_at', false));
});

app.get('/api/reviews/approved', (req, res) => {
  res.json(db.all('reviews', r => r.is_approved).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
});

app.post('/api/reviews', (req, res) => {
  const { author_name, rating, content } = req.body;
  if (!content) return res.status(400).json({ error: 'Content required' });
  const review = db.insert('reviews', { author_name: author_name || 'Guest', rating: rating || 5, content, source: 'website', is_approved: false });
  res.json(review);
});

app.put('/api/reviews/:id', authMiddleware, (req, res) => {
  db.updateById('reviews', parseInt(req.params.id), req.body);
  res.json({ success: true });
});

app.delete('/api/reviews/:id', authMiddleware, (req, res) => {
  db.deleteById('reviews', parseInt(req.params.id));
  res.json({ success: true });
});

/* ============================================================
   GALLERY
   ============================================================ */
app.get('/api/gallery', (req, res) => {
  res.json(db.sorted('gallery_images', 'sort_order', true));
});

app.post('/api/gallery', authMiddleware, (req, res) => {
  const { url, alt, caption, sort_order } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });
  const img = db.insert('gallery_images', { url, alt: alt || '', caption: caption || '', sort_order: sort_order || 0 });
  res.json(img);
});

app.delete('/api/gallery/:id', authMiddleware, (req, res) => {
  db.deleteById('gallery_images', parseInt(req.params.id));
  res.json({ success: true });
});

/* ============================================================
   SETTINGS
   ============================================================ */
app.get('/api/settings', (req, res) => {
  const settings = {};
  db.all('business_settings').forEach(r => { settings[r.key] = r.value; });
  res.json(settings);
});

app.put('/api/settings', authMiddleware, (req, res) => {
  Object.entries(req.body).forEach(([k, v]) => db.upsert('business_settings', { key: k, value: v || '' }, 'key'));
  res.json({ success: true });
});

/* ============================================================
   NOTIFICATIONS
   ============================================================ */
app.get('/api/notifications', authMiddleware, (req, res) => {
  res.json(db.all('notifications', n => !n.is_read).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 50));
});

app.put('/api/notifications/read-all', authMiddleware, (req, res) => {
  db.update('notifications', { is_read: true }, () => true);
  res.json({ success: true });
});

/* ============================================================
   FILE UPLOAD
   ============================================================ */
app.post('/api/upload', authMiddleware, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  res.json({ url: '/uploads/' + req.file.filename });
});

/* ============================================================
   DASHBOARD
   ============================================================ */
app.get('/api/dashboard', authMiddleware, (req, res) => {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const weekAgo = new Date(now - 7 * 86400000).toISOString();
  const monthAgo = new Date(now - 30 * 86400000).toISOString();

  const stats = {
    total_orders: db.count('orders'),
    pending_count: db.count('orders', o => o.status === 'new'),
    completed_count: db.count('orders', o => o.status === 'completed'),
    menu_item_count: db.count('menu_items'),
    total_revenue: db.sum('orders', 'total'),
    today_revenue: db.sum('orders', 'total', o => o.created_at && o.created_at.startsWith(today)),
    today_orders: db.count('orders', o => o.created_at && o.created_at.startsWith(today)),
    week_revenue: db.sum('orders', 'total', o => o.created_at >= weekAgo),
    month_revenue: db.sum('orders', 'total', o => o.created_at >= monthAgo),
  };

  // Daily revenue
  const revenueByDay = {};
  db.all('orders', o => o.created_at >= monthAgo).forEach(o => {
    const day = (o.created_at || '').split('T')[0];
    if (!revenueByDay[day]) revenueByDay[day] = { day, orders: 0, revenue: 0 };
    revenueByDay[day].orders++;
    revenueByDay[day].revenue += o.total || 0;
  });
  stats.daily_revenue = Object.values(revenueByDay).sort((a, b) => b.day.localeCompare(a.day)).slice(0, 30);

  // Recent orders
  stats.recent_orders = db.sorted('orders', 'created_at', false).slice(0, 10).map(o => ({
    ...o, order_items: db.all('order_items', i => i.order_id === o.id)
  }));

  // Best sellers
  const soldMap = {};
  db.all('order_items').forEach(i => {
    if (!soldMap[i.menu_item_name]) soldMap[i.menu_item_name] = { menu_item_name: i.menu_item_name, times_ordered: 0, revenue: 0 };
    soldMap[i.menu_item_name].times_ordered += i.quantity;
    soldMap[i.menu_item_name].revenue += i.subtotal;
  });
  stats.best_sellers = Object.values(soldMap).sort((a, b) => b.times_ordered - a.times_ordered).slice(0, 5);

  res.json(stats);
});

/* ============================================================
   START
   ============================================================ */
seedIfEmpty();
app.listen(PORT, () => {
  console.log(`\n☕ Bolivar Coffee server running at http://localhost:${PORT}`);
  console.log(`   Customer site:   http://localhost:${PORT}/`);
  console.log(`   Admin login:     http://localhost:${PORT}/admin/login.html`);
  console.log(`   Admin dashboard: http://localhost:${PORT}/admin/index.html`);
  console.log(`\n   Default login:   admin@bolivar.coffee / admin123\n`);
});
