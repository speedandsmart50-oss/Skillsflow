import { hasUncompletedLegalInformation } from "./legal-information";

export function isCommerceOpen(flag: string | undefined, legalInformationComplete: boolean): boolean {
  return flag === "true" && legalInformationComplete;
}

export function canCheckout(flag: string | undefined): boolean {
  return isCommerceOpen(flag, !hasUncompletedLegalInformation());
}
