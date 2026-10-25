export const legalInformation = {
  address: "[À COMPLÉTER]",
  vatStatus: "[À COMPLÉTER : mention TVA applicable ou non selon le régime de l’éditeur]",
  competentCourts: "[À COMPLÉTER]",
  accountRetention: "[À COMPLÉTER]",
  orderRetention: "[À COMPLÉTER]",
  paymentLogRetention: "[À COMPLÉTER]",
} as const;

export function hasUncompletedLegalInformation(): boolean {
  return Object.values(legalInformation).some((value) => value.includes("[À COMPLÉTER]"));
}
