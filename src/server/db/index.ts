import { createClient, type InArgs } from "@libsql/client";
import { hash } from "bcryptjs";
import type {
  InformationType,
  StoreOrderDetail,
  StoreOrderItem,
  OrderSummary,
  StoreInformation,
  StoreMarqueeItem,
  StorePrivacyPolicyPage,
  StoreProduct,
  StoreTestimonial,
} from "@/types/store";
import { resolveMediaUrl } from "@/lib/media";
import { getFirebaseFirestore } from "@/server/firebase-admin";

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

function parseJsonArray(value: unknown): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(String(value));
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((item) => String(item).trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function parseJsonRecord(value: unknown): Record<string, number> {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(String(value)) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    const record: Record<string, number> = {};
    for (const [key, raw] of Object.entries(parsed)) {
      if (!key.trim()) {
        continue;
      }
      const votes = Number(raw ?? 0);
      record[key] = Number.isFinite(votes) ? Math.max(0, Math.floor(votes)) : 0;
    }
    return record;
  } catch {
    return {};
  }
}

function normalizePollOptions(options: string[]) {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const option of options) {
    const next = option.trim();
    if (!next) {
      continue;
    }
    const key = next.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalized.push(next);
  }
  return normalized;
}

function normalizePollVotes(options: string[], rawVotes: Record<string, number>) {
  const votes: Record<string, number> = {};
  for (const option of options) {
    votes[option] = Math.max(0, Math.floor(Number(rawVotes[option] ?? 0)));
  }
  return votes;
}

function mapProduct(row: Record<string, unknown>): StoreProduct {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    category: String(row.category),
    shortDescription: String(row.short_description),
    description: String(row.description),
    duration: String(row.duration ?? ""),
    price: Number(row.price),
    imageUrl: resolveMediaUrl(String(row.image_url ?? "")),
    isActive: Number(row.is_active) === 1,
  };
}

function mapInfo(row: Record<string, unknown>): StoreInformation {
  const pollOptions = normalizePollOptions(parseJsonArray(row.poll_options));
  const pollVotes = normalizePollVotes(pollOptions, parseJsonRecord(row.poll_votes));

  return {
    id: String(row.id),
    type: String(row.type) as InformationType,
    title: String(row.title),
    body: String(row.body),
    imageUrl: resolveMediaUrl(String(row.image_url ?? "")),
    pollOptions,
    pollVotes,
    createdAt: new Date(Number(row.created_at)).toISOString(),
  };
}

function mapTestimonial(row: Record<string, unknown>): StoreTestimonial {
  return {
    id: String(row.id),
    name: String(row.name),
    country: String(row.country ?? "Indonesia"),
    message: String(row.message),
    rating: Math.max(1, Math.min(5, Number(row.rating ?? 5))),
    mediaUrl: resolveMediaUrl(String(row.media_url ?? "")),
    audioUrl: String(row.audio_url ?? "/assets/notif.mp3"),
    createdAt: new Date(Number(row.created_at ?? now())).toISOString(),
  };
}

function mapMarquee(row: Record<string, unknown>): StoreMarqueeItem {
  return {
    id: String(row.id),
    label: String(row.label ?? "Logo"),
    imageUrl: resolveMediaUrl(String(row.image_url ?? "")),
    isActive: Number(row.is_active ?? 1) === 1,
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: new Date(Number(row.created_at ?? now())).toISOString(),
  };
}

const PRIVACY_POLICY_PAGE_ID = "main";

const defaultPrivacyPolicyPage: Omit<StorePrivacyPolicyPage, "id" | "updatedAt"> = {
  title: "Kebijakan Privasi & Sertifikasi Layanan",
  updatedLabel: "Terakhir diperbarui: 28 Februari 2026",
  bannerImageUrl: "/assets/background.jpg",
  contentHtml: `
<h2>Kebijakan Privasi</h2>
<p>Tokko berkomitmen menjaga keamanan dan kerahasiaan data pelanggan.</p>
<ul>
  <li>Data digunakan hanya untuk proses transaksi, dukungan, dan evaluasi layanan.</li>
  <li>Data tidak diperjualbelikan kepada pihak ketiga tanpa persetujuan pelanggan.</li>
  <li>Akses data dibatasi hanya untuk personel yang berwenang.</li>
</ul>
<h2>Sertifikasi & Standar Layanan</h2>
<p>Kami menerapkan verifikasi berlapis dan audit kualitas berkala.</p>
<ul>
  <li>Kepatuhan kebijakan perlindungan data pribadi berbasis regulasi Indonesia (UU PDP).</li>
  <li>Seleksi mitra panel layanan berdasarkan stabilitas dan kualitas.</li>
</ul>
<h2>Kontak</h2>
<p>Hubungi tim kami lewat kanal resmi untuk informasi kebijakan lebih rinci.</p>
`.trim(),
};

