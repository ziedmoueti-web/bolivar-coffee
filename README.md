# BOLIVAR Coffee & Lounge — Website + Admin Dashboard

Production-ready coffee shop website with admin management system.

## Stack

```
Frontend:     HTML / CSS / JavaScript (vanilla, no framework)
Backend:      Node.js / Express
Database:     Supabase PostgreSQL
Auth:         Supabase Auth
Storage:      Supabase Storage (for image uploads)
```

## Architecture

```
Customer Browser → Express API → Supabase PostgreSQL
Admin Browser   → Express API (JWT auth) → Supabase PostgreSQL + Storage
```

- **No Supabase client in frontend code** — all database access goes through the Express server
- **Service role key stays server-side only** — never exposed to browsers
- **Prices calculated server-side** — client cannot manipulate order totals
- **Order tracking uses secure tokens** — not sequential IDs

---

## Local Development

### Prerequisites

- Node.js 18+
- A Supabase project (free tier works)

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment

```bash
cp .env.example .env
```

Edit `.env` with your Supabase credentials:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=your-random-secret-string
```

### 3. Set up Supabase database

1. Go to your Supabase dashboard → SQL Editor
2. Open `supabase/migrations/001_initial_schema.sql`
3. Paste and run the entire SQL

### 4. Create storage buckets

In Supabase dashboard → Storage:
- Create bucket: `menu-images` (public)
- Create bucket: `gallery-images` (public)

### 5. Create admin user

In Supabase dashboard → Authentication → Users:
- Click "Add User"
- Enter email and password
- The user profile will be auto-created with role "admin"

### 6. Start the server

```bash
npm run dev
```

Open:
- Customer site: http://localhost:3000
- Admin login: http://localhost:3000/admin/login.html
- Admin dashboard: http://localhost:3000/admin/index.html

---

## Deployment

### Environment Variables

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | Set to `production` |
| `PORT` | Server port (default: 3000) |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Your Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key (SECRET) |
| `JWT_SECRET` | Strong random string for JWT signing |
| `FRONTEND_URL` | Your production URL (for CORS) |

### Deploy Options

**Vercel / Railway / Render:**
1. Push to GitHub
2. Connect repository
3. Set environment variables
4. Deploy

**VPS / Traditional hosting:**
```bash
git clone <repo>
cd bolivar-coffee
npm install
# Set .env
npm start
```

Use PM2 or similar for process management:
```bash
pm2 start server.js --name bolivar
```

---

## Admin Access

### Login

Navigate to `/admin/login.html` and sign in with the credentials you created in Supabase Auth.

### Dashboard Features

- **Dashboard** — Revenue, orders, pending count, charts
- **Menu** — Add/edit/delete items, toggle availability, mark featured
- **Orders** — View all orders, change status (New → Confirmed → Preparing → Ready → Completed)
- **Reviews** — Approve, hide, delete customer reviews
- **Gallery** — Add/delete images
- **Settings** — Edit business info (phone, address, hours, Instagram, etc.)

---

## Customer Features

- Browse menu with category tabs
- Add items to cart
- Place order (name + phone + notes)
- Receive order confirmation with tracking token
- Track order status via token

---

## Security

- Admin authentication via Supabase Auth + JWT
- All admin API endpoints require valid JWT + admin role
- Order prices calculated server-side from database (client cannot manipulate)
- Order tracking uses cryptographically random tokens (not sequential IDs)
- Rate limiting on login (5/min), orders (10/hr), reviews (3/hr)
- Security headers via Helmet
- Input sanitization on all user inputs
- XSS protection via HTML escaping in admin dashboard
- CORS configured for production URL
- Service role key never exposed to frontend

---

## Database Schema

| Table | Purpose |
|-------|---------|
| `profiles` | Admin/staff user profiles |
| `menu_categories` | Menu categories (Coffee, Breakfast, etc.) |
| `menu_items` | Menu items with prices |
| `orders` | Customer orders with tracking tokens |
| `order_items` | Line items per order |
| `reviews` | Customer reviews |
| `gallery_images` | Gallery photos |
| `business_settings` | Key-value business config |

---

## API Routes

### Public

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/menu` | Get available menu items |
| GET | `/api/categories` | Get active categories |
| GET | `/api/reviews` | Get approved reviews |
| POST | `/api/reviews` | Submit a review |
| GET | `/api/gallery` | Get active gallery images |
| GET | `/api/settings` | Get business settings |
| POST | `/api/orders` | Create an order |
| GET | `/api/orders/track/:token` | Track order by token |

### Admin (requires JWT)

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/login` | Admin login |
| GET | `/api/auth/me` | Get current user |
| GET | `/api/admin/dashboard` | Dashboard stats |
| GET | `/api/admin/orders` | List all orders |
| GET | `/api/admin/orders/:id` | Get order details |
| PATCH | `/api/admin/orders/:id` | Update order status |
| GET | `/api/admin/menu` | List all menu items |
| POST | `/api/admin/menu` | Create menu item |
| PATCH | `/api/admin/menu/:id` | Update menu item |
| DELETE | `/api/admin/menu/:id` | Delete menu item |
| GET | `/api/admin/reviews` | List all reviews |
| PATCH | `/api/admin/reviews/:id` | Update review |
| DELETE | `/api/admin/reviews/:id` | Delete review |
| GET | `/api/admin/gallery` | List all gallery images |
| POST | `/api/admin/gallery` | Add gallery image |
| DELETE | `/api/admin/gallery/:id` | Delete gallery image |
| GET | `/api/admin/settings` | Get settings |
| PATCH | `/api/admin/settings` | Update settings |
| POST | `/api/admin/upload` | Upload image |

---

## Verified Business Facts

- **Address:** 87 Av. de la République, Megrine 2033, Tunisia
- **Phone:** +216 22 535 138
- **Hours:** Monday–Sunday, 07:00–00:00
- **Google Rating:** 4.7 / 5 (24 reviews)
- **Instagram:** @bolivar_coffeee
- **Delivery:** Available on Glovo
