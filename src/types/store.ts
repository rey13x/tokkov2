export type StoreProduct = {
  id: string;
  slug: string;
  name: string;
  category: string;
  shortDescription: string;
  description: string;
  duration: string;
  price: number;
  imageUrl: string;
  isActive: boolean;
};

export type InformationType = "message" | "poll" | "update";

export type StoreInformation = {
  id: string;
  type: InformationType;
  title: string;
  body: string;
  imageUrl: string;
  pollOptions: string[];
  pollVotes: Record<string, number>;
  createdAt: string;
};

export type StoreTestimonial = {
  id: string;
  name: string;
  country: string;
  message: string;
  rating: number;
  mediaUrl: string;
  audioUrl: string;
  createdAt: string;
};

export type StoreMarqueeItem = {
  id: string;
  label: string;
  imageUrl: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
};

export type StorePrivacyPolicyPage = {
  id: string;
  title: string;
  updatedLabel: string;
  bannerImageUrl: string;
  contentHtml: string;
  updatedAt: string;
};

export type StorePaymentSettings = {
  id: string;
  title: string;
  qrisImageUrl: string;
  instructionText: string;
  expiryMinutes: number;
  updatedAt: string;
};

export type OrderItemInput = {
  productId: string;
  quantity: number;
};

export type OrderSummary = {
  id: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  total: number;
  status: string;
  createdAt: string;
};

export type StoreOrderItem = {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  productDuration: string;
  quantity: number;
  unitPrice: number;
};

export type StoreOrderDetail = OrderSummary & {
  items: StoreOrderItem[];
};
