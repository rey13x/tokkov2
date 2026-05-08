import { createClient } from '@libsql/client';
import bcrypt from 'bcryptjs';

const client = createClient({
  url: process.env.TURSO_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function checkAdmin() {
  try {
    console.log('Checking admin user in database...');

    // Check admin_emails table
    const adminEmails = await client.execute('SELECT * FROM admin_emails');
    console.log('Admin emails:', adminEmails.rows);

    // Check users table for admin user
    const users = await client.execute('SELECT id, email, role, password_hash FROM users WHERE email = ?', ['digitalawanku2@gmail.com']);
    console.log('Users with admin email:', users.rows);

    if (users.rows.length > 0) {
      const user = users.rows[0];
      console.log('Found user:', user);

      // Check if password hash exists
      if (!user.password_hash) {
        console.log('No password hash found. Setting password...');

        // Hash the password
        const password = 'Ayiamessi139087z';
        const hashedPassword = await bcrypt.hash(password, 10);

        // Update user with password hash
        await client.execute('UPDATE users SET password_hash = ? WHERE id = ?', [hashedPassword, user.id]);

        console.log('Password hash set successfully!');
      } else {
        console.log('Password hash already exists');

        // Test password verification
        const isValid = await bcrypt.compare('Ayiamessi139087z', user.password_hash);
        console.log('Password verification:', isValid);
      }
    }

  } catch (error) {
    console.error('Error checking admin:', error);
  } finally {
    await client.close();
  }
}

checkAdmin();