#!/usr/bin/env node
import { createClient } from '@libsql/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env.local manually
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');

const env = {};
envContent.split('\n').forEach(line => {
  if (line.trim() && !line.startsWith('#')) {
    const eqIndex = line.indexOf('=');
    if (eqIndex !== -1) {
      const key = line.substring(0, eqIndex).trim();
      let value = line.substring(eqIndex + 1).trim();
      // Remove quotes if present
      value = value.replace(/^"(.*)"$/, '$1').trim();
      // Remove any trailing whitespace/newlines
      value = value.replace(/\s+$/, '');
      env[key] = value;
    }
  }
});

const tursoUrl = (env.TURSO_URL || process.env.TURSO_URL || '').trim();
const tursoToken = (env.TURSO_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || '').trim();

console.log('🔍 Debug info:');
console.log('  TURSO_URL:', tursoUrl ? `${tursoUrl.substring(0, 30)}...` : 'NOT SET');
console.log('  TURSO_AUTH_TOKEN length:', tursoToken.length);
console.log('  Token start:', tursoToken.substring(0, 50));

if (!tursoUrl || !tursoToken) {
  console.error('❌ Error: TURSO_URL or TURSO_AUTH_TOKEN not found');
  console.error('TURSO_URL:', tursoUrl);
  console.error('TURSO_AUTH_TOKEN length:', tursoToken?.length);
  process.exit(1);
}

const db = createClient({
  url: tursoUrl,
  authToken: tursoToken,
});

async function setupTursoAdmin() {
  const adminEmail = 'digitalawanku2@gmail.com';
  const adminPassword = 'Ayiamessi139087z';
  
  try {
    console.log('🔧 Setting up admin user in TURSO database...');
    console.log(`📍 Database URL: ${tursoUrl}`);
    
    // Check if user exists
    const existingUser = await db.execute({
      sql: `SELECT id, role FROM users WHERE email = ?`,
      args: [adminEmail]
    });
    
    if (existingUser.rows.length === 0) {
      // Create new user
      console.log(`✏️  Creating new user with email: ${adminEmail}`);
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      const userId = crypto.randomUUID();
      const now = Date.now();
      
      await db.execute({
        sql: `INSERT INTO users (id, username, email, phone, password_hash, role, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [userId, 'Admin Tokko', adminEmail, '', passwordHash, 'admin', now, now]
      });
      console.log('✅ User created successfully');
    } else {
      const user = existingUser.rows[0];
      console.log(`✏️  User already exists with ID: ${user.id}, current role: ${user.role}`);
      
      // Update password hash and role
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      await db.execute({
        sql: `UPDATE users SET password_hash = ?, role = ?, updated_at = ? WHERE id = ?`,
        args: [passwordHash, 'admin', Date.now(), user.id]
      });
      console.log('✅ Updated user password and role to admin');
    }
    
    // Ensure email is in admin_emails table
    const existingAdmin = await db.execute({
      sql: `SELECT id FROM admin_emails WHERE lower(email) = lower(?)`,
      args: [adminEmail]
    });
    
    if (existingAdmin.rows.length === 0) {
      console.log(`✏️  Adding email to admin_emails table`);
      const adminId = crypto.randomUUID();
      const now = Date.now();
      
      await db.execute({
        sql: `INSERT INTO admin_emails (id, email, created_at) VALUES (?, ?, ?)`,
        args: [adminId, adminEmail, now]
      });
      console.log('✅ Email added to admin_emails');
    } else {
      console.log('✅ Email already in admin_emails');
    }
    
    console.log('\n✅ Turso admin setup complete!');
    console.log(`📧 Email: ${adminEmail}`);
    console.log(`🔐 Password: ${adminPassword}`);
    console.log(`🌐 Now you can login at https://tokkov2.vercel.app/auth or http://localhost:3000/auth`);
    console.log('\n💡 Admin will work both locally AND on production!');
    
  } catch (e) {
    console.error('❌ Error:', e.message);
    console.error('Stack:', e.stack);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

setupTursoAdmin();
