import admin from "firebase-admin";
import { createClient } from "@libsql/client";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(".env");
  } catch {}
}

const writeEnabled = process.env.MIGRATION_WRITE === "true";
const mode = process.env.MIGRATION_MODE || "firestore";

function readCredential(jsonName, fileName, allowLegacySource = false) {
  const json = process.env[jsonName];
  if (json) return JSON.parse(json);
  const file = process.env[fileName];
  if (file) return JSON.parse(fs.readFileSync(file, "utf8"));
  if (allowLegacySource) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
      return JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString());
    }
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      return {
        project_id: process.env.FIREBASE_PROJECT_ID,
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      };
    }
  }
  throw new Error(`${jsonName} atau ${fileName} wajib diisi.`);
}

function createApp(name, credential) {
  return admin.initializeApp({ credential: admin.credential.cert(credential) }, name);
}

function valueForFirestore(value) {
  if (value === null || value === undefined) return null;
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return Buffer.from(value).toString("base64");
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed) || (parsed && typeof parsed === "object")) return parsed;
    } catch {}
  }
  return value;
}

async function writeDocument(ref, data) {
  if (!writeEnabled) return;
  await ref.set(data, { merge: true });
}

async function makeFirestoreSafe(destination, collectionName, documentId, data) {
  const safeData = { ...data };
  const maxFieldBytes = 850_000;
  for (const [field, value] of Object.entries(data)) {
    const serialized = JSON.stringify(value);
    if (!serialized || Buffer.byteLength(serialized, "utf8") <= maxFieldBytes) continue;

    const referenceId = crypto
      .createHash("sha256")
      .update(`${collectionName}/${documentId}/${field}`)
      .digest("hex");
    const largeRef = destination.collection("_migrationLargeFields").doc(referenceId);
    const chunkSize = 700_000;
    const chunks = [];
    for (let offset = 0; offset < serialized.length; offset += chunkSize) {
      chunks.push(serialized.slice(offset, offset + chunkSize));
    }

    if (writeEnabled) {
      await largeRef.set({
        sourceCollection: collectionName,
        sourceDocumentId: documentId,
        sourceField: field,
        encoding: "json",
        byteLength: Buffer.byteLength(serialized, "utf8"),
        chunkCount: chunks.length,
      }, { merge: true });
      for (const [index, chunk] of chunks.entries()) {
        await largeRef.collection("chunks").doc(String(index).padStart(6, "0")).set({ value: chunk }, { merge: true });
      }
    }

    safeData[field] = {
      __largeFieldReference: largeRef.path,
      encoding: "json",
      byteLength: Buffer.byteLength(serialized, "utf8"),
      chunkCount: chunks.length,
    };
  }
  return safeData;
}

async function copyDocumentTree(sourceRef, destinationRef, stats) {
  const snapshot = await sourceRef.get();
  if (!snapshot.exists) return;
  const data = snapshot.data() ?? {};
  stats.documents += 1;
  await writeDocument(destinationRef, data);

  const subcollections = await sourceRef.listCollections();
  for (const subcollection of subcollections) {
    const childSnapshot = await subcollection.get();
    for (const child of childSnapshot.docs) {
      await copyDocumentTree(child.ref, destinationRef.collection(subcollection.id).doc(child.id), stats);
    }
  }
}

async function migrateFirestoreProject() {
  const sourceCredential = readCredential("SOURCE_FIREBASE_SERVICE_ACCOUNT_JSON", "SOURCE_FIREBASE_SERVICE_ACCOUNT_FILE", true);
  const destinationCredential = readCredential("DEST_FIREBASE_SERVICE_ACCOUNT_JSON", "DEST_FIREBASE_SERVICE_ACCOUNT_FILE");
  const sourceApp = createApp("migration-source", sourceCredential);
  const destinationApp = createApp("migration-destination", destinationCredential);
  const source = sourceApp.firestore();
  const destination = destinationApp.firestore();
  const stats = { collections: 0, documents: 0 };

  const collections = await source.listCollections();
  for (const collection of collections) {
    stats.collections += 1;
    const snapshot = await collection.get();
    for (const document of snapshot.docs) {
      await copyDocumentTree(document.ref, destination.collection(collection.id).doc(document.id), stats);
    }
  }

  console.log(`${writeEnabled ? "Migrated" : "Dry run"}: ${stats.documents} Firestore documents across ${stats.collections} collections.`);
}

async function migrateTursoDatabase() {
  const destinationCredential = readCredential("DEST_FIREBASE_SERVICE_ACCOUNT_JSON", "DEST_FIREBASE_SERVICE_ACCOUNT_FILE");
  const destinationApp = createApp("migration-turso-destination", destinationCredential);
  const destination = destinationApp.firestore();
  const localDatabase = process.env.TURSO_LOCAL_DB;
  const tursoUrl = process.env.TURSO_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;
  if (!localDatabase && (!tursoUrl || !tursoToken)) {
    throw new Error("Isi TURSO_LOCAL_DB atau TURSO_URL dan TURSO_AUTH_TOKEN.");
  }

  const turso = localDatabase
    ? createClient({ url: `file:${path.resolve(localDatabase)}` })
    : createClient({ url: tursoUrl, authToken: tursoToken });
  const tablesResult = await turso.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
  let rows = 0;
  for (const tableRow of tablesResult.rows) {
    const table = String(tableRow.name);
    const result = await turso.execute(`SELECT * FROM "${table.replaceAll('"', '""')}"`);
    for (const row of result.rows) {
      const raw = Object.fromEntries(Object.entries(row).map(([key, value]) => [key, valueForFirestore(value)]));
      const sourceId = raw.id ? String(raw.id) : crypto.createHash("sha256").update(JSON.stringify(raw)).digest("hex").slice(0, 32);
      const data = await makeFirestoreSafe(destination, table, sourceId, {
        ...raw,
        _migrationSource: "turso",
        _migrationTable: table,
      });
      rows += 1;
      await writeDocument(destination.collection(table).doc(sourceId), data);
    }
  }
  console.log(`${writeEnabled ? "Migrated" : "Dry run"}: ${rows} Turso rows into matching Firestore collections.`);
}

if (!writeEnabled) {
  console.log("DRY RUN: no destination data will be changed. Set MIGRATION_WRITE=true after reviewing the counts.");
}

if (mode === "firestore") await migrateFirestoreProject();
else if (mode === "turso") await migrateTursoDatabase();
else throw new Error("MIGRATION_MODE harus firestore atau turso.");