function getDefaultPrivacyPolicyPage(): StorePrivacyPolicyPage {
  return {
    id: PRIVACY_POLICY_PAGE_ID,
    ...defaultPrivacyPolicyPage,
    updatedAt: new Date(now()).toISOString(),
  };
}

function mapPrivacyPolicyPage(row: Record<string, unknown>): StorePrivacyPolicyPage {
  return {
    id: String(row.id ?? PRIVACY_POLICY_PAGE_ID),
    title: String(row.title ?? defaultPrivacyPolicyPage.title),
    updatedLabel: String(row.updated_label ?? defaultPrivacyPolicyPage.updatedLabel),
    bannerImageUrl: resolveMediaUrl(
      String(row.banner_image_url ?? defaultPrivacyPolicyPage.bannerImageUrl),
    ),
    contentHtml: String(row.content_html ?? defaultPrivacyPolicyPage.contentHtml),
    updatedAt: new Date(Number(row.updated_at ?? now())).toISOString(),
  };
}

const defaultProducts: Array<
  Omit<StoreProduct, "id" | "slug" | "isActive"> & { slug?: string }
> = [];

const defaultInformations: Array<
  Omit<StoreInformation, "id" | "createdAt"> & { createdAt?: string }
> = [];

const defaultTestimonials: Array<
  Omit<StoreTestimonial, "id" | "createdAt"> & { createdAt?: string }
> = [];

const defaultMarquees: Array<
  Omit<StoreMarqueeItem, "id" | "createdAt"> & { createdAt?: string }
> = [];

async function runOneTimeCatalogCleanup() {
  const markerKey = "catalog-app-premium-only-v1";
  const marker = await run("SELECT value FROM app_meta WHERE key = ? LIMIT 1", [markerKey]);
  if (marker.rows.length > 0) {
    return;
  }

  await run("DELETE FROM products WHERE lower(category) <> lower('App Premium')");
  await run("INSERT INTO app_meta (key, value) VALUES (?, ?)", [markerKey, String(now())]);
}

