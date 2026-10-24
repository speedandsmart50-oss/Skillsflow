create table if not exists public.skill_categories (
  id uuid primary key default gen_random_uuid(), slug text not null unique, name text not null,
  description text not null default '', icon text not null default '✦', sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(), slug text not null unique, name text not null,
  category_id uuid not null references public.skill_categories(id), short_description text not null,
  long_description text not null, promise text not null, use_cases jsonb not null default '[]',
  required_inputs jsonb not null default '[]', output_types jsonb not null default '[]', workflow jsonb not null default '[]',
  mcp_tools jsonb not null default '[]', system_prompt text not null default '', price_cents integer not null default 0 check(price_cents>=0),
  is_included_in_membership boolean not null default false, is_active boolean not null default true,
  product_id uuid references public.products(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists skills_category_active_idx on public.skills(category_id,is_active,name);
create index if not exists skills_product_id_idx on public.skills(product_id) where product_id is not null;

create table if not exists public.member_skills (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade, purchase_id uuid references public.orders(id) on delete set null,
  source text not null check(source in ('one_time_purchase','subscription','admin_grant')),
  status text not null default 'active' check(status in ('active','expired','cancelled')),
  access_granted_at timestamptz not null default now(), expires_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,skill_id,source)
);
create index if not exists member_skills_user_status_idx on public.member_skills(user_id,status,skill_id);

create or replace function public.can_access_skill(p_user_id uuid,p_skill_id uuid)
returns boolean language sql stable security definer set search_path=public
as $$ select (auth.uid()=p_user_id or auth.role()='service_role') and exists(
  select 1 from public.skills s where s.id=p_skill_id and s.is_active and (
    (s.is_included_in_membership and exists(select 1 from public.member_skills ms where ms.user_id=p_user_id and ms.skill_id=s.id and ms.source='subscription' and ms.status='active' and (ms.expires_at is null or ms.expires_at>now())))
    or exists(select 1 from public.member_skills ms where ms.user_id=p_user_id and ms.skill_id=s.id and ms.status='active' and (ms.expires_at is null or ms.expires_at>now()))
    or exists(select 1 from public.entitlements e where e.user_id=p_user_id and e.product_id=s.product_id and e.status='active')
  )); $$;
revoke all on function public.can_access_skill(uuid,uuid) from public,anon;
grant execute on function public.can_access_skill(uuid,uuid) to authenticated,service_role;

create table if not exists public.skill_configurations (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade, configuration_data jsonb not null default '{}',
  status text not null default 'draft' check(status in ('draft','in_progress','ready','archived')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,skill_id)
);
create table if not exists public.uploaded_files (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade, file_name text not null, file_type text not null,
  storage_path text not null unique, extraction_status text not null default 'pending' check(extraction_status in ('pending','processing','completed','failed','manual_review')),
  created_at timestamptz not null default now()
);
create table if not exists public.extracted_messages (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade, uploaded_file_id uuid references public.uploaded_files(id) on delete set null,
  sender text not null default 'unknown', raw_content text not null default '', anonymized_content text not null default '',
  validated boolean not null default false, created_at timestamptz not null default now()
);
create table if not exists public.communication_profiles (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade, summary text not null default '', system_prompt text not null default '',
  knowledge_base jsonb not null default '{}', version integer not null default 1, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,skill_id)
);
create table if not exists public.communication_profile_versions (
  id uuid primary key default gen_random_uuid(), communication_profile_id uuid not null references public.communication_profiles(id) on delete cascade,
  version integer not null, snapshot jsonb not null, change_reason text not null default '', created_at timestamptz not null default now(), unique(communication_profile_id,version)
);
create table if not exists public.agent_sessions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade, title text not null default 'Nouvelle conversation',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.agent_messages (
  id uuid primary key default gen_random_uuid(), agent_session_id uuid not null references public.agent_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, role text not null check(role in ('user','assistant','system')),
  content text not null, created_at timestamptz not null default now()
);
create table if not exists public.generated_outputs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade, agent_session_id uuid references public.agent_sessions(id) on delete set null,
  output_type text not null, content text not null, status text not null default 'draft' check(status in ('draft','approved','rejected')),
  created_at timestamptz not null default now()
);
create table if not exists public.feedback_ratings (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade, agent_message_id uuid references public.agent_messages(id) on delete set null,
  rating text not null check(rating in ('perfect','correct','rejected')), corrected_content text, created_at timestamptz not null default now()
);
create table if not exists public.mcp_connections (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  connection_name text not null, provider text not null, status text not null default 'active', scopes jsonb not null default '[]',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.mcp_tool_usage (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  skill_id uuid references public.skills(id) on delete set null, tool_name text not null, input_summary jsonb not null default '{}',
  output_summary jsonb not null default '{}', status text not null default 'success', created_at timestamptz not null default now()
);

do $$ declare t text; begin
  foreach t in array array['skill_configurations','uploaded_files','extracted_messages','communication_profiles','agent_sessions','generated_outputs','feedback_ratings','mcp_tool_usage'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('drop policy if exists member_owns_rows on public.%I',t);
    execute format('create policy member_owns_rows on public.%I for all to authenticated using (auth.uid()=user_id and (skill_id is null or public.can_access_skill(auth.uid(),skill_id))) with check (auth.uid()=user_id and (skill_id is null or public.can_access_skill(auth.uid(),skill_id)))',t);
    execute format('revoke all on public.%I from anon,authenticated',t);
    execute format('grant select,insert,update,delete on public.%I to authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
  alter table public.agent_messages enable row level security;
  drop policy if exists member_owns_agent_messages on public.agent_messages;
  create policy member_owns_agent_messages on public.agent_messages for all to authenticated
    using(auth.uid()=user_id and exists(select 1 from public.agent_sessions s where s.id=agent_session_id and s.user_id=auth.uid() and public.can_access_skill(auth.uid(),s.skill_id)))
    with check(auth.uid()=user_id and exists(select 1 from public.agent_sessions s where s.id=agent_session_id and s.user_id=auth.uid() and public.can_access_skill(auth.uid(),s.skill_id)));
  revoke all on public.agent_messages from anon,authenticated;
  grant select,insert,update,delete on public.agent_messages to authenticated;
  grant all on public.agent_messages to service_role;
  alter table public.member_skills enable row level security;
  drop policy if exists member_reads_own_skill_grants on public.member_skills;
  create policy member_reads_own_skill_grants on public.member_skills for select to authenticated using(auth.uid()=user_id);
  revoke all on public.member_skills from anon,authenticated;
  grant select on public.member_skills to authenticated;
  grant all on public.member_skills to service_role;
  alter table public.mcp_connections enable row level security;
  drop policy if exists member_owns_rows on public.mcp_connections;
  create policy member_owns_rows on public.mcp_connections for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
  revoke all on public.mcp_connections from anon,authenticated;
  grant select,insert,update,delete on public.mcp_connections to authenticated;
  grant all on public.mcp_connections to service_role;
  alter table public.communication_profile_versions enable row level security;
  drop policy if exists member_owns_profile_versions on public.communication_profile_versions;
  create policy member_owns_profile_versions on public.communication_profile_versions for all to authenticated
    using(exists(select 1 from public.communication_profiles p where p.id=communication_profile_id and p.user_id=auth.uid() and public.can_access_skill(auth.uid(),p.skill_id)))
    with check(exists(select 1 from public.communication_profiles p where p.id=communication_profile_id and p.user_id=auth.uid() and public.can_access_skill(auth.uid(),p.skill_id)));
  revoke all on public.communication_profile_versions from anon,authenticated;
  grant select,insert,update,delete on public.communication_profile_versions to authenticated;
  grant all on public.communication_profile_versions to service_role;
end $$;

alter table public.skill_categories enable row level security;
alter table public.skills enable row level security;
drop policy if exists "Active skill categories are discoverable" on public.skill_categories;
drop policy if exists "Active skills are discoverable" on public.skills;
create policy "Active skill categories are discoverable" on public.skill_categories for select to anon,authenticated using(exists(select 1 from public.skills s where s.category_id=skill_categories.id and s.is_active));
create policy "Active skills are discoverable" on public.skills for select to anon,authenticated using(is_active);
revoke all on public.skill_categories,public.skills from anon,authenticated;
grant select on public.skill_categories to anon,authenticated;
grant select(id,slug,name,category_id,short_description,long_description,promise,use_cases,required_inputs,output_types,workflow,mcp_tools,price_cents,is_included_in_membership,is_active,product_id,created_at,updated_at) on public.skills to anon,authenticated;
grant all on public.skill_categories,public.skills to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('skill-files','skill-files',false,15728640,array['image/jpeg','image/png','image/webp','application/pdf','text/plain','application/json'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "Members manage files for accessible skills" on storage.objects;
create policy "Members manage files for accessible skills" on storage.objects for all to authenticated
using(bucket_id='skill-files' and (storage.foldername(name))[1]=auth.uid()::text and public.can_access_skill(auth.uid(),((storage.foldername(name))[2])::uuid))
with check(bucket_id='skill-files' and (storage.foldername(name))[1]=auth.uid()::text and public.can_access_skill(auth.uid(),((storage.foldername(name))[2])::uuid));
insert into public.skill_categories(slug,name,description,icon,sort_order) values
('prospection-vente','Prospection et vente','Conversation commerciale, qualification et conversion.','◉',1),
('marketing-reseau','Marketing de réseau','Accompagnement et duplication responsable des équipes.','◎',2),
('contenu-branding','Contenu et personal branding','Contenu éditorial aligné avec votre voix.','✦',3),
('offre-positionnement','Offre et positionnement','Conception et validation de propositions de valeur.','◇',4),
('email-sequences','E-mail et séquences','Campagnes, newsletters et relances.','✉',5),
('support-client','Support client','Réponses, analyse et amélioration du service.','♡',6),
('recrutement','Recrutement','Présélection et communication employeur.','⌕',7),
('immobilier','Immobilier','Qualification, suivi et préparation de visites.','⌂',8),
('ecommerce','E-commerce','Conseil produit et optimisation de fiches.','▣',9),
('formation-education','Formation et éducation','Explications et exercices pédagogiques.','▤',10),
('productivite-organisation','Productivité et organisation','Planification et gestion des tâches.','◷',11),
('finance-analyse','Finance et analyse','Analyse et aide à la décision financière.','◫',12),
('juridique-administratif','Juridique et administratif','Aide documentaire et organisation administrative.','▧',13),
('sante-bien-etre','Santé et bien-être','Accompagnement informatif et habitudes de bien-être.','✚',14),
('creation-design','Création et design','Idéation et direction créative.','✳',15)
on conflict(slug) do update set name=excluded.name,description=excluded.description,icon=excluded.icon,sort_order=excluded.sort_order;

with seed(slug,name,category,description,price_cents,inputs,outputs) as (values
('clone-de-prospection','Clone de Prospection','prospection-vente','Crée des messages de prospection fidèles à votre style, répond aux objections et prépare les relances.',2900,'["canal","offre","prix","cible","objectif","exemples_de_conversations"]','["message","réponse_objection","relance","qualification","prise_de_rendez_vous"]'),
('setter-ia-coachs','Setter IA pour coachs','prospection-vente','Qualifie les prospects, présente votre offre et prépare la prise de rendez-vous.',2900,'["offre","cible","critères_de_qualification","agenda"]','["questions_de_qualification","réponses","résumé_prospect"]'),
('closer-ia','Closer IA','prospection-vente','Structure les réponses aux objections et les étapes d’un appel de vente.',2900,'["offre","prix","objections","processus_de_vente"]','["réponses_aux_objections","plan_dappel","prochaine_étape"]'),
('agent-relance','Agent de relance','prospection-vente','Prépare des relances adaptées au silence, à l’hésitation ou aux questions de prix.',1900,'["offre","canal","ton","délais_de_relance"]','["séquence_de_relance","messages"]'),
('analyseur-conversations','Analyseur de conversations','prospection-vente','Analyse un échange et propose une prochaine réponse contextualisée.',1900,'["conversation","objectif"]','["analyse","réponse_suggérée","prochaine_action"]'),
('duplication-mlm','Agent de duplication MLM','marketing-reseau','Accompagne les nouveaux partenaires avec des explications et prochaines actions.',1900,'["méthode","offre","ressources","règles_de_conformité"]','["plan_daction","réponses_aux_questions"]'),
('qualification-prospects-mlm','Qualificateur de prospects MLM','marketing-reseau','Identifie les besoins et la disponibilité sans promettre de revenus.',1900,'["offre","questions","critères"]','["qualification","questions_suivantes"]'),
('coach-equipe-mlm','Coach d’équipe MLM','marketing-reseau','Prépare des plans hebdomadaires et scripts de suivi d’équipe.',1900,'["objectifs","équipe","rythme","indicateurs"]','["plan_hebdomadaire","scripts"]'),
('generateur-contenu-marque','Générateur de contenu de marque','contenu-branding','Rédige du contenu à partir de vos exemples et de votre positionnement.',1900,'["audience","positionnement","exemples","plateformes"]','["posts","scripts","newsletter"]'),
('calendrier-editorial-30-jours','Calendrier éditorial 30 jours','contenu-branding','Organise un mois de publications selon vos plateformes et objectifs.',1900,'["audience","plateformes","objectifs","fréquence"]','["calendrier","idées_de_posts"]'),
('transformateur-long-format','Transformateur de long format','contenu-branding','Décline un contenu long en formats courts adaptés à vos canaux.',1900,'["transcription_ou_article","plateformes","ton"]','["posts","carrousels","emails"]'),
('scripteur-reels','Scripteur de Reels','contenu-branding','Crée des hooks, scripts courts et appels à l’action.',1900,'["sujet","audience","objectif","durée"]','["hooks","scripts","cta"]'),
('ghostwriter-linkedin','Ghostwriter LinkedIn','contenu-branding','Rédige des posts LinkedIn dans votre ton et selon votre positionnement.',1900,'["positionnement","exemples","sujet","audience"]','["post_linkedin","variantes"]'),
('architecte-offre-premium','Architecte d’offre premium','offre-positionnement','Transforme une expertise en offre claire avec bénéfices et options.',2900,'["expertise","cible","résultat","contraintes"]','["promesse","structure_offre","bonus","positionnement"]'),
('analyseur-marche','Analyseur de marché','offre-positionnement','Structure une analyse de cible, alternatives, objections et différenciation.',2900,'["marché","cible","concurrents_connus","offre"]','["segments","objections","angles"]'),
('createur-page-vente','Créateur de page de vente','offre-positionnement','Prépare le plan et les textes d’une page de vente à partir de votre offre.',2900,'["offre","preuves","objections","cta"]','["structure_page","textes"]'),
('testeur-offre','Testeur d’offre','offre-positionnement','Met à l’épreuve la clarté et la demande de votre offre.',1900,'["offre","cible","hypothèses"]','["questions","risques","tests"]'),
('sequence-email-conversion','Séquence e-mail de conversion','email-sequences','Prépare une séquence de conversion de cinq à dix e-mails.',1900,'["offre","audience","objections","ton"]','["séquence_email"]'),
('newsletter-personnalisee','Newsletter personnalisée','email-sequences','Rédige une newsletter dans votre style éditorial.',1900,'["sujet","audience","exemples","cta"]','["newsletter","objets_email"]'),
('recuperateur-panier','Récupérateur de panier','email-sequences','Prépare des relances respectueuses pour les paniers non finalisés.',1900,'["produit","canal","ton","objections"]','["emails","messages"]'),
('assistant-support-24-7','Assistant support 24/7','support-client','Répond aux questions avec votre base de connaissances validée.',2900,'["base_de_connaissances","ton","règles_d_escalade"]','["réponse_support","escalade"]'),
('resumeur-tickets','Résumeur de tickets','support-client','Résume les échanges support et propose une réponse à valider.',1900,'["ticket","contexte_client","politique_support"]','["résumé","réponse_suggérée","priorité"]'),
('agent-satisfaction-client','Agent de satisfaction client','support-client','Analyse les retours et organise des pistes d’amélioration.',1900,'["avis","retours","période"]','["thèmes","synthèse","actions"]'),
('agent-preselection','Agent de présélection','recrutement','Organise les critères et propose des questions d’entretien liées au poste.',2900,'["poste","critères","candidature","règles RH"]','["résumé_de_compétences","questions"]'),
('redacteur-offres-emploi','Rédacteur d’offres d’emploi','recrutement','Rédige une annonce claire, inclusive et précise.',1900,'["poste","missions","conditions","compétences"]','["annonce","variantes"]'),
('qualification-prospects-immobiliers','Qualificateur de prospects immobiliers','immobilier','Structure budget, zone, délai et critères du projet immobilier.',1900,'["bien","budget","zone","délai","financement"]','["questions","fiche_prospect"]'),
('suivi-acheteurs','Agent de suivi acheteurs','immobilier','Prépare le suivi des acheteurs et l’organisation de visites.',1900,'["bien","prospect","disponibilités","critères"]','["relances","préparation_visite"]'),
('conseil-produit-ecommerce','Agent de conseil produit','ecommerce','Oriente un client vers les produits adaptés à ses besoins exprimés.',1900,'["catalogue_produits","besoins_client","règles"]','["recommandation","comparaison"]'),
('optimiseur-fiches-produit','Optimiseur de fiches produit','ecommerce','Améliore la clarté, les bénéfices et le référencement des fiches.',1900,'["fiche_actuelle","produit","audience","mots_clés"]','["titre","description","bénéfices","seo"]'),
('coach-pedagogique','Coach pédagogique par matière','formation-education','Explique progressivement et propose des exercices adaptés au niveau.',1900,'["matière","niveau","objectif","notions"]','["explication","exercices","correction"]')
),cats as(select id,slug from public.skill_categories)
insert into public.skills(slug,name,category_id,short_description,long_description,promise,use_cases,required_inputs,output_types,workflow,mcp_tools,system_prompt,price_cents,is_active)
select seed.slug,seed.name,cats.id,seed.description,seed.description,seed.description,jsonb_build_array(seed.description),seed.inputs::jsonb,seed.outputs::jsonb,
'["Présentation","Informations métier","Import des exemples","Validation","Profil personnalisé","Test agent","Validation finale"]'::jsonb,
'["get_skill_details","start_skill_configuration","chat_with_skill_agent","generate_skill_output"]'::jsonb,
'Aide le membre avec un ton clair et utile. Utilise uniquement les informations fournies et validées. N’effectue aucune action externe et demande validation avant tout envoi.',seed.price_cents,true
from seed join cats on cats.slug=seed.category on conflict(slug) do update set name=excluded.name,category_id=excluded.category_id,
short_description=excluded.short_description,long_description=excluded.long_description,promise=excluded.promise,use_cases=excluded.use_cases,
required_inputs=excluded.required_inputs,output_types=excluded.output_types,workflow=excluded.workflow,mcp_tools=excluded.mcp_tools,
system_prompt=excluded.system_prompt,price_cents=excluded.price_cents,updated_at=now();
update public.skills s set product_id=p.id from public.products p where p.slug='prospection-ethique' and s.slug='clone-de-prospection' and s.product_id is null;
