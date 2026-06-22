import type {
  BookStory,
  InformationType,
  MaintenanceSettings,
  OrderSummary,
  PortfolioItem,
  HomepageConfig,
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
  confirmOrderCancellation as confirmOrderCancellationDb,
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
  requestOrderCancellation as requestOrderCancellationDb,
  upsertAppMetaValue as upsertAppMetaValueDb,
  updateInformation as updateInformationDb,
  updateMarquee as updateMarqueeDb,
  updateOrderStatus as updateOrderStatusDb,
  updateProduct as updateProductDb,
  updateTestimonial as updateTestimonialDb,
  upsertPrivacyPolicyPage as upsertPrivacyPolicyPageDb,
  voteInformationPoll as voteInformationPollDb,
  ensureDatabase,
  run,
} from "@/server/db";
import { getFirebaseFirestore } from "@/server/firebase-admin";
import { resolveMediaUrl } from "@/lib/media";

const now = () => Date.now();

const PORTFOLIO_ITEMS_META_KEY = "portfolioItems";
const HOMEPAGE_CONFIG_META_KEY = "homepageConfig";

let firestoreUnavailable = false;

function getFirestoreOrNull() {
  if (firestoreUnavailable) {
    return null;
  }

  return getFirebaseFirestore() as any;
}

function markFirestoreUnavailable(error: unknown) {
  if (firestoreUnavailable) {
    return;
  }

  const message = String(error || "");
  if (
    message.includes("PERMISSION_DENIED") ||
    message.includes("permission_denied") ||
    message.includes("permission denied") ||
    message.includes("PERMISSION_DENIED:") ||
    message.includes("app/permission-denied")
  ) {
    firestoreUnavailable = true;
    console.warn(
      "Firestore access disabled due to permission denied. Falling back to local database for the remainder of this process.",
    );
  }
}

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

function toOptionalIso(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  const asNumber = Number(value);
  if (Number.isFinite(asNumber)) {
    return new Date(asNumber).toISOString();
  }

  if (typeof value === "string" && value.trim()) {
    const asDate = new Date(value.trim());
    if (!Number.isNaN(asDate.getTime())) {
      return asDate.toISOString();
    }
  }

  return null;
}

function mapCancelRequestStatus(value: unknown) {
  const raw = String(value ?? "none");
  if (raw === "requested" || raw === "confirmed") {
    return raw;
  }
  return "none";
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
    productType: (String(data?.productType ?? "jual_beli") as "jual_beli" | "pekerjaan"),
    jobApplicationLink: String(data?.jobApplicationLink ?? ""),
    maxApplicants: Number(data?.maxApplicants ?? 0) || undefined,
    applicantCount: Number(data?.applicantCount ?? 0) || undefined,
    buyNowLink: String(data?.buyNowLink ?? ""),
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
    userId: String(data?.userId ?? "").trim() || undefined,
    name: String(data?.name ?? ""),
    country: String(data?.country ?? "Indonesia"),
    roleLabel: String(data?.roleLabel ?? ""),
    message: String(data?.message ?? ""),
    rating: Number(data?.rating ?? 5),
    mediaUrl: resolveMediaUrl(String(data?.mediaUrl ?? "")),
    userAvatarUrl: resolveMediaUrl(String(data?.userAvatarUrl ?? "")),
    audioUrl: String(data?.audioUrl ?? "/assets/notif.mp3"),
    verified: Boolean(data?.verified),
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
const MAINTENANCE_SETTINGS_META_KEY = "maintenance-settings-v1";
const MAX_QRIS_INLINE_LENGTH = 620_000;

function defaultPaymentSettings(): StorePaymentSettings {
  return {
    id: "main",
    title: "Qriss",
    qrisImageUrl: "/assets/qriss.jpg",
    instructionText:
      "Scan Qriss diatas ini untuk proses produk kamu. Pastikan benar-benar sudah membayar",
    expiryMinutes: 30,
    updatedAt: new Date(now()).toISOString(),
  };
}

function toIsoFromUnknownTimestamp(value: unknown, fallbackMs: number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return new Date(fallbackMs).toISOString();
    }

    const asNumber = Number(trimmed);
    if (Number.isFinite(asNumber)) {
      return new Date(asNumber).toISOString();
    }

    const asDate = new Date(trimmed);
    if (!Number.isNaN(asDate.getTime())) {
      return asDate.toISOString();
    }
  }

  return new Date(fallbackMs).toISOString();
}

function normalizePaymentSettings(
  raw: Partial<StorePaymentSettings> | null | undefined,
): StorePaymentSettings {
  const fallback = defaultPaymentSettings();
  const fallbackMs = now();
  return {
    id: "main",
    title: String(raw?.title ?? fallback.title).trim() || fallback.title,
    qrisImageUrl: resolveMediaUrl(String(raw?.qrisImageUrl ?? fallback.qrisImageUrl)),
    instructionText:
      String(raw?.instructionText ?? fallback.instructionText).trim() || fallback.instructionText,
    expiryMinutes: Math.max(5, Math.min(180, Number(raw?.expiryMinutes ?? fallback.expiryMinutes))),
    updatedAt: toIsoFromUnknownTimestamp(raw?.updatedAt, fallbackMs),
  };
}

async function getUniqueSlug(firestore: any, baseName: string) {
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
  const firestore = getFirestoreOrNull();
  if (!firestore) {
    return listProductsDb();
  }

  try {
    const snapshot = await firestore
      .collection("products")
      .orderBy("createdAt", "desc")
      .get();

    return snapshot.docs
      .map((doc: any) => mapProductDoc(doc.id, doc.data() as Record<string, unknown>))
      .filter((product: any) => product.isActive);
  } catch (error) {
    markFirestoreUnavailable(error);
    console.error("Failed to read products from Firestore. Falling back to local database.", error);
    return listProductsDb();
  }
}

export async function listAllProducts() {
  const firestore = getFirestoreOrNull();
  if (!firestore) {
    return listAllProductsDb();
  }

  try {
    const snapshot = await firestore
      .collection("products")
      .orderBy("createdAt", "desc")
      .get();

    return snapshot.docs.map((doc: any) =>
      mapProductDoc(doc.id, doc.data() as Record<string, unknown>),
    );
  } catch (error) {
    markFirestoreUnavailable(error);
    console.error("Failed to read all products from Firestore. Falling back to local database.", error);
    return listAllProductsDb();
  }
}

export async function getProductById(id: string) {
  const firestore = getFirestoreOrNull();
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
    markFirestoreUnavailable(error);
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
  productType?: string;
  jobApplicationLink?: string;
  maxApplicants?: number;
  buyNowLink?: string;
}) {
  const firestore = getFirestoreOrNull();
  if (!firestore) {
    return createProductDb(input);
  }

  try {
    const id = crypto.randomUUID();
    const createdAt = now();
    const slug = await getUniqueSlug(firestore, input.name);
    const mediaUrl = resolveMediaUrl(input.imageUrl);
    const productType = input.productType === "pekerjaan" ? "pekerjaan" : "jual_beli";
    const jobLink = productType === "pekerjaan" ? (input.jobApplicationLink?.trim() ?? "") : "";
    const maxApplicants = productType === "pekerjaan" ? (input.maxApplicants ?? 0) : 0;
    const buyNowLink = productType === "jual_beli" ? (input.buyNowLink?.trim() ?? "") : "";

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
      productType,
      jobApplicationLink: jobLink,
      maxApplicants,
      buyNowLink,
      applicantCount: 0,
      createdAt,
      updatedAt: createdAt,
    });

    return getProductById(id);
  } catch (error) {
    markFirestoreUnavailable(error);
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
    productType: string;
    jobApplicationLink: string;
    maxApplicants: number;
    buyNowLink: string;
  }>,
) {
  const firestore = getFirestoreOrNull();
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
    
    // Determine the product type (use input if provided, otherwise use current)
    const currentProductType = String(currentData?.productType ?? "jual_beli") as "jual_beli" | "pekerjaan";
    const nextProductType =
      input.productType === "pekerjaan"
        ? "pekerjaan"
        : input.productType === "jual_beli"
        ? "jual_beli"
        : undefined;
    
    // Use current product type as fallback if not changing it
    const effectiveProductType = nextProductType ?? currentProductType;

    let nextJobLink: string | undefined;
    let nextMaxApplicants: number | undefined;
    let nextBuyNowLink: string | undefined;

    if (effectiveProductType === "pekerjaan") {
      nextJobLink = input.jobApplicationLink !== undefined
        ? input.jobApplicationLink.trim()
        : (typeof currentData.jobApplicationLink === "string" ? currentData.jobApplicationLink : "").trim();
      nextMaxApplicants =
        input.maxApplicants !== undefined
          ? input.maxApplicants
          : typeof currentData.maxApplicants === "number"
          ? currentData.maxApplicants
          : undefined;
      nextBuyNowLink = "";
    } else if (effectiveProductType === "jual_beli") {
      nextJobLink = "";
      nextMaxApplicants = 0;
      nextBuyNowLink = input.buyNowLink !== undefined
        ? input.buyNowLink.trim()
        : (typeof currentData.buyNowLink === "string" ? currentData.buyNowLink : "").trim();
    } else {
      nextJobLink =
        input.jobApplicationLink !== undefined
          ? input.jobApplicationLink.trim()
          : undefined;
      nextMaxApplicants = input.maxApplicants;
      nextBuyNowLink =
        input.buyNowLink !== undefined
          ? input.buyNowLink.trim()
          : undefined;
    }

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
      ...(nextProductType !== undefined ? { productType: nextProductType } : {}),
      ...(effectiveProductType === "jual_beli" ? { jobApplicationLink: "", maxApplicants: 0, buyNowLink: nextBuyNowLink } : {}),
      ...(effectiveProductType === "pekerjaan" ? { buyNowLink: "", jobApplicationLink: nextJobLink ?? "", maxApplicants: nextMaxApplicants ?? 0 } : {}),
      ...(nextJobLink !== undefined ? { jobApplicationLink: nextJobLink } : {}),
      ...(nextMaxApplicants !== undefined ? { maxApplicants: nextMaxApplicants } : {}),
      slug: nextSlug,
      slugLower: nextSlug.toLowerCase(),
      updatedAt: now(),
    });

    return getProductById(id);
  } catch (error) {
    markFirestoreUnavailable(error);
    console.error("Failed to update product in Firestore. Falling back to local database.", error);
    return updateProductDb(id, input);
  }
}

export async function deleteProduct(id: string) {
  const firestore = getFirestoreOrNull();
  if (!firestore) {
    await deleteProductDb(id);
    return;
  }
  try {
    await firestore.collection("products").doc(id).delete();
  } catch (error) {
    markFirestoreUnavailable(error);
    console.error("Failed to delete product in Firestore. Falling back to local database.", error);
    await deleteProductDb(id);
  }
}

export async function deleteAllProducts() {
  const firestore = getFirestoreOrNull();
  if (!firestore) {
    await deleteAllProductsDb();
    return;
  }

  try {
    const snapshot = await firestore.collection("products").get();
    const batch = firestore.batch();
    snapshot.docs.forEach((doc: any) => batch.delete(doc.ref));
    await batch.commit();
  } catch (error) {
    markFirestoreUnavailable(error);
    console.error("Failed to delete all products in Firestore. Falling back to local database.", error);
    await deleteAllProductsDb();
  }
}