async function runOneTimeInitialContentReset() {
  const markerKey = "initial-content-reset-v1";
  const marker = await run("SELECT value FROM app_meta WHERE key = ? LIMIT 1", [markerKey]);
  if (marker.rows.length > 0) {
    return;
  }

  await run("DELETE FROM products");
  await run("DELETE FROM informations");
  await run("DELETE FROM testimonials");
  await run("DELETE FROM marquees");
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
          (id, slug, name, category, short_description, description, duration, price, image_url, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [
          randomId(),
          slug,
          item.name,
          item.category,
          item.shortDescription,
          item.description,
          item.duration,
          item.price,
          item.imageUrl,
          now(),
          now(),
        ],
      );
    }
  }

  const infoCount = await run("SELECT COUNT(*) AS count FROM informations");
  const totalInfos = Number(infoCount.rows[0]?.count ?? 0);

  if (totalInfos === 0) {
    for (const item of defaultInformations) {
      const pollOptions = normalizePollOptions(item.pollOptions);
      const pollVotes = normalizePollVotes(pollOptions, item.pollVotes);
      await run(
        `INSERT INTO informations
          (id, type, title, body, image_url, poll_options, poll_votes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomId(),
          item.type,
          item.title,
          item.body,
          item.imageUrl,
          JSON.stringify(pollOptions),
          JSON.stringify(pollVotes),
          now(),
          now(),
        ],
      );
    }
  }

  const testimonialCount = await run("SELECT COUNT(*) AS count FROM testimonials");
  const totalTestimonials = Number(testimonialCount.rows[0]?.count ?? 0);

  if (totalTestimonials === 0) {
    for (const item of defaultTestimonials) {
      await run(
        `INSERT INTO testimonials
          (id, name, country, message, rating, media_url, audio_url, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomId(),
          item.name,
          item.country,
          item.message,
          item.rating,
          item.mediaUrl,
          item.audioUrl,
          now(),
          now(),
        ],
      );
    }
  }

  const marqueeCount = await run("SELECT COUNT(*) AS count FROM marquees");
  const totalMarquees = Number(marqueeCount.rows[0]?.count ?? 0);

  if (totalMarquees === 0) {
    for (const item of defaultMarquees) {
      await run(
        `INSERT INTO marquees
          (id, label, image_url, is_active, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          randomId(),
          item.label,
          item.imageUrl,
          Number(item.isActive),
          item.sortOrder,
          now(),
          now(),
        ],
      );
    }
  }

  await run(
    `INSERT OR IGNORE INTO privacy_policy_pages
      (id, title, updated_label, banner_image_url, content_html, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      PRIVACY_POLICY_PAGE_ID,
      defaultPrivacyPolicyPage.title,
      defaultPrivacyPolicyPage.updatedLabel,
      defaultPrivacyPolicyPage.bannerImageUrl,
      defaultPrivacyPolicyPage.contentHtml,
      now(),
      now(),
    ],
  );
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
          avatar_url TEXT NOT NULL DEFAULT '',
          password_hash TEXT,
          role TEXT NOT NULL DEFAULT 'user',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )`,
      );
      await run(
        "ALTER TABLE users ADD COLUMN avatar_url TEXT NOT NULL DEFAULT ''",
      ).catch(() => {});

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
          duration TEXT NOT NULL DEFAULT '',
          price INTEGER NOT NULL,
          image_url TEXT NOT NULL,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )`,
      );
      await run(
        "ALTER TABLE products ADD COLUMN duration TEXT NOT NULL DEFAULT ''",
      ).catch(() => {});

      await run(
        `CREATE TABLE IF NOT EXISTS informations (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL DEFAULT 'update',
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          image_url TEXT NOT NULL DEFAULT '',
          poll_options TEXT NOT NULL DEFAULT '[]',
          poll_votes TEXT NOT NULL DEFAULT '{}',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )`,
      );
      await run(
        "ALTER TABLE informations ADD COLUMN poll_votes TEXT NOT NULL DEFAULT '{}'",
      ).catch(() => {});

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
        `CREATE TABLE IF NOT EXISTS testimonials (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          country TEXT NOT NULL DEFAULT 'Indonesia',
          message TEXT NOT NULL,
          rating INTEGER NOT NULL DEFAULT 5,
          media_url TEXT NOT NULL DEFAULT '/assets/logo.png',
          audio_url TEXT NOT NULL DEFAULT '/assets/notif.mp3',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )`,
      );
      await run(
        "ALTER TABLE testimonials ADD COLUMN media_url TEXT NOT NULL DEFAULT '/assets/logo.png'",
      ).catch(() => {});

      await run(
        `CREATE TABLE IF NOT EXISTS marquees (
          id TEXT PRIMARY KEY,
          label TEXT NOT NULL,
          image_url TEXT NOT NULL DEFAULT '/assets/logo.png',
          is_active INTEGER NOT NULL DEFAULT 1,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )`,
      );
      await run(
        "ALTER TABLE marquees ADD COLUMN image_url TEXT NOT NULL DEFAULT '/assets/logo.png'",
      ).catch(() => {});
      await run(
        "ALTER TABLE marquees ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1",
      ).catch(() => {});
      await run(
        "ALTER TABLE marquees ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0",
      ).catch(() => {});

      await run(
        `CREATE TABLE IF NOT EXISTS privacy_policy_pages (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          updated_label TEXT NOT NULL,
          banner_image_url TEXT NOT NULL DEFAULT '/assets/background.jpg',
          content_html TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )`,
      );
      await run(
        "ALTER TABLE privacy_policy_pages ADD COLUMN banner_image_url TEXT NOT NULL DEFAULT '/assets/background.jpg'",
      ).catch(() => {});
      await run(
        "ALTER TABLE privacy_policy_pages ADD COLUMN updated_label TEXT NOT NULL DEFAULT 'Terakhir diperbarui: 28 Februari 2026'",
      ).catch(() => {});
      await run(
        "ALTER TABLE privacy_policy_pages ADD COLUMN content_html TEXT NOT NULL DEFAULT ''",
      ).catch(() => {});

      await run(
        `CREATE TABLE IF NOT EXISTS order_items (
          id TEXT PRIMARY KEY,
          order_id TEXT NOT NULL,
          product_id TEXT NOT NULL,
          product_name TEXT NOT NULL,
          product_duration TEXT NOT NULL DEFAULT '',
          quantity INTEGER NOT NULL,
          unit_price INTEGER NOT NULL
        )`,
      );
      await run(
        "ALTER TABLE order_items ADD COLUMN product_duration TEXT NOT NULL DEFAULT ''",
      ).catch(() => {});

      await run(
        `CREATE TABLE IF NOT EXISTS email_verifications (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          username TEXT NOT NULL,
          phone TEXT NOT NULL DEFAULT '',
          password_hash TEXT NOT NULL,
          otp_hash TEXT NOT NULL,
          expires_at INTEGER NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL
        )`,
      );

      await run(
        `CREATE TABLE IF NOT EXISTS password_change_otps (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL UNIQUE,
          email TEXT NOT NULL,
          otp_hash TEXT NOT NULL,
          expires_at INTEGER NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL
        )`,
      );

      await runOneTimeInitialContentReset();
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
  avatarUrl: string;
  role: "user" | "admin";
  passwordHash: string | null;
};

function mapUser(row: Record<string, unknown>): DbUser {
  return {
    id: String(row.id),
    username: String(row.username),
    email: String(row.email),
    phone: String(row.phone),
    avatarUrl: String(row.avatar_url ?? ""),
    role: (String(row.role) as "user" | "admin") ?? "user",
    passwordHash: row.password_hash ? String(row.password_hash) : null,
  };
}

