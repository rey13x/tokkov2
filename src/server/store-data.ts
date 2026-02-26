import type {
  InformationType,
  OrderSummary,
  StoreInformation,
  StoreProduct,
  StoreTestimonial,
} from "@/types/store";
import {
  createInformation as createInformationDb,
  createOrder as createOrderDb,
  createProduct as createProductDb,
  deleteAllProducts as deleteAllProductsDb,
  deleteInformation as deleteInformationDb,
  deleteProduct as deleteProductDb,
  getOrderStatsLastHours as getOrderStatsLastHoursDb,
  getProductById as getProductByIdDb,
  listAllProducts as listAllProductsDb,
  listInformations as listInformationsDb,
  listOrders as listOrdersDb,
  listProducts as listProductsDb,
  updateInformation as updateInformationDb,
  updateProduct as updateProductDb,
} from "@/server/db";
import { getFirebaseFirestore } from "@/server/firebase-admin";

const now = () => Date.now();

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function pad2(value: number) {
  return value.toString().padStart(2, "0");
}

function bucketFromTimestamp(ms: number) {
  const date = new Date(ms);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function isFirebaseDataEnabled() {
  return Boolean(getFirebaseFirestore());
}

function mapProductDoc(
  id: string,
  data: Record<string, unknown> | undefined,
): StoreProduct {
  return {
    id,
    slug: String(data?.slug ?? id),
    name: String(data?.name ?? ""),
    category: String(data?.category ?? "App Premium"),
    shortDescription: String(data?.shortDescription ?? ""),
    description: String(data?.description ?? ""),
    price: Number(data?.price ?? 0),
    imageUrl: String(data?.imageUrl ?? "/assets/background.jpg"),
    isActive: Boolean(data?.isActive ?? true),
  };
}

function mapInformationDoc(
  id: string,
  data: Record<string, unknown> | undefined,
): StoreInformation {
  return {
    id,
    type: (String(data?.type ?? "update") as InformationType),
    title: String(data?.title ?? ""),
    body: String(data?.body ?? ""),
    imageUrl: String(data?.imageUrl ?? ""),
    pollOptions: Array.isArray(data?.pollOptions)
      ? (data?.pollOptions as string[])
      : [],
    createdAt: new Date(Number(data?.createdAt ?? now())).toISOString(),
  };
}

const fallbackTestimonials: StoreTestimonial[] = [
  {
    id: "testi-1",
    name: "StrezKING User",
    message:
      "StrezKING memang sangat baik untuk mendapatkan tidur yang lebih baik. Saya coba 10 sachet dan sangat membantu.",
    rating: 5,
    audioUrl: "/assets/bagas.mp3",
    createdAt: new Date().toISOString(),
  },
];

function mapTestimonialDoc(
  id: string,
  data: Record<string, unknown> | undefined,
): StoreTestimonial {
  return {
    id,
    name: String(data?.name ?? ""),
    message: String(data?.message ?? ""),
    rating: Number(data?.rating ?? 5),
    audioUrl: String(data?.audioUrl ?? "/assets/bagas.mp3"),
    createdAt: new Date(Number(data?.createdAt ?? now())).toISOString(),
  };
}

async function getUniqueSlug(firestore: FirebaseFirestore.Firestore, baseName: string) {
  const baseSlug = slugify(baseName) || "produk";
  let candidate = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await firestore
      .collection("products")
      .where("slugLower", "==", candidate.toLowerCase())
      .limit(1)
      .get();

    if (existing.empty) {
      return candidate;
    }

    counter += 1;
    candidate = `${baseSlug}-${counter}`;
  }
}

export async function listProducts() {
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    return listProductsDb();
  }

  const snapshot = await firestore
    .collection("products")
    .orderBy("createdAt", "desc")
    .get();

  return snapshot.docs
    .map((doc) => mapProductDoc(doc.id, doc.data() as Record<string, unknown>))
    .filter((product) => product.isActive);
}

