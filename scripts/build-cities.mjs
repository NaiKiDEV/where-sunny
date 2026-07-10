// Builds public/data/cities.json from the GeoNames cities5000 dataset (CC-BY 4.0).
// Output row format: [name, countryCode, lat, lon, population], sorted by population desc.
import { writeFile, mkdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { unzipSync } from 'fflate';

const SOURCE_URL = 'https://download.geonames.org/export/dump/cities5000.zip';
const OUT_DIR = new URL('../public/data/', import.meta.url);
const MIN_POPULATION = 1000;
const COORD_DECIMALS = 3; // ~110 m precision, plenty for weather + map markers

// Column indices per https://download.geonames.org/export/dump/readme.txt
const COL = { name: 1, lat: 4, lon: 5, featureClass: 6, countryCode: 8, population: 14 };

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status} for ${url}`);
  return new Uint8Array(await res.arrayBuffer());
}

function parseRows(tsvText) {
  const rows = [];
  for (const line of tsvText.split('\n')) {
    if (!line) continue;
    const cols = line.split('\t');
    if (cols[COL.featureClass] !== 'P') continue;
    const population = Number(cols[COL.population]);
    if (!Number.isFinite(population) || population < MIN_POPULATION) continue;
    const lat = Number(Number(cols[COL.lat]).toFixed(COORD_DECIMALS));
    const lon = Number(Number(cols[COL.lon]).toFixed(COORD_DECIMALS));
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    rows.push([cols[COL.name], cols[COL.countryCode], lat, lon, population]);
  }
  rows.sort((a, b) => b[4] - a[4]);
  return rows;
}

async function main() {
  console.log(`Downloading ${SOURCE_URL} ...`);
  const zip = await download(SOURCE_URL);
  const files = unzipSync(zip);
  const txt = files['cities5000.txt'];
  if (!txt) throw new Error('cities5000.txt not found in archive');

  const rows = parseRows(new TextDecoder().decode(txt));
  const payload = JSON.stringify({
    v: 1,
    source: 'GeoNames cities5000, CC-BY 4.0, https://www.geonames.org',
    count: rows.length,
    rows,
  });

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(new URL('cities.json', OUT_DIR), payload);

  const rawMb = (payload.length / 1e6).toFixed(2);
  const gzMb = (gzipSync(Buffer.from(payload)).length / 1e6).toFixed(2);
  console.log(`cities.json: ${rows.length} places, ${rawMb} MB raw, ${gzMb} MB gzipped`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
