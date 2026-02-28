import type {
  InformationType,
  OrderSummary,
  StoreInformation,
  StoreMarqueeItem,
  StoreOrderDetail,
  StoreOrderItem,
  StorePaymentSettings,
  StorePrivacyPolicyPage,
  StoreProduct,
  StoreTestimonial,
} from "@/types/store";
import {
  createInformation as createInformationDb,
  createOrder as createOrderDb,
  createProduct as createProductDb,
  createMarquee as createMarqueeDb,
  createTestimonial as createTestimonialDb,
  deleteAllProducts as deleteAllProductsDb,
  deleteInformation as deleteInformationDb,
  deleteMarquee as deleteMarqueeDb,
  deleteOrder as deleteOrderDb,
  deleteProduct as deleteProductDb,
  deleteTestimonial as deleteTestimonialDb,
  getAppMetaValue as getAppMetaValueDb,
  getInformationById as getInformationByIdDb,
  getMarqueeById as getMarqueeByIdDb,
  getOrderStatsLastHours as getOrderStatsLastHoursDb,
  getOrderById as getOrderByIdDb,
  getPrivacyPolicyPage as getPrivacyPolicyPageDb,
  getProductById as getProductByIdDb,
  listMarquees as listMarqueesDb,
  listOrderItemsByOrderId as listOrderItemsByOrderIdDb,
  listOrdersWithItems as listOrdersWithItemsDb,
  listAllProducts as listAllProductsDb,
  listInformations as listInformationsDb,
  listOrders as listOrdersDb,
  listProducts as listProductsDb,
  listTestimonials as listTestimonialsDb,
  upsertAppMetaValue as upsertAppMetaValueDb,
  updateInformation as updateInformationDb,
  updateMarquee as updateMarqueeDb,
  updateOrderStatus as updateOrderStatusDb,
  updateProduct as updateProductDb,
  updateTestimonial as updateTestimonialDb,
  upsertPrivacyPolicyPage as upsertPrivacyPolicyPageDb,
  voteInformationPoll as voteInformationPollDb,
} from "@/server/db";
import { getFirebaseFirestore } from "@/server/firebase-admin";
import { resolveMediaUrl } from "@/lib/media";

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

function normalizePollVotes(options: string[], raw: unknown) {
  const row =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const votes: Record<string, number> = {};
  for (const option of options) {
    const value = Number(row[option] ?? 0);
    votes[option] = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  }
  return votes;
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
    duration: String(data?.duration ?? ""),
    price: Number(data?.price ?? 0),
    imageUrl: resolveMediaUrl(String(data?.imageUrl ?? "")),
    isActive: Boolean(data?.isActive ?? true),
  };
}

function mapInformationDoc(
  id: string,
  data: Record<string, unknown> | undefined,
): StoreInformation {
  const pollOptions = Array.isArray(data?.pollOptions)
    ? normalizePollOptions(data.pollOptions as string[])
    : [];

  return {
    id,
    type: (String(data?.type ?? "update") as InformationType),
    title: String(data?.title ?? ""),
    body: String(data?.body ?? ""),
    imageUrl: resolveMediaUrl(String(data?.imageUrl ?? "")),
    pollOptions,
    pollVotes: normalizePollVotes(pollOptions, data?.pollVotes),
    createdAt: new Date(Number(data?.createdAt ?? now())).toISOString(),
  };
}

function mapTestimonialDoc(
  id: string,
  data: Record<string, unknown> | undefined,
): StoreTestimonial {
  return {
    id,
    name: String(data?.name ?? ""),
    country: String(data?.country ?? "Indonesia"),
    roleLabel: String(data?.roleLabel ?? ""),
    message: String(data?.message ?? ""),
    rating: Number(data?.rating ?? 5),
    mediaUrl: resolveMediaUrl(String(data?.mediaUrl ?? "")),
    audioUrl: String(data?.audioUrl ?? "/assets/notif.mp3"),
    createdAt: new Date(Number(data?.createdAt ?? now())).toISOString(),
  };
}

