import { eurosToXof, XOF_PER_EUR } from "@/lib/money";

export const PRODUCT_SLUG = "prospection-ethique";
export const PRODUCT_PRICE_EUR = 39;
export const BOOST_COUPON_CODE = "BOOST";
export const BOOST_DISCOUNT_EUR = 10;
export const INITIAL_LIVE_TRIAL_PRICE_XOF = 280;
export const ADMIN_COUPON_CODE = "ADMIN";

export class InvalidCouponError extends Error {
  constructor(message = "Le code de réduction est invalide.") {
    super(message);
    this.name = "InvalidCouponError";
  }
}

export function calculateProductPrice(
  couponInput = "",
  trialPriceXof: number | null = INITIAL_LIVE_TRIAL_PRICE_XOF,
) {
  const couponCode = couponInput.trim().toUpperCase();

  if (couponCode && couponCode !== BOOST_COUPON_CODE && couponCode !== ADMIN_COUPON_CODE) {
    throw new InvalidCouponError();
  }

  if (couponCode === BOOST_COUPON_CODE && trialPriceXof !== null) {
    throw new InvalidCouponError("BOOST sera disponible après la fin de l’offre pilote.");
  }

  const subtotalEur = trialPriceXof === null
    ? PRODUCT_PRICE_EUR
    : Number((trialPriceXof / XOF_PER_EUR).toFixed(2));
  const discountEur = couponCode === BOOST_COUPON_CODE ? BOOST_DISCOUNT_EUR : 0;
  const totalEur = subtotalEur - discountEur;
  return {
    productSlug: PRODUCT_SLUG,
    couponCode: couponCode || null,
    subtotalEur,
    discountEur,
    totalEur,
    totalXof: trialPriceXof ?? eurosToXof(totalEur),
  };
}
