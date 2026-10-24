export const XOF_PER_EUR = 655.957;

export function eurosToXof(amountEur: number): number {
  if (!Number.isFinite(amountEur) || amountEur < 0) {
    throw new RangeError("Euro amount must be a finite, non-negative number");
  }

  return Math.round(amountEur * XOF_PER_EUR);
}