function mapMarqueeDoc(
  id: string,
  data: Record<string, unknown> | undefined,
): StoreMarqueeItem {
  return {
    id,
    label: String(data?.label ?? "Logo"),
    imageUrl: resolveMediaUrl(String(data?.imageUrl ?? "")),
    isActive: Boolean(data?.isActive ?? true),
    sortOrder: Number(data?.sortOrder ?? 0),
    createdAt: new Date(Number(data?.createdAt ?? now())).toISOString(),
  };
}

function defaultPrivacyPolicyPage(): StorePrivacyPolicyPage {
  return {
    id: "main",
    title: "Kebijakan Privasi & Sertifikasi Layanan",
    updatedLabel: "Terakhir diperbarui: 28 Februari 2026",
    bannerImageUrl: "/assets/background.jpg",
    contentHtml: `
<h2>Kebijakan Privasi</h2>
<p>Tokko berkomitmen menjaga keamanan dan kerahasiaan data pelanggan.</p>
<ul>
  <li>Data digunakan untuk proses transaksi, dukungan, dan evaluasi layanan.</li>
  <li>Data tidak diperjualbelikan kepada pihak ketiga tanpa persetujuan pelanggan.</li>
  <li>Akses data dibatasi hanya untuk personel yang memiliki kewenangan.</li>
</ul>
<h2>Sertifikasi & Standar Layanan</h2>
<p>Kami menerapkan verifikasi berlapis dan audit kualitas secara berkala.</p>
<ul>
  <li>Kepatuhan kebijakan perlindungan data pribadi berbasis regulasi Indonesia (UU PDP).</li>
  <li>Seleksi mitra panel layanan berdasarkan stabilitas dan rekam jejak kualitas.</li>
</ul>
`.trim(),
    updatedAt: new Date(now()).toISOString(),
  };
}

function mapPrivacyPolicyDoc(
  id: string,
  data: Record<string, unknown> | undefined,
): StorePrivacyPolicyPage {
  const fallback = defaultPrivacyPolicyPage();
  return {
    id,
    title: String(data?.title ?? fallback.title),
    updatedLabel: String(data?.updatedLabel ?? fallback.updatedLabel),
    bannerImageUrl: resolveMediaUrl(String(data?.bannerImageUrl ?? fallback.bannerImageUrl)),
    contentHtml: String(data?.contentHtml ?? fallback.contentHtml),
    updatedAt: new Date(Number(data?.updatedAt ?? now())).toISOString(),
  };
}

const PAYMENT_SETTINGS_META_KEY = "payment-settings-v1";

function defaultPaymentSettings(): StorePaymentSettings {
  return {
    id: "main",
    title: "Qriss",
    qrisImageUrl: "/assets/logo.png",
    instructionText:
      "Scan Qriss diatas ini untuk proses produk kamu. Pastikan benar-benar sudah membayar",
    expiryMinutes: 30,
    updatedAt: new Date(now()).toISOString(),
  };
}

