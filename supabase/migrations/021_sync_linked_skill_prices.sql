-- Keep the member library price aligned with the price of its linked catalog product.
update public.skills as skill
set price_cents = round(product.price_eur * 100)::integer,
    updated_at = now()
from public.products as product
where skill.product_id = product.id
  and skill.price_cents <> round(product.price_eur * 100)::integer;
