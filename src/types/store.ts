export type StoreProduct = {
  id: string;
  slug: string;
  name: string;
  category: string;
  shortDescription: string;
  description: string;
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
  createdAt: string;
};

export type OrderItemInput = {
  productId: string;
  quantity: number;
};

export type OrderSummary = {
  id: string;
  userName: string;
  userEmail: string;
  total: number;
  status: string;
  createdAt: string;
};

