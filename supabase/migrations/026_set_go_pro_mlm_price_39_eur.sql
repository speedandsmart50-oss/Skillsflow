-- Keep the catalogue and its linked skill aligned at the requested price.
update public.skills
set price_cents = 3900,
    updated_at = now()
where slug = 'go-pro-mlm';

update public.products
set price = 39.00,
    price_eur = 39.00,
    price_xof = 25582,
    updated_at = now()
where slug = 'go-pro-mlm';