function mapFirestoreUser(id: string, data: Record<string, unknown> | undefined): DbUser {
  return {
    id,
    username: String(data?.username ?? ""),
    email: String(data?.email ?? ""),
    phone: String(data?.phone ?? ""),
    avatarUrl: String(data?.avatarUrl ?? ""),
    role: (String(data?.role ?? "user") as "user" | "admin"),
    passwordHash:
      data?.passwordHash === null || data?.passwordHash === undefined
        ? null
        : String(data.passwordHash),
  };
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

async function findLocalUserByEmail(email: string) {
  await ensureDatabase();
  const res = await run("SELECT * FROM users WHERE lower(email) = lower(?) LIMIT 1", [email]);
  const row = res.rows[0] as Record<string, unknown> | undefined;
  return row ? mapUser(row) : null;
}

async function findLocalUserById(id: string) {
  await ensureDatabase();
  const res = await run("SELECT * FROM users WHERE id = ? LIMIT 1", [id]);
  const row = res.rows[0] as Record<string, unknown> | undefined;
  return row ? mapUser(row) : null;
}

async function findLocalUserByIdentifier(identifier: string) {
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

async function findFirestoreUserById(id: string) {
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    return null;
  }

  const doc = await firestore.collection("users").doc(id).get();
  if (!doc.exists) {
    return null;
  }
  return mapFirestoreUser(doc.id, doc.data() as Record<string, unknown>);
}

async function findFirestoreUserByEmail(email: string) {
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    return null;
  }

  const normalizedEmail = normalizeEmail(email);
  let snapshot = await firestore
    .collection("users")
    .where("emailLower", "==", normalizedEmail)
    .limit(1)
    .get();

  if (snapshot.empty) {
    snapshot = await firestore
      .collection("users")
      .where("email", "==", email.trim())
      .limit(1)
      .get();
  }

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return mapFirestoreUser(doc.id, doc.data() as Record<string, unknown>);
}

async function findFirestoreUserByIdentifier(identifier: string) {
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    return null;
  }

  const normalized = identifier.trim().toLowerCase();

  const byEmailLower = await firestore
    .collection("users")
    .where("emailLower", "==", normalized)
    .limit(1)
    .get();
  if (!byEmailLower.empty) {
    const doc = byEmailLower.docs[0];
    return mapFirestoreUser(doc.id, doc.data() as Record<string, unknown>);
  }

  const byUsernameLower = await firestore
    .collection("users")
    .where("usernameLower", "==", normalized)
    .limit(1)
    .get();
  if (!byUsernameLower.empty) {
    const doc = byUsernameLower.docs[0];
    return mapFirestoreUser(doc.id, doc.data() as Record<string, unknown>);
  }

  const rawIdentifier = identifier.trim();
  const byEmailRaw = await firestore
    .collection("users")
    .where("email", "==", rawIdentifier)
    .limit(1)
    .get();
  if (!byEmailRaw.empty) {
    const doc = byEmailRaw.docs[0];
    return mapFirestoreUser(doc.id, doc.data() as Record<string, unknown>);
  }

  const byUsernameRaw = await firestore
    .collection("users")
    .where("username", "==", rawIdentifier)
    .limit(1)
    .get();
  if (!byUsernameRaw.empty) {
    const doc = byUsernameRaw.docs[0];
    return mapFirestoreUser(doc.id, doc.data() as Record<string, unknown>);
  }

  return null;
}

async function upsertLocalUserMirror(user: DbUser) {
  await ensureDatabase();
  const existing = await run("SELECT id FROM users WHERE id = ? LIMIT 1", [user.id]);
  if (existing.rows.length > 0) {
    await run(
      `UPDATE users
       SET username = ?, email = ?, phone = ?, avatar_url = ?, password_hash = ?, role = ?, updated_at = ?
       WHERE id = ?`,
      [
        user.username,
        user.email,
        user.phone,
        user.avatarUrl,
        user.passwordHash,
        user.role,
        now(),
        user.id,
      ],
    );
    return;
  }

  await run(
    `INSERT INTO users (id, username, email, phone, avatar_url, password_hash, role, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user.id,
      user.username,
      user.email,
      user.phone,
      user.avatarUrl,
      user.passwordHash,
      user.role,
      now(),
      now(),
    ],
  );
}

export async function findUserByEmail(email: string) {
  const firestore = getFirebaseFirestore();
  if (firestore) {
    try {
      const firebaseUser = await findFirestoreUserByEmail(email);
      if (firebaseUser) {
        return firebaseUser;
      }
    } catch (error) {
      console.error("Failed to read user by email from Firestore:", error);
    }
  }

  return findLocalUserByEmail(email);
}

export async function findUserById(id: string) {
  const firestore = getFirebaseFirestore();
  if (firestore) {
    try {
      const firebaseUser = await findFirestoreUserById(id);
      if (firebaseUser) {
        return firebaseUser;
      }
    } catch (error) {
      console.error("Failed to read user by id from Firestore:", error);
    }
  }

  return findLocalUserById(id);
}

export async function findUserByIdentifier(identifier: string) {
  const firestore = getFirebaseFirestore();
  if (firestore) {
    try {
      const firebaseUser = await findFirestoreUserByIdentifier(identifier);
      if (firebaseUser) {
        return firebaseUser;
      }
    } catch (error) {
      console.error("Failed to read user by identifier from Firestore:", error);
    }
  }

  return findLocalUserByIdentifier(identifier);
}

export async function createUser(input: {
  username: string;
  email: string;
  phone: string;
  avatarUrl?: string;
  passwordHash: string | null;
  role?: "user" | "admin";
}) {
  const id = randomId();
  const role = input.role ?? "user";
  const avatarUrl = (input.avatarUrl ?? "").trim();
  const normalizedEmail = normalizeEmail(input.email);
  const normalizedUsername = normalizeUsername(input.username);
  const firestore = getFirebaseFirestore();

  if (firestore) {
    const createdAt = now();
    await firestore.collection("users").doc(id).set({
      username: input.username.trim(),
      usernameLower: normalizedUsername,
      email: normalizedEmail,
      emailLower: normalizedEmail,
      phone: input.phone.trim(),
      avatarUrl,
      passwordHash: input.passwordHash,
      role,
      createdAt,
      updatedAt: createdAt,
    });

    const created = await findFirestoreUserById(id);
    if (!created) {
      throw new Error("Failed to read created Firestore user.");
    }

    await upsertLocalUserMirror(created).catch(() => {});
    return created;
  }

  await ensureDatabase();
  await run(
    `INSERT INTO users (id, username, email, phone, avatar_url, password_hash, role, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.username.trim(),
      normalizedEmail,
      input.phone.trim(),
      avatarUrl,
      input.passwordHash,
      role,
      now(),
      now(),
    ],
  );
  return findLocalUserById(id);
}

