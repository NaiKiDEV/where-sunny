// Generates PWA icons (public/icons/*.png) with a dependency-free PNG encoder.
// Draws the app's sun mark: gold disc + 8 rays on a warm cream background.
import { writeFile, mkdir } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';

const OUT_DIR = new URL('../public/icons/', import.meta.url);
const BG = [255, 244, 220, 255];
const SUN = [245, 166, 35, 255];
const RAY_COUNT = 8;
const SUPERSAMPLE = 2;

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePng(size, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const scanlines = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    scanlines[rowStart] = 0; // filter: none
    rgba.copy(scanlines, rowStart + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(scanlines)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function insideRoundedSquare(x, y, size, cornerRadius) {
  const min = cornerRadius;
  const max = size - cornerRadius;
  if (x >= min && x <= max) return true;
  if (y >= min && y <= max) return true;
  const cx = x < min ? min : max;
  const cy = y < min ? min : max;
  return (x - cx) ** 2 + (y - cy) ** 2 <= cornerRadius ** 2;
}

function nearestRayAngleDelta(angle) {
  const step = (Math.PI * 2) / RAY_COUNT;
  const mod = ((angle % step) + step) % step;
  return Math.min(mod, step - mod);
}

function drawIcon(size, { discRatio, rayInnerRatio, rayOuterRatio, cornerRatio }) {
  const s = size * SUPERSAMPLE;
  const hi = Buffer.alloc(s * s * 4);
  const center = s / 2;
  const disc = discRatio * s;
  const rayInner = rayInnerRatio * s;
  const rayOuter = rayOuterRatio * s;
  const rayHalfWidth = 0.045 * s;
  const corner = cornerRatio * s;

  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const dx = x - center + 0.5;
      const dy = y - center + 0.5;
      const r = Math.hypot(dx, dy);
      let color = [0, 0, 0, 0];
      if (insideRoundedSquare(x + 0.5, y + 0.5, s, corner)) color = BG;
      const isDisc = r <= disc;
      const isRay =
        r >= rayInner && r <= rayOuter && nearestRayAngleDelta(Math.atan2(dy, dx)) * r <= rayHalfWidth;
      if (isDisc || isRay) color = SUN;
      hi.set(color, (y * s + x) * 4);
    }
  }

  // box-downsample for antialiasing
  const out = Buffer.alloc(size * size * 4);
  const n = SUPERSAMPLE * SUPERSAMPLE;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sums = [0, 0, 0, 0];
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const i = ((y * SUPERSAMPLE + sy) * s + x * SUPERSAMPLE + sx) * 4;
          for (let c = 0; c < 4; c++) sums[c] += hi[i + c];
        }
      }
      out.set(sums.map((v) => Math.round(v / n)), (y * size + x) * 4);
    }
  }
  return encodePng(size, out);
}

const ICONS = [
  { file: 'icon-192.png', size: 192, discRatio: 0.19, rayInnerRatio: 0.26, rayOuterRatio: 0.38, cornerRatio: 0.22 },
  { file: 'icon-512.png', size: 512, discRatio: 0.19, rayInnerRatio: 0.26, rayOuterRatio: 0.38, cornerRatio: 0.22 },
  // maskable: full-bleed square, sun shrunk into the 80% safe zone
  { file: 'maskable-512.png', size: 512, discRatio: 0.15, rayInnerRatio: 0.21, rayOuterRatio: 0.3, cornerRatio: 0 },
];

await mkdir(OUT_DIR, { recursive: true });
for (const { file, size, ...shape } of ICONS) {
  await writeFile(new URL(file, OUT_DIR), drawIcon(size, shape));
  console.log(`icons/${file}`);
}
