// Builds public/data/country-facts.json - the on-the-ground facts PracticalInfo
// diffs against home: IEC plug letters + nominal voltage, driving side, and the
// primary emergency number (the all-purpose number where one exists - 112, 911,
// 999 - else the police number). The source table is embedded below and
// hand-auditable like the curated destinations: IEC world-plug types plus the
// Wikipedia driving-side and emergency-number lists. Territories inherit their
// administering country's values (RE -> FR, CX -> AU); obviously uninhabited
// codes (AQ, BV, HM, UM, TF, GS) and North Korea (no reliably documented
// emergency number) are deliberately absent - correctness over completeness.
import { writeFile, mkdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const OUT_DIR = new URL('../public/data/', import.meta.url);

const R = 'right';
const L = 'left';

/** One row: IEC plug letters as a compact string, nominal voltage, driving side, emergency number. */
const f = (plugs, voltage, drive, emergency) => ({
  plugs: plugs.split(''),
  voltage,
  drive,
  emergency: [emergency],
});

/* prettier-ignore */
const FACTS = {
  // Europe (EU/EEA and neighbours - 112 is the universal number)
  AD: f('CF', 230, R, '112'), AL: f('CF', 230, R, '112'), AT: f('CF', 230, R, '112'), AX: f('CF', 230, R, '112'),
  BA: f('CF', 230, R, '122'), BE: f('CE', 230, R, '112'), BG: f('CF', 230, R, '112'), BY: f('CF', 230, R, '112'),
  CH: f('CJ', 230, R, '112'), CY: f('G', 240, L, '112'), CZ: f('CE', 230, R, '112'), DE: f('CF', 230, R, '112'),
  DK: f('CEFK', 230, R, '112'), EE: f('CF', 230, R, '112'), ES: f('CF', 230, R, '112'), FI: f('CF', 230, R, '112'),
  FO: f('CEFK', 230, R, '112'), FR: f('CE', 230, R, '112'), GB: f('G', 230, L, '999'), GG: f('G', 230, L, '999'),
  GI: f('CG', 240, R, '112'), GR: f('CF', 230, R, '112'), HR: f('CF', 230, R, '112'), HU: f('CF', 230, R, '112'),
  IE: f('G', 230, L, '112'), IM: f('G', 240, L, '999'), IS: f('CF', 230, R, '112'), IT: f('CFL', 230, R, '112'),
  JE: f('G', 230, L, '999'), LI: f('CJ', 230, R, '112'), LT: f('CF', 230, R, '112'), LU: f('CF', 230, R, '112'),
  LV: f('CF', 230, R, '112'), MC: f('CEF', 230, R, '112'), MD: f('CF', 230, R, '112'), ME: f('CF', 230, R, '112'),
  MK: f('CF', 230, R, '192'), MT: f('G', 230, L, '112'), NL: f('CF', 230, R, '112'), NO: f('CF', 230, R, '112'),
  PL: f('CE', 230, R, '112'), PT: f('CF', 230, R, '112'), RO: f('CF', 230, R, '112'), RS: f('CF', 230, R, '192'),
  RU: f('CF', 230, R, '112'), SE: f('CF', 230, R, '112'), SI: f('CF', 230, R, '112'), SJ: f('CF', 230, R, '112'),
  SK: f('CE', 230, R, '112'), SM: f('CFL', 230, R, '112'), TR: f('CF', 230, R, '112'), UA: f('CF', 230, R, '112'),
  VA: f('CFL', 230, R, '112'), XK: f('CF', 230, R, '112'),
  // Middle East
  AE: f('G', 230, R, '999'), BH: f('G', 230, R, '999'), IL: f('CH', 230, R, '100'), IQ: f('CDG', 230, R, '104'),
  IR: f('CF', 230, R, '110'), JO: f('CDFG', 230, R, '911'), KW: f('CG', 240, R, '112'), LB: f('CDG', 230, R, '112'),
  OM: f('CG', 240, R, '9999'), PS: f('CH', 230, R, '100'), QA: f('DG', 240, R, '999'), SA: f('G', 230, R, '911'),
  SY: f('CEL', 220, R, '112'), YE: f('ADG', 230, R, '199'),
  // Caucasus & Central Asia
  AM: f('CF', 230, R, '911'), AZ: f('CF', 220, R, '112'), GE: f('CF', 220, R, '112'), KG: f('CF', 220, R, '112'),
  KZ: f('CF', 220, R, '112'), TJ: f('CF', 220, R, '102'), TM: f('CF', 220, R, '102'), UZ: f('CF', 220, R, '102'),
  // South Asia
  AF: f('CF', 220, R, '119'), BD: f('CDG', 220, L, '999'), BT: f('CDG', 230, L, '113'), IN: f('CDM', 230, L, '112'),
  LK: f('DGM', 230, L, '119'), MV: f('DG', 230, L, '119'), NP: f('CDM', 230, L, '100'), PK: f('CD', 230, L, '15'),
  // East & Southeast Asia
  BN: f('G', 240, L, '993'), CN: f('ACI', 220, R, '110'), HK: f('G', 220, L, '999'), ID: f('CF', 230, L, '110'),
  JP: f('AB', 100, L, '110'), KH: f('ACG', 230, R, '117'), KR: f('CF', 220, R, '112'), LA: f('ABC', 230, R, '191'),
  MM: f('CDFG', 230, R, '199'), MN: f('CE', 230, R, '102'), MO: f('DG', 220, L, '999'), MY: f('G', 240, L, '999'),
  PH: f('ABC', 220, R, '911'), SG: f('G', 230, L, '999'), TH: f('ABCO', 230, L, '191'), TL: f('CEFI', 220, L, '112'),
  TW: f('AB', 110, R, '110'), VN: f('AC', 220, R, '113'),
  // North Africa
  DZ: f('CF', 230, R, '17'), EG: f('CF', 220, R, '122'), EH: f('CE', 220, R, '19'), LY: f('CDL', 230, R, '193'),
  MA: f('CE', 220, R, '19'), TN: f('CE', 230, R, '197'),
  // Sub-Saharan Africa
  AO: f('CF', 220, R, '113'), BF: f('CE', 220, R, '17'), BI: f('CE', 220, R, '117'), BJ: f('CE', 220, R, '117'),
  BW: f('DGM', 230, L, '999'), CD: f('CDE', 220, R, '112'), CF: f('CE', 220, R, '117'), CG: f('CE', 230, R, '117'),
  CI: f('CE', 220, R, '111'), CM: f('CE', 220, R, '117'), CV: f('CF', 230, R, '132'), DJ: f('CE', 220, R, '17'),
  ER: f('CL', 230, R, '113'), ET: f('CEF', 220, R, '991'), GA: f('C', 220, R, '177'), GH: f('DG', 230, R, '112'),
  GM: f('G', 230, R, '117'), GN: f('CFK', 220, R, '117'), GQ: f('CE', 220, R, '114'), GW: f('C', 220, R, '117'),
  KE: f('G', 240, L, '999'), KM: f('CE', 220, R, '17'), LR: f('AB', 120, R, '911'), LS: f('M', 220, L, '112'),
  MG: f('CE', 220, R, '117'), ML: f('CE', 220, R, '17'), MR: f('C', 220, R, '117'), MU: f('CG', 230, L, '999'),
  MW: f('G', 230, L, '997'), MZ: f('CFM', 220, L, '119'), NA: f('DM', 220, L, '10111'), NE: f('CE', 220, R, '17'),
  NG: f('DG', 230, R, '112'), RE: f('CE', 230, R, '112'), RW: f('CJ', 230, R, '112'), SC: f('G', 240, L, '999'),
  SD: f('CD', 230, R, '999'), SH: f('G', 240, L, '999'), SL: f('DG', 230, R, '999'), SN: f('CE', 230, R, '17'),
  SO: f('C', 220, R, '888'), SS: f('CD', 230, R, '999'), ST: f('CF', 220, R, '112'), SZ: f('M', 230, L, '999'),
  TD: f('CE', 220, R, '17'), TG: f('C', 220, R, '117'), TZ: f('DG', 230, L, '112'), UG: f('G', 240, L, '999'),
  YT: f('CE', 230, R, '112'), ZA: f('CDMN', 230, L, '10111'), ZM: f('CDG', 230, L, '999'), ZW: f('DG', 220, L, '999'),
  // North & Central America, Caribbean
  AG: f('AB', 230, L, '911'), AI: f('AB', 110, L, '911'), AW: f('ABF', 127, R, '911'), BB: f('AB', 115, L, '211'),
  BL: f('CE', 230, R, '112'), BM: f('AB', 120, L, '911'), BQ: f('AB', 127, R, '911'), BS: f('AB', 120, L, '911'),
  BZ: f('ABG', 110, R, '911'), CA: f('AB', 120, R, '911'), CR: f('AB', 120, R, '911'), CU: f('AB', 110, R, '106'),
  CW: f('AB', 127, R, '911'), DM: f('DG', 230, L, '999'), DO: f('AB', 110, R, '911'), GD: f('G', 230, L, '911'),
  GP: f('CE', 230, R, '112'), GT: f('AB', 120, R, '110'), HN: f('AB', 110, R, '911'), HT: f('AB', 110, R, '114'),
  JM: f('AB', 110, L, '119'), KN: f('DG', 230, L, '911'), KY: f('AB', 120, L, '911'), LC: f('G', 240, L, '999'),
  MF: f('CE', 220, R, '112'), MQ: f('CE', 220, R, '112'), MS: f('AB', 230, L, '911'), MX: f('AB', 127, R, '911'),
  NI: f('AB', 120, R, '118'), PA: f('AB', 110, R, '911'), PM: f('CE', 230, R, '112'), PR: f('AB', 120, R, '911'),
  SV: f('AB', 115, R, '911'), SX: f('AB', 110, R, '911'), TC: f('AB', 120, L, '911'), TT: f('AB', 115, L, '999'),
  US: f('AB', 120, R, '911'), VC: f('G', 230, L, '999'), VG: f('AB', 110, L, '911'), VI: f('AB', 110, L, '911'),
  // South America
  AR: f('CI', 220, R, '911'), BO: f('AC', 230, R, '110'), BR: f('CN', 127, R, '190'), CL: f('CL', 220, R, '133'),
  CO: f('AB', 110, R, '123'), EC: f('AB', 120, R, '911'), FK: f('G', 240, L, '999'), GF: f('CE', 220, R, '112'),
  GY: f('ABDG', 240, L, '911'), PE: f('ABC', 220, R, '105'), PY: f('C', 220, R, '911'), SR: f('CF', 127, L, '115'),
  UY: f('CFIL', 230, R, '911'), VE: f('AB', 120, R, '911'),
  // Oceania
  AS: f('AB', 120, R, '911'), AU: f('I', 230, L, '000'), CC: f('I', 230, L, '000'), CK: f('I', 240, L, '999'),
  CX: f('I', 230, L, '000'), FJ: f('I', 240, L, '911'), FM: f('AB', 120, R, '911'), GU: f('AB', 120, R, '911'),
  KI: f('I', 240, L, '999'), MH: f('AB', 120, R, '911'), MP: f('AB', 120, R, '911'), NC: f('CF', 220, R, '112'),
  NF: f('I', 230, L, '000'), NR: f('I', 240, L, '110'), NU: f('I', 230, L, '999'), NZ: f('I', 230, L, '111'),
  PF: f('CE', 220, R, '112'), PG: f('I', 240, L, '112'), PN: f('I', 230, L, '999'), PW: f('AB', 120, R, '911'),
  SB: f('GI', 220, L, '999'), TK: f('I', 230, L, '111'), TO: f('I', 240, L, '911'), TV: f('I', 220, L, '911'),
  VU: f('CGI', 220, R, '111'), WF: f('CE', 220, R, '112'), WS: f('I', 230, L, '999'),
  // Atlantic & Indian Ocean territories
  GL: f('CEFK', 230, R, '112'), IO: f('G', 240, L, '999'),
};

// Same constraints as parseCountryFacts in src/core/practical/countryFacts.ts -
// keep in sync so nothing valid here is rejected at runtime.
const ISO2_RE = /^[A-Z]{2}$/;
const PLUG_RE = /^[A-O]$/;
const EMERGENCY_RE = /^\d{2,6}$/;

function validate(code, facts) {
  const ok =
    ISO2_RE.test(code) &&
    Array.isArray(facts.plugs) && facts.plugs.length > 0 && facts.plugs.every((p) => PLUG_RE.test(p)) &&
    Number.isFinite(facts.voltage) && facts.voltage >= 100 && facts.voltage <= 240 &&
    (facts.drive === 'right' || facts.drive === 'left') &&
    Array.isArray(facts.emergency) && facts.emergency.length > 0 &&
    facts.emergency.every((n) => EMERGENCY_RE.test(n));
  if (!ok) throw new Error(`country-facts: malformed entry for ${code}: ${JSON.stringify(facts)}`);
}

async function main() {
  const entries = Object.entries(FACTS);
  for (const [code, facts] of entries) validate(code, facts);
  if (entries.length < 230) {
    throw new Error(`country-facts: only ${entries.length} entries - expected 230+`);
  }

  const payload = JSON.stringify({ v: 1, count: entries.length, facts: FACTS });
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(new URL('country-facts.json', OUT_DIR), payload);

  const rawKb = (payload.length / 1e3).toFixed(1);
  const gzKb = (gzipSync(Buffer.from(payload)).length / 1e3).toFixed(1);
  console.log(`country-facts.json: ${entries.length} countries, ${rawKb} KB raw, ${gzKb} KB gzipped`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
