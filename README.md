# BOLIVAR Coffee & Lounge — Website + Admin Dashboard

Production-ready coffee shop website with a complete admin management system.
Built with Supabase (PostgreSQL + Auth + Storage + RLS) and vanilla HTML/CSS/JavaScript.

```
index.html                  → Customer-facing website
order.html                  → Order confirmation page
css/style.css               → Customer site styles + cart/order styles
js/main.js                  → Customer site interactions + dynamic loading
js/supabase.js              → Supabase client config
js/api.js                   → Data API layer (menu, orders, reviews, etc.)
js/cart.js                  → Shopping cart with localStorage
js/order.js                 → Order form + submission
admin/login.html            → Admin login page
admin/index.html            → Admin dashboard SPA
admin/css/admin.css         → Admin dashboard styles
admin/js/admin.js           → Admin dashboard logic
supabase/migrations/        → Database schema + RLS policies
scripts/setup.js            → First admin creation script
scripts/seed.js             → Database seed script
```

---

## 🚀 Quick Start

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click **"New Project"** and fill in:
   - Organization: your org
   - Project name: `bolivar-coffee`
   - Database password: (choose a strong password)
   - Region: closest to Tunisia (EU West recommended)
3. Wait for the project to be created (1-2 minutes)

### 2. Set Up the Database

1. In the Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Open the file `supabase/migrations/001_initial_schema.sql` from this repo
3. Copy the entire contents and paste into the SQL Editor
4. Click **"Run"** to execute the migration
5. Go to **Storage** and create three buckets:
   - `menu-images` (public)
   - `gallery` (public)
   - `uploads` (public)

### 3. Configure Environment Variables

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
2. Open `.env.local` and fill in your Supabase credentials:
   - `SUPABASE_URL` — from Settings → API → Project URL
   - `SUPABASE_ANON_KEY` — from Settings → API → anon/public key
   - `SUPABASE_SERVICE_ROLE_KEY` — from Settings → API → service_role key (SECRET!)

3. Update the frontend config files with your Supabase URL and anon key:
   - `js/supabase.js` — replace `YOUR_SUPABASE_URL` and `YOUR_SUPABASE_ANON_KEY`
   - `admin/login.html` — same values (near the bottom, in the script tag)
   - `admin/js/admin.js` — same values (at the top of the file)

### 4. Install Dependencies & Create Admin

```bash
npm install
npm run setup
```

This will:
- Prompt you for an admin email and password
- Create the admin user in Supabase Auth
- Set up the admin profile in the database
- Create storage buckets

### 5. Seed the Menu

```bash
npm run seed
```

This populates the database with all the menu items from the existing site (33 items across 7 categories) and gallery images.

### 6. Run Locally

```bash
npm run dev
```

Open `http://localhost:3000` to see the customer website.
Open `http://localhost:3000/admin/login.html` to access the admin dashboard.

---

## 📊 Database Structure

| Table | Description |
|-------|-------------|
| `profiles` | Admin/staff user profiles (extends Supabase Auth) |
| `menu_categories` | Menu categories (Coffee, Breakfast, Crêpes, etc.) |
| `menu_items` | Menu items with name, description, price, image |
| `orders` | Customer orders with status tracking |
| `order_items` | Individual items within an order |
| `reviews` | Customer reviews (approval workflow) |
| `gallery_images` | Gallery photos with captions |
| `business_settings` | Key-value store for business info |
| `notifications` | In-app notification system |

**Views:**
- `order_stats` — Aggregated order statistics for the dashboard
- `menu_item_stats` — Sales statistics per menu item
- `daily_revenue` — Revenue breakdown by day

---

## 🔐 How to Access Admin

1. Navigate to `/admin/login.html`
2. Enter your admin email and password
3. You'll be redirected to the dashboard

The admin dashboard has these sections:
- **Dashboard** — Overview with revenue, orders, pending count, charts
- **Menu** — Add/edit/delete menu items, toggle availability, mark featured
- **Orders** — View all orders, filter by status, update order status
- **Reviews** — Approve, hide, or delete customer reviews
- **Gallery** — Upload and manage gallery images
- **Settings** — Edit business name, phone, hours, social links, maps

---

## 👤 How to Create the First Admin

```bash
npm run setup
```

The script will ask for:
- Email address
- Password (minimum 8 characters)
- Full name (optional)

**For additional admins:** Create them via the Supabase dashboard:
1. Go to Authentication → Users
2. Click "Add User"
3. Enter email and password
4. Then update their profile in the `profiles` table to set `role = 'admin'`

---

## 🔧 Environment Variables

