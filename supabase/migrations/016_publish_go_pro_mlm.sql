-- Publish the Go Pro MLM skill as a member skill and a purchasable catalog product.
-- The prompt is independently written; it does not reproduce the source book.
insert into public.skill_categories (slug, name, description, icon, sort_order)
values (
  'marketing-reseau',
  'Marketing reseau',
  'Accompagnement et developpement responsable des equipes.',
  'M',
  2
)
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    sort_order = excluded.sort_order;

insert into public.skills (
  slug, name, category_id, short_description, long_description, promise,
  use_cases, required_inputs, output_types, workflow, mcp_tools, system_prompt, price_cents, is_active
)
select
  'go-pro-mlm',
  'Go Pro MLM - coach de marketing reseau',
  category.id,
  'Un coach pratique pour prospecter, inviter, presenter, relancer et accompagner une equipe de vente directe avec methode et respect.',
  'Un assistant de terrain pour structurer les sept etapes du marketing reseau : trouver des contacts, inviter, presenter, assurer le suivi, aider a decider, accompagner les nouveaux et animer les evenements. Il adapte les exemples au canal et au contexte de la personne, sans promesse de revenus ni pression commerciale.',
  'Aider les professionnels du marketing reseau a organiser des actions regulieres, communiquer avec transparence et developper leur equipe de facon responsable.',
  '["ecrire une invitation WhatsApp ou e-mail", "preparer une presentation honnete", "organiser le suivi des prospects", "repondre aux objections sans pression", "preparer le demarrage d''un nouveau partenaire", "planifier une reunion ou un webinaire", "diagnostiquer une activite qui stagne"]'::jsonb,
  '["activite et produits de l''entreprise", "canal de communication", "etape qui bloque", "ton souhaite", "temps disponible", "regles officielles de l''entreprise"]'::jsonb,
  '["scripts personnalises", "plan d''action sur 7 jours", "tableau de suivi", "deroule de presentation", "check-list de demarrage", "annonce d''evenement"]'::jsonb,
  '["Clarifier l''etape et l''objectif", "Adapter les propositions au canal et au contexte", "Produire des actions simples et duplicables", "Verifier la transparence et le respect du consentement"]'::jsonb,
  '["get_skill_details", "start_skill_configuration", "chat_with_skill_agent", "generate_skill_output"]'::jsonb,
  'Tu es un coach pratique en marketing reseau et vente directe. Reponds dans la langue de la personne, avec des conseils concrets et des exemples prets a adapter. Pour une demande precise, aide directement ; si le besoin est vague, pose une seule question sur l''etape bloquante : prospection, invitation, presentation, suivi, decision, demarrage ou evenement. Adapte le canal, le pays et le temps disponible. Respecte toujours le consentement et le refus ; aucune pression, culpabilisation, collecte de contacts sans accord, spam, promesse ou garantie de revenus, allegation sante ou information inventee. Ne conseille jamais de s''endetter ou d''engager l''argent necessaire aux depenses essentielles. Pour les revenus, rappelle que les resultats varient et que beaucoup de participants gagnent peu ; invite a consulter les documents officiels de remuneration. N''invente pas de regles pour l''entreprise : demande ses documents officiels si necessaire. Ne reproduis pas de passages d''ouvrages proteges. Termine par une prochaine action realiste.',
  2900,
  true
from public.skill_categories as category
where category.slug = 'marketing-reseau'
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  short_description = excluded.short_description,
  long_description = excluded.long_description,
  promise = excluded.promise,
  use_cases = excluded.use_cases,
  required_inputs = excluded.required_inputs,
  output_types = excluded.output_types,
  workflow = excluded.workflow,
  mcp_tools = excluded.mcp_tools,
  system_prompt = excluded.system_prompt,
  price_cents = excluded.price_cents,
  is_active = true,
  updated_at = now();

insert into public.products (
  slug, name, description, status, price, version, zip_path,
  domain, catalog_status, price_eur, price_xof
)
select
  skill.slug,
  skill.name,
  skill.long_description,
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
where skill.slug = 'go-pro-mlm'
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  status = 'published',
  price = excluded.price,
  version = coalesce(nullif(public.products.version, ''), excluded.version),
  domain = excluded.domain,
  catalog_status = 'disponible',
  price_eur = excluded.price_eur,
  price_xof = excluded.price_xof,
  archived_at = null,
  updated_at = now();

update public.skills as skill
set product_id = product.id,
    updated_at = now()
from public.products as product
where skill.slug = 'go-pro-mlm'
  and product.slug = 'go-pro-mlm'
  and skill.product_id is distinct from product.id;
