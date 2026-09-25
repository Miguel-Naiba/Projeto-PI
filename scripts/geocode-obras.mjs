import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CAMINHO_BRUTO = path.join(__dirname, '../public/data/obras-smoi-bruto.json');
const CAMINHO_SAIDA = path.join(__dirname, '../public/data/obras-smoi.json');
const CAMINHO_PENDENTES = path.join(__dirname, '../public/data/obras-smoi-pendentes.json');

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search';
const VIEWBOX_POA = '-51.30,-30.27,-51.03,-29.93';
const ATRASO_ENTRE_CHAMADAS_MS = 1100;

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

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
 * Cascata de tentativas em ordem de precisão decrescente. Linhas sem
 * endereço NEM bairro (só descrição do tipo de obra, ex. "Demolições Orla
 * do Lami") não entram aqui — não dá pra geocodificar isso sem inventar
 * localização, então ficam de fora do resultado final por design.
 */
function limparTexto(texto) {
  return texto
    .replace(/\(.*?\)/g, '')
    .replace(/n[ºo°]\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}


function comPrefixoDeViaSeNecessario(texto) {
  const jaTemTipoDeVia = /\b(rua|av\.?|avenida|travessa|estrada|rodovia|alameda|praça|viela)\b/i.test(texto);
  const poucasPalavras = texto.trim().split(/\s+/).length <= 3;
  if (!jaTemTipoDeVia && poucasPalavras) return `Rua ${texto}`;
  return texto;
}

// Alguns registros só têm o nome da rua dentro de uma frase de descrição
// (ex.: "substituição do muro de contenção existente na Rua Planalto") — a
// informação existe, só não está isolada num campo próprio.
function extrairViaDeDescricao(texto) {
  const m = texto.match(/\b((?:Rua|Av\.?|Avenida|Travessa|Estrada|Alameda)\s+[A-ZÀ-Ú][a-zà-úA-ZÀ-Ú]*(?:\s+[A-ZÀ-Ú][a-zà-úA-ZÀ-Ú]*){0,3})/);
  return m ? m[1] : null;
}

async function geocodificarComFallback(linha) {
  const tentativas = [];
  const enderecoLimpo = linha.endereco ? limparTexto(linha.endereco) : null;
  const localLimpo = linha.local ? limparTexto(linha.local) : null;

  if (enderecoLimpo && linha.bairro) {
    tentativas.push({ query: `${enderecoLimpo}, ${linha.bairro}`, precisao: 'endereco-completo' });
  }
  if (localLimpo && linha.bairro) {
    tentativas.push({ query: `${localLimpo}, ${linha.bairro}`, precisao: 'nome-e-bairro' });
  }
  if (enderecoLimpo) {
    tentativas.push({ query: enderecoLimpo, precisao: 'so-endereco' });
  }
  // "local" muitas vezes é o endereço de verdade (ex.: "Bento Gonçalves, 9601")
  // quando "endereco" é só o nome do projeto/loteamento — tentamos mesmo sem bairro.
  if (localLimpo) {
    tentativas.push({ query: localLimpo, precisao: 'so-local' });
    tentativas.push({ query: comPrefixoDeViaSeNecessario(localLimpo), precisao: 'local-com-prefixo-via' });
  }
  const viaNaDescricao = enderecoLimpo ? extrairViaDeDescricao(enderecoLimpo) : null;
  if (viaNaDescricao) {
    tentativas.push({ query: viaNaDescricao, precisao: 'via-extraida-da-descricao' });
  }
  if (linha.bairro) {
    tentativas.push({ query: linha.bairro, precisao: 'so-bairro-aproximado' });
  }

  for (const t of tentativas) {
    const resultado = await consultarNominatim(t.query);
    if (resultado) return { resultado, precisao: t.precisao, query_usada: t.query };
    await dormir(ATRASO_ENTRE_CHAMADAS_MS);
  }
  return null;
}

async function main() {
  const dados = JSON.parse(readFileSync(CAMINHO_BRUTO, 'utf-8'));
  const linhas = dados.obras;
  const resolvidos = [];
  const pendentes = [];

  const geocodificaveis = linhas.filter((l) => l.endereco || l.bairro);
  const semLocalizacao = linhas.filter((l) => !l.endereco && !l.bairro);

  console.log(`${linhas.length} obras no total — ${geocodificaveis.length} com endereço/bairro pra tentar geocodificar, ${semLocalizacao.length} só com descrição (sem localização, ficam de fora por design).`);

  for (const linha of geocodificaveis) {
    try {
      const achado = await geocodificarComFallback(linha);
      if (achado) {
        resolvidos.push({
          id: `smoi-obra-${linha.ordem}`,
          nome: linha.local,
          endereco: linha.endereco,
          bairro: linha.bairro,
          lat: parseFloat(achado.resultado.lat),
          lon: parseFloat(achado.resultado.lon),
          precisao: achado.precisao,
          fonte: 'smoi-planilha-obras-2026',
        });
        console.log(`✅ [${linha.ordem}] (${achado.precisao}) ${linha.local}`);
      } else {
        pendentes.push({ ...linha, motivo: 'nenhuma estratégia de busca retornou resultado' });
        console.log(`⚠️  [${linha.ordem}] sem resultado: ${linha.local}`);
      }
    } catch (err) {
      pendentes.push({ ...linha, motivo: String(err) });
      console.log(`❌ [${linha.ordem}] erro: ${linha.local} — ${err}`);
    }
    await dormir(ATRASO_ENTRE_CHAMADAS_MS);
  }

  // Registra as sem-localização também nos pendentes, só pra não sumirem
  // silenciosamente — ficam visíveis pra alguém completar manualmente algum dia.
  for (const linha of semLocalizacao) {
    pendentes.push({ ...linha, motivo: 'planilha não tem endereço nem bairro pra essa linha' });
  }

  writeFileSync(
    CAMINHO_SAIDA,
    JSON.stringify(
      {
        gerado_em: new Date().toISOString().slice(0, 10),
        fonte_original: 'SMOI — Secretaria Municipal de Obras e Infraestrutura, planilha de obras 2026',
        metodologia: 'Geocodificação via Nominatim/OSM em cascata: endereço+bairro → só endereço → nome+bairro → só bairro (aproximado). Linhas sem endereço nem bairro na planilha original (só descrição textual da obra) não foram geocodificadas — ficam em obras-smoi-pendentes.json. Campo `precisao` indica a confiabilidade de cada ponto.',
        total_linhas_planilha: linhas.length,
        total_geocodificados: resolvidos.length,
        obras: resolvidos,
      },
      null,
      2
    ),
    'utf-8'
  );
  writeFileSync(CAMINHO_PENDENTES, JSON.stringify(pendentes, null, 2), 'utf-8');

  console.log(`\nConcluído: ${resolvidos.length}/${geocodificaveis.length} geocodificados (${semLocalizacao.length} sem localização na planilha original, fora do total acima).`);
  console.log(`${pendentes.length} entradas em obras-smoi-pendentes.json pra revisão manual.`);
}

main();