export async function listAllProducts() {
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    return listAllProductsDb();
  }

  const snapshot = await firestore
    .collection("products")
    .orderBy("createdAt", "desc")
    .get();

  return snapshot.docs.map((doc) =>
    mapProductDoc(doc.id, doc.data() as Record<string, unknown>),
  );
}

export async function getProductById(id: string) {
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    return getProductByIdDb(id);
  }

  const doc = await firestore.collection("products").doc(id).get();
  if (!doc.exists) {
    return null;
  }

  return mapProductDoc(doc.id, doc.data() as Record<string, unknown>);
}

export async function createProduct(input: {
  name: string;
  category: string;
  shortDescription: string;
  description: string;
  price: number;
  imageUrl: string;
}) {
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    return createProductDb(input);
  }

  const id = crypto.randomUUID();
  const createdAt = now();
  const slug = await getUniqueSlug(firestore, input.name);

  await firestore.collection("products").doc(id).set({
    slug,
    slugLower: slug.toLowerCase(),
    name: input.name,
    category: input.category,
    shortDescription: input.shortDescription,
    description: input.description,
    price: input.price,
    imageUrl: input.imageUrl,
    isActive: true,
    createdAt,
    updatedAt: createdAt,
  });

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
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    return updateProductDb(id, input);
  }

  const ref = firestore.collection("products").doc(id);
  const current = await ref.get();
  if (!current.exists) {
    return null;
  }

  const currentData = current.data() as Record<string, unknown>;
  const nextName = input.name ?? String(currentData.name ?? "");
  let nextSlug = String(currentData.slug ?? "");

  if (input.name && input.name !== currentData.name) {
    nextSlug = await getUniqueSlug(firestore, nextName);
  }

  await ref.update({
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.category !== undefined ? { category: input.category } : {}),
    ...(input.shortDescription !== undefined
      ? { shortDescription: input.shortDescription }
      : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.price !== undefined ? { price: input.price } : {}),
    ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    slug: nextSlug,
    slugLower: nextSlug.toLowerCase(),
    updatedAt: now(),
  });

  return getProductById(id);
}

export async function deleteProduct(id: string) {
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    await deleteProductDb(id);
    return;
  }
  await firestore.collection("products").doc(id).delete();
}

export async function deleteAllProducts() {
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    await deleteAllProductsDb();
    return;
  }

  const snapshot = await firestore.collection("products").get();
  const batch = firestore.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
}

export async function listInformations() {
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    return listInformationsDb();
  }

  const snapshot = await firestore
    .collection("informations")
    .orderBy("createdAt", "desc")
    .get();
  return snapshot.docs.map((doc) =>
    mapInformationDoc(doc.id, doc.data() as Record<string, unknown>),
  );
}

export async function createInformation(input: {
  type: InformationType;
  title: string;
  body: string;
  imageUrl: string;
  pollOptions: string[];
}) {
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    return createInformationDb(input);
  }

  const id = crypto.randomUUID();
  const createdAt = now();
  await firestore.collection("informations").doc(id).set({
    type: input.type,
    title: input.title,
    body: input.body,
    imageUrl: input.imageUrl,
    pollOptions: input.pollOptions,
    createdAt,
    updatedAt: createdAt,
  });

  const doc = await firestore.collection("informations").doc(id).get();
  return mapInformationDoc(doc.id, doc.data() as Record<string, unknown>);
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
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    return updateInformationDb(id, input);
  }

  const ref = firestore.collection("informations").doc(id);
  const doc = await ref.get();
  if (!doc.exists) {
    return null;
  }

  await ref.update({
    ...(input.type !== undefined ? { type: input.type } : {}),
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.body !== undefined ? { body: input.body } : {}),
    ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
    ...(input.pollOptions !== undefined ? { pollOptions: input.pollOptions } : {}),
    updatedAt: now(),
  });

  const updated = await ref.get();
  return mapInformationDoc(updated.id, updated.data() as Record<string, unknown>);
}

export async function deleteInformation(id: string) {
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    await deleteInformationDb(id);
    return;
  }
  await firestore.collection("informations").doc(id).delete();
}

