
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

create policy "leitura publica" on public.paradas_piso_tatil for select using (true);
create policy "leitura publica" on public.botoeiras_sonoras for select using (true);
create policy "leitura publica" on public.obras_smoi for select using (true);

-- Reportes da comunidade: obra em andamento, botoeira quebrada/mal
-- funcionando, ou rua obstruída. Diferente das tabelas acima (dados
-- oficiais sincronizados por script), esta é alimentada pelas próprias
-- pessoas usando o app, então precisa de auth de verdade — cada linha
-- pertence a quem criou.
create table if not exists public.reportes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('obra', 'botoeira_quebrada', 'rua_obstruida')),
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
create policy "leitura publica" on public.reportes for select using (true);

-- Só quem tem conta cria, e só em nome de si mesmo (não dá pra criar um
-- reporte assinado por outra pessoa).
create policy "criar autenticado" on public.reportes for insert
  with check (auth.uid() = usuario_id);

-- Só quem criou apaga o próprio reporte (ex.: reportou por engano).
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
