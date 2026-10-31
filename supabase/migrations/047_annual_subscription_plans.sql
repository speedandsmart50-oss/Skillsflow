-- Annual membership plans are separate products so the checkout amount and access duration
-- are both enforced by the existing payment and entitlement flow.
insert into public.products (
  slug, name, description, status, price, version, zip_path,
  domain, catalog_status, price_eur, price_xof, product_type, subscription_days
)
values
  ('skillflow-plus-annual', 'SkillFlow Plus annuel', 'Accès annuel à SkillFlow Plus. Deux mois sont offerts par rapport au paiement mensuel.', 'published', 149.00, '1.0.0', null, 'Abonnement SkillFlow', 'disponible', 149.00, 97700, 'subscription', 365),
  ('skillflow-pro-annual', 'SkillFlow Pro annuel', 'Accès annuel à SkillFlow Pro. Deux mois sont offerts par rapport au paiement mensuel.', 'published', 299.00, '1.0.0', null, 'Abonnement SkillFlow', 'disponible', 299.00, 196100, 'subscription', 365)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  status = excluded.status,
  price = excluded.price,
  domain = excluded.domain,
  catalog_status = excluded.catalog_status,
  price_eur = excluded.price_eur,
  price_xof = excluded.price_xof,
  product_type = excluded.product_type,
  subscription_days = excluded.subscription_days,
  archived_at = null,
  updated_at = now();

create or replace function public.subscription_skill_limit(p_plan_slug text)
returns integer
language sql immutable
as $$
  select case regexp_replace(p_plan_slug, '-annual$', '')
    when 'skillflow-plus' then 1
    when 'skillflow-pro' then 2
    when 'skillflow-max' then 3
    else 0
  end;
$$;