function normalizePaymentSettings(
  raw: Partial<StorePaymentSettings> | null | undefined,
): StorePaymentSettings {
  const fallback = defaultPaymentSettings();
  return {
    id: "main",
    title: String(raw?.title ?? fallback.title).trim() || fallback.title,
    qrisImageUrl: resolveMediaUrl(String(raw?.qrisImageUrl ?? fallback.qrisImageUrl)),
    instructionText:
      String(raw?.instructionText ?? fallback.instructionText).trim() || fallback.instructionText,
    expiryMinutes: Math.max(5, Math.min(180, Number(raw?.expiryMinutes ?? fallback.expiryMinutes))),
    updatedAt: new Date(Number(raw?.updatedAt ?? now())).toISOString(),
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

  try {
    const snapshot = await firestore
      .collection("products")
      .orderBy("createdAt", "desc")
      .get();

    return snapshot.docs
      .map((doc) => mapProductDoc(doc.id, doc.data() as Record<string, unknown>))
      .filter((product) => product.isActive);
  } catch (error) {
    console.error("Failed to read products from Firestore. Falling back to local database.", error);
    return listProductsDb();
  }
}

export async function listAllProducts() {
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    return listAllProductsDb();
  }

  try {
    const snapshot = await firestore
      .collection("products")
      .orderBy("createdAt", "desc")
      .get();

    return snapshot.docs.map((doc) =>
      mapProductDoc(doc.id, doc.data() as Record<string, unknown>),
    );
  } catch (error) {
    console.error("Failed to read all products from Firestore. Falling back to local database.", error);
    return listAllProductsDb();
  }
}

export async function getProductById(id: string) {
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    return getProductByIdDb(id);
  }

  try {
    const doc = await firestore.collection("products").doc(id).get();
    if (!doc.exists) {
      return null;
    }

    return mapProductDoc(doc.id, doc.data() as Record<string, unknown>);
  } catch (error) {
    console.error("Failed to read product by id from Firestore. Falling back to local database.", error);
    return getProductByIdDb(id);
  }
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
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    return createProductDb(input);
  }

  try {
    const id = crypto.randomUUID();
    const createdAt = now();
    const slug = await getUniqueSlug(firestore, input.name);
    const mediaUrl = resolveMediaUrl(input.imageUrl);

    await firestore.collection("products").doc(id).set({
      slug,
      slugLower: slug.toLowerCase(),
      name: input.name,
      category: input.category,
      shortDescription: input.shortDescription,
      description: input.description,
      duration: input.duration.trim(),
      price: input.price,
      imageUrl: mediaUrl,
      isActive: true,
      createdAt,
      updatedAt: createdAt,
    });

    return getProductById(id);
  } catch (error) {
    console.error("Failed to create product in Firestore. Falling back to local database.", error);
    return createProductDb(input);
  }
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
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    return updateProductDb(id, input);
  }

  try {
    const ref = firestore.collection("products").doc(id);
    const current = await ref.get();
    if (!current.exists) {
      return null;
    }

    const currentData = current.data() as Record<string, unknown>;
    const nextName = input.name ?? String(currentData.name ?? "");
    let nextSlug = String(currentData.slug ?? "");
    const nextMediaUrl =
      input.imageUrl !== undefined ? resolveMediaUrl(input.imageUrl) : undefined;

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
      ...(input.duration !== undefined ? { duration: input.duration.trim() } : {}),
      ...(input.price !== undefined ? { price: input.price } : {}),
      ...(nextMediaUrl !== undefined ? { imageUrl: nextMediaUrl } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      slug: nextSlug,
      slugLower: nextSlug.toLowerCase(),
      updatedAt: now(),
    });

    return getProductById(id);
  } catch (error) {
    console.error("Failed to update product in Firestore. Falling back to local database.", error);
    return updateProductDb(id, input);
  }
}

export async function deleteProduct(id: string) {
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    await deleteProductDb(id);
    return;
  }
  try {
    await firestore.collection("products").doc(id).delete();
  } catch (error) {
    console.error("Failed to delete product in Firestore. Falling back to local database.", error);
    await deleteProductDb(id);
  }
}

export async function deleteAllProducts() {
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    await deleteAllProductsDb();
    return;
  }

  try {
    const snapshot = await firestore.collection("products").get();
    const batch = firestore.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  } catch (error) {
    console.error("Failed to delete all products in Firestore. Falling back to local database.", error);
    await deleteAllProductsDb();
  }
}

