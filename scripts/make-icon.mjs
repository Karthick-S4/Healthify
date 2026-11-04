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

function colorAt(nx, ny) {
  const radius = 0.22;
  const dx = Math.abs(nx - 0.5) - (0.5 - radius);
  const dy = Math.abs(ny - 0.5) - (0.5 - radius);
  const outside = Math.min(Math.max(dx, dy), 0) + Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  if (outside > 0) return [0, 0, 0, 0];

  const cx = nx - 0.5;
  const cy = ny - 0.5;
  const distance = Math.hypot(cx, cy);
  let angle = Math.atan2(cy, cx) + Math.PI / 2;
  if (angle < 0) angle += Math.PI * 2;
  if (distance <= 0.3 && distance >= 0.2 && angle <= Math.PI * 1.55) return [255, 253, 248, 255];
  if (distance < 0.065) return [255, 253, 248, 255];
  return [194, 77, 36, 255];
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
