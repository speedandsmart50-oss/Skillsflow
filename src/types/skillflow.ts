export type UserRole = "guest" | "customer" | "admin";
export type ProductStatus = "draft" | "published";
export type PaymentState = "pending" | "paid" | "failed";

export type Product = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  problem: string;
  stack: string[];
  installSteps: string[];
  price: number;
  version: string;
  status: ProductStatus;
  zipFile: string;
  compatibleAgents: string[];
  versions: VersionEntry[];
};

export type VersionEntry = {
  version: string;
  date: string;
  notes: string[];
  status: "published" | "draft";
};

export type Order = {
  id: string;
  customer: string;
  total: number;
  status: PaymentState;
  date: string;
};

export type DownloadAccess = {
  productId: string;
  allowed: boolean;
  expiresAt?: string;
};

export type AdminAction = {
  id: string;
  title: string;
  detail: string;
};
