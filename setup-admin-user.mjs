import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { createClient } from '@libsql/client';

const db = createClient({
  url: 'file:./tokko.db',
});

async function setupAdminUser() {
  const adminEmail = 'digitalawanku2@gmail.com';
  const adminPassword = 'Ayiamessi139087z';
  
  try {
    console.log('🔧 Setting up admin user...');
    
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
        args: [userId, 'Admin Tokko', adminEmail, '08123456789', passwordHash, 'user', now, now]
      });
      console.log('✅ User created successfully');
    } else {
      const user = existingUser.rows[0];
      console.log(`✏️  User already exists with ID: ${user.id}, current role: ${user.role}`);
      
      // Update to admin role if not already
      if (user.role !== 'admin') {
        await db.execute({
          sql: `UPDATE users SET role = ? WHERE id = ?`,
          args: ['admin', user.id]
        });
        console.log('✅ Updated user role to admin');
      }
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
    
    console.log('\n✅ Admin setup complete!');
    console.log(`📧 Email: ${adminEmail}`);
    console.log(`🔐 Password: ${adminPassword}`);
    console.log(`\n🌐 Try login at http://localhost:3000/auth (or http://localhost:3001/auth)`);
    
  } catch (e) {
    console.error('❌ Error:', e.message);
  } finally {
    process.exit(0);
  }
}

setupAdminUser();
