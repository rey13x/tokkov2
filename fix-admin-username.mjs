#!/usr/bin/env node

import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, "tokko.db");

console.log("🔧 Fixing admin username in database...");
console.log(`📁 Database: ${dbPath}`);

try {
  const db = new Database(dbPath);

  // 1. Update testimonial_comments table - set username to "Tokko Marketplace" for admin email
  const updateComments = db.prepare(`
    UPDATE testimonial_comments 
    SET user_name = 'Tokko Marketplace' 
    WHERE user_name IN ('Admin Tokko', 'admin', 'Admin')
      OR user_id IN (
        SELECT id FROM users WHERE email = 'digitalawanku2@gmail.com'
      )
  `);
  const commentsResult = updateComments.run();
  console.log(`✅ Updated ${commentsResult.changes} comments with admin username`);

  // 2. Check if admin user exists in database
  const adminCheck = db.prepare(
    "SELECT id, username, email FROM users WHERE email = 'digitalawanku2@gmail.com'"
  );
  const adminUser = adminCheck.get();

  if (adminUser) {
    console.log(
      `👤 Admin found: ID=${adminUser.id}, Username=${adminUser.username}, Email=${adminUser.email}`
    );

    // Update admin user username if not "Tokko Marketplace"
    if (adminUser.username !== "Tokko Marketplace") {
      const updateAdmin = db.prepare(
        "UPDATE users SET username = 'Tokko Marketplace' WHERE id = ?"
      );
      updateAdmin.run(adminUser.id);
      console.log(`✅ Updated admin username to 'Tokko Marketplace'`);
    }
  } else {
    console.log("⚠️  Admin user not found in database");
  }

  // 3. Verify comments count
  const countComments = db.prepare(
    "SELECT COUNT(*) as total FROM testimonial_comments WHERE user_name = 'Tokko Marketplace'"
  );
  const commentCount = countComments.get();
  console.log(
    `📊 Total comments by Tokko Marketplace: ${commentCount.total}`
  );

  // 4. List all comments with their usernames
  const listComments = db.prepare(`
    SELECT id, user_name, user_id, text, created_at 
    FROM testimonial_comments 
    ORDER BY created_at DESC 
    LIMIT 10
  `);
  const recentComments = listComments.all();
  console.log("\n📝 Recent comments:");
  recentComments.forEach((comment) => {
    const date = new Date(comment.created_at).toLocaleString("id-ID");
    console.log(`  • ${comment.user_name} (${date}): ${comment.text.slice(0, 40)}...`);
  });

  db.close();
  console.log("\n✅ Fix completed successfully!");
} catch (error) {
  console.error("❌ Error:", error.message);
  process.exit(1);
}