export async function listInformations() {
  const firestore = getFirestoreOrNull();
  if (!firestore) {
    return listInformationsDb();
  }

  try {
    const snapshot = await firestore
      .collection("informations")
      .orderBy("createdAt", "desc")
      .get();
    return snapshot.docs.map((doc: any) =>
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
  const firestore = getFirestoreOrNull();
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
  const firestore = getFirestoreOrNull();
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
  const firestore = getFirestoreOrNull();
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
  const firestore = getFirestoreOrNull();
  if (!firestore) {
    return voteInformationPollDb(id, option);
  }

  const ref = firestore.collection("informations").doc(id);
  let updated: StoreInformation | null = null;

  await firestore.runTransaction(async (transaction: any) => {
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
  const firestore = getFirestoreOrNull();
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
  const firestore = getFirestoreOrNull();
  if (!firestore) {
    return listTestimonialsDb();
  }

  try {
    const snapshot = await firestore
      .collection("testimonials")
      .orderBy("createdAt", "desc")
      .get();

    return snapshot.docs.map((doc: any) =>
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
  userId?: string;
  name: string;
  country: string;
  roleLabel: string;
  message: string;
  rating: number;
  mediaUrl: string;
  userAvatarUrl?: string;
  audioUrl: string;
  verified?: boolean;
}) {
  const firestore = getFirestoreOrNull();
  if (!firestore) {
    return createTestimonialDb(input);
  }

  try {
    const mediaUrl = resolveMediaUrl(input.mediaUrl);
    const userAvatarUrl = resolveMediaUrl(input.userAvatarUrl ?? "/assets/logo.png");
    const audioUrl = input.audioUrl.trim() || "/assets/notif.mp3";
    const id = crypto.randomUUID();
    const createdAt = now();
    await firestore.collection("testimonials").doc(id).set({
      userId: input.userId ?? null,
      name: input.name,
      country: input.country,
      roleLabel: input.roleLabel.trim(),
      message: input.message,
      rating: Math.max(1, Math.min(5, input.rating)),
      mediaUrl,
      userAvatarUrl,
      audioUrl,
      verified: input.verified ? true : false,
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
    userId: string;
    name: string;
    country: string;
    roleLabel: string;
    message: string;
    rating: number;
    mediaUrl: string;
    userAvatarUrl: string;
    audioUrl: string;
    verified: boolean;
  }>,
) {
  const firestore = getFirestoreOrNull();
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
    const nextUserAvatarUrl =
      input.userAvatarUrl !== undefined ? resolveMediaUrl(input.userAvatarUrl) : undefined;
    const nextAudioUrl =
      input.audioUrl !== undefined ? input.audioUrl.trim() || "/assets/notif.mp3" : undefined;
    await ref.update({
      ...(input.userId !== undefined ? { userId: input.userId || null } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.country !== undefined ? { country: input.country } : {}),
      ...(input.roleLabel !== undefined ? { roleLabel: input.roleLabel.trim() } : {}),
      ...(input.message !== undefined ? { message: input.message } : {}),
      ...(input.rating !== undefined ? { rating: Math.max(1, Math.min(5, input.rating)) } : {}),
      ...(nextMediaUrl !== undefined ? { mediaUrl: nextMediaUrl } : {}),
      ...(nextUserAvatarUrl !== undefined ? { userAvatarUrl: nextUserAvatarUrl } : {}),
      ...(input.audioUrl !== undefined ? { audioUrl: nextAudioUrl } : {}),
      ...(input.verified !== undefined ? { verified: input.verified ? true : false } : {}),
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
  const firestore = getFirestoreOrNull();
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
  const firestore = getFirestoreOrNull();
  if (!firestore) {
    return listMarqueesDb();
  }

  try {
    const snapshot = await firestore
      .collection("marquees")
      .orderBy("sortOrder", "asc")
      .get();

    return snapshot.docs
      .map((doc: any) => mapMarqueeDoc(doc.id, doc.data() as Record<string, unknown>))
      .sort((a: any, b: any) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
  } catch (error) {
    console.error(
      "Failed to read marquees from Firestore. Falling back to local database.",
      error,
    );
    return listMarqueesDb();
  }
}

export async function getMarqueeById(id: string) {
  const firestore = getFirestoreOrNull();
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
  const firestore = getFirestoreOrNull();
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
    markFirestoreUnavailable(error);
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
  const firestore = getFirestoreOrNull();
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
    markFirestoreUnavailable(error);
    console.error("Failed to update marquee in Firestore. Falling back to local database.", error);
    return updateMarqueeDb(id, input);
  }
}

export async function deleteMarquee(id: string) {
  const firestore = getFirestoreOrNull();
  if (!firestore) {
    await deleteMarqueeDb(id);
    return;
  }
  try {
    await firestore.collection("marquees").doc(id).delete();
  } catch (error) {
    markFirestoreUnavailable(error);
    console.error("Failed to delete marquee in Firestore. Falling back to local database.", error);
    await deleteMarqueeDb(id);
  }
}

export async function getPrivacyPolicyPage() {
  const firestore = getFirestoreOrNull();
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
    markFirestoreUnavailable(error);
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
  const firestore = getFirestoreOrNull();
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
    markFirestoreUnavailable(error);
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
  const firestore = getFirestoreOrNull();
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
      cancelRequestStatus: "none",
      cancelRequestReason: "",
      cancelRequestedAt: null,
      cancelConfirmedAt: null,
      createdAt,
      items: input.items,
    });

    return { id, total };
  } catch (error) {
    markFirestoreUnavailable(error);
    console.error("Failed to create order in Firestore. Falling back to local database.", error);
    return createOrderDb(input);
  }
}

export async function updateOrderStatus(
  id: string,
  status: "process" | "done" | "error",
) {
  const firestore = getFirestoreOrNull();
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
      ...(status === "process" || status === "done"
        ? {
            cancelRequestStatus: "none",
            cancelConfirmedAt: null,
          }
        : {}),
      updatedAt: now(),
    });
    return getOrderById(id);
  } catch (error) {
    markFirestoreUnavailable(error);
    console.error("Failed to update order status in Firestore. Falling back to local database.", error);
    return updateOrderStatusDb(id, status);
  }
}

export async function deleteOrder(id: string) {
  const firestore = getFirestoreOrNull();
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
    markFirestoreUnavailable(error);
    console.error("Failed to delete order in Firestore. Falling back to local database.", error);
    return deleteOrderDb(id);
  }
}

export async function listOrders(limit = 100) {
  const firestore = getFirestoreOrNull();
  if (!firestore) {
    return listOrdersDb(limit);
  }

  try {
    const snapshot = await firestore
      .collection("orders")
      .orderBy("createdAt", "desc")
      .limit(Math.max(1, limit))
      .get();

    return snapshot.docs.map((doc: any) => {
      const data = doc.data() as Record<string, unknown>;
      return {
        id: doc.id,
        userName: String(data.userName ?? ""),
        userEmail: String(data.userEmail ?? ""),
        userPhone: String(data.userPhone ?? ""),
        total: Number(data.total ?? 0),
        status: String(data.status ?? "new"),
        paymentMethod: data.paymentMethod as "static_qris" | "dynamic_qris" | undefined,
        qrImage: String(data.qrImage ?? ""),
        totalAmount: Number(data.totalAmount ?? 0),
        uniqueCode: Number(data.uniqueCode ?? 0),
        depositId: String(data.depositId ?? ""),
        qrCode: String(data.qrCode ?? ""),
        cancelRequestStatus: mapCancelRequestStatus(data.cancelRequestStatus),
        cancelRequestReason: String(data.cancelRequestReason ?? ""),
        cancelRequestedAt: toOptionalIso(data.cancelRequestedAt),
        cancelConfirmedAt: toOptionalIso(data.cancelConfirmedAt),
        createdAt: new Date(Number(data.createdAt ?? now())).toISOString(),
      } satisfies OrderSummary;
    });
  } catch (error) {
    markFirestoreUnavailable(error);
    console.error("Failed to read orders from Firestore. Falling back to local database.", error);
    return listOrdersDb(limit);
  }
}

export async function listOrderItemsByOrderId(orderId: string) {
  const firestore = getFirestoreOrNull();
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
  const firestore = getFirestoreOrNull();
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
      paymentMethod: data.paymentMethod as "static_qris" | "dynamic_qris" | undefined,
      qrImage: String(data.qrImage ?? ""),
      totalAmount: Number(data.totalAmount ?? 0),
      uniqueCode: Number(data.uniqueCode ?? 0),
      depositId: String(data.depositId ?? ""),
      qrCode: String(data.qrCode ?? ""),
      cancelRequestStatus: mapCancelRequestStatus(data.cancelRequestStatus),
      cancelRequestReason: String(data.cancelRequestReason ?? ""),
      cancelRequestedAt: toOptionalIso(data.cancelRequestedAt),
      cancelConfirmedAt: toOptionalIso(data.cancelConfirmedAt),
      createdAt: new Date(Number(data.createdAt ?? now())).toISOString(),
    } satisfies OrderSummary;
  } catch (error) {
    markFirestoreUnavailable(error);
    console.error("Failed to read order by id from Firestore. Falling back to local database.", error);
    return getOrderByIdDb(id);
  }
}

export async function requestOrderCancellation(id: string, reason: string) {
  const safeReason = reason.trim();
  if (safeReason.length < 5) {
    throw new Error("Alasan pembatalan minimal 5 karakter.");
  }

  const firestore = getFirestoreOrNull();
  if (!firestore) {
    return requestOrderCancellationDb(id, safeReason);
  }

  try {
    const ref = firestore.collection("orders").doc(id);
    const doc = await ref.get();
    if (!doc.exists) {
      return null;
    }

    await ref.update({
      cancelRequestStatus: "requested",
      cancelRequestReason: safeReason,
      cancelRequestedAt: now(),
      cancelConfirmedAt: null,
      updatedAt: now(),
    });

    return getOrderById(id);
  } catch (error) {
    markFirestoreUnavailable(error);
    console.error("Failed to request order cancellation in Firestore. Falling back to local database.", error);
    return requestOrderCancellationDb(id, safeReason);
  }
}

export async function confirmOrderCancellation(id: string) {
  const firestore = getFirestoreOrNull();
  if (!firestore) {
    return confirmOrderCancellationDb(id);
  }

  try {
    const ref = firestore.collection("orders").doc(id);
    const doc = await ref.get();
    if (!doc.exists) {
      return null;
    }

    await ref.update({
      status: "error",
      cancelRequestStatus: "confirmed",
      cancelConfirmedAt: now(),
      updatedAt: now(),
    });

    return getOrderById(id);
  } catch (error) {
    markFirestoreUnavailable(error);
    console.error("Failed to confirm order cancellation in Firestore. Falling back to local database.", error);
    return confirmOrderCancellationDb(id);
  }
}

