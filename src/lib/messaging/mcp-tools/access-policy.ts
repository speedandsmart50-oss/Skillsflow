export function isConfiguredMessagingAdmin(
  role: unknown,
  email: unknown,
  configuredAdminEmail: string | undefined,
): boolean {
  const expectedEmail = configuredAdminEmail?.trim().toLowerCase();
  return Boolean(
    expectedEmail
      && role === "admin"
      && typeof email === "string"
      && email.trim().toLowerCase() === expectedEmail,
  );
}
