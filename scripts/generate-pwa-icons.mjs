import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const svgPath = path.join(publicDir, 'icon.svg');
const svg = await fs.readFile(svgPath);

await sharp(svg).resize(192, 192, { fit: 'contain' }).png().toFile(path.join(publicDir, 'icon-192.png'));
await sharp(svg).resize(512, 512, { fit: 'contain' }).png().toFile(path.join(publicDir, 'icon-512.png'));

// Maskable artwork keeps the complete logo inside the central safe zone.
const safeLogo = await sharp(svg).resize(400, 400, { fit: 'contain' }).png().toBuffer();
await sharp({
  create: {
    width: 512,
    height: 512,
    channels: 4,
    background: { r: 7, g: 87, b: 183, alpha: 1 }
  }
})
  .composite([{ input: safeLogo, left: 56, top: 56 }])
  .png()
  .toFile(path.join(publicDir, 'icon-maskable-512.png'));

console.log('Generated ProLink 192px, 512px, and maskable PWA icons.');
