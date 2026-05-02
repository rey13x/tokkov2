export type ProductType = "jual_beli" | "pekerjaan";

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
  productType: ProductType;
  jobApplicationLink?: string;
  maxApplicants?: number;
  applicantCount?: number;
};

export type MaintenanceSettings = {
  id: "main";
  isEnabled: boolean;
  message: string;
  accessKey: string;
  openDate?: string;
  openTime?: string;
  closeDate?: string;
  closeTime?: string;
  updatedAt: string;
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
  roleLabel: string;
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

export type BookStory = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userAvatarUrl?: string;
  story: string;
  photos: string[];
  likes: number;
  likedBy: string[];
  comments: Array<{
    id: string;
    userId: string;
    userName: string;
    text: string;
    createdAt: string;
  }>;
  reportCount?: number;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  approvedAt?: string;
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
  items?: StoreOrderItem[];
  cancelRequestStatus?: "none" | "requested" | "confirmed";
  cancelRequestReason?: string;
  cancelRequestedAt?: string | null;
  cancelConfirmedAt?: string | null;
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

export type PortfolioItem = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  category: string;
  link?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
};

export type ServiceConfig = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  isActive: boolean;
  sortOrder: number;
  parentId?: string; // For nested menu
  children?: ServiceConfig[];
  createdAt: string;
};

export type HomepageConfig = {
  id: string;
  portfolioEnabled: boolean;
  servicesEnabled: boolean;
  testimonialEnabled: boolean;
  productsEnabled: boolean;
  informationEnabled: boolean;
  marqueeEnabled: boolean;
  heroTitle: string;
  heroSubtitle: string;
  portfolioSectionTitle: string;
  updatedAt: string;
};
