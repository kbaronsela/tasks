/**
 * מייצא אייקוני PWA מ־public/icons/pwa-icon-source.png (512+ מומלץ).
 * הרצה: node scripts/generate-pwa-icons.mjs
 */
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "public", "icons");
const sourcePath = join(outDir, "pwa-icon-source.png");

async function main() {
  if (!existsSync(sourcePath)) {
    console.error("חסר קובץ:", sourcePath);
    process.exit(1);
  }

  mkdirSync(outDir, { recursive: true });

  const base = sharp(sourcePath).resize(512, 512, { fit: "cover", position: "centre" });

  await base.clone().png().toFile(join(outDir, "pwa-512.png"));
  await base.clone().resize(192, 192, { fit: "cover", position: "centre" }).png().toFile(join(outDir, "pwa-192.png"));

  const innerSize = Math.round(512 * 0.8);
  const offset = Math.floor((512 - innerSize) / 2);
  const innerBuf = await sharp(sourcePath)
    .resize(innerSize, innerSize, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 244, g: 244, b: 245, alpha: 1 },
    },
  })
    .composite([{ input: innerBuf, left: offset, top: offset }])
    .png()
    .toFile(join(outDir, "pwa-512-maskable.png"));

  console.log("עודכנו public/icons/pwa-*.png מ־pwa-icon-source.png");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
