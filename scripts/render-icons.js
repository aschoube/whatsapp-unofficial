'use strict';

// Rasterises the app mark into the PNGs electron-builder and the tray need.
// Pure Node -- no system image tooling and no display required, so it
// reproduces anywhere including CI. Run with `npm run icons`.
//
// build/icon.svg stays the source of truth for the design; the geometry below
// mirrors it. Change one, change the other.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const BUILD = path.join(__dirname, '..', 'build');
const VIEWBOX = 512;
const SAMPLES = 4; // supersampling factor per axis

// --- geometry -------------------------------------------------------------

// Signed distance to a rounded rectangle; negative is inside.
function roundedRect(px, py, x, y, w, h, r) {
  const qx = Math.abs(px - (x + w / 2)) - (w / 2 - r);
  const qy = Math.abs(py - (y + h / 2)) - (h / 2 - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

function circle(px, py, cx, cy, r) {
  return Math.hypot(px - cx, py - cy) - r;
}

// --- scene ----------------------------------------------------------------

const PANEL_BACK = { x: 150, y: 116, w: 248, h: 168, r: 40 };
const PANEL_FRONT = { x: 114, y: 204, w: 284, h: 192, r: 46 };
const DOTS = [188, 256, 324].map((cx) => ({ cx, cy: 300, r: 21 }));
const INDIGO = [91, 84, 240];
const VIOLET = [124, 58, 237];
const WHITE = [255, 255, 255];

function scene(unreadMarker) {
  const layers = [
    {
      hit: (x, y) => roundedRect(x, y, 0, 0, VIEWBOX, VIEWBOX, 116),
      color: (x, y) => {
        const t = Math.min(1, Math.max(0, (x + y) / (2 * VIEWBOX)));
        return [
          INDIGO[0] + (VIOLET[0] - INDIGO[0]) * t,
          INDIGO[1] + (VIOLET[1] - INDIGO[1]) * t,
          INDIGO[2] + (VIOLET[2] - INDIGO[2]) * t
        ];
      },
      alpha: 1
    },
    {
      hit: (x, y) => roundedRect(x, y, PANEL_BACK.x, PANEL_BACK.y, PANEL_BACK.w, PANEL_BACK.h, PANEL_BACK.r),
      color: () => WHITE,
      alpha: 0.34
    },
    {
      hit: (x, y) => roundedRect(x, y, PANEL_FRONT.x, PANEL_FRONT.y, PANEL_FRONT.w, PANEL_FRONT.h, PANEL_FRONT.r),
      color: () => WHITE,
      alpha: 1
    },
    ...DOTS.map((d) => ({ hit: (x, y) => circle(x, y, d.cx, d.cy, d.r), color: () => INDIGO, alpha: 1 }))
  ];

  if (unreadMarker) {
    layers.push(
      { hit: (x, y) => circle(x, y, 404, 108, 104), color: () => [23, 23, 28], alpha: 1 },
      { hit: (x, y) => circle(x, y, 404, 108, 82), color: () => [255, 77, 79], alpha: 1 }
    );
  }
  return layers;
}

function render(size, unreadMarker) {
  const layers = scene(unreadMarker);
  const rgba = Buffer.alloc(size * size * 4);
  const scale = VIEWBOX / size;
  const step = 1 / SAMPLES;
  const weight = 1 / (SAMPLES * SAMPLES);

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const x = (px + (sx + 0.5) * step) * scale;
          const y = (py + (sy + 0.5) * step) * scale;

          // Composite this subsample through the stack, back to front.
          let sr = 0;
          let sg = 0;
          let sb = 0;
          let sa = 0;
          for (const layer of layers) {
            if (layer.hit(x, y) > 0) continue;
            const [lr, lg, lb] = layer.color(x, y);
            const la = layer.alpha;
            sr = lr * la + sr * (1 - la);
            sg = lg * la + sg * (1 - la);
            sb = lb * la + sb * (1 - la);
            sa = la + sa * (1 - la);
          }
          r += sr * weight;
          g += sg * weight;
          b += sb * weight;
          a += sa * weight;
        }
      }

      // Un-premultiply so edge pixels keep their colour on any backdrop.
      const i = (py * size + px) * 4;
      const norm = a > 0 ? 1 / a : 0;
      rgba[i] = Math.round(Math.min(255, r * norm));
      rgba[i + 1] = Math.round(Math.min(255, g * norm));
      rgba[i + 2] = Math.round(Math.min(255, b * norm));
      rgba[i + 3] = Math.round(Math.min(255, a * 255));
    }
  }
  return rgba;
}

// --- PNG ------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePNG(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

const TARGETS = [
  { out: 'icon-512.png', size: 512, unread: false },
  { out: 'icon-256.png', size: 256, unread: false },
  { out: 'icon-128.png', size: 128, unread: false },
  { out: 'icon-64.png', size: 64, unread: false },
  { out: 'tray.png', size: 22, unread: false },
  { out: 'tray-unread.png', size: 22, unread: true }
];

for (const target of TARGETS) {
  fs.writeFileSync(
    path.join(BUILD, target.out),
    encodePNG(target.size, render(target.size, target.unread))
  );
  console.log(`  ${target.out}  ${target.size}x${target.size}`);
}
