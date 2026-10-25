-- Repair French catalog strings that were previously persisted with mojibake.
create or replace function pg_temp.repair_catalog_text(value text)
returns text language plpgsql immutable as $$
begin
  value := replace(value, 'Ã©', 'é');
  value := replace(value, 'Ã¨', 'è');
  value := replace(value, 'Ãª', 'ê');
  value := replace(value, 'Ã«', 'ë');
  value := replace(value, 'Ã ', 'à');
  value := replace(value, 'Ã ', 'à');
  value := replace(value, 'Ã¢', 'â');
  value := replace(value, 'Ã®', 'î');
  value := replace(value, 'Ã¯', 'ï');
  value := replace(value, 'Ã´', 'ô');
  value := replace(value, 'Ã»', 'û');
  value := replace(value, 'Ã¹', 'ù');
  value := replace(value, 'Ã§', 'ç');
  value := replace(value, 'Ã‰', 'É');
  value := replace(value, 'Ã€', 'À');
  value := replace(value, 'â€™', '’');
  value := replace(value, 'â€˜', '‘');
  value := replace(value, 'â€œ', '“');
  value := replace(value, 'â€', '”');
  value := replace(value, 'â€“', '–');
  value := replace(value, 'â€”', '—');
  value := replace(value, 'â‚¬', '€');
  value := replace(value, 'â—‰', '◉');
  value := replace(value, 'â—Ž', '◎');
  value := replace(value, 'âœ¦', '✦');
  value := replace(value, 'â—‡', '◇');
  value := replace(value, 'âœ‰', '✉');
  value := replace(value, 'â™¡', '♡');
  value := replace(value, 'âŒ•', '⌕');
  value := replace(value, 'âŒ‚', '⌂');
  value := replace(value, 'â–£', '▣');
  value := replace(value, 'â–¤', '▤');
  value := replace(value, 'â—·', '◷');
  value := replace(value, 'â—«', '◫');
  value := replace(value, 'â–§', '▧');
  value := replace(value, 'âœš', '✚');
  value := replace(value, 'âœ³', '✳');
  return value;
end
$$;

update public.products set
  name = pg_temp.repair_catalog_text(name),
  description = pg_temp.repair_catalog_text(description),
  domain = pg_temp.repair_catalog_text(domain);

update public.skill_categories set
  name = pg_temp.repair_catalog_text(name),
  description = pg_temp.repair_catalog_text(description),
  icon = pg_temp.repair_catalog_text(icon);

update public.skills set
  name = pg_temp.repair_catalog_text(name),
  short_description = pg_temp.repair_catalog_text(short_description),
  long_description = pg_temp.repair_catalog_text(long_description),
  promise = pg_temp.repair_catalog_text(promise),
  system_prompt = pg_temp.repair_catalog_text(system_prompt),
  required_inputs = pg_temp.repair_catalog_text(required_inputs::text)::jsonb,
  output_types = pg_temp.repair_catalog_text(output_types::text)::jsonb,
  workflow = pg_temp.repair_catalog_text(workflow::text)::jsonb,
  use_cases = pg_temp.repair_catalog_text(use_cases::text)::jsonb,
  updated_at = now();

update public.skill_versions set release_notes = pg_temp.repair_catalog_text(release_notes);
update public.product_versions set release_notes = pg_temp.repair_catalog_text(release_notes);
