import { createClient } from "@libsql/client";

const TURSO_URL = "libsql://tokkov2-slinku.aws-us-east-1.turso.io";
const TURSO_AUTH_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzIyNjAwNjcsImlkIjoiMDE5Y2EyZWQtYzEwMS03NDhlLTgyYjUtOWRjNzI4ZjIxYzcxIiwicmlkIjoiYmFmN2QwNGQtNmFmYy00ZTQ3LWE1OTYtYzViYWE5YTlhNDM4In0.R5EcdaiYjsDGXVNbBZ4EMwkXff6fCZxcdJTR-9nyCIw_QEUTN4WuJ5pRttMtlgbBOqQsKY8PkU6aFWTBR7S2AA";

const remoteDb = createClient({
  url: TURSO_URL,
  authToken: TURSO_AUTH_TOKEN,
});

const localDb = createClient({
  url: "file:./tokko.db",
});

async function syncDatabase() {
  console.log("🔄 Starting database sync...");
  
  try {
    // Check remote database
    console.log("\n📊 Checking remote Turso database...");
    const remoteProducts = await remoteDb.execute("SELECT COUNT(*) as count FROM products");
    const remoteInfos = await remoteDb.execute("SELECT COUNT(*) as count FROM informations");
    console.log("Remote: ", remoteProducts.rows, remoteInfos.rows);

    // Clear old data
    console.log("\n🗑️  Clearing old data from remote database...");
    await remoteDb.execute("DELETE FROM products");
    await remoteDb.execute("DELETE FROM informations");
    await remoteDb.execute("DELETE FROM testimonials");
    await remoteDb.execute("DELETE FROM marquees");
    console.log("✅ Old data cleared!");

    // Fetch data from local database
    console.log("\n📥 Fetching data from local database...");
    const localProductsResult = await localDb.execute("SELECT * FROM products");
    const localInfoResult = await localDb.execute("SELECT * FROM informations");
    const localTestimonialResult = await localDb.execute("SELECT * FROM testimonials");
    const localMarqueeResult = await localDb.execute("SELECT * FROM marquees");

    console.log(`  Products: ${localProductsResult.rows.length}`);
    console.log(`  Informations: ${localInfoResult.rows.length}`);
    console.log(`  Testimonials: ${localTestimonialResult.rows.length}`);
    console.log(`  Marquees: ${localMarqueeResult.rows.length}`);

    // Sync products
    if (localProductsResult.rows.length > 0) {
      console.log("\n📤 Syncing products to remote...");
      for (const product of localProductsResult.rows) {
        const values = Object.values(product);
        const placeholders = values.map(() => "?").join(",");
        const columns = Object.keys(product).join(",");
        const query = `INSERT INTO products (${columns}) VALUES (${placeholders})`;
        await remoteDb.execute({
          sql: query,
          args: values,
        });
      }
      console.log(`✅ Synced ${localProductsResult.rows.length} products`);
    }

    // Sync informations
    if (localInfoResult.rows.length > 0) {
      console.log("\n📤 Syncing informations to remote...");
      for (const info of localInfoResult.rows) {
        const values = Object.values(info);
        const placeholders = values.map(() => "?").join(",");
        const columns = Object.keys(info).join(",");
        const query = `INSERT INTO informations (${columns}) VALUES (${placeholders})`;
        await remoteDb.execute({
          sql: query,
          args: values,
        });
      }
      console.log(`✅ Synced ${localInfoResult.rows.length} informations`);
    }

    // Sync testimonials
    if (localTestimonialResult.rows.length > 0) {
      console.log("\n📤 Syncing testimonials to remote...");
      for (const testimonial of localTestimonialResult.rows) {
        const values = Object.values(testimonial);
        const placeholders = values.map(() => "?").join(",");
        const columns = Object.keys(testimonial).join(",");
        const query = `INSERT INTO testimonials (${columns}) VALUES (${placeholders})`;
        await remoteDb.execute({
          sql: query,
          args: values,
        });
      }
      console.log(`✅ Synced ${localTestimonialResult.rows.length} testimonials`);
    }

    // Sync marquees
    if (localMarqueeResult.rows.length > 0) {
      console.log("\n📤 Syncing marquees to remote...");
      for (const marquee of localMarqueeResult.rows) {
        const values = Object.values(marquee);
        const placeholders = values.map(() => "?").join(",");
        const columns = Object.keys(marquee).join(",");
        const query = `INSERT INTO marquees (${columns}) VALUES (${placeholders})`;
        await remoteDb.execute({
          sql: query,
          args: values,
        });
      }
      console.log(`✅ Synced ${localMarqueeResult.rows.length} marquees`);
    }

    console.log("\n✅ Database sync complete!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Sync failed:", error);
    process.exit(1);
  }
}

syncDatabase();
