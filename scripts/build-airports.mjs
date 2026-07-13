// Builds public/data/airports.json from the OurAirports dataset (Public Domain).
// Kept to airports with scheduled passenger service (large + medium + small) -
// i.e. everywhere you can actually fly - trimming ~85k rows to ~4.2k. Runway
// count/length is joined from runways.csv; elevation is converted to metres.
// Output row format (v2):
// [iata, icao, name, lat, lon, countryCode, region, municipality, home, wiki,
//  size, elevationM, runwayCount, longestRunwayM]
// size is 1 (large_airport) or 0 (medium/small); iata/home/wiki may be "";
// elevationM is null when unknown; runwayCount/longestRunwayM are 0 when unknown.
// Mirrors build-cities.mjs; see src/core/airports/loadAirports.ts for the reader.
import { writeFile, mkdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const AIRPORTS_URL = 'https://davidmegginson.github.io/ourairports-data/airports.csv';
const RUNWAYS_URL = 'https://davidmegginson.github.io/ourairports-data/runways.csv';
const OUT_DIR = new URL('../public/data/', import.meta.url);
const KEEP_TYPES = new Set(['large_airport', 'medium_airport', 'small_airport']);
const COORD_DECIMALS = 4; // ~11 m precision, plenty for a map marker
const FT_TO_M = 0.3048;

// Minimal RFC-4180 CSV parser: OurAirports quotes every field and names/cities
// contain commas, so a naive split on "," would misalign columns.
function parseCsv(str) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (inQuotes) {
      if (c === '"') {
        if (str[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status} for ${url}`);
  return res.text();
}

// airport_ident -> { count, longestFt } over OPEN runways only.
function buildRunwayIndex(csvText) {
  const parsed = parseCsv(csvText);
  const header = parsed[0];
  const c = Object.fromEntries(header.map((h, i) => [h, i]));
  const index = new Map();
  for (let r = 1; r < parsed.length; r++) {
    const cols = parsed[r];
    if (cols.length < header.length) continue;
    if (cols[c.closed] === '1') continue;
    const ident = cols[c.airport_ident];
    if (!ident) continue;
    const lengthFt = Number(cols[c.length_ft]);
    const entry = index.get(ident) ?? { count: 0, longestFt: 0 };
    entry.count += 1;
    if (Number.isFinite(lengthFt) && lengthFt > entry.longestFt) entry.longestFt = lengthFt;
    index.set(ident, entry);
  }
  return index;
}

function buildRows(csvText, runwayIndex) {
  const parsed = parseCsv(csvText);
  const header = parsed[0];
  const col = Object.fromEntries(header.map((h, i) => [h, i]));
  const rows = [];
  for (let r = 1; r < parsed.length; r++) {
    const cols = parsed[r];
    if (cols.length < header.length) continue;
    const type = cols[col.type];
    if (!KEEP_TYPES.has(type)) continue;
    if (cols[col.scheduled_service] !== 'yes') continue;

    const iata = cols[col.iata_code].trim();
    const icao = cols[col.icao_code].trim();
    if (!icao && !iata) continue; // need at least one stable identifier

    const lat = Number(Number(cols[col.latitude_deg]).toFixed(COORD_DECIMALS));
    const lon = Number(Number(cols[col.longitude_deg]).toFixed(COORD_DECIMALS));
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const elevationFt = Number(cols[col.elevation_ft]);
    const elevationM = Number.isFinite(elevationFt) ? Math.round(elevationFt * FT_TO_M) : null;

    const runways = runwayIndex.get(cols[col.ident]);
    const runwayCount = runways ? runways.count : 0;
    const longestRunwayM = runways && runways.longestFt > 0 ? Math.round(runways.longestFt * FT_TO_M) : 0;

    rows.push([
      iata,
      icao,
      cols[col.name].trim(),
      lat,
      lon,
      cols[col.iso_country].trim(),
      cols[col.iso_region].trim(),
      cols[col.municipality].trim(),
      cols[col.home_link].trim(),
      cols[col.wikipedia_link].trim(),
      type === 'large_airport' ? 1 : 0,
      elevationM,
      runwayCount,
      longestRunwayM,
    ]);
  }
  // Large airports first, then alphabetical - stable output, and any future cap
  // keeps the most significant hubs.
  rows.sort((a, b) => b[10] - a[10] || a[2].localeCompare(b[2]));
  return rows;
}

async function main() {
  console.log('Downloading OurAirports airports + runways ...');
  const [airportsCsv, runwaysCsv] = await Promise.all([download(AIRPORTS_URL), download(RUNWAYS_URL)]);
  const runwayIndex = buildRunwayIndex(runwaysCsv);
  const rows = buildRows(airportsCsv, runwayIndex);
  const payload = JSON.stringify({
    v: 2,
    source: 'OurAirports, Public Domain, https://ourairports.com/data/',
    count: rows.length,
    rows,
  });

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(new URL('airports.json', OUT_DIR), payload);

  const rawKb = (payload.length / 1024).toFixed(0);
  const gzKb = (gzipSync(Buffer.from(payload)).length / 1024).toFixed(0);
  const large = rows.filter((r) => r[10] === 1).length;
  const withRunways = rows.filter((r) => r[12] > 0).length;
  console.log(
    `airports.json: ${rows.length} airports (${large} large), ${withRunways} with runway data, ${rawKb} KB raw, ${gzKb} KB gzipped`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
