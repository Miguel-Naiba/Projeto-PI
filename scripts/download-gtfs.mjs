import { createWriteStream, mkdirSync, existsSync, writeFileSync } from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR_SAIDA = path.join(__dirname, '../public/gtfs');
const CAMINHO_ZIP = path.join(__dirname, '../public/gtfs/arquivo-gtfs.zip');

const URL_GTFS =
  'https://dadosabertos.poa.br/dataset/1fe9c2c1-9fbe-48ea-841b-61e30597ecd6/resource/b3bce61f-78ee-49eb-be57-6236d82bd5e0/download/arquivo-gtfs.zip';

if (!existsSync(DIR_SAIDA)) mkdirSync(DIR_SAIDA, { recursive: true });

console.log('⬇️  Baixando GTFS de Porto Alegre...');

await new Promise((resolve, reject) => {
  const arquivo = createWriteStream(CAMINHO_ZIP);
  https.get(URL_GTFS, (res) => {
    if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
    res.pipe(arquivo);
    arquivo.on('finish', () => { arquivo.close(); resolve(); });
  }).on('error', reject);
});

console.log('📦 Extraindo stops.txt...');
const zip = new AdmZip(CAMINHO_ZIP);
const entradaStops = zip.getEntry('stops.txt');
if (!entradaStops) throw new Error('stops.txt não encontrado no ZIP!');

writeFileSync(path.join(DIR_SAIDA, 'stops.txt'), entradaStops.getData());
console.log('✅ public/gtfs/stops.txt salvo com sucesso!');
console.log('   Agora reinicie o servidor: npm run dev');