export async function updateUserById(
  id: string,
  input: Partial<{
    username: string;
    email: string;
    phone: string;
    avatarUrl: string;
    passwordHash: string | null;
    role: "user" | "admin";
  }>,
) {
  const firestore = getFirebaseFirestore();
  if (firestore) {
    const current = (await findFirestoreUserById(id)) ?? (await findLocalUserById(id));
    if (!current) {
      return null;
    }

    const nextUsername = (input.username ?? current.username).trim();
    const nextEmail = normalizeEmail(input.email ?? current.email);
    const nextPhone = (input.phone ?? current.phone).trim();
    const nextAvatarUrl =
      input.avatarUrl === undefined ? current.avatarUrl : input.avatarUrl.trim();
    const nextPasswordHash =
      input.passwordHash === undefined ? current.passwordHash : input.passwordHash;
    const nextRole = input.role ?? current.role;

    await firestore.collection("users").doc(id).set(
      {
        username: nextUsername,
        usernameLower: normalizeUsername(nextUsername),
        email: nextEmail,
        emailLower: nextEmail,
        phone: nextPhone,
        avatarUrl: nextAvatarUrl,
        passwordHash: nextPasswordHash,
        role: nextRole,
        updatedAt: now(),
      },
      { merge: true },
    );

    const updated = await findFirestoreUserById(id);
    if (!updated) {
      return null;
    }

    await upsertLocalUserMirror(updated).catch(() => {});
    return updated;
  }

  await ensureDatabase();
  const current = await findLocalUserById(id);
  if (!current) {
    return null;
  }

  const nextAvatarUrl =
    input.avatarUrl === undefined ? current.avatarUrl : input.avatarUrl.trim();

  await run(
    `UPDATE users
     SET username = ?, email = ?, phone = ?, avatar_url = ?, password_hash = ?, role = ?, updated_at = ?
     WHERE id = ?`,
    [
      input.username ?? current.username,
      normalizeEmail(input.email ?? current.email),
      input.phone ?? current.phone,
      nextAvatarUrl,
      input.passwordHash ?? current.passwordHash,
      input.role ?? current.role,
      now(),
      id,
    ],
  );
  return findLocalUserById(id);
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
  duration: string;
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

  const mediaUrl = resolveMediaUrl(input.imageUrl);
  await run(
    `INSERT INTO products
      (id, slug, name, category, short_description, description, duration, price, image_url, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [
      id,
      slug,
      input.name,
      input.category,
      input.shortDescription,
      input.description,
      input.duration.trim(),
      input.price,
      mediaUrl,
      now(),
      now(),
    ],
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
    duration: string;
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
  const nextMediaUrl =
    input.imageUrl === undefined ? current.imageUrl : resolveMediaUrl(input.imageUrl);
  const nextSlug =
    nextName !== current.name
      ? `${slugify(nextName)}-${Math.floor(Math.random() * 900 + 100)}`
      : current.slug;

  await run(
    `UPDATE products
     SET slug = ?, name = ?, category = ?, short_description = ?, description = ?, duration = ?, price = ?, image_url = ?, is_active = ?, updated_at = ?
     WHERE id = ?`,
    [
      nextSlug,
      nextName,
      input.category ?? current.category,
      input.shortDescription ?? current.shortDescription,
      input.description ?? current.description,
      input.duration?.trim() ?? current.duration,
      input.price ?? current.price,
      nextMediaUrl,
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

export async function getInformationById(id: string) {
  await ensureDatabase();
  const res = await run("SELECT * FROM informations WHERE id = ? LIMIT 1", [id]);
  const row = res.rows[0] as Record<string, unknown> | undefined;
  return row ? mapInfo(row) : null;
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
  const mediaUrl = resolveMediaUrl(input.imageUrl);
  const pollOptions = normalizePollOptions(input.pollOptions);
  const pollVotes = input.type === "poll" ? normalizePollVotes(pollOptions, {}) : {};
  await run(
    `INSERT INTO informations
      (id, type, title, body, image_url, poll_options, poll_votes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.type,
      input.title,
      input.body,
      mediaUrl,
      JSON.stringify(pollOptions),
      JSON.stringify(pollVotes),
      now(),
      now(),
    ],
  );

  return getInformationById(id);
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
  const current = await getInformationById(id);
  if (!current) {
    return null;
  }
  const nextMediaUrl =
    input.imageUrl === undefined ? current.imageUrl : resolveMediaUrl(input.imageUrl);
  const nextType = input.type ?? current.type;
  const nextPollOptions = normalizePollOptions(input.pollOptions ?? current.pollOptions);
  const nextPollVotes =
    nextType === "poll"
      ? normalizePollVotes(nextPollOptions, current.pollVotes)
      : {};

  await run(
    `UPDATE informations
     SET type = ?, title = ?, body = ?, image_url = ?, poll_options = ?, poll_votes = ?, updated_at = ?
     WHERE id = ?`,
    [
      nextType,
      input.title ?? current.title,
      input.body ?? current.body,
      nextMediaUrl,
      JSON.stringify(nextPollOptions),
      JSON.stringify(nextPollVotes),
      now(),
      id,
    ],
  );

  return getInformationById(id);
}

