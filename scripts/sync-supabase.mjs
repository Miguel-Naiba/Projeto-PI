import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR_DADOS = path.join(__dirname, '../public/data');

const URL_SUPABASE = process.env.SUPABASE_URL;
const CHAVE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_SUPABASE || !CHAVE_SERVICE_ROLE) {
  console.error(
    'Faltam SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente.\n' +
      'Pega esses valores em Project Settings > API no painel do Supabase (a service_role\n' +
      'fica em "Project API keys" — NUNCA coloque essa chave num arquivo VITE_*, ela\n' +
      'ignora o RLS e não pode vazar pro navegador). Exporte antes de rodar:\n\n' +
      '  export SUPABASE_URL="https://xxxxx.supabase.co"\n' +
      '  export SUPABASE_SERVICE_ROLE_KEY="eyJ..."\n' +
      '  npm run supabase:sync\n'
  );
  process.exit(1);
}

const supabase = createClient(URL_SUPABASE, CHAVE_SERVICE_ROLE);
const TAMANHO_LOTE = 50;

async function upsertEmLotes(tabela, linhas, colunaChave) {
  if (linhas.length === 0) {
    console.log(`⚠️  Nada pra sincronizar em "${tabela}" (arquivo vazio ou não gerado ainda).`);
    return;
  }
  let sincronizados = 0;
  for (let i = 0; i < linhas.length; i += TAMANHO_LOTE) {
    const lote = linhas.slice(i, i + TAMANHO_LOTE);
    const { error } = await supabase.from(tabela).upsert(lote, { onConflict: colunaChave });
    if (error) {
      console.error(`❌ Erro no lote ${i}-${i + lote.length} de "${tabela}":`, error.message);
    } else {
      sincronizados += lote.length;
    }
  }
  console.log(`✅ ${sincronizados}/${linhas.length} linhas sincronizadas em "${tabela}".`);
}

function lerJsonSeExistir(nomeArquivo) {
  const caminho = path.join(DIR_DADOS, nomeArquivo);
  if (!existsSync(caminho)) return null;
  return JSON.parse(readFileSync(caminho, 'utf-8'));
}

async function main() {
  console.log('Sincronizando dados geocodificados com o Supabase...\n');

  const piso = lerJsonSeExistir('paradas-tatil-eptc.json');
  if (piso) {
    const linhas = piso.paradas.map((p) => ({
      stop_id: p.stop_id,
      stop_name: p.stop_name,
      lat: p.lat,
      lon: p.lon,
      bairro: p.bairro ?? null,
      endereco_origem: p.endereco_origem ?? null,
      piso: p.piso ?? null,
      fonte: p.fonte ?? 'eptc',
      match_distancia_m: p.match_distancia_m ?? null,
    }));
    await upsertEmLotes('paradas_piso_tatil', linhas, 'stop_id');
  } else {
    console.log('⚠️  paradas-tatil-eptc.json não encontrado — pulei piso tátil.');
  }

  const botoeiras = lerJsonSeExistir('botoeiras-eptc.json');
  if (botoeiras) {
    const linhas = botoeiras.botoeiras.map((b) => ({
      id: b.id,
      local: b.local,
      lat: b.lat,
      lon: b.lon,
      data_implantacao: b.dataImplantacao ?? null,
      n_botoeiras: b.nBotoeiras ?? 0,
      n_travessias: b.nTravessias ?? 0,
      fonte: b.fonte ?? 'eptc',
      precisao: b.precisao ?? null,
    }));
    await upsertEmLotes('botoeiras_sonoras', linhas, 'id');
  } else {
    console.log('⚠️  botoeiras-eptc.json não encontrado — rode `npm run botoeiras:geocode` primeiro.');
  }

  const obras = lerJsonSeExistir('obras-smoi.json');
  if (obras) {
    const linhas = obras.obras.map((o) => ({
      id: o.id,
      nome: o.nome,
      endereco: o.endereco ?? null,
      bairro: o.bairro ?? null,
      lat: o.lat,
      lon: o.lon,
      precisao: o.precisao ?? null,
      fonte: o.fonte ?? 'smoi',
    }));
    await upsertEmLotes('obras_smoi', linhas, 'id');
  } else {
    console.log('⚠️  obras-smoi.json não encontrado — rode `npm run obras:geocode` primeiro.');
  }

  console.log('\nConcluído.');
}

main();