export async function listInformations() {
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    return listInformationsDb();
  }

  try {
    const snapshot = await firestore
      .collection("informations")
      .orderBy("createdAt", "desc")
      .get();
    return snapshot.docs.map((doc) =>
      mapInformationDoc(doc.id, doc.data() as Record<string, unknown>),
    );
  } catch (error) {
    console.error(
      "Failed to read informations from Firestore. Falling back to local database.",
      error,
    );
    return listInformationsDb();
  }
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

  try {
    const id = crypto.randomUUID();
    const createdAt = now();
    const mediaUrl = resolveMediaUrl(input.imageUrl);
    const pollOptions = normalizePollOptions(input.pollOptions);
    const pollVotes = input.type === "poll" ? normalizePollVotes(pollOptions, {}) : {};
    await firestore.collection("informations").doc(id).set({
      type: input.type,
      title: input.title,
      body: input.body,
      imageUrl: mediaUrl,
      pollOptions,
      pollVotes,
      createdAt,
      updatedAt: createdAt,
    });

    const doc = await firestore.collection("informations").doc(id).get();
    return mapInformationDoc(doc.id, doc.data() as Record<string, unknown>);
  } catch (error) {
    console.error(
      "Failed to create information in Firestore. Falling back to local database.",
      error,
    );
    return createInformationDb(input);
  }
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

  try {
    const ref = firestore.collection("informations").doc(id);
    const doc = await ref.get();
    if (!doc.exists) {
      return null;
    }

    const currentData = doc.data() as Record<string, unknown>;
    const currentMapped = mapInformationDoc(doc.id, currentData);
    const nextType = input.type ?? currentMapped.type;
    const nextPollOptions = normalizePollOptions(input.pollOptions ?? currentMapped.pollOptions);
    const nextPollVotes =
      nextType === "poll"
        ? normalizePollVotes(nextPollOptions, currentMapped.pollVotes)
        : {};
    const nextMediaUrl =
      input.imageUrl !== undefined ? resolveMediaUrl(input.imageUrl) : undefined;
    await ref.update({
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(nextMediaUrl !== undefined ? { imageUrl: nextMediaUrl } : {}),
      ...(input.pollOptions !== undefined ? { pollOptions: nextPollOptions } : {}),
      pollVotes: nextPollVotes,
      updatedAt: now(),
    });

    const updated = await ref.get();
    return mapInformationDoc(updated.id, updated.data() as Record<string, unknown>);
  } catch (error) {
    console.error(
      "Failed to update information in Firestore. Falling back to local database.",
      error,
    );
    return updateInformationDb(id, input);
  }
}

export async function getInformationById(id: string) {
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    return getInformationByIdDb(id);
  }

  try {
    const doc = await firestore.collection("informations").doc(id).get();
    if (!doc.exists) {
      return null;
    }

    return mapInformationDoc(doc.id, doc.data() as Record<string, unknown>);
  } catch (error) {
    console.error(
      "Failed to read information by id from Firestore. Falling back to local database.",
      error,
    );
    return getInformationByIdDb(id);
  }
}

export async function voteInformationPoll(id: string, option: string) {
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    return voteInformationPollDb(id, option);
  }

  const ref = firestore.collection("informations").doc(id);
  let updated: StoreInformation | null = null;

  await firestore.runTransaction(async (transaction) => {
    const doc = await transaction.get(ref);
    if (!doc.exists) {
      return;
    }

    const current = mapInformationDoc(doc.id, doc.data() as Record<string, unknown>);
    if (current.type !== "poll") {
      return;
    }

    const selectedOption = option.trim();
    if (!current.pollOptions.includes(selectedOption)) {
      return;
    }

    const nextPollVotes = normalizePollVotes(current.pollOptions, current.pollVotes);
    nextPollVotes[selectedOption] = (nextPollVotes[selectedOption] ?? 0) + 1;
    transaction.update(ref, {
      pollVotes: nextPollVotes,
      updatedAt: now(),
    });

    updated = {
      ...current,
      pollVotes: nextPollVotes,
    };
  });

  return updated;
}