export async function voteInformationPoll(id: string, option: string) {
  await ensureDatabase();
  const info = await getInformationById(id);
  if (!info || info.type !== "poll") {
    return null;
  }

  const normalizedOption = option.trim();
  if (!info.pollOptions.includes(normalizedOption)) {
    return null;
  }

  const nextPollVotes = normalizePollVotes(info.pollOptions, info.pollVotes);
  nextPollVotes[normalizedOption] = (nextPollVotes[normalizedOption] ?? 0) + 1;

  await run(
    `UPDATE informations
     SET poll_votes = ?, updated_at = ?
     WHERE id = ?`,
    [JSON.stringify(nextPollVotes), now(), id],
  );

  return getInformationById(id);
}

export async function deleteInformation(id: string) {
  await ensureDatabase();
  await run("DELETE FROM informations WHERE id = ?", [id]);
}

export async function listTestimonials() {
  await ensureDatabase();
  const res = await run("SELECT * FROM testimonials ORDER BY created_at DESC");
  return res.rows.map((row) => mapTestimonial(row as Record<string, unknown>));
}

export async function createTestimonial(input: {
  name: string;
  country: string;
  message: string;
  rating: number;
  mediaUrl: string;
  audioUrl: string;
}) {
  await ensureDatabase();
  const id = randomId();
  const mediaUrl = resolveMediaUrl(input.mediaUrl);
  const audioUrl = input.audioUrl.trim() || "/assets/notif.mp3";
  await run(
    `INSERT INTO testimonials
      (id, name, country, message, rating, media_url, audio_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name,
      input.country,
      input.message,
      Math.max(1, Math.min(5, input.rating)),
      mediaUrl,
      audioUrl,
      now(),
      now(),
    ],
  );

  const res = await run("SELECT * FROM testimonials WHERE id = ? LIMIT 1", [id]);
  const row = res.rows[0] as Record<string, unknown> | undefined;
  return row ? mapTestimonial(row) : null;
}

export async function updateTestimonial(
  id: string,
  input: Partial<{
    name: string;
    country: string;
    message: string;
    rating: number;
    mediaUrl: string;
    audioUrl: string;
  }>,
) {
  await ensureDatabase();
  const res = await run("SELECT * FROM testimonials WHERE id = ? LIMIT 1", [id]);
  const row = res.rows[0] as Record<string, unknown> | undefined;
  if (!row) {
    return null;
  }
  const current = mapTestimonial(row);
  const nextMediaUrl =
    input.mediaUrl === undefined ? current.mediaUrl : resolveMediaUrl(input.mediaUrl);
  const nextAudioUrl =
    input.audioUrl === undefined ? current.audioUrl : input.audioUrl.trim() || "/assets/notif.mp3";

  await run(
    `UPDATE testimonials
     SET name = ?, country = ?, message = ?, rating = ?, media_url = ?, audio_url = ?, updated_at = ?
     WHERE id = ?`,
    [
      input.name ?? current.name,
      input.country ?? current.country,
      input.message ?? current.message,
      input.rating === undefined
        ? current.rating
        : Math.max(1, Math.min(5, input.rating)),
      nextMediaUrl,
      nextAudioUrl,
      now(),
      id,
    ],
  );

  const updated = await run("SELECT * FROM testimonials WHERE id = ? LIMIT 1", [id]);
  return mapTestimonial(updated.rows[0] as Record<string, unknown>);
}

export async function deleteTestimonial(id: string) {
  await ensureDatabase();
  await run("DELETE FROM testimonials WHERE id = ?", [id]);
}

export async function listMarquees() {
  await ensureDatabase();
  const res = await run(
    "SELECT * FROM marquees ORDER BY sort_order ASC, created_at ASC",
  );
  return res.rows.map((row) => mapMarquee(row as Record<string, unknown>));
}

export async function getMarqueeById(id: string) {
  await ensureDatabase();
  const res = await run("SELECT * FROM marquees WHERE id = ? LIMIT 1", [id]);
  const row = res.rows[0] as Record<string, unknown> | undefined;
  return row ? mapMarquee(row) : null;
}

export async function createMarquee(input: {
  label: string;
  imageUrl: string;
  isActive: boolean;
  sortOrder: number;
}) {
  await ensureDatabase();
  const id = randomId();
  const mediaUrl = resolveMediaUrl(input.imageUrl);

  await run(
    `INSERT INTO marquees
      (id, label, image_url, is_active, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.label.trim(),
      mediaUrl,
      Number(input.isActive),
      Math.max(0, Math.floor(input.sortOrder)),
      now(),
      now(),
    ],
  );

  return getMarqueeById(id);
}

