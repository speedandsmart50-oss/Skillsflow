import { eurosToXof } from "@/lib/money";

export const PRODUCT_SLUG = "prospection-ethique";
export const PRODUCT_PRICE_EUR = 39;
export const BOOST_COUPON_CODE = "BOOST";
export const BOOST_DISCOUNT_EUR = 10;
export const SMART_COUPON_CODE = "SMART";
export class InvalidCouponError extends Error {
  constructor(message = "Le code de réduction est invalide.") {
    super(message);
    this.name = "InvalidCouponError";
  }
}

export function calculateProductPrice(
  couponInput = "",
  productSlug = PRODUCT_SLUG,
  productPriceEur = PRODUCT_PRICE_EUR,
  productPriceXof = eurosToXof(productPriceEur),
) {
  const couponCode = couponInput.trim().toUpperCase();

  if (couponCode && couponCode !== BOOST_COUPON_CODE && couponCode !== SMART_COUPON_CODE) {
    throw new InvalidCouponError();
  }

  const subtotalEur = productPriceEur;
  const discountEur = couponCode === SMART_COUPON_CODE
    ? subtotalEur
    : couponCode === BOOST_COUPON_CODE ? BOOST_DISCOUNT_EUR : 0;
  const totalEur = subtotalEur - discountEur;
  if (totalEur < 0) {
    throw new InvalidCouponError("Le prix de ce skill ne permet pas d’utiliser ce code de réduction.");
  }
  return {
    productSlug,
    couponCode: couponCode || null,
    subtotalEur,
    discountEur,
    totalEur,
    totalXof: couponCode === SMART_COUPON_CODE ? 0 : couponCode ? eurosToXof(totalEur) : productPriceXof,
  };
}
