-- =====================================================================
-- THE PET HOUSE - Catálogo curado da loja online
-- Rode este arquivo inteiro no Supabase > SQL Editor > New query > Run.
-- É idempotente: pode rodar mais de uma vez sem quebrar nada.
--
-- O que muda: até aqui a loja mostrava TODO produto do PDV, porque
-- `visivel_loja` nasceu com default true. A partir de agora a vitrine é
-- escolhida a dedo na tela "Loja online" do painel — o cadastro do PDV
-- continua sendo a única fonte de preço, estoque e nome.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Produto novo nasce fora da vitrine
-- ---------------------------------------------------------------------
alter table public.products alter column visivel_loja set default false;

comment on column public.products.visivel_loja
  is 'aparece no catálogo da loja online; curado na tela "Loja online" do painel';

-- ---------------------------------------------------------------------
-- 2. Tira todo mundo da vitrine, uma vez só
--
-- A trava é a tabela `migrations_aplicadas`: sem ela, rodar o arquivo de
-- novo apagaria a curadoria que já tivesse sido feita no painel.
-- ---------------------------------------------------------------------
create table if not exists public.migrations_aplicadas (
  nome       text primary key,
  aplicada_em timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from public.migrations_aplicadas where nome = '003_catalogo_curado'
  ) then

    update public.products set visivel_loja = false;

    -- -----------------------------------------------------------------
    -- 3. Devolve à vitrine as 20 rações que mais saíram em 90 dias
    --
    -- Assim a loja já abre apresentável e o lojista ajusta depois, em vez
    -- de encontrar um catálogo vazio.
    -- -----------------------------------------------------------------
    update public.products p
       set visivel_loja = true
     where p.id in (
       select si.product_id
         from public.sale_items si
         join public.sales s on s.id = si.sale_id
         join public.products pr on pr.id = si.product_id
        where s.created_at >= now() - interval '90 days'
          and si.product_id is not null
          and pr.ativo = 1
          and coalesce(pr.categoria, 'racao') = 'racao'
          and (
            coalesce(pr.preco_saco_fechado, 0) > 0
            or coalesce(pr.preco_por_kg, 0) > 0
          )
        group by si.product_id
        order by count(*) desc
        limit 20
     );

    insert into public.migrations_aplicadas (nome) values ('003_catalogo_curado');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 4. Conferência
-- ---------------------------------------------------------------------
select count(*) filter (where visivel_loja) as na_vitrine,
       count(*)                             as total_ativos
  from public.products
 where ativo = 1;
