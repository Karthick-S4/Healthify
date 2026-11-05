import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, pixels) {
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0;
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function inHeart(nx, ny) {
  const scale = 0.25;
  const x = (nx - 0.5) / scale;
  const y = -(ny - 0.5) / scale + 0.12;
  return (x * x + y * y - 1) ** 3 - x * x * y ** 3 <= 0;
}

function colorAt(nx, ny) {
  if (inHeart(nx, ny)) return [255, 250, 251, 255];
  const t = (nx + ny) / 2;
  let covered = 0;
  const taps = 12;
  for (let tap = 0; tap < taps; tap += 1) {
    const angle = (tap / taps) * Math.PI * 2;
    if (inHeart(nx - Math.cos(angle) * 0.035, ny - 0.03 - Math.sin(angle) * 0.035)) covered += 1;
  }
  const shade = 1 - 0.14 * (covered / taps);
  return [
    Math.round((244 + (199 - 244) * t) * shade),
    Math.round((182 + (77 - 182) * t) * shade),
    Math.round((166 + (110 - 166) * t) * shade),
    255,
  ];
}

function render(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const samples = 4;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let red = 0;
      let green = 0;
      let blue = 0;
      let alpha = 0;
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const color = colorAt((x + (sx + 0.5) / samples) / size, (y + (sy + 0.5) / samples) / size);
          red += color[0];
          green += color[1];
          blue += color[2];
          alpha += color[3];
        }
      }
      const count = samples * samples;
      const index = (y * size + x) * 4;
      pixels[index] = Math.round(red / count);
      pixels[index + 1] = Math.round(green / count);
      pixels[index + 2] = Math.round(blue / count);
      pixels[index + 3] = Math.round(alpha / count);
    }
  }
  return pixels;
}

for (const size of [180, 192, 512]) {
  fs.writeFileSync(path.join(root, `icon-${size}.png`), encodePng(size, render(size)));
}