export async function deleteInformation(id: string) {
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    await deleteInformationDb(id);
    return;
  }
  try {
    await firestore.collection("informations").doc(id).delete();
  } catch (error) {
    console.error(
      "Failed to delete information in Firestore. Falling back to local database.",
      error,
    );
    await deleteInformationDb(id);
  }
}

export async function listTestimonials() {
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    return listTestimonialsDb();
  }

  try {
    const snapshot = await firestore
      .collection("testimonials")
      .orderBy("createdAt", "desc")
      .get();

    return snapshot.docs.map((doc) =>
      mapTestimonialDoc(doc.id, doc.data() as Record<string, unknown>),
    );
  } catch (error) {
    console.error(
      "Failed to read testimonials from Firestore. Falling back to local database.",
      error,
    );
    return listTestimonialsDb();
  }
}

export async function createTestimonial(input: {
  name: string;
  country: string;
  roleLabel: string;
  message: string;
  rating: number;
  mediaUrl: string;
  audioUrl: string;
}) {
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    return createTestimonialDb(input);
  }

  try {
    const mediaUrl = resolveMediaUrl(input.mediaUrl);
    const audioUrl = input.audioUrl.trim() || "/assets/notif.mp3";
    const id = crypto.randomUUID();
    const createdAt = now();
    await firestore.collection("testimonials").doc(id).set({
      name: input.name,
      country: input.country,
      roleLabel: input.roleLabel.trim(),
      message: input.message,
      rating: Math.max(1, Math.min(5, input.rating)),
      mediaUrl,
      audioUrl,
      createdAt,
      updatedAt: createdAt,
    });

    const doc = await firestore.collection("testimonials").doc(id).get();
    return mapTestimonialDoc(doc.id, doc.data() as Record<string, unknown>);
  } catch (error) {
    console.error(
      "Failed to create testimonial in Firestore. Falling back to local database.",
      error,
    );
    return createTestimonialDb(input);
  }
}

export async function updateTestimonial(
  id: string,
  input: Partial<{
    name: string;
    country: string;
    roleLabel: string;
    message: string;
    rating: number;
    mediaUrl: string;
    audioUrl: string;
  }>,
) {
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    return updateTestimonialDb(id, input);
  }

  try {
    const ref = firestore.collection("testimonials").doc(id);
    const doc = await ref.get();
    if (!doc.exists) {
      return null;
    }

    const nextMediaUrl =
      input.mediaUrl !== undefined ? resolveMediaUrl(input.mediaUrl) : undefined;
    const nextAudioUrl =
      input.audioUrl !== undefined ? input.audioUrl.trim() || "/assets/notif.mp3" : undefined;
    await ref.update({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.country !== undefined ? { country: input.country } : {}),
      ...(input.roleLabel !== undefined ? { roleLabel: input.roleLabel.trim() } : {}),
      ...(input.message !== undefined ? { message: input.message } : {}),
      ...(input.rating !== undefined ? { rating: Math.max(1, Math.min(5, input.rating)) } : {}),
      ...(nextMediaUrl !== undefined ? { mediaUrl: nextMediaUrl } : {}),
      ...(nextAudioUrl !== undefined ? { audioUrl: nextAudioUrl } : {}),
      updatedAt: now(),
    });

    const updated = await ref.get();
    return mapTestimonialDoc(updated.id, updated.data() as Record<string, unknown>);
  } catch (error) {
    console.error(
      "Failed to update testimonial in Firestore. Falling back to local database.",
      error,
    );
    return updateTestimonialDb(id, input);
  }
}

export async function deleteTestimonial(id: string) {
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    await deleteTestimonialDb(id);
    return;
  }
  try {
    await firestore.collection("testimonials").doc(id).delete();
  } catch (error) {
    console.error(
      "Failed to delete testimonial in Firestore. Falling back to local database.",
      error,
    );
    await deleteTestimonialDb(id);
  }
}

