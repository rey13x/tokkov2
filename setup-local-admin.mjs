#!/usr/bin/env node
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'tokko.db');

async function setupLocalAdmin() {
  try {
    const db = new Database(dbPath);
    
    console.log('🔧 Setting up local admin account...');
    console.log(`📁 Database: ${dbPath}`);
    
    const adminEmail = 'digitalawanku2@gmail.com';
    const adminPassword = 'Ayiamessi139087z';
    
    // Check if user exists
    const existingUser = db.prepare('SELECT id, role FROM users WHERE email = ?').get(adminEmail);
    
    if (existingUser) {
      console.log(`✏️  User with email ${adminEmail} already exists (ID: ${existingUser.id})`);
      
      // Update to admin role if not already
      if (existingUser.role !== 'admin') {
        db.prepare('UPDATE users SET role = ? WHERE id = ?').run('admin', existingUser.id);
        console.log('✅ Updated user role to admin');
      } else {
        console.log('✅ User already has admin role');
      }
    } else {
      // Create new admin user
      console.log(`✏️  Creating new admin user with email: ${adminEmail}`);
      const userId = crypto.randomUUID();
      const now = Date.now();
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      
      db.prepare(`
        INSERT INTO users (id, username, email, phone, password_hash, role, avatar_url, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(userId, 'Admin Tokko', adminEmail, '', passwordHash, 'admin', '', now, now);
      
      console.log('✅ Admin user created successfully');
    }
    
    // Ensure email is in admin_emails table
    const existingAdminEmail = db.prepare(
      'SELECT id FROM admin_emails WHERE lower(email) = lower(?)'
    ).get(adminEmail);
    
    if (!existingAdminEmail) {
      console.log(`✏️  Adding email to admin_emails table`);
      const adminEmailId = crypto.randomUUID();
      const now = Date.now();
      
      db.prepare(`
        INSERT INTO admin_emails (id, email, created_at)
        VALUES (?, ?, ?)
      `).run(adminEmailId, adminEmail, now);
      
      console.log('✅ Email added to admin_emails');
    } else {
      console.log('✅ Email already in admin_emails');
    }
    
    db.close();
    
    console.log('\n✅ Setup complete!');
    console.log(`📧 Email: ${adminEmail}`);
    console.log(`🔐 Password: ${adminPassword}`);
    console.log('\n🌐 Try login at http://localhost:3000/auth');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

setupLocalAdmin();
