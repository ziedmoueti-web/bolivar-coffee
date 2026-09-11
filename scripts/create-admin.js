#!/usr/bin/env node
/* ============================================================
   BOLIVAR COFFEE — Create / reset the admin login
   ------------------------------------------------------------
   Creates (or updates) the admin user in Supabase Auth with the
   given email + password, confirms the email, and ensures the
   matching profile has the 'admin' role.

   Usage:
     npm run create-admin
     # or override the defaults:
     ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=secret npm run create-admin

   Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.
   ============================================================ */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const EMAIL = (process.env.ADMIN_EMAIL || 'admin@gmail.com').trim();
const PASSWORD = process.env.ADMIN_PASSWORD || 'admin.123';
const FULL_NAME = process.env.ADMIN_FULL_NAME || 'Admin';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)) {
  console.error(`❌ SUPABASE_URL does not look like a real Supabase project: ${url}`);
  console.error('   Open .env and paste your real project URL + service role key, then re-run.');
  process.exit(1);
}

if (PASSWORD.length < 8) {
  console.warn('⚠ Password is shorter than 8 characters (weak).');
}

// Service-role client (server-side only).
const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

async function main() {
  // 1. Find an existing user with this email.
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) throw listError;

  const existing = (users || []).find(u => u.email && u.email.toLowerCase() === EMAIL.toLowerCase());

  if (existing) {
    const { error: updErr } = await supabase.auth.admin.updateUserById(existing.id, {
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { ...(existing.user_metadata || {}), role: 'admin', full_name: FULL_NAME }
    });
    if (updErr) throw updErr;
    console.log(`✓ Updated existing admin user: ${EMAIL}`);
  } else {
    const { data, error: createErr } = await supabase.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { role: 'admin', full_name: FULL_NAME }
    });
    if (createErr) throw createErr;
    console.log(`✓ Created admin user: ${EMAIL} (${data.user.id})`);
  }

  // 2. Ensure the profile row has the admin role.
  const { data: prof, error: profErr } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('email', EMAIL)
    .maybeSingle();
  if (profErr) throw profErr;

  if (prof) {
    if (prof.role !== 'admin') {
      const { error: roleErr } = await supabase.from('profiles').update({ role: 'admin' }).eq('id', prof.id);
      if (roleErr) throw roleErr;
      console.log('✓ Promoted profile role to admin');
    } else {
      console.log('✓ Profile already has admin role');
    }
  } else {
    console.log('⚠ No profile row found for ' + EMAIL + ' — the on_auth_user_created trigger creates it automatically.');
  }

  console.log('\n──────────────────────────────────────────────');
  console.log('  Admin login ready:');
  console.log(`    Email:    ${EMAIL}`);
  console.log(`    Password: ${PASSWORD}`);
  console.log('──────────────────────────────────────────────');
}

main().catch(e => {
  console.error('❌ Failed:', e.message);
  process.exit(1);
});
