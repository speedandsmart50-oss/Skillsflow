-- Publish active member skills as products. They grant in-app agent access, so they do not need a ZIP.
insert into public.products (
  slug, name, description, status, price, version, zip_path,
  domain, catalog_status, price_eur, price_xof
)
select
  skill.slug,
  skill.name,
  coalesce(nullif(skill.long_description, ''), skill.short_description),
  'published',
  skill.price_cents / 100.0,
  '1.0.0',
  null,
  category.name,
  'disponible',
  skill.price_cents / 100.0,
  round((skill.price_cents / 100.0) * 655.957)::bigint
from public.skills as skill
join public.skill_categories as category on category.id = skill.category_id
where skill.is_active and skill.product_id is null
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  status = 'published',
  price = excluded.price,
  version = coalesce(nullif(public.products.version, ''), '1.0.0'),
  zip_path = coalesce(public.products.zip_path, excluded.zip_path),
  domain = excluded.domain,
  catalog_status = 'disponible',
  price_eur = excluded.price_eur,
  price_xof = excluded.price_xof,
  archived_at = null,
  updated_at = now();

update public.skills as skill
set product_id = product.id,
    price_cents = round(product.price_eur * 100)::integer,
    updated_at = now()
from public.products as product
where product.slug = skill.slug
  and skill.is_active
  and skill.product_id is null;
