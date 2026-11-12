-- =====================================================================
-- CATÁLOGO DE MÁRMORES — estrutura do banco (Supabase)
-- Cole este arquivo inteiro no "SQL Editor" do Supabase e clique em RUN.
-- Pode rodar de novo sem problema (não apaga produtos já cadastrados).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Quem pode editar (lista de e-mails autorizados)
-- ---------------------------------------------------------------------
create table if not exists public.administradores (
  email text primary key
);

-- >>> TROQUE pelo e-mail que sua esposa vai usar para entrar no painel.
-- Para mais de uma pessoa, repita a linha com outro e-mail.
insert into public.administradores (email) values
  ('email-da-sua-esposa@exemplo.com')
on conflict do nothing;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.administradores
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- ---------------------------------------------------------------------
-- 2) Configurações gerais do site (uma linha só)
-- ---------------------------------------------------------------------
create table if not exists public.configuracoes (
  id            int primary key default 1 check (id = 1),
  mostrar_preco boolean not null default true,   -- FLAG GLOBAL DE PREÇO
  nome_empresa  text not null default 'Catálogo de Mármores',
  whatsapp      text,                             -- ex.: 5519999999999
  atualizado_em timestamptz not null default now()
);
insert into public.configuracoes (id) values (1) on conflict do nothing;

-- ---------------------------------------------------------------------
-- 3) Produtos (cada cadastro = um material + lote)
-- ---------------------------------------------------------------------
create table if not exists public.produtos (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null check (length(trim(nome)) > 0),
  codigo         text not null check (length(trim(codigo)) > 0),
  tipo           text,             -- Mármore, Granito, Quartzito...
  cor            text,
  origem         text,             -- Nacional / Importado (país)
  acabamento     text,             -- Polido, Levigado, Escovado...
  espessura_cm   numeric(5,2)  check (espessura_cm  is null or espessura_cm  > 0),
  comprimento_cm numeric(7,2)  check (comprimento_cm is null or comprimento_cm > 0),
  altura_cm      numeric(7,2)  check (altura_cm     is null or altura_cm     > 0),
  lote           text,
  qtd_chapas     int           check (qtd_chapas    is null or qtd_chapas    >= 0),
  preco_m2       numeric(12,2) check (preco_m2      is null or preco_m2      >= 0),
  mostrar_preco  boolean not null default true,  -- flag de preço por produto
  status         text not null default 'disponivel'
                 check (status in ('disponivel','reservado','sob_consulta','esgotado')),
  aplicacoes     text[] not null default '{}',   -- Bancada, Piso, Parede...
  observacoes    text,
  fotos          jsonb  not null default '[]'::jsonb, -- caminhos no storage; 1ª = principal
  publicado      boolean not null default true,  -- desmarcado = some do site
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

-- Mesmo código não pode repetir no mesmo lote
create unique index if not exists produtos_codigo_lote_uk
  on public.produtos (lower(codigo), lower(coalesce(lote, '')));

create or replace function public.tocar_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

drop trigger if exists produtos_atualizado on public.produtos;
create trigger produtos_atualizado before update on public.produtos
  for each row execute function public.tocar_atualizado_em();

drop trigger if exists config_atualizado on public.configuracoes;
create trigger config_atualizado before update on public.configuracoes
  for each row execute function public.tocar_atualizado_em();

-- ---------------------------------------------------------------------
-- 4) O que o público enxerga: uma "vitrine" que já esconde o preço
--    quando a flag estiver desligada (o valor nem sai do servidor)
-- ---------------------------------------------------------------------
create or replace view public.catalogo_publico as
select
  p.id, p.nome, p.codigo, p.tipo, p.cor, p.origem, p.acabamento,
  p.espessura_cm, p.comprimento_cm, p.altura_cm, p.lote, p.qtd_chapas,
  case when c.mostrar_preco and p.mostrar_preco then p.preco_m2 end as preco_m2,
  p.status, p.aplicacoes, p.observacoes, p.fotos, p.atualizado_em
from public.produtos p
cross join public.configuracoes c
where p.publicado and c.id = 1;

-- ---------------------------------------------------------------------
-- 5) Permissões
-- ---------------------------------------------------------------------
alter table public.produtos        enable row level security;
alter table public.configuracoes   enable row level security;
alter table public.administradores enable row level security;

-- Público (anon) NÃO lê a tabela de produtos direto — só a vitrine
revoke all on public.produtos        from anon;
revoke all on public.administradores from anon, authenticated;
grant  select on public.catalogo_publico to anon, authenticated;
grant  select on public.configuracoes    to anon, authenticated;
grant  select, insert, update, delete on public.produtos to authenticated;
grant  update on public.configuracoes to authenticated;

drop policy if exists "admin gerencia produtos" on public.produtos;
create policy "admin gerencia produtos" on public.produtos
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "todos leem configuracoes" on public.configuracoes;
create policy "todos leem configuracoes" on public.configuracoes
  for select to anon, authenticated using (true);

drop policy if exists "admin altera configuracoes" on public.configuracoes;
create policy "admin altera configuracoes" on public.configuracoes
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 6) Fotos (Storage): leitura pública, gravação só para admin
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', true)
on conflict (id) do update set public = true;

-- (apagar/substituir foto exige que o admin também "enxergue" o arquivo)
drop policy if exists "admin lista fotos" on storage.objects;
create policy "admin lista fotos" on storage.objects
  for select to authenticated
  using (bucket_id = 'fotos' and public.is_admin());

drop policy if exists "admin envia fotos" on storage.objects;
create policy "admin envia fotos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'fotos' and public.is_admin());

drop policy if exists "admin altera fotos" on storage.objects;
create policy "admin altera fotos" on storage.objects
  for update to authenticated
  using (bucket_id = 'fotos' and public.is_admin());

drop policy if exists "admin apaga fotos" on storage.objects;
create policy "admin apaga fotos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'fotos' and public.is_admin());
