import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CAMINHO_BRUTO = path.join(__dirname, '../public/data/botoeiras-eptc-bruto.json');
const CAMINHO_SAIDA = path.join(__dirname, '../public/data/botoeiras-eptc.json');
const CAMINHO_PENDENTES = path.join(__dirname, '../public/data/botoeiras-eptc-pendentes.json');

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search';
// Sem "bounded" — vira preferência (bias), não filtro rígido. Com bounded=1
// muita consulta válida vinha vazia porque o ponto real caía a poucos metros
// da caixa ou o Nominatim não achava match dentro do limite estrito.
const VIEWBOX_POA = '-51.30,-30.27,-51.03,-29.93';
const ATRASO_ENTRE_CHAMADAS_MS = 1100; // política do Nominatim: no máx. ~1 req/s

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

function separarLocal(local) {
  const partes = local.split(/\sx\s/i);
  if (partes.length === 2) return { via1: partes[0].trim(), via2: partes[1].trim() };
  return { via1: local.trim(), via2: '' };
}

function limparReferencia(texto) {
  return texto
    .replace(/\bdef\.?\s*n[ºo°]?\s*\d+/gi, '')
    .replace(/\bn[ºo°]\s*\d+/gi, '')
    .replace(/\bprox\.?\s*/gi, '')
    .replace(/\bpróx\.?\s*a?\s*/gi, '')
    .replace(/\best\.?\s*\d+/gi, '')
    .replace(/\bpedestre\b/gi, '')
    .replace(/\bBC\b|\bCB\b/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/^[\s\-–,.]+|[\s\-–,.]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function consultarNominatim(query) {
  const params = new URLSearchParams({
    q: `${query}, Porto Alegre, RS, Brasil`,
    format: 'jsonv2',
    limit: '1',
    viewbox: VIEWBOX_POA,
  });
  const res = await fetch(`${NOMINATIM_BASE}?${params.toString()}`, {
    headers: { 'User-Agent': 'EchoPath-geocoder/1.0 (projeto academico de acessibilidade, Porto Alegre)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const dados = await res.json();
  return dados[0] ?? null;
}

/**
 * Tenta geocodificar em ordem de precisão decrescente, parando na primeira
 * que der resultado. Devolve também qual estratégia funcionou, pra deixar
 * claro no dado final que "via1 sozinha" é bem mais impreciso que
 * "via1 esquina via2".
 */
async function geocodificarComFallback(via1Limpa, via2Limpa) {
  const tentativas = [];
  if (via2Limpa) {
    tentativas.push({ query: `${via1Limpa} e ${via2Limpa}`, precisao: 'cruzamento' });
    tentativas.push({ query: `${via1Limpa} esquina ${via2Limpa}`, precisao: 'cruzamento' });
    tentativas.push({ query: via2Limpa, precisao: 'referencia-isolada' });
  }
  tentativas.push({ query: via1Limpa, precisao: 'via-principal-apenas' });

  for (const t of tentativas) {
    if (!t.query) continue;
    const resultado = await consultarNominatim(t.query);
    if (resultado) return { resultado, precisao: t.precisao, query_usada: t.query };
    await dormir(ATRASO_ENTRE_CHAMADAS_MS);
  }
  return null;
}

async function main() {
  const linhas = JSON.parse(readFileSync(CAMINHO_BRUTO, 'utf-8'));
  const resolvidos = [];
  const pendentes = [];

  console.log(`Geocodificando ${linhas.length} locais de botoeiras sonoras (Nominatim, ~1 req/s, com fallback em cascata)...`);

  for (const linha of linhas) {
    const { via1, via2 } = separarLocal(linha.local);
    const via1Limpa = limparReferencia(via1);
    const via2Limpa = limparReferencia(via2);

    try {
      const achado = await geocodificarComFallback(via1Limpa, via2Limpa);
      if (achado) {
        resolvidos.push({
          id: `eptc-botoeira-${linha.ordem}`,
          local: linha.local,
          lat: parseFloat(achado.resultado.lat),
          lon: parseFloat(achado.resultado.lon),
          precisao: achado.precisao,
          dataImplantacao: linha.data_implantacao,
          nBotoeiras: linha.n_botoeiras,
          nTravessias: linha.n_travessias,
          fonte: 'eptc-planilha-botoeiras-2026',
        });
        console.log(`✅ [${linha.ordem}/78] (${achado.precisao}) ${linha.local}`);
      } else {
        pendentes.push({ ...linha, motivo: 'nenhuma estratégia de busca retornou resultado' });
        console.log(`⚠️  [${linha.ordem}/78] sem resultado em nenhuma tentativa: ${linha.local}`);
      }
    } catch (err) {
      pendentes.push({ ...linha, motivo: String(err) });
      console.log(`❌ [${linha.ordem}/78] erro: ${linha.local} — ${err}`);
    }

    await dormir(ATRASO_ENTRE_CHAMADAS_MS);
  }

  writeFileSync(
    CAMINHO_SAIDA,
    JSON.stringify(
      {
        gerado_em: new Date().toISOString().slice(0, 10),
        fonte_original: 'Planilha EPTC "Botoeiras Sonoras Atual" — GMSV, Coordenação Semafórica e Iluminação do Mobiliário',
        metodologia: 'Geocodificação via Nominatim/OSM em cascata: 1) cruzamento completo ("via1 e via2"), 2) variação "esquina", 3) só a referência/marco isolado, 4) só a via principal. Cada ponto tem um campo `precisao` indicando qual estratégia funcionou — "cruzamento" é confiável, "via-principal-apenas" é só uma aproximação ao longo da rua. Nenhum é a coordenada oficial de instalação da EPTC.',
        total_locais_planilha: linhas.length,
        total_geocodificados: resolvidos.length,
        botoeiras: resolvidos,
      },
      null,
      2
    ),
    'utf-8'
  );
  writeFileSync(CAMINHO_PENDENTES, JSON.stringify(pendentes, null, 2), 'utf-8');

  console.log(`\nConcluído: ${resolvidos.length}/${linhas.length} geocodificados.`);
  if (pendentes.length > 0) {
    console.log(`${pendentes.length} ficaram pendentes — revise manualmente em public/data/botoeiras-eptc-pendentes.json`);
  }
}

main();
