-- Public catalogue access is limited to display metadata. Detailed skill
-- instructions and workflows are returned only by authenticated API routes
-- after the user's entitlement has been checked.
revoke all on public.skills from public, anon, authenticated;

grant select (
  id,
  slug,
  name,
  category_id,
  short_description,
  price_cents,
  is_included_in_membership,
  is_active,
  product_id,
  created_at,
  updated_at
) on public.skills to anon, authenticated;

grant all on public.skills to service_role;
