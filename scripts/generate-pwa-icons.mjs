/**
 * יוצר PNG מינימליים (ללא תלות חיצונית) לאייקוני PWA.
 * הרצה: node scripts/generate-pwa-icons.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "public", "icons");

function solidPng(width, height, r, g, b) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const ihdrChunk = chunk("IHDR", ihdr);
  const raw = Buffer.alloc((1 + width * 3) * height);
  let o = 0;
  for (let y = 0; y < height; y++) {
    raw[o++] = 0;
    for (let x = 0; x < width; x++) {
      raw[o++] = r;
      raw[o++] = g;
      raw[o++] = b;
    }
  }
  const compressed = deflateSync(raw, { level: 9 });
  const idatChunk = chunk("IDAT", compressed);
  const iendChunk = chunk("IEND", Buffer.alloc(0));
  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function chunk(type, data) {
  const t = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = crc32(Buffer.concat([t, data]));
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc >>> 0, 0);
  return Buffer.concat([len, t, data, crcBuf]);
}

function crc32(buf) {
  let c = -1 >>> 0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
  }
  return (c ^ -1) >>> 0;
}

/** ריבוע עם שוליים בטוחים למסכים עם "maskable" */
function maskablePng(size, r, g, b, marginFrac) {
  const m = Math.floor(size * marginFrac);
  const inner = size - 2 * m;
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const ihdrChunk = chunk("IHDR", ihdr);
  const raw = Buffer.alloc((1 + size * 3) * size);
  let o = 0;
  const bgR = 0xf4,
    bgG = 0xf4,
    bgB = 0xf5;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0;
    for (let x = 0; x < size; x++) {
      const inInner = x >= m && x < m + inner && y >= m && y < m + inner;
      if (inInner) {
        raw[o++] = r;
        raw[o++] = g;
        raw[o++] = b;
      } else {
        raw[o++] = bgR;
        raw[o++] = bgG;
        raw[o++] = bgB;
      }
    }
  }
  const compressed = deflateSync(raw, { level: 9 });
  const idatChunk = chunk("IDAT", compressed);
  const iendChunk = chunk("IEND", Buffer.alloc(0));
  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

mkdirSync(outDir, { recursive: true });
const R = 0x4f,
  G = 0x46,
  B = 0xe5;
writeFileSync(join(outDir, "pwa-192.png"), solidPng(192, 192, R, G, B));
writeFileSync(join(outDir, "pwa-512.png"), solidPng(512, 512, R, G, B));
writeFileSync(join(outDir, "pwa-512-maskable.png"), maskablePng(512, R, G, B, 0.1));
console.log("Wrote public/icons/pwa-*.png");
