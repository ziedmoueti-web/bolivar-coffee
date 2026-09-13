/* ============================================================
   BOLIVAR COFFEE — In-memory demo backend
   ------------------------------------------------------------
   Active only when DEMO_MODE=true. Provides a Supabase-
   compatible client backed by in-memory data so the whole site
   and admin dashboard work locally with no Supabase project.

   EVERYTHING is read-only. Writes succeed against memory and
   are lost on restart. Nothing here touches the network.
   ============================================================ */

const crypto = require('crypto');

/* ------------------------------------------------------------
   Demo data — mirrors the real Supabase schema
   ------------------------------------------------------------ */
const db = {
  profiles: [
    {
      id: 'demo-admin-0000-0000-0000-000000000001',
      email: 'admin@demo.local',
      full_name: 'Demo Admin',
      role: 'admin',
    },
  ],
  menu_categories: [
    { id: 'cat-1', name: 'Coffee', slug: 'coffee', is_active: true, display_order: 1 },
    { id: 'cat-2', name: 'Breakfast', slug: 'breakfast', is_active: true, display_order: 2 },
    { id: 'cat-3', name: 'Food', slug: 'food', is_active: true, display_order: 3 },
    { id: 'cat-4', name: 'Desserts', slug: 'desserts', is_active: true, display_order: 4 },
  ],
  menu_items: [
    { id: 'mi-1', category_id: 'cat-1', name: 'Espresso', description: 'Short, intense, velvety crema.', price: 2.2, image_url: 'https://images.unsplash.com/photo-1510707577719-ae7c14805e3a?auto=format&fit=crop&w=400&q=60', is_available: true, is_featured: true, display_order: 1 },
    { id: 'mi-2', category_id: 'cat-1', name: 'Cappuccino', description: 'Equal parts espresso, milk and foam.', price: 3.5, image_url: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&w=400&q=60', is_available: true, is_featured: false, display_order: 2 },
    { id: 'mi-3', category_id: 'cat-1', name: 'Café Latte', description: 'Smooth espresso with silky steamed milk.', price: 4.0, image_url: 'https://images.unsplash.com/photo-1561047029-3000c68339ca?auto=format&fit=crop&w=400&q=60', is_available: true, is_featured: true, display_order: 3 },
    { id: 'mi-4', category_id: 'cat-2', name: 'Petit Déjeuner Continental', description: 'Bread, butter, jam, eggs, hot drink.', price: 9.5, image_url: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=400&q=60', is_available: true, is_featured: true, display_order: 4 },
    { id: 'mi-5', category_id: 'cat-2', name: 'Avocado Toast', description: 'Smashed avocado, poached egg, sourdough.', price: 11.0, image_url: 'https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?auto=format&fit=crop&w=400&q=60', is_available: true, is_featured: false, display_order: 5 },
    { id: 'mi-6', category_id: 'cat-3', name: 'Escalope Pané', description: 'Breaded veal escalope, fries, salad.', price: 16.5, image_url: 'https://images.unsplash.com/photo-1604382205937-95a4b1e0e4a6?auto=format&fit=crop&w=400&q=60', is_available: true, is_featured: true, display_order: 6 },
    { id: 'mi-7', category_id: 'cat-4', name: 'Crêpe Chocolat', description: 'Warm, soft, full of chocolate.', price: 8.0, image_url: 'https://images.unsplash.com/photo-1519676867240-f03562e64548?auto=format&fit=crop&w=400&q=60', is_available: true, is_featured: false, display_order: 7 },
    { id: 'mi-8', category_id: 'cat-4', name: 'Tiramisu', description: 'Mascarpone, coffee, cocoa — house-made.', price: 9.0, image_url: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=400&q=60', is_available: false, is_featured: false, display_order: 8 },
  ],
  reviews: [
    { id: 'rev-1', customer_name: 'Amine', rating: 5, content: 'Propreté, décor minimaliste, serveurs polis et ambiance calme.', source: 'google', is_approved: true, is_featured: false, created_at: '2026-09-01T10:00:00Z' },
    { id: 'rev-2', customer_name: 'Sara', rating: 5, content: 'Petit déjeuner délicieux avec une bonne ambiance cozy.', source: 'google', is_approved: true, is_featured: true, created_at: '2026-09-02T10:00:00Z' },
    { id: 'rev-3', customer_name: 'Mehdi', rating: 4, content: 'Un passage pour déguster une tasse de thé, superbe surprise.', source: 'website', is_approved: false, is_featured: false, created_at: '2026-09-10T10:00:00Z' },
  ],
  gallery_images: [
    { id: 'g-1', title: 'Espresso', caption: 'House espresso', image_url: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=600&q=60', is_active: true, display_order: 1 },
    { id: 'g-2', title: 'Interior', caption: 'Calm lounge seating', image_url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=600&q=60', is_active: true, display_order: 2 },
    { id: 'g-3', title: 'Dessert', caption: 'Crêpe chocolat', image_url: 'https://images.unsplash.com/photo-1519676867240-f03562e64548?auto=format&fit=crop&w=600&q=60', is_active: true, display_order: 3 },
  ],
  business_settings: [
    { key: 'google_rating', value: '4.7', updated_at: '2026-09-01T00:00:00Z' },
    { key: 'google_review_count', value: '128', updated_at: '2026-09-01T00:00:00Z' },
    { key: 'instagram_handle', value: '@bolivar_coffeee', updated_at: '2026-09-01T00:00:00Z' },
  ],
};

const DEMO_PROFILE = db.profiles[0];
const DEMO_PASSWORD = 'demo1234';

/* ------------------------------------------------------------
   Query builder — implements the subset of the PostgREST-style
   chainable API that server.js actually uses:
   select / eq / order / insert / update / delete / upsert /
   maybeSingle / single, plus a terminal thenable (await-able).
   ------------------------------------------------------------ */
function makeQuery(table) {
  const state = {
    op: 'select',
    filters: [],
    selectStr: '*',
    payload: null,
    options: null,
    orderBy: null,
    orderAsc: true,
    countMode: null,
  };

  function rowsForRead() {
    let rows = db[table] ? db[table].map((r) => ({ ...r })) : [];
    if (state.selectStr.includes('!inner')) {
      // menu_items joined with menu_categories
      rows = rows.map((r) => {
        const cat = db.menu_categories.find((c) => c.id === r.category_id);
        return { ...r, menu_categories: cat ? { ...cat } : null };
      });
    }
    for (const f of state.filters) {
      rows = rows.filter((r) => {
        // Support dotted paths like 'menu_categories.slug'
        const val = f.col.split('.').reduce((o, k) => (o ? o[k] : undefined), r);
        return val === f.val;
      });
    }
    if (state.orderBy) {
      rows.sort((a, b) => {
        const av = a[state.orderBy], bv = b[state.orderBy];
        const cmp = av === bv ? 0 : av > bv ? 1 : -1;
        return state.orderAsc ? cmp : -cmp;
      });
    }
    return rows;
  }

  const q = {
    select(str, opts) {
      state.selectStr = str || '*';
      if (opts && opts.count) state.countMode = opts.count;
      return q;
    },
    eq(col, val) {
      state.filters.push({ col, val });
      return q;
    },
    order(col, opts) {
      state.orderBy = col;
      state.orderAsc = !(opts && opts.ascending === false);
      return q;
    },
    insert(payload) {
      state.op = 'insert';
      state.payload = payload;
      return q;
    },
    update(payload) {
      state.op = 'update';
      state.payload = payload;
      return q;
    },
    upsert(payload, options) {
      state.op = 'upsert';
      state.payload = payload;
      state.options = options || null;
      return q;
    },
    delete() {
      state.op = 'delete';
      return q;
    },
    single() {
      return thenable(true);
    },
    maybeSingle() {
      return thenable(true);
    },
    then(onRes, onRej) {
      return thenable(false).then(onRes, onRej);
    },
  };

  function thenable(expectsOne) {
    const p = new Promise((resolve) => {
      setImmediate(() => resolve(execute(expectsOne)));
    });
    return {
      then: p.then.bind(p),
      catch: p.catch.bind(p),
      _promise: p,
    };
  }

  async function execute(expectsOne) {
    const table_ = table;
    if (state.op === 'select') {
      let rows = rowsForRead();
      if (state.countMode === 'exact' || state.countMode === 'planned') {
        return { data: rows, error: null, count: rows.length };
      }
      if (expectsOne) {
        return { data: rows[0] || null, error: rows.length ? null : { message: 'Row not found' } };
      }
      return { data: rows, error: null };
    }
    if (state.op === 'insert') {
      const incoming = Array.isArray(state.payload) ? state.payload : [state.payload];
      const created = incoming.map((item, i) => ({
        id: `${table_.slice(0, 3)}-${Date.now()}-${i}-${crypto.randomBytes(3).toString('hex')}`,
        created_at: new Date().toISOString(),
        ...item,
      }));
      db[table_].push(...created);
      return { data: created.length === 1 ? created[0] : created, error: null };
    }
    if (state.op === 'update') {
      const targets = applyFilters(db[table_] || []);
      targets.forEach((r) => Object.assign(r, state.payload));
      return { data: null, error: null };
    }
    if (state.op === 'upsert') {
      const incoming = Array.isArray(state.payload) ? state.payload : [state.payload];
      const conflictKey = (state.options && state.options.onConflict) || 'id';
      incoming.forEach((item) => {
        const idx = db[table_].findIndex((r) => r[conflictKey] === item[conflictKey]);
        if (idx >= 0) db[table_][idx] = { ...db[table_][idx], ...item };
        else {
          db[table_].push({ id: `${table_.slice(0, 3)}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`, ...item });
        }
      });
      return { data: null, error: null };
    }
    if (state.op === 'delete') {
      const targets = applyFilters(db[table_] || []);
      db[table_] = db[table_].filter((r) => !targets.includes(r));
      return { data: null, error: null };
    }
    return { data: null, error: { message: 'Unsupported op ' + state.op } };
  }

  function applyFilters(rows) {
    let out = rows;
    for (const f of state.filters) {
      out = out.filter((r) => {
        const val = f.col.split('.').reduce((o, k) => (o ? o[k] : undefined), r);
        return val === f.val;
      });
    }
    return out;
  }

  return q;
}

/* ------------------------------------------------------------
   The Supabase-compatible client
   ------------------------------------------------------------ */
function createDemoClient() {
  const client = {
    from(table) {
      return makeQuery(table);
    },
    auth: {
      async signInWithPassword({ email, password }) {
        const match =
          String(email).trim().toLowerCase() === DEMO_PROFILE.email &&
          password === DEMO_PASSWORD;
        if (!match) {
          return { data: null, error: { message: 'Invalid login credentials' } };
        }
        return {
          data: {
            user: { id: DEMO_PROFILE.id, email: DEMO_PROFILE.email },
            session: { access_token: 'demo-session-token' },
          },
          error: null,
        };
      },
      admin: {
        async signOut() {
          return { error: null };
        },
      },
    },
    storage: {
      from(bucket) {
        return {
          async upload() {
            return { data: { path: `demo/${bucket}/uploaded.png` }, error: null };
          },
          getPublicUrl(path) {
            return { data: { publicUrl: `data:image/png;base64,DEMO_NO_STORAGE` } };
          },
        };
      },
    },
  };
  return client;
}

module.exports = { createDemoClient, DEMO_PROFILE, DEMO_PASSWORD };
