export function isAllowlistedAdmin(
  email: string | null | undefined,
  emailConfirmed: boolean,
  allowedEmail: string | null | undefined,
): boolean {
  if (!email || !allowedEmail || !emailConfirmed) return false;
  return email.trim().toLowerCase() === allowedEmail.trim().toLowerCase();
}
