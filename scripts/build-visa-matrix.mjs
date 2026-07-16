// Builds public/data/visa/{iso2}.json - one tiny file per passport - from the
// open passport-index dataset (https://github.com/ilyankou/passport-index-dataset,
// MIT). The runtime fetches exactly one file, only after the user picks a
// passport in Settings. Each file maps destination alpha-2 -> a compact
// requirement record ({ cat, days? }) plus the generation date, surfaced in the
// UI as the dataset vintage. Fails loudly on any unexpected category so a
// silent format change upstream can never ship a wrong answer.
import { writeFile, mkdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const SOURCE =
  'https://raw.githubusercontent.com/ilyankou/passport-index-dataset/master/passport-index-tidy-iso2.csv';
const OUT_DIR = new URL('../public/data/visa/', import.meta.url);
const EXPECTED_HEADER = 'Passport,Destination,Requirement';

const ISO2_RE = /^[A-Z]{2}$/;

// Mirrors parseCsvRequirement in src/core/practical/visa.ts - keep in sync.
// Returns null for the '-1' same-country marker (those rows are dropped; the
// UI hides the chip for passport == destination anyway).
function toRequirement(raw) {
  const value = raw.trim().toLowerCase();
  if (value === '-1') return null;
  if (/^\d+$/.test(value)) return { cat: 'vf', days: Number(value) };
  switch (value) {
    case 'visa free':
      return { cat: 'vf' };
    case 'visa on arrival':
      return { cat: 'voa' };
    case 'e-visa':
      return { cat: 'ev' };
    case 'eta':
      return { cat: 'eta' };
    case 'visa required':
      return { cat: 'vr' };
    case 'no admission':
      return { cat: 'na' };
    default:
      throw new Error(`visa-matrix: unexpected requirement "${raw}" - update the category map`);
  }
}

async function main() {
  const res = await fetch(SOURCE);
  if (!res.ok) throw new Error(`visa-matrix: passport-index CSV fetch failed: HTTP ${res.status}`);
  const text = await res.text();

  const lines = text.trim().split('\n').map((line) => line.trim());
  const header = lines.shift();
  if (header !== EXPECTED_HEADER) {
    throw new Error(`visa-matrix: unexpected CSV header "${header}"`);
  }

  const byPassport = new Map();
  for (const line of lines) {
    if (!line) continue;
    const parts = line.split(',');
    if (parts.length !== 3) throw new Error(`visa-matrix: malformed row "${line}"`);
    const [passport, destination, requirement] = parts.map((p) => p.trim());
    if (!ISO2_RE.test(passport) || !ISO2_RE.test(destination)) {
      throw new Error(`visa-matrix: malformed country code in row "${line}"`);
    }
    const req = toRequirement(requirement);
    if (req === null) {
      if (passport !== destination) {
        throw new Error(`visa-matrix: '-1' outside the diagonal in row "${line}"`);
      }
      continue;
    }
    if (!byPassport.has(passport)) byPassport.set(passport, {});
    byPassport.get(passport)[destination] = req;
  }

  const generated = new Date().toISOString().slice(0, 10);
  await mkdir(OUT_DIR, { recursive: true });

  let totalBytes = 0;
  let totalGzBytes = 0;
  for (const [passport, destinations] of byPassport) {
    const payload = JSON.stringify({ v: 1, generated, passport, destinations });
    await writeFile(new URL(`${passport}.json`, OUT_DIR), payload);
    totalBytes += payload.length;
    totalGzBytes += gzipSync(Buffer.from(payload)).length;
  }

  const count = byPassport.size;
  if (count < 150) throw new Error(`visa-matrix: only ${count} passports - expected ~199`);
  const avgKb = (totalBytes / count / 1e3).toFixed(1);
  const totalKb = (totalBytes / 1e3).toFixed(0);
  const gzKb = (totalGzBytes / 1e3).toFixed(0);
  console.log(
    `visa/: ${count} passport files (${generated}), ${avgKb} KB each avg, ${totalKb} KB raw total, ${gzKb} KB gzipped`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