export async function updateMarquee(
  id: string,
  input: Partial<{
    label: string;
    imageUrl: string;
    isActive: boolean;
    sortOrder: number;
  }>,
) {
  await ensureDatabase();
  const current = await getMarqueeById(id);
  if (!current) {
    return null;
  }

  const nextMediaUrl =
    input.imageUrl === undefined ? current.imageUrl : resolveMediaUrl(input.imageUrl);

  await run(
    `UPDATE marquees
     SET label = ?, image_url = ?, is_active = ?, sort_order = ?, updated_at = ?
     WHERE id = ?`,
    [
      input.label?.trim() ?? current.label,
      nextMediaUrl,
      input.isActive === undefined ? Number(current.isActive) : Number(input.isActive),
      input.sortOrder === undefined
        ? current.sortOrder
        : Math.max(0, Math.floor(input.sortOrder)),
      now(),
      id,
    ],
  );

  return getMarqueeById(id);
}

export async function deleteMarquee(id: string) {
  await ensureDatabase();
  await run("DELETE FROM marquees WHERE id = ?", [id]);
}

export async function getPrivacyPolicyPage() {
  await ensureDatabase();
  const res = await run("SELECT * FROM privacy_policy_pages WHERE id = ? LIMIT 1", [
    PRIVACY_POLICY_PAGE_ID,
  ]);
  const row = res.rows[0] as Record<string, unknown> | undefined;
  return row ? mapPrivacyPolicyPage(row) : getDefaultPrivacyPolicyPage();
}

export async function upsertPrivacyPolicyPage(input: {
  title: string;
  updatedLabel: string;
  bannerImageUrl: string;
  contentHtml: string;
}) {
  await ensureDatabase();
  const safeTitle = input.title.trim() || defaultPrivacyPolicyPage.title;
  const safeUpdatedLabel = input.updatedLabel.trim() || defaultPrivacyPolicyPage.updatedLabel;
  const safeBanner = resolveMediaUrl(input.bannerImageUrl) || defaultPrivacyPolicyPage.bannerImageUrl;
  const safeContent = input.contentHtml.trim() || defaultPrivacyPolicyPage.contentHtml;
  const timestamp = now();

  await run(
    `INSERT INTO privacy_policy_pages
      (id, title, updated_label, banner_image_url, content_html, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      updated_label = excluded.updated_label,
      banner_image_url = excluded.banner_image_url,
      content_html = excluded.content_html,
      updated_at = excluded.updated_at`,
    [
      PRIVACY_POLICY_PAGE_ID,
      safeTitle,
      safeUpdatedLabel,
      safeBanner,
      safeContent,
      timestamp,
      timestamp,
    ],
  );

  return getPrivacyPolicyPage();
}

export async function createOrder(input: {
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  items: Array<{
    productId: string;
    productName: string;
    productDuration: string;
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
        (id, order_id, product_id, product_name, product_duration, quantity, unit_price)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        randomId(),
        id,
        item.productId,
        item.productName,
        item.productDuration,
        item.quantity,
        item.unitPrice,
      ],
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
      userPhone: String(data.user_phone ?? ""),
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
      productDuration: String(data.product_duration ?? ""),
      quantity: Number(data.quantity),
      unitPrice: Number(data.unit_price),
    } satisfies StoreOrderItem;
  });
}