| Variable | Where | Description |
|----------|-------|-------------|
| `SUPABASE_URL` | .env.local | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | .env.local + js/supabase.js + admin files | Public anon key (safe for browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | .env.local ONLY | Secret key (never in browser code!) |

**Where each value is used:**
- `.env.local` — setup and seed scripts (service role key)
- `js/supabase.js` — customer website (anon key only)
- `admin/login.html` — admin login (anon key only)
- `admin/js/admin.js` — admin dashboard (anon key only)

---

## 🛒 How Orders Work

1. **Customer** browses the menu (fetched from database)
2. Clicks **+** on items to add to cart (cart stored in localStorage)
3. Opens cart, reviews items, adjusts quantities
4. Clicks **PLACE ORDER** → fills in name + phone + optional notes
5. Order is saved to the database with all items
6. Customer sees confirmation page with order number
7. **Admin** receives a notification and sees the new order in the dashboard
8. Admin updates order status: New → Confirmed → Preparing → Ready → Completed

---

## 🍽️ How Menu Changes Propagate

1. Admin edits a menu item (name, price, description, availability) in the dashboard
2. Changes are saved to the `menu_items` table in Supabase
3. When a customer visits the website, `js/main.js` loads menu items from the database
4. The customer sees the updated information immediately

Example: Admin changes Cappuccino from 5.000 DT → 6.000 DT
→ Customer website shows 6.000 DT on next page load

---

## 🚢 Deployment

### Option A: Static Hosting + Supabase (Recommended)

This project can be deployed as static files to any hosting provider:

1. **Deploy files** to Vercel, Netlify, Cloudflare Pages, or any static host
2. **Configure Supabase** — update `js/supabase.js`, `admin/login.html`, and `admin/js/admin.js` with production Supabase URL and anon key
3. **Set up admin** — run `npm run setup` and `npm run seed` locally before deploying
4. **Configure RLS** — ensure all RLS policies are active in Supabase

### Option B: Node.js Server

```bash
# On your server
git clone <repo>
cd bolivar-coffee
npm install
cp .env.example .env.local  # fill in values
npm run setup
npm run seed
npx serve . -l 3000
```

### Production Checklist

- [ ] Supabase project created and configured
- [ ] Database migration executed
- [ ] Storage buckets created (menu-images, gallery, uploads)
- [ ] Environment variables configured
- [ ] First admin user created
- [ ] Menu items seeded
- [ ] Supabase URL and anon key updated in all config files
- [ ] SSL/HTTPS enabled
- [ ] Custom domain configured
- [ ] Google Maps embed updated with correct coordinates
- [ ] Glovo link updated with direct store URL
- [ ] Instagram link verified
- [ ] Phone number verified

---

## 🔒 Security

- **Authentication:** Supabase Auth with email/password
- **Authorization:** Row Level Security (RLS) on all tables
- **Admin protection:** RLS policies check `auth.uid()` + role in `profiles`
- **No secrets in frontend:** Anon key is public by design; service role key only in setup scripts
- **Input validation:** Server-side via RLS constraints and client-side forms
- **File uploads:** Supabase Storage with type and size restrictions
- **Session management:** Handled by Supabase Auth client

---

## 📱 Mobile

The admin dashboard is fully responsive:
- Sidebar collapses to a hamburger menu on mobile
- Tables scroll horizontally
- Forms stack vertically
- Modals adapt to screen size
- All actions accessible from a phone

---

## 🧪 Testing Checklist

After setup, verify:

- [ ] Admin login works at `/admin/login.html`
- [ ] Unauthorized users cannot access `/admin/index.html`
- [ ] Dashboard shows correct stats
- [ ] Can add a new menu item
- [ ] Can edit a menu item (name, price, description)
- [ ] Can delete a menu item
- [ ] Can toggle item availability
- [ ] Menu item changes appear on customer website
- [ ] Can add to cart on customer site
- [ ] Cart persists across page loads
- [ ] Can submit an order
- [ ] Order appears in admin dashboard
- [ ] Can change order status
- [ ] Notifications appear for new orders
- [ ] Can approve/hide/delete reviews
- [ ] Can upload gallery images
- [ ] Can update business settings
- [ ] Mobile layout works for admin
- [ ] Mobile layout works for customer site
- [ ] Logout works correctly

---

## Verified Business Facts

- **Address:** 87 Av. de la République, Megrine 2033, Tunisia
- **Phone:** +216 22 535 138
- **Hours:** Monday–Sunday, 07:00–00:00
- **Google Rating:** 4.7 / 5 (24 reviews)
- **Instagram:** @bolivar_coffeee
- **Delivery:** Available on Glovo