export async function listMarquees() {
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    return listMarqueesDb();
  }

  try {
    const snapshot = await firestore
      .collection("marquees")
      .orderBy("sortOrder", "asc")
      .get();

    return snapshot.docs
      .map((doc) => mapMarqueeDoc(doc.id, doc.data() as Record<string, unknown>))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
  } catch (error) {
    console.error(
      "Failed to read marquees from Firestore. Falling back to local database.",
      error,
    );
    return listMarqueesDb();
  }
}

export async function getMarqueeById(id: string) {
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    return getMarqueeByIdDb(id);
  }

  try {
    const doc = await firestore.collection("marquees").doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return mapMarqueeDoc(doc.id, doc.data() as Record<string, unknown>);
  } catch (error) {
    console.error(
      "Failed to read marquee by id from Firestore. Falling back to local database.",
      error,
    );
    return getMarqueeByIdDb(id);
  }
}

export async function createMarquee(input: {
  label: string;
  imageUrl: string;
  isActive: boolean;
  sortOrder: number;
}) {
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    return createMarqueeDb(input);
  }

  try {
    const id = crypto.randomUUID();
    const createdAt = now();
    const mediaUrl = resolveMediaUrl(input.imageUrl);

    await firestore.collection("marquees").doc(id).set({
      label: input.label.trim(),
      imageUrl: mediaUrl,
      isActive: Boolean(input.isActive),
      sortOrder: Math.max(0, Math.floor(input.sortOrder)),
      createdAt,
      updatedAt: createdAt,
    });

    return getMarqueeById(id);
  } catch (error) {
    console.error("Failed to create marquee in Firestore. Falling back to local database.", error);
    return createMarqueeDb(input);
  }
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
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    return updateMarqueeDb(id, input);
  }

  try {
    const ref = firestore.collection("marquees").doc(id);
    const current = await ref.get();
    if (!current.exists) {
      return null;
    }

    const nextMediaUrl =
      input.imageUrl !== undefined ? resolveMediaUrl(input.imageUrl) : undefined;

    await ref.update({
      ...(input.label !== undefined ? { label: input.label.trim() } : {}),
      ...(nextMediaUrl !== undefined ? { imageUrl: nextMediaUrl } : {}),
      ...(input.isActive !== undefined ? { isActive: Boolean(input.isActive) } : {}),
      ...(input.sortOrder !== undefined
        ? { sortOrder: Math.max(0, Math.floor(input.sortOrder)) }
        : {}),
      updatedAt: now(),
    });

    return getMarqueeById(id);
  } catch (error) {
    console.error("Failed to update marquee in Firestore. Falling back to local database.", error);
    return updateMarqueeDb(id, input);
  }
}

export async function deleteMarquee(id: string) {
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    await deleteMarqueeDb(id);
    return;
  }
  try {
    await firestore.collection("marquees").doc(id).delete();
  } catch (error) {
    console.error("Failed to delete marquee in Firestore. Falling back to local database.", error);
    await deleteMarqueeDb(id);
  }
}

export async function getPrivacyPolicyPage() {
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    try {
      return await getPrivacyPolicyPageDb();
    } catch (error) {
      console.error("Failed to read privacy policy from database.", error);
      return defaultPrivacyPolicyPage();
    }
  }

  try {
    const doc = await firestore.collection("privacyPolicyPages").doc("main").get();
    if (!doc.exists) {
      return defaultPrivacyPolicyPage();
    }

    return mapPrivacyPolicyDoc(doc.id, doc.data() as Record<string, unknown>);
  } catch (error) {
    console.error("Failed to read privacy policy from Firestore. Falling back to database.", error);
    try {
      return await getPrivacyPolicyPageDb();
    } catch {
      return defaultPrivacyPolicyPage();
    }
  }
}

