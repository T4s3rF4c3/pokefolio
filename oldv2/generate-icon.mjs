// Generates public/apple-touch-icon.png (180x180) — run once with: node generate-icon.mjs
import { deflateSync } from 'zlib';
import { writeFileSync } from 'fs';

const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[i] = c;
}
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const d = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const len = Buffer.allocUnsafe(4); len.writeUInt32BE(d.length);
  const crcVal = Buffer.allocUnsafe(4); crcVal.writeUInt32BE(crc32(Buffer.concat([t, d])));
  return Buffer.concat([len, t, d, crcVal]);
}

const W = 180, H = 180;
const BG  = [13, 13, 26];    // #0d0d1a
const YEL = [255, 203, 5];   // #ffcb05
const DRK = [10, 10, 20];    // bolt fill

function inRoundRect(x, y, rx, ry, rw, rh, r) {
  const px = x - rx, py = y - ry;
  if (px < 0 || px >= rw || py < 0 || py >= rh) return false;
  if (px < r && py < r)         return (px-r)**2 + (py-r)**2 <= r*r;
  if (px >= rw-r && py < r)     return (px-(rw-r))**2 + (py-r)**2 <= r*r;
  if (px < r && py >= rh-r)     return (px-r)**2 + (py-(rh-r))**2 <= r*r;
  if (px >= rw-r && py >= rh-r) return (px-(rw-r))**2 + (py-(rh-r))**2 <= r*r;
  return true;
}

function isLightning(px, py, bw, bh) {
  const nx = px / bw, ny = py / bh;
  const inUpper = nx >= 0.35 && nx <= 0.82 && ny >= 0.04 && ny <= 0.52 &&
    (nx - 0.35) * 0.46 >= (ny - 0.04) * 0.32;
  const inLower = nx >= 0.18 && nx <= 0.65 && ny >= 0.48 && ny <= 0.96 &&
    (nx - 0.65) * (-0.46) >= (ny - 0.48) * (-0.32);
  return inUpper || inLower;
}

const M = 36, BX = M, BY = M, BW = W - M*2, BH = H - M*2, CR = 22;
const scanlines = Buffer.alloc(H * (1 + W * 3));

for (let y = 0; y < H; y++) {
  const rs = y * (1 + W * 3);
  scanlines[rs] = 0;
  for (let x = 0; x < W; x++) {
    let [r, g, b] = BG;
    if (inRoundRect(x, y, BX, BY, BW, BH, CR)) {
      [r, g, b] = YEL;
      if (isLightning(x - BX, y - BY, BW, BH)) [r, g, b] = DRK;
    }
    scanlines[rs + 1 + x*3]     = r;
    scanlines[rs + 1 + x*3 + 1] = g;
    scanlines[rs + 1 + x*3 + 2] = b;
  }
}

const idat = deflateSync(scanlines, { level: 9 });
const ihdr = Buffer.allocUnsafe(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = ihdr[11] = ihdr[12] = 0;

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', idat),
  chunk('IEND', Buffer.alloc(0)),
]);

writeFileSync('public/apple-touch-icon.png', png);
console.log('Created public/apple-touch-icon.png (180x180)');
