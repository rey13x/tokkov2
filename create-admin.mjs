import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { createClient } from '@libsql/client';

const db = createClient({
  url: 'file:./tokko.db',
});

async function createAdmin() {
  const passwordHash = await bcrypt.hash('admin123456', 10);
  const id = crypto.randomUUID();
  const now = Date.now();
  
  try {
    await db.execute({
      sql: `INSERT INTO users (id, username, email, phone, password_hash, role, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, 'Admin Tokko', 'admin@tokko.com', '08123456789', passwordHash, 'admin', now, now]
    });
    
    const adminId = crypto.randomUUID();
    await db.execute({
      sql: `INSERT INTO admin_emails (id, email, created_at) VALUES (?, ?, ?)`,
      args: [adminId, 'admin@tokko.com', now]
    });
    
    console.log('✅ Admin user created!');
    console.log('Email: admin@tokko.com');
    console.log('Password: admin123456');
  } catch (e) {
    console.error('Error:', e.message);
  }
}

createAdmin();
