-- =====================================================================
-- ATUALIZAÇÃO 2 — "O que aparece no site"
-- Rode UMA vez no SQL Editor do Supabase (New query → colar → Run).
-- Não apaga nada. Pode rodar de novo sem problema.
-- =====================================================================

alter table public.configuracoes add column if not exists exibir jsonb not null default '{}'::jsonb;

create or replace function public.exibe(cfg jsonb, campo text)
returns boolean language sql immutable as $$
  select coalesce((cfg ->> campo)::boolean, true);
$$;

drop view if exists public.catalogo_publico;
create view public.catalogo_publico as
select
  p.id, p.nome,
  case when public.exibe(c.exibir, 'codigo')     then p.codigo end         as codigo,
  case when public.exibe(c.exibir, 'tipo')       then p.tipo end           as tipo,
  case when public.exibe(c.exibir, 'cor')        then p.cor end            as cor,
  case when public.exibe(c.exibir, 'origem')     then p.origem end         as origem,
  case when public.exibe(c.exibir, 'acabamento') then p.acabamento end     as acabamento,
  case when public.exibe(c.exibir, 'espessura')  then p.espessura_cm end   as espessura_cm,
  case when public.exibe(c.exibir, 'medidas')    then p.comprimento_cm end as comprimento_cm,
  case when public.exibe(c.exibir, 'medidas')    then p.altura_cm end      as altura_cm,
  case when public.exibe(c.exibir, 'lote')       then p.lote end           as lote,
  case when public.exibe(c.exibir, 'estoque')    then p.qtd_chapas end     as qtd_chapas,
  case when c.mostrar_preco and p.mostrar_preco  then p.preco_m2 end       as preco_m2,
  p.status,
  case when public.exibe(c.exibir, 'aplicacoes') then p.aplicacoes else '{}'::text[] end as aplicacoes,
  case when public.exibe(c.exibir, 'observacoes') then p.observacoes end   as observacoes,
  case when public.exibe(c.exibir, 'videos') then p.fotos
       else coalesce((select jsonb_agg(x) from jsonb_array_elements(p.fotos) x where not (x ? 'v')), '[]'::jsonb) end as fotos,
  p.atualizado_em
from public.produtos p
cross join public.configuracoes c
where p.publicado and c.id = 1;

grant select on public.catalogo_publico to anon, authenticated;
