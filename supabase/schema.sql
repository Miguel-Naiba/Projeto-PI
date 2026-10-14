
create table if not exists public.paradas_piso_tatil (
  stop_id text primary key,
  stop_name text not null,
  lat double precision not null,
  lon double precision not null,
  bairro text,
  endereco_origem text,
  piso text,
  fonte text not null default 'eptc',
  match_distancia_m double precision,
  atualizado_em timestamptz not null default now()
);
create index if not exists idx_piso_tatil_lat_lon on public.paradas_piso_tatil (lat, lon);

create table if not exists public.botoeiras_sonoras (
  id text primary key,
  local text not null,
  lat double precision not null,
  lon double precision not null,
  data_implantacao date,
  n_botoeiras integer default 0,
  n_travessias integer default 0,
  fonte text not null default 'eptc',
  precisao text,
  atualizado_em timestamptz not null default now()
);
create index if not exists idx_botoeiras_lat_lon on public.botoeiras_sonoras (lat, lon);

create table if not exists public.obras_smoi (
  id text primary key,
  nome text not null,
  endereco text,
  bairro text,
  lat double precision not null,
  lon double precision not null,
  precisao text,
  fonte text not null default 'smoi',
  atualizado_em timestamptz not null default now()
);
create index if not exists idx_obras_lat_lon on public.obras_smoi (lat, lon);


alter table public.paradas_piso_tatil enable row level security;
alter table public.botoeiras_sonoras enable row level security;
alter table public.obras_smoi enable row level security;

-- drop + create (não "create policy if not exists" — Postgres não tem essa
-- variante) pra esse arquivo poder ser rodado de novo com segurança num
-- projeto onde as tabelas/policies já existem, sem erro 42710 "already
-- exists" interrompendo o resto do script no meio.
drop policy if exists "leitura publica" on public.paradas_piso_tatil;
create policy "leitura publica" on public.paradas_piso_tatil for select using (true);
drop policy if exists "leitura publica" on public.botoeiras_sonoras;
create policy "leitura publica" on public.botoeiras_sonoras for select using (true);
drop policy if exists "leitura publica" on public.obras_smoi;
create policy "leitura publica" on public.obras_smoi for select using (true);

-- Reportes da comunidade: obra em andamento, botoeira quebrada/mal
-- funcionando, ou rua obstruída. Diferente das tabelas acima (dados
-- oficiais sincronizados por script), esta é alimentada pelas próprias
-- pessoas usando o app, então precisa de auth de verdade — cada linha
-- pertence a quem criou.
create table if not exists public.reportes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('obra', 'botoeira', 'parada_tatil', 'botoeira_quebrada', 'rua_obstruida')),
  lat double precision not null,
  lon double precision not null,
  descricao text not null default '',
  usuario_id uuid not null references auth.users (id) on delete cascade,
  usuario_nome text not null default 'Alguém',
  criado_em timestamptz not null default now()
);
create index if not exists idx_reportes_lat_lon on public.reportes (lat, lon);
create index if not exists idx_reportes_criado_em on public.reportes (criado_em desc);

alter table public.reportes enable row level security;

-- Leitura pública — é assim que um reporte "alerta outros usuários": todo
-- mundo vê, inclusive quem não tem conta.
drop policy if exists "leitura publica" on public.reportes;
create policy "leitura publica" on public.reportes for select using (true);

-- Só quem tem conta cria, e só em nome de si mesmo (não dá pra criar um
-- reporte assinado por outra pessoa).
drop policy if exists "criar autenticado" on public.reportes;
create policy "criar autenticado" on public.reportes for insert
  with check (auth.uid() = usuario_id);

-- Só quem criou apaga o próprio reporte (ex.: reportou por engano).
drop policy if exists "apagar proprio reporte" on public.reportes;
create policy "apagar proprio reporte" on public.reportes for delete
  using (auth.uid() = usuario_id);

-- Campos adicionados depois da primeira versão da tabela — ALTER, não
-- CREATE, porque a tabela pode já existir num projeto Supabase real (rule
-- 162: nunca destrutivo, sempre aditivo quando a tabela já está em uso).
alter table public.reportes add column if not exists problema text;
alter table public.reportes add column if not exists ponto_id text;
alter table public.reportes add column if not exists ponto_nome text;
alter table public.reportes add column if not exists ponto_fonte text;
alter table public.reportes add column if not exists rota_ativa boolean;
alter table public.reportes add column if not exists distancia_da_rota_m double precision;
alter table public.reportes add column if not exists status text not null default 'pendente'
  check (status in ('pendente', 'validado', 'rejeitado'));

-- Fase 3 (checklist mestre, item 16 — "falta crítica"): o frontend passou a
-- enviar as 3 categorias oficiais de Reportar (parada_tatil / botoeira /
-- obra) em vez das antigas (obra / botoeira_quebrada / rua_obstruida). Num
-- projeto Supabase onde a tabela `reportes` já existe com a CHECK antiga,
-- o CREATE TABLE IF NOT EXISTS acima não re-executa — é este ALTER que
-- corrige a constraint, de forma aditiva: superconjunto dos valores
-- antigos e novos, nada apagado, nada inventado. 'botoeira_quebrada' e
-- 'rua_obstruida' continuam válidos pras linhas antigas (histórico
-- preservado); a partir desta fase a aplicação só envia os 3 valores
-- novos, então nenhum registro novo vai usar os antigos.
alter table public.reportes drop constraint if exists reportes_tipo_check;
alter table public.reportes add constraint reportes_tipo_check
  check (tipo in ('obra', 'botoeira', 'parada_tatil', 'botoeira_quebrada', 'rua_obstruida'));

-- Opcional — NÃO executado automaticamente aqui, só documentado: depois de
-- revisar manualmente, 'botoeira_quebrada' pode ser normalizado para
-- 'botoeira' (mesmo fenômeno, nome diferente). 'rua_obstruida' não tem
-- equivalente entre as 3 categorias atuais — decidir o que fazer com esses
-- reportes antigos (manter como estão, ou criar uma 4ª categoria de novo)
-- é uma decisão de produto, não algo para inventar sozinho:
-- update public.reportes set tipo = 'botoeira' where tipo = 'botoeira_quebrada';