export async function upsertPrivacyPolicyPage(input: {
  title: string;
  updatedLabel: string;
  bannerImageUrl: string;
  contentHtml: string;
}) {
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    return upsertPrivacyPolicyPageDb(input);
  }

  try {
    const current = await getPrivacyPolicyPage();
    const next = {
      title: input.title.trim() || current.title,
      updatedLabel: input.updatedLabel.trim() || current.updatedLabel,
      bannerImageUrl: resolveMediaUrl(input.bannerImageUrl) || current.bannerImageUrl,
      contentHtml: input.contentHtml.trim() || current.contentHtml,
    };

    await firestore.collection("privacyPolicyPages").doc("main").set(
      {
        ...next,
        updatedAt: now(),
      },
      { merge: true },
    );

    return getPrivacyPolicyPage();
  } catch (error) {
    console.error("Failed to write privacy policy to Firestore. Falling back to database.", error);
    return upsertPrivacyPolicyPageDb(input);
  }
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
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    return createOrderDb(input);
  }

  try {
    const id = crypto.randomUUID();
    const createdAt = now();
    const total = input.items.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);

    await firestore.collection("orders").doc(id).set({
      userId: input.userId,
      userName: input.userName,
      userEmail: input.userEmail,
      userPhone: input.userPhone,
      total,
      status: "process",
      createdAt,
      items: input.items,
    });

    return { id, total };
  } catch (error) {
    console.error("Failed to create order in Firestore. Falling back to local database.", error);
    return createOrderDb(input);
  }
}

export async function updateOrderStatus(
  id: string,
  status: "process" | "done" | "error",
) {
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    return updateOrderStatusDb(id, status);
  }

  try {
    const ref = firestore.collection("orders").doc(id);
    const doc = await ref.get();
    if (!doc.exists) {
      return null;
    }

    await ref.update({
      status,
      updatedAt: now(),
    });
    return getOrderById(id);
  } catch (error) {
    console.error("Failed to update order status in Firestore. Falling back to local database.", error);
    return updateOrderStatusDb(id, status);
  }
}

export async function deleteOrder(id: string) {
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    return deleteOrderDb(id);
  }

  try {
    const ref = firestore.collection("orders").doc(id);
    const doc = await ref.get();
    if (!doc.exists) {
      return false;
    }
    await ref.delete();
    return true;
  } catch (error) {
    console.error("Failed to delete order in Firestore. Falling back to local database.", error);
    return deleteOrderDb(id);
  }
}

export async function listOrders(limit = 100) {
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    return listOrdersDb(limit);
  }

  try {
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
        userPhone: String(data.userPhone ?? ""),
        total: Number(data.total ?? 0),
        status: String(data.status ?? "new"),
        createdAt: new Date(Number(data.createdAt ?? now())).toISOString(),
      } satisfies OrderSummary;
    });
  } catch (error) {
    console.error("Failed to read orders from Firestore. Falling back to local database.", error);
    return listOrdersDb(limit);
  }
}

export async function listOrderItemsByOrderId(orderId: string) {
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    return listOrderItemsByOrderIdDb(orderId);
  }

  try {
    const doc = await firestore.collection("orders").doc(orderId).get();
    if (!doc.exists) {
      return [] as StoreOrderItem[];
    }

    const data = doc.data() as Record<string, unknown>;
    const rawItems = Array.isArray(data.items) ? data.items : [];

    return rawItems.map((item, index) => {
      const typed = item as Record<string, unknown>;
      return {
        id: `${orderId}-${index + 1}`,
        orderId,
        productId: String(typed.productId ?? ""),
        productName: String(typed.productName ?? ""),
        productDuration: String(typed.productDuration ?? ""),
        quantity: Number(typed.quantity ?? 1),
        unitPrice: Number(typed.unitPrice ?? 0),
      } satisfies StoreOrderItem;
    });
  } catch (error) {
    console.error(
      "Failed to read order items from Firestore. Falling back to local database.",
      error,
    );
    return listOrderItemsByOrderIdDb(orderId);
  }
}

