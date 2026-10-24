import type { AdminAction } from "@/types/skillflow";

export const adminActions: AdminAction[] = [
  { id: "publish", title: "Publish release", detail: "Review product metadata and mark a version as public." },
  { id: "zip-upload", title: "Upload ZIP", detail: "Attach the signed archive and store it in the private bucket." },
  { id: "orders", title: "Order monitoring", detail: "Track payment status and customer entitlement updates." },
];
