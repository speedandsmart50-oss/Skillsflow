export function isCommerceOpen(flag: string | undefined): boolean {
  return flag === "true";
}

export function canCheckout(flag: string | undefined): boolean {
  return isCommerceOpen(flag);
}
