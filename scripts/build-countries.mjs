// Builds public/data/countries.json from the world-atlas Natural Earth dataset
// (public domain). Output is a GeoJSON FeatureCollection of every country's
// territory, each feature tagged with `properties.code` (ISO 3166-1 alpha-2,
// uppercase) + `properties.name`. The map bundles ALL countries once and renders
// only the subset banned in src/core/bannedCountries.ts, so banning a new code
// needs no data rebuild - see src/components/map/mapLayers.ts.
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { feature } from 'topojson-client';
import countries from 'i18n-iso-countries';
// Node 24 requires the import attribute for JSON modules. The locale registers
// every alpha-2 English name, powering public/data/country-names.json (the
// user-ban country picker) - keyed by uppercase alpha-2, e.g. "FR":"France".
import enLocale from 'i18n-iso-countries/langs/en.json' with { type: 'json' };

countries.registerLocale(enLocale);

const SOURCE = new URL('../node_modules/world-atlas/countries-110m.json', import.meta.url);
const OUT_DIR = new URL('../public/data/', import.meta.url);

// world-atlas geometry ids are ISO 3166-1 NUMERIC codes as strings (e.g. "643").
// numericToAlpha2 needs no locale registration; a few entries (disputed regions
// like Kosovo) have no alpha-2 and are skipped.
function toAlpha2(numericId) {
  const code = countries.numericToAlpha2(String(numericId).padStart(3, '0'));
  return code ? code.toUpperCase() : null;
}

// A ring "crosses" the antimeridian when consecutive points jump >180° in
// longitude - the signature of a clamped ±180 representation (Russia, Fiji, ...).
function ringCrosses(ring) {
  for (let i = 1; i < ring.length; i++) {
    if (Math.abs(ring[i][0] - ring[i - 1][0]) > 180) return true;
  }
  return false;
}

// Rewrite a crossing ring to continuous longitudes (which may exceed ±180).
// MapLibre fills a clamped crossing ring the "long way" - smearing a band across
// the whole map - but renders continuous coordinates correctly, wrapping them
// across world copies. Non-crossing geometry is left byte-for-byte unchanged.
function unwrapRing(ring) {
  const out = [ring[0].slice()];
  let offset = 0;
  for (let i = 1; i < ring.length; i++) {
    const delta = ring[i][0] - ring[i - 1][0];
    if (delta > 180) offset -= 360;
    else if (delta < -180) offset += 360;
    out.push([ring[i][0] + offset, ring[i][1]]);
  }
  return out;
}

function unwrapAntimeridian(geometry) {
  const polys = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];
  let changed = false;
  const fixed = polys.map((poly) => {
    if (!poly.some(ringCrosses)) return poly;
    changed = true;
    return poly.map(unwrapRing);
  });
  if (!changed) return geometry;
  return geometry.type === 'MultiPolygon'
    ? { type: 'MultiPolygon', coordinates: fixed }
    : { type: 'Polygon', coordinates: fixed[0] };
}

async function main() {
  const topo = JSON.parse(await readFile(SOURCE, 'utf8'));
  const geo = feature(topo, topo.objects.countries);

  const features = [];
  let skipped = 0;
  for (const f of geo.features) {
    const code = toAlpha2(f.id);
    if (!code) {
      skipped += 1;
      continue;
    }
    features.push({
      type: 'Feature',
      geometry: unwrapAntimeridian(f.geometry),
      properties: { code, name: f.properties?.name ?? code },
    });
  }

  const payload = JSON.stringify({ type: 'FeatureCollection', features });

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(new URL('countries.json', OUT_DIR), payload);

  const rawMb = (payload.length / 1e6).toFixed(2);
  const gzMb = (gzipSync(Buffer.from(payload)).length / 1e6).toFixed(2);
  console.log(`countries.json: ${features.length} countries (${skipped} skipped), ${rawMb} MB raw, ${gzMb} MB gzipped`);

  // Flat { alpha2: englishName } map for the user-ban country picker. Keys are
  // already uppercase alpha-2 (matches Place.countryCode / effectiveBannedCodes).
  const names = countries.getNames('en', { select: 'official' });
  const namesPayload = JSON.stringify(names);
  await writeFile(new URL('country-names.json', OUT_DIR), namesPayload);
  const namesKb = (namesPayload.length / 1e3).toFixed(1);
  console.log(`country-names.json: ${Object.keys(names).length} names, ${namesKb} KB raw`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
