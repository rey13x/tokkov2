import { createClient, type InArgs } from "@libsql/client";
import { hash } from "bcryptjs";
import type {
  InformationType,
  OrderSummary,
  StoreInformation,
  StoreProduct,
} from "@/types/store";

const now = () => Date.now();

const db = createClient({
  url: process.env.TURSO_URL ?? "file:./tokko.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

let initialized = false;
let initPromise: Promise<void> | null = null;

function randomId() {
  return crypto.randomUUID();
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function mapProduct(row: Record<string, unknown>): StoreProduct {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    category: String(row.category),
    shortDescription: String(row.short_description),
    description: String(row.description),
    price: Number(row.price),
    imageUrl: String(row.image_url),
    isActive: Number(row.is_active) === 1,
  };
}

function mapInfo(row: Record<string, unknown>): StoreInformation {
  const pollOptionsRaw = row.poll_options ? String(row.poll_options) : "[]";

  return {
    id: String(row.id),
    type: String(row.type) as InformationType,
    title: String(row.title),
    body: String(row.body),
    imageUrl: String(row.image_url ?? ""),
    pollOptions: JSON.parse(pollOptionsRaw) as string[],
    createdAt: new Date(Number(row.created_at)).toISOString(),
  };
}

const defaultProducts: Array<
  Omit<StoreProduct, "id" | "slug" | "isActive"> & { slug?: string }
> = [
  {
    name: "Netflix Private 1 Bulan",
    category: "App Premium",
    shortDescription: "Akun private HD + garansi",
    description: "Akun private siap pakai kualitas HD dengan garansi.",
    price: 59000,
    imageUrl: "/assets/background.jpg",
  },
  {
    name: "Spotify Premium Family",
    category: "App Premium",
    shortDescription: "Anti iklan, mode offline",
    description: "Upgrade akun Spotify tanpa iklan dan mode offline aktif.",
    price: 25000,
    imageUrl: "/assets/prime-video.jpg",
  },
  {
    name: "YouTube Premium Share",
    category: "App Premium",
    shortDescription: "No ads, aktivasi cepat",
    description: "Nikmati YouTube tanpa iklan dengan dukungan login aman.",
    price: 28000,
    imageUrl: "/assets/canva.jpg",
  },
];

const defaultInformations: Array<
  Omit<StoreInformation, "id" | "createdAt"> & { createdAt?: string }
> = [
  {
    type: "update",
    title: "Pesan Promo Mingguan",
    body: "Admin bisa mengisi pesan campaign terbaru dan instruksi pembelian.",
    imageUrl: "/assets/background.jpg",
    pollOptions: [],
  },
  {
    type: "poll",
    title: "Polling Produk Favorit",
    body: "Pilih kategori yang paling sering kamu beli minggu ini.",
    imageUrl: "/assets/canva.jpg",
    pollOptions: ["App Premium"],
  },
];

async function runOneTimeCatalogCleanup() {
  const markerKey = "catalog-app-premium-only-v1";
  const marker = await run("SELECT value FROM app_meta WHERE key = ? LIMIT 1", [markerKey]);
  if (marker.rows.length > 0) {
    return;
  }

  await run("DELETE FROM products WHERE lower(category) <> lower('App Premium')");
  await run("INSERT INTO app_meta (key, value) VALUES (?, ?)", [markerKey, String(now())]);
}

async function ensureLocalAdminUser() {
  const adminUsername = "Admin123x";
  const adminEmail = "admin123x@local.tokko";
  const adminPasswordHash = await hash("Admin123x", 10);

  const existing = await run(
    "SELECT id FROM users WHERE lower(username) = lower(?) OR lower(email) = lower(?) LIMIT 1",
    [adminUsername, adminEmail],
  );

  if (existing.rows.length > 0) {
    await run(
      `UPDATE users
       SET role = 'admin', password_hash = ?, updated_at = ?
       WHERE id = ?`,
      [adminPasswordHash, now(), String(existing.rows[0]?.id)],
    );
    return;
  }

  await run(
    `INSERT INTO users (id, username, email, phone, password_hash, role, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'admin', ?, ?)`,
    [randomId(), adminUsername, adminEmail, "", adminPasswordHash, now(), now()],
  );
}

async function run(sql: string, args?: InArgs) {
  return db.execute({ sql, args });
}

async function seedIfEmpty() {
  const productCount = await run("SELECT COUNT(*) AS count FROM products");
  const totalProducts = Number(productCount.rows[0]?.count ?? 0);

  if (totalProducts === 0) {
    for (const item of defaultProducts) {
      const slug = item.slug ?? slugify(item.name);
      await run(
        `INSERT INTO products
          (id, slug, name, category, short_description, description, price, image_url, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [randomId(), slug, item.name, item.category, item.shortDescription, item.description, item.price, item.imageUrl, now(), now()],
      );
    }
  }

  const infoCount = await run("SELECT COUNT(*) AS count FROM informations");
  const totalInfos = Number(infoCount.rows[0]?.count ?? 0);

  if (totalInfos === 0) {
    for (const item of defaultInformations) {
      await run(
        `INSERT INTO informations
          (id, type, title, body, image_url, poll_options, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [randomId(), item.type, item.title, item.body, item.imageUrl, JSON.stringify(item.pollOptions), now(), now()],
      );
    }
  }
}

export async function ensureDatabase() {
  if (initialized) {
    return;
  }

  if (!initPromise) {
    initPromise = (async () => {
      await run(
        `CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          phone TEXT NOT NULL DEFAULT '',
          password_hash TEXT,
          role TEXT NOT NULL DEFAULT 'user',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )`,
      );

      await run(
        `CREATE TABLE IF NOT EXISTS app_meta (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )`,
      );

      await run(
        `CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY,
          slug TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          short_description TEXT NOT NULL,
          description TEXT NOT NULL,
          price INTEGER NOT NULL,
          image_url TEXT NOT NULL,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )`,
      );

      await run(
        `CREATE TABLE IF NOT EXISTS informations (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL DEFAULT 'update',
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          image_url TEXT NOT NULL DEFAULT '',
          poll_options TEXT NOT NULL DEFAULT '[]',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )`,
      );

      await run(
        `CREATE TABLE IF NOT EXISTS orders (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          user_name TEXT NOT NULL,
          user_email TEXT NOT NULL,
          user_phone TEXT NOT NULL,
          total INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'new',
          created_at INTEGER NOT NULL
        )`,
      );

      await run(
        `CREATE TABLE IF NOT EXISTS order_items (
          id TEXT PRIMARY KEY,
          order_id TEXT NOT NULL,
          product_id TEXT NOT NULL,
          product_name TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          unit_price INTEGER NOT NULL
        )`,
      );

      await seedIfEmpty();
      await runOneTimeCatalogCleanup();
      await ensureLocalAdminUser();
      initialized = true;
    })();
  }

  await initPromise;
}

export type DbUser = {
  id: string;
  username: string;
  email: string;
  phone: string;
  role: "user" | "admin";
  passwordHash: string | null;
};

function mapUser(row: Record<string, unknown>): DbUser {
  return {
    id: String(row.id),
    username: String(row.username),
    email: String(row.email),
    phone: String(row.phone),
    role: (String(row.role) as "user" | "admin") ?? "user",
    passwordHash: row.password_hash ? String(row.password_hash) : null,
  };
}

export async function findUserByEmail(email: string) {
  await ensureDatabase();
  const res = await run("SELECT * FROM users WHERE lower(email) = lower(?) LIMIT 1", [email]);
  const row = res.rows[0] as Record<string, unknown> | undefined;
  return row ? mapUser(row) : null;
}

export async function findUserById(id: string) {
  await ensureDatabase();
  const res = await run("SELECT * FROM users WHERE id = ? LIMIT 1", [id]);
  const row = res.rows[0] as Record<string, unknown> | undefined;
  return row ? mapUser(row) : null;
}

export async function findUserByIdentifier(identifier: string) {
  await ensureDatabase();
  const res = await run(
    `SELECT * FROM users
     WHERE lower(email) = lower(?) OR lower(username) = lower(?)
     LIMIT 1`,
    [identifier, identifier],
  );
  const row = res.rows[0] as Record<string, unknown> | undefined;
  return row ? mapUser(row) : null;
}

export async function createUser(input: {
  username: string;
  email: string;
  phone: string;
  passwordHash: string | null;
  role?: "user" | "admin";
}) {
  await ensureDatabase();
  const id = randomId();
  const role = input.role ?? "user";
  await run(
    `INSERT INTO users (id, username, email, phone, password_hash, role, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.username, input.email, input.phone, input.passwordHash, role, now(), now()],
  );
  return findUserById(id);
}

export async function updateUserById(
  id: string,
  input: Partial<{
    username: string;
    email: string;
    phone: string;
    passwordHash: string | null;
    role: "user" | "admin";
  }>,
) {
  await ensureDatabase();
  const current = await findUserById(id);
  if (!current) {
    return null;
  }

  await run(
    `UPDATE users
     SET username = ?, email = ?, phone = ?, password_hash = ?, role = ?, updated_at = ?
     WHERE id = ?`,
    [
      input.username ?? current.username,
      input.email ?? current.email,
      input.phone ?? current.phone,
      input.passwordHash ?? current.passwordHash,
      input.role ?? current.role,
      now(),
      id,
    ],
  );
  return findUserById(id);
}

export async function listProducts() {
  await ensureDatabase();
  const res = await run(
    "SELECT * FROM products WHERE is_active = 1 ORDER BY created_at DESC",
  );
  return res.rows.map((row) => mapProduct(row as Record<string, unknown>));
}

export async function listAllProducts() {
  await ensureDatabase();
  const res = await run("SELECT * FROM products ORDER BY created_at DESC");
  return res.rows.map((row) => mapProduct(row as Record<string, unknown>));
}

export async function getProductBySlug(slug: string) {
  await ensureDatabase();
  const res = await run(
    "SELECT * FROM products WHERE lower(slug) = lower(?) AND is_active = 1 LIMIT 1",
    [slug],
  );
  const row = res.rows[0] as Record<string, unknown> | undefined;
  return row ? mapProduct(row) : null;
}

export async function getProductById(id: string) {
  await ensureDatabase();
  const res = await run("SELECT * FROM products WHERE id = ? LIMIT 1", [id]);
  const row = res.rows[0] as Record<string, unknown> | undefined;
  return row ? mapProduct(row) : null;
}

export async function createProduct(input: {
  name: string;
  category: string;
  shortDescription: string;
  description: string;
  price: number;
  imageUrl: string;
}) {
  await ensureDatabase();
  const id = randomId();
  const baseSlug = slugify(input.name);
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await run(
      "SELECT id FROM products WHERE lower(slug) = lower(?) LIMIT 1",
      [slug],
    );
    if (existing.rows.length === 0) {
      break;
    }
    counter += 1;
    slug = `${baseSlug}-${counter}`;
  }

  await run(
    `INSERT INTO products
      (id, slug, name, category, short_description, description, price, image_url, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [id, slug, input.name, input.category, input.shortDescription, input.description, input.price, input.imageUrl, now(), now()],
  );
  return getProductById(id);
}

export async function updateProduct(
  id: string,
  input: Partial<{
    name: string;
    category: string;
    shortDescription: string;
    description: string;
    price: number;
    imageUrl: string;
    isActive: boolean;
  }>,
) {
  await ensureDatabase();
  const current = await getProductById(id);
  if (!current) {
    return null;
  }

  const nextName = input.name ?? current.name;
  const nextSlug =
    nextName !== current.name
      ? `${slugify(nextName)}-${Math.floor(Math.random() * 900 + 100)}`
      : current.slug;

  await run(
    `UPDATE products
     SET slug = ?, name = ?, category = ?, short_description = ?, description = ?, price = ?, image_url = ?, is_active = ?, updated_at = ?
     WHERE id = ?`,
    [
      nextSlug,
      nextName,
      input.category ?? current.category,
      input.shortDescription ?? current.shortDescription,
      input.description ?? current.description,
      input.price ?? current.price,
      input.imageUrl ?? current.imageUrl,
      input.isActive === undefined ? Number(current.isActive) : Number(input.isActive),
      now(),
      id,
    ],
  );
  return getProductById(id);
}

export async function deleteProduct(id: string) {
  await ensureDatabase();
  await run("DELETE FROM products WHERE id = ?", [id]);
}

export async function deleteAllProducts() {
  await ensureDatabase();
  await run("DELETE FROM products");
}

export async function listInformations() {
  await ensureDatabase();
  const res = await run("SELECT * FROM informations ORDER BY created_at DESC");
  return res.rows.map((row) => mapInfo(row as Record<string, unknown>));
}

export async function createInformation(input: {
  type: InformationType;
  title: string;
  body: string;
  imageUrl: string;
  pollOptions: string[];
}) {
  await ensureDatabase();
  const id = randomId();
  await run(
    `INSERT INTO informations
      (id, type, title, body, image_url, poll_options, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.type, input.title, input.body, input.imageUrl, JSON.stringify(input.pollOptions), now(), now()],
  );

  const res = await run("SELECT * FROM informations WHERE id = ? LIMIT 1", [id]);
  const row = res.rows[0] as Record<string, unknown> | undefined;
  return row ? mapInfo(row) : null;
}

export async function updateInformation(
  id: string,
  input: Partial<{
    type: InformationType;
    title: string;
    body: string;
    imageUrl: string;
    pollOptions: string[];
  }>,
) {
  await ensureDatabase();
  const res = await run("SELECT * FROM informations WHERE id = ? LIMIT 1", [id]);
  const row = res.rows[0] as Record<string, unknown> | undefined;
  if (!row) {
    return null;
  }
  const current = mapInfo(row);

  await run(
    `UPDATE informations
     SET type = ?, title = ?, body = ?, image_url = ?, poll_options = ?, updated_at = ?
     WHERE id = ?`,
    [
      input.type ?? current.type,
      input.title ?? current.title,
      input.body ?? current.body,
      input.imageUrl ?? current.imageUrl,
      JSON.stringify(input.pollOptions ?? current.pollOptions),
      now(),
      id,
    ],
  );

  const updated = await run("SELECT * FROM informations WHERE id = ? LIMIT 1", [id]);
  return mapInfo(updated.rows[0] as Record<string, unknown>);
}

export async function deleteInformation(id: string) {
  await ensureDatabase();
  await run("DELETE FROM informations WHERE id = ?", [id]);
}

export async function createOrder(input: {
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
  }>;
}) {
  await ensureDatabase();
  const id = randomId();
  const total = input.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  await run(
    `INSERT INTO orders
      (id, user_id, user_name, user_email, user_phone, total, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'new', ?)`,
    [id, input.userId, input.userName, input.userEmail, input.userPhone, total, now()],
  );

  for (const item of input.items) {
    await run(
      `INSERT INTO order_items
        (id, order_id, product_id, product_name, quantity, unit_price)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [randomId(), id, item.productId, item.productName, item.quantity, item.unitPrice],
    );
  }

  return {
    id,
    total,
  };
}

export async function listOrders(limit = 100) {
  await ensureDatabase();
  const res = await run(
    "SELECT * FROM orders ORDER BY created_at DESC LIMIT ?",
    [Math.max(1, limit)],
  );

  return res.rows.map((row) => {
    const data = row as Record<string, unknown>;
    return {
      id: String(data.id),
      userName: String(data.user_name),
      userEmail: String(data.user_email),
      total: Number(data.total),
      status: String(data.status),
      createdAt: new Date(Number(data.created_at)).toISOString(),
    } satisfies OrderSummary;
  });
}

export async function listOrderItemsByOrderId(orderId: string) {
  await ensureDatabase();
  const res = await run(
    "SELECT * FROM order_items WHERE order_id = ? ORDER BY rowid DESC",
    [orderId],
  );
  return res.rows.map((row) => {
    const data = row as Record<string, unknown>;
    return {
      id: String(data.id),
      orderId: String(data.order_id),
      productId: String(data.product_id),
      productName: String(data.product_name),
      quantity: Number(data.quantity),
      unitPrice: Number(data.unit_price),
    };
  });
}

export async function getOrderStatsLastHours(hours = 12) {
  await ensureDatabase();
  const from = now() - hours * 60 * 60 * 1000;
  const res = await run(
    `SELECT strftime('%Y-%m-%d %H:%M', datetime(created_at / 1000, 'unixepoch')) AS bucket,
            COUNT(*) AS total_orders,
            SUM(total) AS total_amount
     FROM orders
     WHERE created_at >= ?
     GROUP BY bucket
     ORDER BY bucket ASC`,
    [from],
  );

  return res.rows.map((row) => {
    const data = row as Record<string, unknown>;
    return {
      bucket: String(data.bucket),
      totalOrders: Number(data.total_orders ?? 0),
      totalAmount: Number(data.total_amount ?? 0),
    };
  });
}