export async function getOrderById(id: string) {
  await ensureDatabase();
  const res = await run("SELECT * FROM orders WHERE id = ? LIMIT 1", [id]);
  const row = res.rows[0] as Record<string, unknown> | undefined;
  if (!row) {
    return null;
  }

  return {
    id: String(row.id),
    userName: String(row.user_name),
    userEmail: String(row.user_email),
    userPhone: String(row.user_phone ?? ""),
    total: Number(row.total ?? 0),
    status: String(row.status ?? "new"),
    createdAt: new Date(Number(row.created_at)).toISOString(),
  } satisfies OrderSummary;
}

export async function listOrdersWithItems(limit = 100) {
  const orders = await listOrders(limit);
  const detailed: StoreOrderDetail[] = [];

  for (const order of orders) {
    const items = await listOrderItemsByOrderId(order.id);
    detailed.push({
      ...order,
      items,
    });
  }

  return detailed;
}

export async function upsertEmailVerification(input: {
  email: string;
  username: string;
  phone: string;
  passwordHash: string;
  otpHash: string;
  expiresAt: number;
}) {
  await ensureDatabase();
  const existing = await run(
    "SELECT id FROM email_verifications WHERE lower(email) = lower(?) LIMIT 1",
    [input.email],
  );
  if (existing.rows.length > 0) {
    await run(
      `UPDATE email_verifications
       SET username = ?, phone = ?, password_hash = ?, otp_hash = ?, expires_at = ?, attempts = 0, created_at = ?
       WHERE lower(email) = lower(?)`,
      [
        input.username,
        input.phone,
        input.passwordHash,
        input.otpHash,
        input.expiresAt,
        now(),
        input.email,
      ],
    );
    return;
  }

  await run(
    `INSERT INTO email_verifications
      (id, email, username, phone, password_hash, otp_hash, expires_at, attempts, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    [
      randomId(),
      input.email,
      input.username,
      input.phone,
      input.passwordHash,
      input.otpHash,
      input.expiresAt,
      now(),
    ],
  );
}

export async function getEmailVerificationByEmail(email: string) {
  await ensureDatabase();
  const res = await run(
    "SELECT * FROM email_verifications WHERE lower(email) = lower(?) LIMIT 1",
    [email],
  );
  const row = res.rows[0] as Record<string, unknown> | undefined;
  if (!row) {
    return null;
  }

  return {
    id: String(row.id),
    email: String(row.email),
    username: String(row.username),
    phone: String(row.phone ?? ""),
    passwordHash: String(row.password_hash),
    otpHash: String(row.otp_hash),
    expiresAt: Number(row.expires_at),
    attempts: Number(row.attempts ?? 0),
    createdAt: Number(row.created_at ?? now()),
  };
}

export async function incrementEmailVerificationAttempts(email: string) {
  await ensureDatabase();
  await run(
    `UPDATE email_verifications
     SET attempts = attempts + 1
     WHERE lower(email) = lower(?)`,
    [email],
  );
}

export async function deleteEmailVerificationByEmail(email: string) {
  await ensureDatabase();
  await run("DELETE FROM email_verifications WHERE lower(email) = lower(?)", [email]);
}

export async function upsertPasswordChangeOtp(input: {
  userId: string;
  email: string;
  otpHash: string;
  expiresAt: number;
}) {
  await ensureDatabase();
  const existing = await run(
    "SELECT id FROM password_change_otps WHERE user_id = ? LIMIT 1",
    [input.userId],
  );

  if (existing.rows.length > 0) {
    await run(
      `UPDATE password_change_otps
       SET email = ?, otp_hash = ?, expires_at = ?, attempts = 0, created_at = ?
       WHERE user_id = ?`,
      [input.email, input.otpHash, input.expiresAt, now(), input.userId],
    );
    return;
  }

  await run(
    `INSERT INTO password_change_otps
      (id, user_id, email, otp_hash, expires_at, attempts, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?)`,
    [randomId(), input.userId, input.email, input.otpHash, input.expiresAt, now()],
  );
}

export async function getPasswordChangeOtpByUserId(userId: string) {
  await ensureDatabase();
  const res = await run(
    "SELECT * FROM password_change_otps WHERE user_id = ? LIMIT 1",
    [userId],
  );
  const row = res.rows[0] as Record<string, unknown> | undefined;
  if (!row) {
    return null;
  }

  return {
    id: String(row.id),
    userId: String(row.user_id),
    email: String(row.email),
    otpHash: String(row.otp_hash),
    expiresAt: Number(row.expires_at),
    attempts: Number(row.attempts ?? 0),
    createdAt: Number(row.created_at ?? now()),
  };
}

export async function incrementPasswordChangeOtpAttempts(userId: string) {
  await ensureDatabase();
  await run(
    `UPDATE password_change_otps
     SET attempts = attempts + 1
     WHERE user_id = ?`,
    [userId],
  );
}

export async function deletePasswordChangeOtpByUserId(userId: string) {
  await ensureDatabase();
  await run("DELETE FROM password_change_otps WHERE user_id = ?", [userId]);
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