export async function getOrderById(id: string) {
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    return getOrderByIdDb(id);
  }

  try {
    const doc = await firestore.collection("orders").doc(id).get();
    if (!doc.exists) {
      return null;
    }

    const data = doc.data() as Record<string, unknown>;
    return {
      id: doc.id,
      userName: String(data.userName ?? ""),
      userEmail: String(data.userEmail ?? ""),
      userPhone: String(data.userPhone ?? ""),
      total: Number(data.total ?? 0),
      status: String(data.status ?? "new"),
      createdAt: new Date(Number(data.createdAt ?? now())).toISOString(),
    } satisfies OrderSummary;
  } catch (error) {
    console.error("Failed to read order by id from Firestore. Falling back to local database.", error);
    return getOrderByIdDb(id);
  }
}

export async function listOrdersWithItems(limit = 100) {
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    return listOrdersWithItemsDb(limit);
  }

  try {
    const orders = await listOrders(limit);
    const rows: StoreOrderDetail[] = [];

    for (const order of orders) {
      const items = await listOrderItemsByOrderId(order.id);
      rows.push({
        ...order,
        items,
      });
    }

    return rows;
  } catch (error) {
    console.error(
      "Failed to build order detail list from Firestore. Falling back to local database.",
      error,
    );
    return listOrdersWithItemsDb(limit);
  }
}

export async function getOrderStatsLastHours(hours = 12) {
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    return getOrderStatsLastHoursDb(hours);
  }

  try {
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
  } catch (error) {
    console.error("Failed to read order stats from Firestore. Falling back to local database.", error);
    return getOrderStatsLastHoursDb(hours);
  }
}

export async function getPaymentSettings() {
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    try {
      const raw = await getAppMetaValueDb(PAYMENT_SETTINGS_META_KEY);
      if (!raw) {
        return defaultPaymentSettings();
      }
      return normalizePaymentSettings(JSON.parse(raw) as Partial<StorePaymentSettings>);
    } catch {
      return defaultPaymentSettings();
    }
  }

  try {
    const doc = await firestore.collection("paymentSettings").doc("main").get();
    if (!doc.exists) {
      return defaultPaymentSettings();
    }
    return normalizePaymentSettings(doc.data() as Partial<StorePaymentSettings>);
  } catch (error) {
    console.error("Failed to read payment settings from Firestore. Falling back to local database.", error);
    try {
      const raw = await getAppMetaValueDb(PAYMENT_SETTINGS_META_KEY);
      if (!raw) {
        return defaultPaymentSettings();
      }
      return normalizePaymentSettings(JSON.parse(raw) as Partial<StorePaymentSettings>);
    } catch {
      return defaultPaymentSettings();
    }
  }
}

export async function upsertPaymentSettings(input: {
  title: string;
  qrisImageUrl: string;
  instructionText: string;
  expiryMinutes: number;
}) {
  const next = normalizePaymentSettings({
    id: "main",
    title: input.title,
    qrisImageUrl: input.qrisImageUrl,
    instructionText: input.instructionText,
    expiryMinutes: input.expiryMinutes,
    updatedAt: new Date(now()).toISOString(),
  });

  const firestore = getFirebaseFirestore();
  if (!firestore) {
    await upsertAppMetaValueDb(PAYMENT_SETTINGS_META_KEY, JSON.stringify(next));
    return next;
  }

  try {
    await firestore.collection("paymentSettings").doc("main").set(
      {
        ...next,
        updatedAt: now(),
      },
      { merge: true },
    );
    return getPaymentSettings();
  } catch (error) {
    console.error("Failed to write payment settings to Firestore. Falling back to local database.", error);
    await upsertAppMetaValueDb(PAYMENT_SETTINGS_META_KEY, JSON.stringify(next));
    return next;
  }
}
