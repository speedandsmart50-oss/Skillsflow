-- Align the public bundle with the SkillFlow launch pricing.
update public.products
set price = 69.00,
    price_eur = 69.00,
    price_xof = 45261
where slug = 'pack-marketing-reseau'
  and archived_at is null;
