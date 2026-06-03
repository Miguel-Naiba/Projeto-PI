/**
 * Script para baixar e extrair stops.txt do GTFS de Porto Alegre
 * Salva em public/gtfs/stops.txt para ser servido localmente pelo Vite.
 *
 * Rode UMA VEZ:  node scripts/download-gtfs.mjs
 * Precisa instalar: npm install -D adm-zip
 */

import { createWriteStream, mkdirSync, existsSync, writeFileSync } from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '../public/gtfs');
const ZIP_PATH   = path.join(__dirname, '../public/gtfs/arquivo-gtfs.zip');

const GTFS_URL =
  'https://dadosabertos.poa.br/dataset/1fe9c2c1-9fbe-48ea-841b-61e30597ecd6/resource/b3bce61f-78ee-49eb-be57-6236d82bd5e0/download/arquivo-gtfs.zip';

if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

console.log('⬇️  Baixando GTFS de Porto Alegre...');

await new Promise((resolve, reject) => {
  const file = createWriteStream(ZIP_PATH);
  https.get(GTFS_URL, (res) => {
    if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
    res.pipe(file);
    file.on('finish', () => { file.close(); resolve(); });
  }).on('error', reject);
});

console.log('📦 Extraindo stops.txt...');
const zip = new AdmZip(ZIP_PATH);
const stopsEntry = zip.getEntry('stops.txt');
if (!stopsEntry) throw new Error('stops.txt não encontrado no ZIP!');

writeFileSync(path.join(OUTPUT_DIR, 'stops.txt'), stopsEntry.getData());
console.log('✅ public/gtfs/stops.txt salvo com sucesso!');
console.log('   Agora reinicie o servidor: npm run dev');