export async function listOrdersWithItems(limit = 100) {
  const firestore = getFirestoreOrNull();
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
  const firestore = getFirestoreOrNull();
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

    snapshot.docs.forEach((doc: any) => {
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
    markFirestoreUnavailable(error);
    console.error("Failed to read order stats from Firestore. Falling back to local database.", error);
    return getOrderStatsLastHoursDb(hours);
  }
}

export async function getPaymentSettings() {
  const firestore = getFirestoreOrNull();
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
    markFirestoreUnavailable(error);
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
  if (next.qrisImageUrl.startsWith("data:") && next.qrisImageUrl.length > MAX_QRIS_INLINE_LENGTH) {
    throw new Error("Gambar QRIS inline terlalu besar. Gunakan file lebih kecil atau aktifkan bucket upload.");
  }

  const firestore = getFirestoreOrNull();
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
    markFirestoreUnavailable(error);
    console.error("Failed to write payment settings to Firestore. Falling back to local database.", error);
    try {
      await upsertAppMetaValueDb(PAYMENT_SETTINGS_META_KEY, JSON.stringify(next));
      return next;
    } catch (fallbackError) {
      console.error("Failed to persist payment settings to local database fallback.", fallbackError);
      const primaryMessage =
        error instanceof Error ? error.message : "Unknown Firestore error";
      const fallbackMessage =
        fallbackError instanceof Error ? fallbackError.message : "Unknown database fallback error";
      throw new Error(
        `Storage write failed (Firestore: ${primaryMessage}; Local fallback: ${fallbackMessage})`,
      );
    }
  }
}

function defaultMaintenanceSettings(): MaintenanceSettings {
  return {
    id: "main",
    isEnabled: false,
    message: "Website sedang dalam pemeliharaan. Mohon coba lagi nanti.",
    accessKey: "",
    maintenanceMode: "schedule",
    openTime: "09:00",
    closeTime: "18:00",
    maintenanceTitle: "Website sedang dalam Pemeliharaan",
    maintenanceSubtitle: "Hi! Tokkers Website sedang dalam Pemeliharaan. Tenang.. kamu tetap bisa melihat tampilan website kami",
    updatedAt: new Date(now()).toISOString(),
  };
}

export async function getMaintenanceSettings() {
  const firestore = getFirestoreOrNull();
  if (!firestore) {
    try {
      const raw = await getAppMetaValueDb(MAINTENANCE_SETTINGS_META_KEY);
      if (!raw) {
        return defaultMaintenanceSettings();
      }
      return JSON.parse(raw) as MaintenanceSettings;
    } catch {
      return defaultMaintenanceSettings();
    }
  }

  try {
    const doc = await firestore.collection("maintenanceSettings").doc("main").get();
    if (!doc.exists) {
      return defaultMaintenanceSettings();
    }
    return doc.data() as MaintenanceSettings;
  } catch (error) {
    markFirestoreUnavailable(error);
    console.error("Failed to read maintenance settings from Firestore. Falling back to local database.", error);
    try {
      const raw = await getAppMetaValueDb(MAINTENANCE_SETTINGS_META_KEY);
      if (!raw) {
        return defaultMaintenanceSettings();
      }
      return JSON.parse(raw) as MaintenanceSettings;
    } catch {
      return defaultMaintenanceSettings();
    }
  }
}

export async function upsertMaintenanceSettings(input: {
  isEnabled: boolean;
  message: string;
  accessKey: string;
  maintenanceMode?: "instant" | "schedule";
  openTime?: string;
  closeTime?: string;
  maintenanceTitle?: string;
  maintenanceSubtitle?: string;
}) {
  const next: MaintenanceSettings = {
    id: "main",
    isEnabled: input.isEnabled,
    message: input.message.trim() || "Website sedang dalam pemeliharaan. Mohon coba lagi nanti.",
    accessKey: input.accessKey.trim() || "",
    maintenanceMode: input.maintenanceMode || "schedule",
    openTime: input.openTime?.trim() || "09:00",
    closeTime: input.closeTime?.trim() || "18:00",
    maintenanceTitle: input.maintenanceTitle?.trim() || "Website sedang dalam Pemeliharaan",
    maintenanceSubtitle: input.maintenanceSubtitle?.trim() || "Hi! Tokkers Website sedang dalam Pemeliharaan. Tenang.. kamu tetap bisa melihat tampilan website kami",
    updatedAt: new Date(now()).toISOString(),
  };

  const firestore = getFirestoreOrNull();
  if (!firestore) {
    await upsertAppMetaValueDb(MAINTENANCE_SETTINGS_META_KEY, JSON.stringify(next));
    return next;
  }

  try {
    await firestore.collection("maintenanceSettings").doc("main").set(next, { merge: true });
    return getMaintenanceSettings();
  } catch (error) {
    markFirestoreUnavailable(error);
    console.error("Failed to write maintenance settings to Firestore. Falling back to local database.", error);
    try {
      await upsertAppMetaValueDb(MAINTENANCE_SETTINGS_META_KEY, JSON.stringify(next));
      return next;
    } catch (fallbackError) {
      console.error("Failed to persist maintenance settings to local database fallback.", fallbackError);
      throw new Error("Failed to update maintenance settings");
    }
  }
}

function mapBookStoryDoc(
  id: string,
  data: Record<string, unknown> | undefined,
): BookStory {
  const photos = (() => {
    try {
      const val = data?.photos;
      if (typeof val === "string") return JSON.parse(val);
      if (Array.isArray(val)) return val;
      return [];
    } catch {
      return [];
    }
  })();

  const likedBy = (() => {
    try {
      const val = data?.likedBy || data?.liked_by;
      if (typeof val === "string") return JSON.parse(val);
      if (Array.isArray(val)) return val;
      return [];
    } catch {
      return [];
    }
  })();

  const comments = (() => {
    try {
      const val = data?.comments;
      if (typeof val === "string") return JSON.parse(val);
      if (Array.isArray(val)) return val;
      return [];
    } catch {
      return [];
    }
  })();

  const restrictedViewers = (() => {
    try {
      const val = data?.restrictedViewers || data?.restricted_viewers;
      if (typeof val === "string") return JSON.parse(val);
      if (Array.isArray(val)) return val;
      return [];
    } catch {
      return [];
    }
  })();

  return {
    id,
    userId: String(data?.userId ?? data?.user_id ?? ""),
    userName: String(data?.userName ?? data?.user_name ?? ""),
    userEmail: String(data?.userEmail ?? data?.user_email ?? ""),
    userAvatarUrl: String(data?.userAvatarUrl ?? data?.user_avatar_url ?? ""),
    verified: Boolean(data?.verified),
    title: String(data?.title ?? data?.title ?? ""),
    category: String(data?.category ?? data?.category ?? ""),
    story: String(data?.story ?? ""),
    photos,
    likes: likedBy.length,
    likedBy,
    comments,
    views: Number(data?.views ?? data?.view ?? 0),
    viewedBy: (() => {
      try {
        const val = data?.viewedBy || data?.viewed_by;
        if (typeof val === "string") return JSON.parse(val);
        if (Array.isArray(val)) return val;
        return [];
      } catch {
        return [];
      }
    })(),
    savedBy: (() => {
      try {
        const val = data?.savedBy || data?.saved_by;
        if (typeof val === "string") return JSON.parse(val);
        if (Array.isArray(val)) return val;
        return [];
      } catch {
        return [];
      }
    })(),
    shareCount: Number(data?.shareCount ?? data?.share_count ?? 0),
    reportCount: Number(data?.reportCount ?? data?.report_count ?? 0),
    isPrivate: Number(data?.isPrivate ?? data?.is_private ?? 0) === 1,
    restrictedViewers,
    originalUserId: String(data?.originalUserId ?? data?.original_user_id ?? "").trim() || undefined,
    rating: data?.rating ? Number(data.rating) : undefined,
    linkedProducts: (() => {
      try {
        const val = data?.linkedProducts || data?.linked_products;
        const items = typeof val === "string" ? JSON.parse(val) : Array.isArray(val) ? val : undefined;
        if (!Array.isArray(items)) {
          return undefined;
        }
        return items.map((item) => ({
          productId: String(item.productId ?? item.id ?? ""),
          productName: String(item.productName ?? item.name ?? ""),
          productImage: item.productImage ? String(item.productImage) : undefined,
          productPrice: item.productPrice ? Number(item.productPrice) : undefined,
        })).filter((item) => item.productId || item.productName);
      } catch {
        return undefined;
      }
    })(),
    elements: (() => {
      try {
        const val = data?.elements;
        if (typeof val === "string") return JSON.parse(val);
        if (Array.isArray(val)) return val;
        return undefined;
      } catch {
        return undefined;
      }
    })(),
    status: (data?.status as "pending" | "approved" | "rejected") ?? "pending",
    createdAt: new Date(Number(data?.createdAt ?? data?.created_at ?? now())).toISOString(),
    approvedAt: data?.approvedAt || data?.approved_at ? new Date(Number(data.approvedAt || data.approved_at)).toISOString() : undefined,
    approvedBy: data?.approvedBy || data?.approved_by ? String(data.approvedBy || data.approved_by) : undefined,
  };
}

async function getAdminStoryEmails() {
  await ensureDatabase();
  const emails = new Set<string>(["digitalawanku2@gmail.com"]);

  const adminEmailRows = await run("SELECT lower(email) AS email FROM admin_emails").catch(() => null);
  for (const row of ((adminEmailRows?.rows ?? []) as Array<Record<string, unknown>>)) {
    const email = String(row.email ?? "").trim().toLowerCase();
    if (email) {
      emails.add(email);
    }
  }

  const adminUserRows = await run("SELECT lower(email) AS email FROM users WHERE role = 'admin'").catch(() => null);
  for (const row of ((adminUserRows?.rows ?? []) as Array<Record<string, unknown>>)) {
    const email = String(row.email ?? "").trim().toLowerCase();
    if (email) {
      emails.add(email);
    }
  }

  return emails;
}

async function withBookStoryVerifiedFlags(stories: BookStory[]) {
  const adminEmails = await getAdminStoryEmails();

  return stories.map((story) => {
    const isStoryAdmin = adminEmails.has(story.userEmail.trim().toLowerCase());
    return {
      ...story,
      verified: isStoryAdmin,
      comments: story.comments.map((comment) => ({
        ...comment,
        verified:
          Boolean(comment.verified) ||
          adminEmails.has(String(comment.userEmail ?? "").trim().toLowerCase()) ||
          comment.userId === "dev-admin-hardcoded" ||
          comment.userName === "Tokko Marketplace",
      })),
    };
  });
}

