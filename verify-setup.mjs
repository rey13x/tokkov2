#!/usr/bin/env node
/**
 * 🔍 Admin & Sign-Up Verification Script
 * Checks if system is properly configured for admin login and user registration
 * 
 * Usage: node verify-setup.mjs
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@libsql/client';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

console.log('🔍 Tokko Admin & Sign-Up Setup Verification\n');
console.log('=' .repeat(50));

let hasErrors = false;

// 1. Check .env.local exists
console.log('\n📋 1. Checking environment files...');
const envLocalPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envLocalPath)) {
  console.log('   ✅ .env.local found');
} else {
  console.log('   ❌ .env.local not found');
  hasErrors = true;
}

// 2. Check admin email configuration
console.log('\n📋 2. Checking admin email configuration...');
const envContent = fs.readFileSync(envLocalPath, 'utf-8');
if (envContent.includes('ADMIN_EMAIL=digitalawanku2@gmail.com')) {
  console.log('   ✅ Admin email configured: digitalawanku2@gmail.com');
} else if (envContent.includes('ADMIN_EMAIL=')) {
  console.log('   ⚠️  Admin email configured but value unexpected');
} else {
  console.log('   ❌ ADMIN_EMAIL not found in .env.local');
  hasErrors = true;
}

// 3. Check local database exists
console.log('\n📋 3. Checking local database...');
const tokkoDbPath = path.join(__dirname, 'tokko.db');
if (fs.existsSync(tokkoDbPath)) {
  console.log('   ✅ Local database (tokko.db) exists');
  const stats = fs.statSync(tokkoDbPath);
  console.log(`      Size: ${(stats.size / 1024).toFixed(2)} KB`);
} else {
  console.log('   ❌ Local database (tokko.db) not found');
  console.log('      → Run: npm run dev (to auto-create)');
  hasErrors = true;
}

// 4. Check database tables (if local DB exists)
if (fs.existsSync(tokkoDbPath)) {
  console.log('\n📋 4. Checking database tables...');
  try {
    const db = createClient({
      url: 'file:./tokko.db',
    });

    // Check users table
    const usersResult = await db.execute('SELECT COUNT(*) as count FROM users');
    const userCount = Number(usersResult.rows[0]?.count ?? 0);
    console.log(`   ✅ users table exists (${userCount} users)`);

    // Check admin_emails table
    const adminEmailsResult = await db.execute('SELECT COUNT(*) as count FROM admin_emails');
    const adminCount = Number(adminEmailsResult.rows[0]?.count ?? 0);
    console.log(`   ✅ admin_emails table exists (${adminCount} admin emails)`);

    // Check device_account_creations table
    const deviceCreationsResult = await db.execute('SELECT COUNT(*) as count FROM device_account_creations');
    const deviceCount = Number(deviceCreationsResult.rows[0]?.count ?? 0);
    console.log(`   ✅ device_account_creations table exists (${deviceCount} records)`);

    // Check if admin user exists
    const adminUserResult = await db.execute(
      'SELECT id, role FROM users WHERE email = ?',
      ['digitalawanku2@gmail.com']
    );
    
    if (adminUserResult.rows.length > 0) {
      const adminUser = adminUserResult.rows[0];
      console.log(`\n   ✅ Admin user found in database`);
      console.log(`      ID: ${adminUser.id}`);
      console.log(`      Role: ${adminUser.role}`);
    } else {
      console.log(`\n   ⚠️  Admin user NOT found in database`);
      console.log(`      → Run: node setup-admin-user.mjs`);
      hasErrors = true;
    }

    // Check if admin email is in admin_emails table
    const adminEmailCheckResult = await db.execute(
      'SELECT id FROM admin_emails WHERE lower(email) = ?',
      ['digitalawanku2@gmail.com']
    );
    
    if (adminEmailCheckResult.rows.length > 0) {
      console.log(`   ✅ Admin email in admin_emails table`);
    } else {
      console.log(`   ⚠️  Admin email NOT in admin_emails table`);
      console.log(`      → Run: node setup-admin-user.mjs`);
      hasErrors = true;
    }

  } catch (error) {
    console.log(`   ❌ Error checking database: ${error.message}`);
    hasErrors = true;
  }
}

// 5. Check required npm scripts
console.log('\n📋 5. Checking required npm scripts...');
const packageJsonPath = path.join(__dirname, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
const requiredScripts = ['dev', 'build', 'start'];

requiredScripts.forEach(script => {
  if (packageJson.scripts?.[script]) {
    console.log(`   ✅ npm run ${script} available`);
  } else {
    console.log(`   ❌ npm run ${script} NOT found`);
    hasErrors = true;
  }
});

// 6. Check NextAuth configuration
console.log('\n📋 6. Checking NextAuth configuration...');
if (envContent.includes('NEXTAUTH_SECRET=')) {
  console.log('   ✅ NEXTAUTH_SECRET configured');
} else {
  console.log('   ❌ NEXTAUTH_SECRET not found');
  hasErrors = true;
}

if (envContent.includes('NEXTAUTH_URL=')) {
  console.log('   ✅ NEXTAUTH_URL configured');
} else {
  console.log('   ❌ NEXTAUTH_URL not found');
  hasErrors = true;
}

// 7. Summary
console.log('\n' + '='.repeat(50));
console.log('\n📊 VERIFICATION SUMMARY');

if (!hasErrors) {
  console.log('\n✅ All checks passed! System is ready.\n');
  console.log('🚀 Next steps:');
  console.log('  1. npm run dev (start development server)');
  console.log('  2. Visit http://localhost:3000/auth');
  console.log('  3. Login with: digitalawanku2@gmail.com / Ayiamessi139087z');
  console.log('  4. Test sign-up with new credentials\n');
} else {
  console.log('\n⚠️  Some checks failed. See above for details.\n');
  console.log('💡 Common fixes:');
  console.log('  • Missing local DB: npm run dev (auto-creates)');
  console.log('  • Missing admin user: node setup-admin-user.mjs');
  console.log('  • Missing env vars: Check .env.local file\n');
}

console.log('='.repeat(50) + '\n');

process.exit(hasErrors ? 1 : 0);