export async function listTestimonials() {
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    return fallbackTestimonials;
  }

  const snapshot = await firestore
    .collection("testimonials")
    .orderBy("createdAt", "desc")
    .get();

  return snapshot.docs.map((doc) =>
    mapTestimonialDoc(doc.id, doc.data() as Record<string, unknown>),
  );
}

export async function createTestimonial(input: {
  name: string;
  message: string;
  rating: number;
  audioUrl: string;
}) {
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    throw new Error("Firebase belum dikonfigurasi.");
  }

  const id = crypto.randomUUID();
  const createdAt = now();
  await firestore.collection("testimonials").doc(id).set({
    name: input.name,
    message: input.message,
    rating: Math.max(1, Math.min(5, input.rating)),
    audioUrl: input.audioUrl,
    createdAt,
    updatedAt: createdAt,
  });

  const doc = await firestore.collection("testimonials").doc(id).get();
  return mapTestimonialDoc(doc.id, doc.data() as Record<string, unknown>);
}

export async function updateTestimonial(
  id: string,
  input: Partial<{
    name: string;
    message: string;
    rating: number;
    audioUrl: string;
  }>,
) {
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    throw new Error("Firebase belum dikonfigurasi.");
  }

  const ref = firestore.collection("testimonials").doc(id);
  const doc = await ref.get();
  if (!doc.exists) {
    return null;
  }

  await ref.update({
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.message !== undefined ? { message: input.message } : {}),
    ...(input.rating !== undefined ? { rating: Math.max(1, Math.min(5, input.rating)) } : {}),
    ...(input.audioUrl !== undefined ? { audioUrl: input.audioUrl } : {}),
    updatedAt: now(),
  });

  const updated = await ref.get();
  return mapTestimonialDoc(updated.id, updated.data() as Record<string, unknown>);
}

export async function deleteTestimonial(id: string) {
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    throw new Error("Firebase belum dikonfigurasi.");
  }
  await firestore.collection("testimonials").doc(id).delete();
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
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    return createOrderDb(input);
  }

  const id = crypto.randomUUID();
  const createdAt = now();
  const total = input.items.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);

  await firestore.collection("orders").doc(id).set({
    userId: input.userId,
    userName: input.userName,
    userEmail: input.userEmail,
    userPhone: input.userPhone,
    total,
    status: "new",
    createdAt,
    items: input.items,
  });

  return { id, total };
}

export async function listOrders(limit = 100) {
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    return listOrdersDb(limit);
  }

  const snapshot = await firestore
    .collection("orders")
    .orderBy("createdAt", "desc")
    .limit(Math.max(1, limit))
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data() as Record<string, unknown>;
    return {
      id: doc.id,
      userName: String(data.userName ?? ""),
      userEmail: String(data.userEmail ?? ""),
      total: Number(data.total ?? 0),
      status: String(data.status ?? "new"),
      createdAt: new Date(Number(data.createdAt ?? now())).toISOString(),
    } satisfies OrderSummary;
  });
}

export async function getOrderStatsLastHours(hours = 12) {
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    return getOrderStatsLastHoursDb(hours);
  }

  const from = now() - hours * 60 * 60 * 1000;
  const snapshot = await firestore
    .collection("orders")
    .where("createdAt", ">=", from)
    .orderBy("createdAt", "asc")
    .get();

  const bucketMap = new Map<
    string,
    {
      bucket: string;
      totalOrders: number;
      totalAmount: number;
    }
  >();

  snapshot.docs.forEach((doc) => {
    const data = doc.data() as Record<string, unknown>;
    const createdAt = Number(data.createdAt ?? now());
    const bucket = bucketFromTimestamp(createdAt);
    const total = Number(data.total ?? 0);

    const current = bucketMap.get(bucket) ?? {
      bucket,
      totalOrders: 0,
      totalAmount: 0,
    };
    current.totalOrders += 1;
    current.totalAmount += total;
    bucketMap.set(bucket, current);
  });

  return [...bucketMap.values()];
}