export async function createBookStory(input: {
  userId: string;
  userName: string;
  userEmail: string;
  userAvatarUrl?: string;
  title: string;
  category: string;
  story: string;
  photos?: string[];
  rating?: number;
  linkedProducts?: Array<{id: string; name: string}>;
  elements?: Array<{emoji: string; opacity: number}>;
}) {
  try {
    // Use local database for book stories
    await ensureDatabase();
    const id = crypto.randomUUID();
    const createdAt = now();

    const storyData = {
      id,
      userId: input.userId || "",
      userName: input.userName || "Anonymous",
      userEmail: input.userEmail || "",
      userAvatarUrl: input.userAvatarUrl || "",
      title: input.title.trim(),
      category: input.category.trim(),
      story: input.story.trim(),
      photos: JSON.stringify(input.photos || []),
      likedBy: JSON.stringify([]),
      rating: input.rating || null,
      linkedProducts: JSON.stringify(
        (input.linkedProducts || []).map((product) => ({
          productId: product.id,
          productName: product.name,
        })),
      ),
      elements: JSON.stringify(input.elements || []),
      status: "approved",
      createdAt,
      approvedAt: createdAt,
    };

    console.log("Creating book story with data:", {
      id,
      userId: storyData.userId,
      userEmail: storyData.userEmail,
      storyLength: storyData.story.length,
    });

    await run(
      `INSERT INTO book_stories (id, user_id, user_name, user_email, user_avatar_url, title, category, story, photos, liked_by, views, viewed_by, saved_by, share_count, status, created_at, approved_at, rating, linked_products, elements)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        storyData.id,
        storyData.userId,
        storyData.userName,
        storyData.userEmail,
        storyData.userAvatarUrl,
        storyData.title,
        storyData.category,
        storyData.story,
        storyData.photos,
        storyData.likedBy,
        0,
        JSON.stringify([]),
        JSON.stringify([]),
        0,
        storyData.status,
        storyData.createdAt,
        storyData.approvedAt,
        storyData.rating,
        storyData.linkedProducts,
        storyData.elements,
      ],
    );

    console.log("Book story created successfully:", id);
    return mapBookStoryDoc(id, {
      userId: storyData.userId,
      userName: storyData.userName,
      userEmail: storyData.userEmail,
      userAvatarUrl: storyData.userAvatarUrl,
      title: storyData.title,
      category: storyData.category,
      story: storyData.story,
      photos: input.photos || [],
      rating: input.rating,
      linkedProducts: (input.linkedProducts || []).map((product) => ({
        productId: product.id,
        productName: product.name,
      })),
      elements: input.elements,
      likedBy: [],
      comments: [],
      views: 0,
      viewedBy: [],
      savedBy: [],
      shareCount: 0,
      status: storyData.status,
      createdAt: storyData.createdAt,
      approvedAt: storyData.approvedAt,
    });
  } catch (error) {
    markFirestoreUnavailable(error);
    console.error("Failed to create book story:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    throw new Error("Gagal menyimpan cerita. Coba lagi nanti.");
  }
}

export async function listPendingBookStories() {
  try {
    await ensureDatabase();
    const res = await run(
      "SELECT * FROM book_stories WHERE status = 'pending' ORDER BY created_at DESC",
    );

    const stories = ((res.rows ?? []) as Array<Record<string, unknown>>).map((row) =>
      mapBookStoryDoc(String(row.id), row),
    );
    return withBookStoryVerifiedFlags(stories);
  } catch (error) {
    markFirestoreUnavailable(error);
    console.error("Failed to read pending book stories from database:", error);
    return [];
  }
}

export async function listApprovedBookStories() {
  try {
    await ensureDatabase();
    const res = await run(
      "SELECT * FROM book_stories WHERE status = 'approved' ORDER BY approved_at DESC",
    );

    const stories = ((res.rows ?? []) as Array<Record<string, unknown>>).map((row) =>
      mapBookStoryDoc(String(row.id), row),
    );
    return withBookStoryVerifiedFlags(stories);
  } catch (error) {
    markFirestoreUnavailable(error);
    console.error("Failed to read approved book stories from database:", error);
    return [];
  }
}

export async function approveBookStory(storyId: string) {
  try {
    await ensureDatabase();
    const approvedAt = now();
    await run(
      "UPDATE book_stories SET status = ?, approved_at = ? WHERE id = ?",
      ["approved", approvedAt, storyId]
    );

    const result = await run(
      "SELECT * FROM book_stories WHERE id = ? LIMIT 1",
      [storyId]
    );
    
    const row = result.rows?.[0] as Record<string, unknown> | undefined;
    if (!row) {
      throw new Error("Story not found");
    }

    return mapBookStoryDoc(storyId, row);
  } catch (error) {
    markFirestoreUnavailable(error);
    console.error("Failed to approve book story in database.", error);
    throw new Error("Gagal menyetujui cerita");
  }
}

export async function rejectBookStory(storyId: string) {
  try {
    await ensureDatabase();
    await run(
      "UPDATE book_stories SET status = ? WHERE id = ?",
      ["rejected", storyId]
    );

    const result = await run(
      "SELECT * FROM book_stories WHERE id = ? LIMIT 1",
      [storyId]
    );
    
    const row = result.rows?.[0] as Record<string, unknown> | undefined;
    if (!row) {
      throw new Error("Story not found");
    }

    return mapBookStoryDoc(storyId, row);
  } catch (error) {
    markFirestoreUnavailable(error);
    console.error("Failed to reject book story in database.", error);
    throw new Error("Gagal menolak cerita");
  }
}

export async function incrementBookStoryLikes(storyId: string, userId: string) {
  try {
    await ensureDatabase();
    
    const result = await run(
      "SELECT liked_by FROM book_stories WHERE id = ? LIMIT 1",
      [storyId]
    );
    
    const row = result.rows?.[0] as Record<string, unknown> | undefined;
    if (!row) {
      throw new Error("Story not found");
    }

    let likedBy: string[] = [];
    try {
      const val = row.liked_by;
      if (typeof val === "string") likedBy = JSON.parse(val);
      else if (Array.isArray(val)) likedBy = val;
    } catch {
      likedBy = [];
    }

    // Check if user already liked
    if (likedBy.includes(userId)) {
      // Remove like
      likedBy = likedBy.filter(id => id !== userId);
    } else {
      // Add like
      likedBy.push(userId);
    }

    await run(
      "UPDATE book_stories SET liked_by = ? WHERE id = ?",
      [JSON.stringify(likedBy), storyId]
    );

    const updatedResult = await run(
      "SELECT * FROM book_stories WHERE id = ? LIMIT 1",
      [storyId]
    );
    
    const updatedRow = updatedResult.rows?.[0] as Record<string, unknown> | undefined;
    if (!updatedRow) {
      throw new Error("Story not found");
    }

    return (await withBookStoryVerifiedFlags([mapBookStoryDoc(storyId, updatedRow)]))[0];
  } catch (error) {
    markFirestoreUnavailable(error);
    console.error("Failed to increment book story likes.", error);
    throw new Error("Gagal memberikan like");
  }
}

export async function toggleBookStorySave(storyId: string, userId: string) {
  try {
    await ensureDatabase();
    const result = await run(
      "SELECT saved_by FROM book_stories WHERE id = ? LIMIT 1",
      [storyId]
    );

    const row = result.rows?.[0] as Record<string, unknown> | undefined;
    if (!row) {
      throw new Error("Story not found");
    }

    let savedBy: string[] = [];
    try {
      const val = row.saved_by;
      if (typeof val === "string") savedBy = JSON.parse(val);
      else if (Array.isArray(val)) savedBy = val;
    } catch {
      savedBy = [];
    }

    if (savedBy.includes(userId)) {
      savedBy = savedBy.filter((id) => id !== userId);
    } else {
      savedBy.push(userId);
    }

    await run(
      "UPDATE book_stories SET saved_by = ? WHERE id = ?",
      [JSON.stringify(savedBy), storyId]
    );

    const updatedResult = await run(
      "SELECT * FROM book_stories WHERE id = ? LIMIT 1",
      [storyId]
    );
    const updatedRow = updatedResult.rows?.[0] as Record<string, unknown> | undefined;
    if (!updatedRow) {
      throw new Error("Story not found");
    }

    return (await withBookStoryVerifiedFlags([mapBookStoryDoc(storyId, updatedRow)]))[0];
  } catch (error) {
    markFirestoreUnavailable(error);
    console.error("Failed to toggle book story save.", error);
    throw new Error("Gagal menyimpan cerita");
  }
}

export async function incrementBookStoryShareCount(storyId: string) {
  try {
    await ensureDatabase();
    const result = await run(
      "SELECT share_count FROM book_stories WHERE id = ? LIMIT 1",
      [storyId]
    );

    const row = result.rows?.[0] as Record<string, unknown> | undefined;
    if (!row) {
      throw new Error("Story not found");
    }

    const currentCount = Number(row.share_count ?? 0);
    const nextCount = currentCount + 1;

    await run(
      "UPDATE book_stories SET share_count = ? WHERE id = ?",
      [nextCount, storyId]
    );

    const updatedResult = await run(
      "SELECT * FROM book_stories WHERE id = ? LIMIT 1",
      [storyId]
    );
    const updatedRow = updatedResult.rows?.[0] as Record<string, unknown> | undefined;
    if (!updatedRow) {
      throw new Error("Story not found");
    }

    return (await withBookStoryVerifiedFlags([mapBookStoryDoc(storyId, updatedRow)]))[0];
  } catch (error) {
    markFirestoreUnavailable(error);
    console.error("Failed to increment book story share count.", error);
    throw new Error("Gagal menambah share");
  }
}

export async function updateBookStorySaves(storyId: string, savedCount: number) {
  try {
    await ensureDatabase();
    const savedBy = Array.from({ length: Math.max(0, savedCount) }, (_, i) => `system_save_${i}`);

    await run(
      "UPDATE book_stories SET saved_by = ? WHERE id = ?",
      [JSON.stringify(savedBy), storyId],
    );

    const updatedResult = await run(
      "SELECT * FROM book_stories WHERE id = ? LIMIT 1",
      [storyId],
    );
    const updatedRow = updatedResult.rows?.[0] as Record<string, unknown> | undefined;
    if (!updatedRow) {
      throw new Error("Story not found");
    }

    return (await withBookStoryVerifiedFlags([mapBookStoryDoc(storyId, updatedRow)]))[0];
  } catch (error) {
    markFirestoreUnavailable(error);
    console.error("Failed to update book story saves.", error);
    throw new Error("Gagal memperbarui jumlah simpanan");
  }
}

export async function updateBookStoryShareCount(storyId: string, shareCount: number) {
  try {
    await ensureDatabase();
    await run(
      "UPDATE book_stories SET share_count = ? WHERE id = ?",
      [Math.max(0, shareCount), storyId],
    );

    const updatedResult = await run(
      "SELECT * FROM book_stories WHERE id = ? LIMIT 1",
      [storyId],
    );
    const updatedRow = updatedResult.rows?.[0] as Record<string, unknown> | undefined;
    if (!updatedRow) {
      throw new Error("Story not found");
    }

    return (await withBookStoryVerifiedFlags([mapBookStoryDoc(storyId, updatedRow)]))[0];
  } catch (error) {
    markFirestoreUnavailable(error);
    console.error("Failed to update book story share count.", error);
    throw new Error("Gagal memperbarui jumlah share");
  }
}

export async function incrementBookStoryViews(storyId: string, userId?: string) {
  try {
    await ensureDatabase();
    
    const result = await run(
      "SELECT views, viewed_by FROM book_stories WHERE id = ? LIMIT 1",
      [storyId],
    );
    
    const row = result.rows?.[0] as Record<string, unknown> | undefined;
    if (!row) {
      throw new Error("Story not found");
    }

    let viewedBy: string[] = [];
    try {
      const val = row.viewed_by;
      if (typeof val === "string") viewedBy = JSON.parse(val);
      else if (Array.isArray(val)) viewedBy = val;
    } catch {
      viewedBy = [];
    }

    if (userId && !viewedBy.includes(userId)) {
      viewedBy.push(userId);
    }

    const views = userId ? viewedBy.length : Number(row.views ?? 0) + 1;

    await run(
      "UPDATE book_stories SET viewed_by = ?, views = ? WHERE id = ?",
      [JSON.stringify(viewedBy), views, storyId],
    );

    const updated = await run(
      "SELECT * FROM book_stories WHERE id = ? LIMIT 1",
      [storyId],
    );
    
    const updatedRow = updated.rows?.[0] as Record<string, unknown> | undefined;
    if (!updatedRow) {
      throw new Error("Story not found after update");
    }

    return (await withBookStoryVerifiedFlags([mapBookStoryDoc(storyId, updatedRow)]))[0];
  } catch (error) {
    console.error("Failed to increment views:", error);
    throw new Error("Gagal menambah views");
  }
}

export async function addBookStoryComment(
  storyId: string,
  comment: {
    id: string;
    userId: string;
    userName: string;
    userEmail?: string;
    verified?: boolean;
    text: string;
    replyToId?: string;
    replyToName?: string;
    createdAt: string;
  },
) {
  try {
    await ensureDatabase();
    
    const result = await run(
      "SELECT comments FROM book_stories WHERE id = ? LIMIT 1",
      [storyId]
    );
    
    const row = result.rows?.[0] as Record<string, unknown> | undefined;
    if (!row) {
      throw new Error("Story not found");
    }

    let comments: BookStory["comments"] = [];
    try {
      const val = row.comments;
      if (typeof val === "string") comments = JSON.parse(val);
      else if (Array.isArray(val)) comments = val;
    } catch {
      comments = [];
    }

    comments.push(comment);

    await run(
      "UPDATE book_stories SET comments = ? WHERE id = ?",
      [JSON.stringify(comments), storyId]
    );

    const updatedResult = await run(
      "SELECT * FROM book_stories WHERE id = ? LIMIT 1",
      [storyId]
    );
    
    const updatedRow = updatedResult.rows?.[0] as Record<string, unknown> | undefined;
    if (!updatedRow) {
      throw new Error("Story not found");
    }

    return (await withBookStoryVerifiedFlags([mapBookStoryDoc(storyId, updatedRow)]))[0];
  } catch (error) {
    markFirestoreUnavailable(error);
    console.error("Failed to add book story comment.", error);
    throw new Error("Gagal menambah komentar");
  }
}

export async function deleteBookStoryComment(storyId: string, commentId: string) {
  try {
    await ensureDatabase();

    const result = await run(
      "SELECT comments FROM book_stories WHERE id = ? LIMIT 1",
      [storyId],
    );

    const row = result.rows?.[0] as Record<string, unknown> | undefined;
    if (!row) {
      throw new Error("Story not found");
    }

    let comments: BookStory["comments"] = [];
    try {
      const val = row.comments;
      if (typeof val === "string") {
        comments = JSON.parse(val);
      } else if (Array.isArray(val)) {
        comments = val as BookStory["comments"];
      }
    } catch {
      comments = [];
    }

    const nextComments = comments.filter((comment) => comment.id !== commentId);
    if (nextComments.length === comments.length) {
      return null;
    }

    await run(
      "UPDATE book_stories SET comments = ? WHERE id = ?",
      [JSON.stringify(nextComments), storyId],
    );

    const updatedResult = await run(
      "SELECT * FROM book_stories WHERE id = ? LIMIT 1",
      [storyId],
    );

    const updatedRow = updatedResult.rows?.[0] as Record<string, unknown> | undefined;
    if (!updatedRow) {
      throw new Error("Story not found");
    }

    return (await withBookStoryVerifiedFlags([mapBookStoryDoc(storyId, updatedRow)]))[0];
  } catch (error) {
    console.error("Failed to delete book story comment:", error);
    throw new Error("Gagal hapus komentar");
  }
}

export async function updateBookStoryCommentAuthor(
  storyId: string,
  commentId: string,
  newUserName: string,
  newUserAvatarUrl: string,
) {
  try {
    await ensureDatabase();

    const result = await run(
      "SELECT comments FROM book_stories WHERE id = ? LIMIT 1",
      [storyId],
    );

    const row = result.rows?.[0] as Record<string, unknown> | undefined;
    if (!row) {
      throw new Error("Story not found");
    }

    let comments: BookStory["comments"] = [];
    try {
      const val = row.comments;
      if (typeof val === "string") {
        comments = JSON.parse(val);
      } else if (Array.isArray(val)) {
        comments = val as BookStory["comments"];
      }
    } catch {
      comments = [];
    }

    const updatedComments = comments.map((comment) =>
      comment.id === commentId
        ? { ...comment, userName: newUserName, userAvatarUrl: newUserAvatarUrl }
        : comment
    );

    await run(
      "UPDATE book_stories SET comments = ? WHERE id = ?",
      [JSON.stringify(updatedComments), storyId],
    );

    const updatedResult = await run(
      "SELECT * FROM book_stories WHERE id = ? LIMIT 1",
      [storyId],
    );

    const updatedRow = updatedResult.rows?.[0] as Record<string, unknown> | undefined;
    if (!updatedRow) {
      throw new Error("Story not found");
    }

    return (await withBookStoryVerifiedFlags([mapBookStoryDoc(storyId, updatedRow)]))[0];
  } catch (error) {
    console.error("Failed to update book story comment author:", error);
    throw new Error("Gagal ubah penulis komentar");
  }
}

export async function updateBookStoryCommentVerified(
  storyId: string,
  commentId: string,
  verified: boolean,
) {
  try {
    await ensureDatabase();

    const result = await run(
      "SELECT comments FROM book_stories WHERE id = ? LIMIT 1",
      [storyId],
    );

    const row = result.rows?.[0] as Record<string, unknown> | undefined;
    if (!row) {
      throw new Error("Story not found");
    }

    let comments: BookStory["comments"] = [];
    try {
      const val = row.comments;
      if (typeof val === "string") {
        comments = JSON.parse(val);
      } else if (Array.isArray(val)) {
        comments = val as BookStory["comments"];
      }
    } catch {
      comments = [];
    }

    const updatedComments = comments.map((comment) =>
      comment.id === commentId
        ? { ...comment, verified: !verified }
        : comment
    );

    await run(
      "UPDATE book_stories SET comments = ? WHERE id = ?",
      [JSON.stringify(updatedComments), storyId],
    );

    const updatedResult = await run(
      "SELECT * FROM book_stories WHERE id = ? LIMIT 1",
      [storyId],
    );

    const updatedRow = updatedResult.rows?.[0] as Record<string, unknown> | undefined;
    if (!updatedRow) {
      throw new Error("Story not found");
    }

    return (await withBookStoryVerifiedFlags([mapBookStoryDoc(storyId, updatedRow)]))[0];
  } catch (error) {
    console.error("Failed to update book story comment verified:", error);
    throw new Error("Gagal update verified komentar");
  }
}

export async function updateBookStoryUserProfile(
  userId: string,
  input: { userName?: string; userEmail?: string; userAvatarUrl?: string },
) {
  await ensureDatabase();

  const rows = await run("SELECT id, user_id, comments FROM book_stories").catch(() => null);
  for (const row of ((rows?.rows ?? []) as Array<Record<string, unknown>>)) {
    const storyId = String(row.id ?? "");
    if (!storyId) {
      continue;
    }

    const updates: string[] = [];
    const values: string[] = [];
    if (String(row.user_id ?? "") === userId) {
      if (input.userName !== undefined) {
        updates.push("user_name = ?");
        values.push(input.userName);
      }
      if (input.userEmail !== undefined) {
        updates.push("user_email = ?");
        values.push(input.userEmail);
      }
      if (input.userAvatarUrl !== undefined) {
        updates.push("user_avatar_url = ?");
        values.push(input.userAvatarUrl);
      }
    }

    let commentsChanged = false;
    let comments: BookStory["comments"] = [];
    try {
      const rawComments = row.comments;
      if (typeof rawComments === "string") {
        comments = JSON.parse(rawComments);
      } else if (Array.isArray(rawComments)) {
        comments = rawComments as BookStory["comments"];
      }
    } catch {
      comments = [];
    }

    const nextComments = comments.map((comment) => {
      if (comment.userId !== userId) {
        return comment;
      }

      commentsChanged = true;
      return {
        ...comment,
        userName: input.userName ?? comment.userName,
        userEmail: input.userEmail ?? comment.userEmail,
        userAvatarUrl: input.userAvatarUrl ?? comment.userAvatarUrl,
      };
    });

    if (commentsChanged) {
      updates.push("comments = ?");
      values.push(JSON.stringify(nextComments));
    }

    if (updates.length > 0) {
      await run(`UPDATE book_stories SET ${updates.join(", ")} WHERE id = ?`, [...values, storyId]);
    }
  }
}

// Story report functions
export async function reportStory(storyId: string, reporterUserId: string, reason: string) {
  try {
    await ensureDatabase();
    const id = crypto.randomUUID();
    const createdAt = now();

    await run(
      `INSERT INTO story_reports (id, story_id, reporter_user_id, reason, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(story_id, reporter_user_id) DO UPDATE SET
        id = excluded.id,
        reason = excluded.reason,
        created_at = excluded.created_at`,
      [id, storyId, reporterUserId, reason, createdAt],
    );

    // Update report count in story
    const countRes = await run(
      "SELECT COUNT(*) as count FROM story_reports WHERE story_id = ? AND resolved = 0",
      [storyId],
    );
    const reportCount = Number((countRes.rows?.[0] as any)?.count ?? 0);

    await run(
      "UPDATE book_stories SET report_count = ? WHERE id = ?",
      [reportCount, storyId],
    ).catch(() => {});

    return { success: true, reportId: id };
  } catch (error) {
    console.error("Failed to report story:", error);
    throw new Error("Gagal melaporkan cerita");
  }
}

export async function getStoryReports(storyId?: string) {
  try {
    await ensureDatabase();
    
    let query = `
      SELECT 
        sr.id,
        sr.story_id,
        sr.reporter_user_id,
        sr.reason,
        sr.created_at,
        bs.id as story_user_id,
        bs.user_id,
        bs.user_name,
        bs.user_email,
        bs.user_avatar_url,
        bs.story,
        bs.photos,
        bs.liked_by,
        bs.comments,
        bs.status,
        bs.created_at as story_created_at,
        bs.approved_at
      FROM story_reports sr
      LEFT JOIN book_stories bs ON sr.story_id = bs.id
      WHERE sr.resolved = 0
    `;
    const params: any[] = [];
    
    if (storyId) {
      query += " AND sr.story_id = ?";
      params.push(storyId);
    }
    
    query += " ORDER BY sr.created_at DESC";
    
    const res = await run(query, params);
    
    return ((res.rows ?? []) as Array<Record<string, unknown>>).map((row) => {
      const report: any = {
        id: String(row.id),
        storyId: String(row.story_id),
        userId: String(row.reporter_user_id),
        reason: String(row.reason),
        createdAt: new Date(Number(row.created_at)).toISOString(),
      };

      // Include story data if it exists
      if (row.story_user_id) {
        report.story = mapBookStoryDoc(String(row.story_user_id), {
          userId: row.user_id,
          userName: row.user_name,
          userEmail: row.user_email,
          userAvatarUrl: row.user_avatar_url,
          story: row.story,
          photos: row.photos,
          likedBy: row.liked_by,
          comments: row.comments,
          status: row.status,
          createdAt: row.story_created_at,
          approvedAt: row.approved_at,
        });
      }

      return report;
    });
  } catch (error) {
    console.error("Failed to get story reports:", error);
    return [];
  }
}

export async function resolveStoryReport(reportId: string, resolvedBy: string, deleteStory: boolean = false) {
  try {
    await ensureDatabase();
    const resolvedAt = now();

    // Get report details
    const reportRes = await run(
      "SELECT story_id FROM story_reports WHERE id = ? LIMIT 1",
      [reportId],
    );
    
    const report = reportRes.rows?.[0] as Record<string, unknown> | undefined;
    if (!report) {
      throw new Error("Report not found");
    }

    const storyId = String(report.story_id);

    // Mark report as resolved
    await run(
      "UPDATE story_reports SET resolved = 1, resolved_at = ?, resolved_by = ? WHERE id = ?",
      [resolvedAt, resolvedBy, reportId],
    );

    // If delete story flag is set, delete the story
    if (deleteStory) {
      await run("DELETE FROM book_stories WHERE id = ?", [storyId]);
    }

    // Update report count
    const countRes = await run(
      "SELECT COUNT(*) as count FROM story_reports WHERE story_id = ? AND resolved = 0",
      [storyId],
    );
    const reportCount = Number((countRes.rows?.[0] as any)?.count ?? 0);

    if (!deleteStory) {
      await run(
        "UPDATE book_stories SET report_count = ? WHERE id = ?",
        [reportCount, storyId],
      ).catch(() => {});
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to resolve report:", error);
    throw new Error("Gagal menyelesaikan laporan");
  }
}

export async function deleteBookStory(storyId: string) {
  try {
    await ensureDatabase();
    await run("DELETE FROM book_stories WHERE id = ?", [storyId]);
    await run("DELETE FROM story_reports WHERE story_id = ?", [storyId]).catch(() => {});
    return { success: true };
  } catch (error) {
    console.error("Failed to delete story:", error);
    throw new Error("Gagal menghapus cerita");
  }
}

export async function updateBookStoryLikes(storyId: string, likeCount: number) {
  try {
    await ensureDatabase();
    
    // Create liked_by array with dummy IDs for the like count
    const likedBy = Array.from({ length: Math.max(0, likeCount) }, (_, i) => `system_like_${i}`);
    
    await run(
      "UPDATE book_stories SET liked_by = ?, likes = ? WHERE id = ?",
      [JSON.stringify(likedBy), likeCount, storyId],
    );

    const result = await run(
      "SELECT * FROM book_stories WHERE id = ? LIMIT 1",
      [storyId],
    );
    
    const row = result.rows?.[0] as Record<string, unknown> | undefined;
    if (!row) {
      throw new Error("Story not found");
    }

    return mapBookStoryDoc(storyId, row);
  } catch (error) {
    console.error("Failed to update likes:", error);
    throw new Error("Gagal mengupdate like");
  }
}

export async function addCustomBookStoryComments(storyId: string, comments: Array<{ userName: string; text: string; verified?: boolean }>) {
  try {
    await ensureDatabase();

    const result = await run(
      "SELECT comments, views FROM book_stories WHERE id = ? LIMIT 1",
      [storyId],
    );

    const row = result.rows?.[0] as Record<string, unknown> | undefined;
    if (!row) {
      throw new Error("Story not found");
    }

    let existingComments: any[] = [];
    try {
      const val = row.comments;
      if (typeof val === "string") {
        existingComments = JSON.parse(val);
      }
    } catch {}

    // Add new comments
    const newComments = comments.map((c) => ({
      id: `comment_${Date.now()}_${Math.random()}`,
      userId: "admin",
      userName: c.userName || "Admin",
      userEmail: "digitalawanku2@gmail.com",
      verified: c.verified !== undefined ? c.verified : false,
      text: c.text,
      createdAt: new Date().toISOString(),
    }));

    const allComments = [...existingComments, ...newComments];

    await run(
      "UPDATE book_stories SET comments = ? WHERE id = ?",
      [JSON.stringify(allComments), storyId],
    );

    const updatedResult = await run(
      "SELECT * FROM book_stories WHERE id = ? LIMIT 1",
      [storyId],
    );

    const updatedRow = updatedResult.rows?.[0] as Record<string, unknown> | undefined;
    if (!updatedRow) {
      throw new Error("Story not found");
    }

    return mapBookStoryDoc(storyId, {
      userId: updatedRow.user_id,
      userName: updatedRow.user_name,
      userEmail: updatedRow.user_email,
      userAvatarUrl: updatedRow.user_avatar_url,
      story: updatedRow.story,
      photos: updatedRow.photos,
      likedBy: updatedRow.liked_by,
      comments: updatedRow.comments,
      views: updatedRow.views,
      status: updatedRow.status,
      createdAt: updatedRow.created_at,
      approvedAt: updatedRow.approved_at,
    });
  } catch (error) {
    console.error("Failed to add comments:", error);
    throw new Error("Gagal menambah komentar");
  }
}

export async function changeBookStoryWriter(
  storyId: string,
  newUserId: string,
  newUserName: string,
  newUserEmail: string,
  newUserAvatarUrl: string = "",
) {
  try {
    await ensureDatabase();

    const result = await run(
      "SELECT user_id, original_user_id FROM book_stories WHERE id = ? LIMIT 1",
      [storyId],
    );

    const row = result.rows?.[0] as Record<string, unknown> | undefined;
    if (!row) {
      throw new Error("Cerita tidak ditemukan");
    }

    // Track original author if this is the first change
    const originalUserId = String(row.original_user_id || row.user_id);

    await run(
      `UPDATE book_stories 
       SET user_id = ?, user_name = ?, user_email = ?, user_avatar_url = ?, original_user_id = ?
       WHERE id = ?`,
      [newUserId, newUserName, newUserEmail, newUserAvatarUrl, originalUserId, storyId],
    );

    const updatedResult = await run(
      "SELECT * FROM book_stories WHERE id = ? LIMIT 1",
      [storyId],
    );

    const updatedRow = updatedResult.rows?.[0] as Record<string, unknown> | undefined;
    if (!updatedRow) {
      throw new Error("Cerita tidak ditemukan setelah update");
    }

    return mapBookStoryDoc(storyId, updatedRow);
  } catch (error) {
    console.error("Failed to change story writer:", error);
    throw new Error("Gagal mengubah penulis cerita");
  }
}

export async function manageBookStoryViewers(
  storyId: string,
  isPrivate: boolean,
  restrictedViewerIds: string[] = [],
) {
  try {
    await ensureDatabase();

    const result = await run(
      "SELECT id FROM book_stories WHERE id = ? LIMIT 1",
      [storyId],
    );

    if (!result.rows?.[0]) {
      throw new Error("Cerita tidak ditemukan");
    }

    await run(
      `UPDATE book_stories 
       SET is_private = ?, restricted_viewers = ?
       WHERE id = ?`,
      [Number(isPrivate), JSON.stringify(restrictedViewerIds), storyId],
    );

    const updatedResult = await run(
      "SELECT * FROM book_stories WHERE id = ? LIMIT 1",
      [storyId],
    );

    const updatedRow = updatedResult.rows?.[0] as Record<string, unknown> | undefined;
    if (!updatedRow) {
      throw new Error("Cerita tidak ditemukan setelah update");
    }

    return mapBookStoryDoc(storyId, updatedRow);
  } catch (error) {
    console.error("Failed to manage story viewers:", error);
    throw new Error("Gagal mengatur penonton cerita");
  }
}

// ============================================================================
// PORTFOLIO ITEMS FUNCTIONS
// ============================================================================

function mapPortfolioItemDoc(
  id: string,
  data: Record<string, unknown> | undefined,
): PortfolioItem {
  return {
    id,
    title: String(data?.title ?? ""),
    description: String(data?.description ?? ""),
    imageUrl: resolveMediaUrl(String(data?.imageUrl ?? "")),
    category: String(data?.category ?? ""),
    link: String(data?.link ?? ""),
    sortOrder: Number(data?.sortOrder ?? 0),
    isActive: Boolean(data?.isActive ?? true),
    createdAt: new Date(Number(data?.createdAt ?? now())).toISOString(),
  };
}

export async function listPortfolioItems() {
  const firestore = getFirestoreOrNull();
  if (!firestore) {
    return [];
  }

  try {
    const snapshot = await firestore
      .collection("portfolioItems")
      .where("isActive", "==", true)
      .orderBy("sortOrder", "asc")
      .orderBy("createdAt", "desc")
      .get();

    return snapshot.docs
      .map((doc: any) => mapPortfolioItemDoc(doc.id, doc.data() as Record<string, unknown>))
      .sort((a: PortfolioItem, b: PortfolioItem) =>
        a.sortOrder - b.sortOrder || b.createdAt.localeCompare(a.createdAt),
      );
  } catch (error) {
    console.error("Failed to read portfolio items from Firestore.", error);
    return [];
  }
}

export async function listAllPortfolioItems() {
  const firestore = getFirestoreOrNull();
  if (!firestore) {
    return [];
  }

  try {
    const snapshot = await firestore
      .collection("portfolioItems")
      .orderBy("sortOrder", "asc")
      .orderBy("createdAt", "desc")
      .get();

    return snapshot.docs
      .map((doc: any) => mapPortfolioItemDoc(doc.id, doc.data() as Record<string, unknown>))
      .sort((a: PortfolioItem, b: PortfolioItem) =>
        a.sortOrder - b.sortOrder || b.createdAt.localeCompare(a.createdAt),
      );
  } catch (error) {
    console.error("Failed to read all portfolio items from Firestore.", error);
    return [];
  }
}

export async function createPortfolioItem(input: {
  title: string;
  description: string;
  imageUrl: string;
  category: string;
  link?: string;
  sortOrder?: number;
  isActive?: boolean;
}) {
  const firestore = getFirestoreOrNull();
  if (!firestore) {
    throw new Error("Firestore tidak tersedia");
  }

  try {
    const id = crypto.randomUUID();
    const createdAt = now();
    const mediaUrl = resolveMediaUrl(input.imageUrl);

    await firestore.collection("portfolioItems").doc(id).set({
      title: input.title.trim(),
      description: input.description.trim(),
      imageUrl: mediaUrl,
      category: input.category.trim(),
      link: (input.link ?? "").trim(),
      sortOrder: Math.max(0, Math.floor(input.sortOrder ?? 0)),
      isActive: input.isActive ?? true,
      createdAt,
      updatedAt: createdAt,
    });

    const doc = await firestore.collection("portfolioItems").doc(id).get();
    return mapPortfolioItemDoc(doc.id, doc.data() as Record<string, unknown>);
  } catch (error) {
    console.error("Failed to create portfolio item in Firestore.", error);
    throw new Error("Gagal membuat portfolio item");
  }
}

export async function updatePortfolioItem(
  id: string,
  input: Partial<{
    title: string;
    description: string;
    imageUrl: string;
    category: string;
    link: string;
    sortOrder: number;
    isActive: boolean;
  }>,
) {
  const firestore = getFirestoreOrNull();
  if (!firestore) {
    throw new Error("Firestore tidak tersedia");
  }

  try {
    const ref = firestore.collection("portfolioItems").doc(id);
    const doc = await ref.get();
    if (!doc.exists) {
      return null;
    }

    const nextMediaUrl =
      input.imageUrl !== undefined ? resolveMediaUrl(input.imageUrl) : undefined;

    await ref.update({
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description.trim() } : {}),
      ...(nextMediaUrl !== undefined ? { imageUrl: nextMediaUrl } : {}),
      ...(input.category !== undefined ? { category: input.category.trim() } : {}),
      ...(input.link !== undefined ? { link: input.link.trim() } : {}),
      ...(input.sortOrder !== undefined
        ? { sortOrder: Math.max(0, Math.floor(input.sortOrder)) }
        : {}),
      ...(input.isActive !== undefined ? { isActive: Boolean(input.isActive) } : {}),
      updatedAt: now(),
    });

    const updated = await ref.get();
    return mapPortfolioItemDoc(updated.id, updated.data() as Record<string, unknown>);
  } catch (error) {
    console.error("Failed to update portfolio item in Firestore.", error);
    throw new Error("Gagal memperbarui portfolio item");
  }
}

export async function deletePortfolioItem(id: string) {
  const firestore = getFirestoreOrNull();
  if (!firestore) {
    throw new Error("Firestore tidak tersedia");
  }

  try {
    await firestore.collection("portfolioItems").doc(id).delete();
  } catch (error) {
    console.error("Failed to delete portfolio item in Firestore.", error);
    throw new Error("Gagal menghapus portfolio item");
  }
}

// ============================================================================
// HOMEPAGE CONFIG FUNCTIONS
// ============================================================================

function defaultHomepageConfig(): HomepageConfig {
  return {
    id: "main",
    portfolioEnabled: true,
    servicesEnabled: true,
    testimonialEnabled: true,
    productsEnabled: true,
    informationEnabled: true,
    marqueeEnabled: true,
    heroTitle: "Tokko",
    heroSubtitle: "Your Digital Vision, Perfectly Realized.",
    portfolioSectionTitle: "Portfolio",
    updatedAt: new Date(now()).toISOString(),
  };
}

function mapHomepageConfigDoc(
  id: string,
  data: Record<string, unknown> | undefined,
): HomepageConfig {
  const fallback = defaultHomepageConfig();
  return {
    id,
    portfolioEnabled: Boolean(data?.portfolioEnabled ?? fallback.portfolioEnabled),
    servicesEnabled: Boolean(data?.servicesEnabled ?? fallback.servicesEnabled),
    testimonialEnabled: Boolean(data?.testimonialEnabled ?? fallback.testimonialEnabled),
    productsEnabled: Boolean(data?.productsEnabled ?? fallback.productsEnabled),
    informationEnabled: Boolean(data?.informationEnabled ?? fallback.informationEnabled),
    marqueeEnabled: Boolean(data?.marqueeEnabled ?? fallback.marqueeEnabled),
    heroTitle: String(data?.heroTitle ?? fallback.heroTitle),
    heroSubtitle: String(data?.heroSubtitle ?? fallback.heroSubtitle),
    portfolioSectionTitle: String(data?.portfolioSectionTitle ?? fallback.portfolioSectionTitle),
    updatedAt: new Date(Number(data?.updatedAt ?? now())).toISOString(),
  };
}

export async function getHomepageConfig() {
  const firestore = getFirestoreOrNull();
  if (!firestore) {
    return defaultHomepageConfig();
  }

  try {
    const doc = await firestore.collection("homepageConfig").doc("main").get();
    if (!doc.exists) {
      return defaultHomepageConfig();
    }

    return mapHomepageConfigDoc(doc.id, doc.data() as Record<string, unknown>);
  } catch (error) {
    console.error("Failed to read homepage config from Firestore.", error);
    return defaultHomepageConfig();
  }
}

export async function updateHomepageConfig(
  input: Partial<{
    portfolioEnabled: boolean;
    servicesEnabled: boolean;
    testimonialEnabled: boolean;
    productsEnabled: boolean;
    informationEnabled: boolean;
    marqueeEnabled: boolean;
    heroTitle: string;
    heroSubtitle: string;
    portfolioSectionTitle: string;
  }>,
) {
  const firestore = getFirestoreOrNull();
  if (!firestore) {
    throw new Error("Firestore tidak tersedia");
  }

  try {
    const ref = firestore.collection("homepageConfig").doc("main");
    await ref.set(
      {
        ...(input.portfolioEnabled !== undefined ? { portfolioEnabled: input.portfolioEnabled } : {}),
        ...(input.servicesEnabled !== undefined ? { servicesEnabled: input.servicesEnabled } : {}),
        ...(input.testimonialEnabled !== undefined ? { testimonialEnabled: input.testimonialEnabled } : {}),
        ...(input.productsEnabled !== undefined ? { productsEnabled: input.productsEnabled } : {}),
        ...(input.informationEnabled !== undefined ? { informationEnabled: input.informationEnabled } : {}),
        ...(input.marqueeEnabled !== undefined ? { marqueeEnabled: input.marqueeEnabled } : {}),
        ...(input.heroTitle !== undefined ? { heroTitle: input.heroTitle.trim() } : {}),
        ...(input.heroSubtitle !== undefined ? { heroSubtitle: input.heroSubtitle.trim() } : {}),
        ...(input.portfolioSectionTitle !== undefined
          ? { portfolioSectionTitle: input.portfolioSectionTitle.trim() }
          : {}),
        updatedAt: now(),
      },
      { merge: true },
    );

    return getHomepageConfig();
  } catch (error) {
    console.error("Failed to update homepage config in Firestore.", error);
    throw new Error("Gagal memperbarui homepage config");
  }
}

// ==================== TESTIMONIAL COMMENTS ====================

function mapTestimonialCommentDoc(
  id: string,
  data: Record<string, unknown> | undefined,
): any {
  return {
    id,
    testimonialId: String(data?.testimonialId ?? ""),
    userId: String(data?.userId ?? "").trim() || undefined,
    userName: String(data?.userName ?? ""),
    userAvatarUrl: String(data?.userAvatarUrl ?? ""),
    verified: Boolean(data?.verified),
    rating: Math.max(0, Math.min(5, Number(data?.rating ?? 0))),
    text: String(data?.text ?? ""),
    replyToId: String(data?.replyToId ?? "").trim() || undefined,
    replyToName: String(data?.replyToName ?? "").trim() || undefined,
    createdAt: new Date(Number(data?.createdAt ?? now())).toISOString(),
  };
}

function mapTestimonialComment(row: Record<string, unknown>): any {
  return {
    id: String(row.id),
    testimonialId: String(row.testimonial_id ?? ""),
    userId: String(row.user_id ?? "").trim() || undefined,
    userName: String(row.user_name ?? ""),
    userAvatarUrl: String(row.user_avatar_url ?? ""),
    verified: Number(row.verified ?? 0) === 1,
    rating: Math.max(0, Math.min(5, Number(row.rating ?? 0))),
    text: String(row.text ?? ""),
    replyToId: String(row.reply_to_id ?? "").trim() || undefined,
    replyToName: String(row.reply_to_name ?? "").trim() || undefined,
    createdAt: new Date(Number(row.created_at ?? now())).toISOString(),
  };
}

export async function addTestimonialComment(input: {
  testimonialId: string;
  userId?: string;
  userName: string;
  userAvatarUrl?: string;
  verified?: boolean;
  rating?: number;
  text: string;
  replyToId?: string;
  replyToName?: string;
}): Promise<any> {
  const firestore = getFirestoreOrNull();
  if (firestore) {
    try {
      const id = crypto.randomUUID();
      const createdAt = now();
      const rating = Math.max(0, Math.min(5, input.rating ?? 0));

      await firestore.collection("testimonialComments").doc(id).set({
        testimonialId: input.testimonialId,
        userId: input.userId ?? null,
        userName: input.userName,
        userAvatarUrl: input.userAvatarUrl ?? "",
        verified: input.verified ? true : false,
        rating,
        text: input.text.trim(),
        replyToId: input.replyToId ?? null,
        replyToName: input.replyToName ?? null,
        createdAt,
        updatedAt: createdAt,
      });

      const doc = await firestore.collection("testimonialComments").doc(id).get();
      return mapTestimonialCommentDoc(id, doc.data() as Record<string, unknown>);
    } catch (error) {
      console.error("Failed to add testimonial comment in Firestore:", error);
    }
  }

  // Fallback to local database
  try {
    const { ensureDatabase: ensDb, run: dbRun } = await import("./db");
    const id = crypto.randomUUID();
    const createdAt = now();
    const rating = Math.max(0, Math.min(5, input.rating ?? 0));

    await ensDb();
    await dbRun(
      `INSERT INTO testimonial_comments
        (id, testimonial_id, user_id, user_name, user_avatar_url, verified, rating, text, reply_to_id, reply_to_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.testimonialId,
        input.userId ?? null,
        input.userName,
        input.userAvatarUrl ?? "",
        input.verified ? 1 : 0,
        rating,
        input.text.trim(),
        input.replyToId ?? null,
        input.replyToName ?? null,
        createdAt,
        createdAt,
      ],
    );

    const res = await dbRun("SELECT * FROM testimonial_comments WHERE id = ? LIMIT 1", [id]);
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row ? mapTestimonialComment(row) : null;
  } catch (error) {
    console.error("Failed to add testimonial comment in database:", error);
    return null;
  }
}

export async function getTestimonialComments(testimonialId: string): Promise<any[]> {
  const firestore = getFirestoreOrNull();
  if (firestore) {
    try {
      const snapshot = await firestore
        .collection("testimonialComments")
        .where("testimonialId", "==", testimonialId)
        .orderBy("createdAt", "asc")
        .get();

      if (snapshot.size > 0) {
        return snapshot.docs.map((doc: any) =>
          mapTestimonialCommentDoc(doc.id, doc.data() as Record<string, unknown>),
        );
      }
    } catch (error) {
      console.error("Failed to get testimonial comments from Firestore:", error);
    }
  }

  // Fallback to local database
  try {
    const { ensureDatabase: ensDb, run: dbRun } = await import("./db");
    await ensDb();
    const res = await dbRun(
      "SELECT * FROM testimonial_comments WHERE testimonial_id = ? ORDER BY created_at ASC",
      [testimonialId],
    );
    return (res.rows as Record<string, unknown>[]).map(mapTestimonialComment);
  } catch (error) {
    console.error("Failed to get testimonial comments from database:", error);
    return [];
  }
}

export async function deleteTestimonialComment(commentId: string): Promise<boolean> {
  const firestore = getFirestoreOrNull();
  if (firestore) {
    try {
      await firestore.collection("testimonialComments").doc(commentId).delete();
      return true;
    } catch (error) {
      console.error("Failed to delete testimonial comment in Firestore:", error);
    }
  }

  // Fallback to local database
  try {
    const { ensureDatabase: ensDb, run: dbRun } = await import("./db");
    await ensDb();
    await dbRun("DELETE FROM testimonial_comments WHERE id = ?", [commentId]);
    return true;
  } catch (error) {
    console.error("Failed to delete testimonial comment in database:", error);
    return false;
  }
}

export async function updateTestimonialComment(commentId: string, text: string): Promise<any> {
  const firestore = getFirestoreOrNull();
  if (firestore) {
    try {
      const updatedAt = now();
      await firestore.collection("testimonialComments").doc(commentId).update({
        text: text.trim(),
        updatedAt,
      });

      const doc = await firestore.collection("testimonialComments").doc(commentId).get();
      return mapTestimonialCommentDoc(commentId, doc.data() as Record<string, unknown>);
    } catch (error) {
      console.error("Failed to update testimonial comment in Firestore:", error);
    }
  }

  // Fallback to local database
  try {
    const { ensureDatabase: ensDb, run: dbRun } = await import("./db");
    await ensDb();
    const updatedAt = now();
    await dbRun(
      "UPDATE testimonial_comments SET text = ?, updated_at = ? WHERE id = ?",
      [text.trim(), updatedAt, commentId],
    );

    const res = await dbRun("SELECT * FROM testimonial_comments WHERE id = ? LIMIT 1", [commentId]);
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row ? mapTestimonialComment(row) : null;
  } catch (error) {
    console.error("Failed to update testimonial comment in database:", error);
    return null;
  }
}

export async function updateTestimonialCommentRating(
  commentId: string,
  rating: number,
): Promise<any> {
  const rating_val = Math.max(0, Math.min(5, rating));
  const firestore = getFirestoreOrNull();
  if (firestore) {
    try {
      const updatedAt = now();
      await firestore.collection("testimonialComments").doc(commentId).update({
        rating: rating_val,
        updatedAt,
      });

      const doc = await firestore.collection("testimonialComments").doc(commentId).get();
      return mapTestimonialCommentDoc(commentId, doc.data() as Record<string, unknown>);
    } catch (error) {
      console.error("Failed to update testimonial comment rating in Firestore:", error);
    }
  }

  // Fallback to local database
  try {
    const { ensureDatabase: ensDb, run: dbRun } = await import("./db");
    await ensDb();
    const updatedAt = now();
    await dbRun(
      "UPDATE testimonial_comments SET rating = ?, updated_at = ? WHERE id = ?",
      [rating_val, updatedAt, commentId],
    );

    const res = await dbRun("SELECT * FROM testimonial_comments WHERE id = ? LIMIT 1", [commentId]);
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row ? mapTestimonialComment(row) : null;
  } catch (error) {
    console.error("Failed to update testimonial comment rating in database:", error);
    return null;
  }
}

export async function updateTestimonialUserProfile(
  userId: string,
  input: { userName?: string; userAvatarUrl?: string },
): Promise<boolean> {
  const firestore = getFirestoreOrNull();
  if (firestore) {
    try {
      const [commentsSnapshot, testimonialsSnapshot] = await Promise.all([
        firestore.collection("testimonialComments").where("userId", "==", userId).get(),
        firestore.collection("testimonials").where("userId", "==", userId).get(),
      ]);

      if (commentsSnapshot.size > 0 || testimonialsSnapshot.size > 0) {
        const batch = firestore.batch();
        commentsSnapshot.docs.forEach((doc: any) => {
          batch.update(doc.ref, {
            ...(input.userName !== undefined ? { userName: input.userName } : {}),
            ...(input.userAvatarUrl !== undefined ? { userAvatarUrl: input.userAvatarUrl } : {}),
          });
        });
        testimonialsSnapshot.docs.forEach((doc: any) => {
          batch.update(doc.ref, {
            ...(input.userName !== undefined ? { name: input.userName } : {}),
            ...(input.userAvatarUrl !== undefined ? { userAvatarUrl: input.userAvatarUrl } : {}),
            updatedAt: now(),
          });
        });
        await batch.commit();
      }
      return true;
    } catch (error) {
      console.error("Failed to update testimonial user profile in Firestore:", error);
    }
  }

  // Fallback to local database
  try {
    const { ensureDatabase: ensDb, run: dbRun } = await import("./db");
    await ensDb();
    const commentSets: string[] = [];
    const commentValues: (string | number)[] = [];
    if (input.userName !== undefined) {
      commentSets.push("user_name = ?");
      commentValues.push(input.userName);
    }
    if (input.userAvatarUrl !== undefined) {
      commentSets.push("user_avatar_url = ?");
      commentValues.push(input.userAvatarUrl);
    }
    if (commentSets.length > 0) {
      const nowValue = now();
      await dbRun(
        `UPDATE testimonial_comments SET ${commentSets.join(", ")}, updated_at = ? WHERE user_id = ?`,
        [...commentValues, nowValue, userId] as (string | number | null)[]
      );
    }

    const testimonialSets: string[] = [];
    const testimonialValues: (string | number)[] = [];
    if (input.userName !== undefined) {
      testimonialSets.push("name = ?");
      testimonialValues.push(input.userName);
    }
    if (input.userAvatarUrl !== undefined) {
      testimonialSets.push("user_avatar_url = ?");
      testimonialValues.push(input.userAvatarUrl);
    }
    if (testimonialSets.length > 0) {
      const nowValue = now();
      await dbRun(
        `UPDATE testimonials SET ${testimonialSets.join(", ")}, updated_at = ? WHERE user_id = ?`,
        [...testimonialValues, nowValue, userId] as (string | number | null)[]
      );
    }
    return true;
  } catch (error) {
    console.error("Failed to update testimonial user profile in database:", error);
    return false;
  }
}

export async function updateTestimonialCommentUserName(userId: string, newUserName: string): Promise<boolean> {
  return updateTestimonialUserProfile(userId, { userName: newUserName });
}

export async function updateTestimonialCommentAuthor(
  commentId: string,
  newUserName: string,
  newUserAvatarUrl: string = "",
): Promise<any> {
  const firestore = getFirestoreOrNull();
  if (firestore) {
    try {
      const updatedAt = now();
      await firestore.collection("testimonialComments").doc(commentId).update({
        userName: newUserName,
        userAvatarUrl: newUserAvatarUrl,
        updatedAt,
      });

      const doc = await firestore.collection("testimonialComments").doc(commentId).get();
      return mapTestimonialCommentDoc(commentId, doc.data() as Record<string, unknown>);
    } catch (error) {
      console.error("Failed to update testimonial comment author in Firestore:", error);
    }
  }

  // Fallback to local database
  try {
    const { ensureDatabase: ensDb, run: dbRun } = await import("./db");
    await ensDb();
    await dbRun(
      "UPDATE testimonial_comments SET user_name = ?, user_avatar_url = ?, updated_at = ? WHERE id = ?",
      [newUserName, newUserAvatarUrl, now(), commentId],
    );

    const res = await dbRun("SELECT * FROM testimonial_comments WHERE id = ? LIMIT 1", [commentId]);
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row ? mapTestimonialComment(row) : null;
  } catch (error) {
    console.error("Failed to update testimonial comment author in database:", error);
    throw new Error("Gagal mengubah penulis komentar");
  }
}

export async function updateTestimonialCommentVerified(
  commentId: string,
  verified: boolean,
): Promise<any> {
  const firestore = getFirestoreOrNull();
  if (firestore) {
    try {
      const updatedAt = now();
      await firestore.collection("testimonialComments").doc(commentId).update({
        verified,
        updatedAt,
      });

      const doc = await firestore.collection("testimonialComments").doc(commentId).get();
      return mapTestimonialCommentDoc(commentId, doc.data() as Record<string, unknown>);
    } catch (error) {
      console.error("Failed to update testimonial comment verified status in Firestore:", error);
    }
  }

  // Fallback to local database
  try {
    const { ensureDatabase: ensDb, run: dbRun } = await import("./db");
    await ensDb();
    await dbRun(
      "UPDATE testimonial_comments SET verified = ?, updated_at = ? WHERE id = ?",
      [verified ? 1 : 0, now(), commentId],
    );

    const res = await dbRun("SELECT * FROM testimonial_comments WHERE id = ? LIMIT 1", [commentId]);
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row ? mapTestimonialComment(row) : null;
  } catch (error) {
    console.error("Failed to update testimonial comment verified status in database:", error);
    throw new Error("Gagal mengubah status verified komentar");
  }
}

// Comment Reactions functions

function mapCommentReaction(row: Record<string, unknown>) {
  return {
    id: String(row.id ?? ""),
    commentId: String(row.comment_id ?? ""),
    userId: String(row.user_id ?? "").trim() || undefined,
    emoji: String(row.emoji ?? ""),
    createdAt: new Date(Number(row.created_at ?? now())).toISOString(),
  };
}

export async function addCommentReaction(input: {
  commentId: string;
  userId?: string;
  emoji: string;
}): Promise<any> {
  const firestore = getFirestoreOrNull();
  if (firestore) {
    try {
      const id = crypto.randomUUID();
      const createdAt = now();

      await firestore.collection("commentReactions").doc(id).set({
        commentId: input.commentId,
        userId: input.userId ?? null,
        emoji: input.emoji,
        createdAt,
      });

      const doc = await firestore.collection("commentReactions").doc(id).get();
      return mapCommentReaction({ id, ...doc.data() } as Record<string, unknown>);
    } catch (error) {
      console.error("Failed to add comment reaction in Firestore:", error);
    }
  }

  // Fallback to local database
  try {
    const { ensureDatabase: ensDb, run: dbRun } = await import("./db");
    const id = crypto.randomUUID();
    const createdAt = now();

    await ensDb();
    await dbRun(
      `INSERT INTO comment_reactions (id, comment_id, user_id, emoji, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(comment_id, user_id, emoji) DO NOTHING`,
      [id, input.commentId, input.userId ?? null, input.emoji, createdAt],
    );

    const res = await dbRun("SELECT * FROM comment_reactions WHERE id = ? LIMIT 1", [id]);
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row ? mapCommentReaction(row) : null;
  } catch (error) {
    console.error("Failed to add comment reaction in database:", error);
    return null;
  }
}

export async function removeCommentReaction(input: {
  commentId: string;
  userId?: string;
  emoji: string;
}): Promise<boolean> {
  const firestore = getFirestoreOrNull();
  if (firestore) {
    try {
      const snapshot = await firestore
        .collection("commentReactions")
        .where("commentId", "==", input.commentId)
        .where("userId", "==", input.userId ?? null)
        .where("emoji", "==", input.emoji)
        .limit(1)
        .get();

      if (snapshot.size > 0) {
        await snapshot.docs[0].ref.delete();
      }
      return true;
    } catch (error) {
      console.error("Failed to remove comment reaction in Firestore:", error);
    }
  }

  // Fallback to local database
  try {
    const { ensureDatabase: ensDb, run: dbRun } = await import("./db");
    await ensDb();
    await dbRun(
      `DELETE FROM comment_reactions 
       WHERE comment_id = ? AND user_id = ? AND emoji = ?`,
      [input.commentId, input.userId ?? null, input.emoji],
    );
    return true;
  } catch (error) {
    console.error("Failed to remove comment reaction in database:", error);
    return false;
  }
}

export async function getCommentReactions(commentId: string): Promise<any[]> {
  const firestore = getFirestoreOrNull();
  if (firestore) {
    try {
      const snapshot = await firestore
        .collection("commentReactions")
        .where("commentId", "==", commentId)
        .orderBy("createdAt", "asc")
        .get();

      if (snapshot.size > 0) {
        return snapshot.docs.map((doc: any) =>
          mapCommentReaction({ id: doc.id, ...doc.data() } as Record<string, unknown>),
        );
      }
    } catch (error) {
      console.error("Failed to get comment reactions from Firestore:", error);
    }
  }

  // Fallback to local database
  try {
    const { ensureDatabase: ensDb, run: dbRun } = await import("./db");
    await ensDb();
    const res = await dbRun(
      "SELECT * FROM comment_reactions WHERE comment_id = ? ORDER BY created_at ASC",
      [commentId],
    );
    return (res.rows as Record<string, unknown>[]).map(mapCommentReaction);
  } catch (error) {
    console.error("Failed to get comment reactions from database:", error);
    return [];
  }
}

export async function getCommentReactionsSummary(commentId: string, userId?: string): Promise<any> {
  try {
    const reactions = await getCommentReactions(commentId);
    const summary: Record<string, { count: number; userReacted: boolean }> = {};

    for (const reaction of reactions) {
      if (!summary[reaction.emoji]) {
        summary[reaction.emoji] = { count: 0, userReacted: false };
      }
      summary[reaction.emoji].count += 1;
      if (userId && reaction.userId === userId) {
        summary[reaction.emoji].userReacted = true;
      }
    }

    return Object.entries(summary).map(([emoji, data]) => ({
      emoji,
      ...data,
    }));
  } catch (error) {
    console.error("Failed to get comment reactions summary:", error);
    return [];
  }
}
