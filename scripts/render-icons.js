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
const SAMPLES = 4; // sub-scanlines per pixel row; x is covered analytically

// --- geometry -------------------------------------------------------------
//
// Everything is flattened to polygons in the 512-unit design space, then
// filled by a scanline pass. Polygons (rather than the signed-distance trick
// this script used to rely on) are what let the WhatsApp glyph -- an arbitrary
// bezier outline -- go through the same pipeline as the plate behind it.

const CURVE_STEPS = 32;

// The mark, lifted verbatim from the source artwork. Its own coordinates sit
// in a 48-unit box offset by (700, 360); GLYPH_TRANSFORM puts it back.
const GLYPH_PATH =
  "M723.993033,360 C710.762252,360 700,370.765287 700,383.999801 C700,389.248451 " +
  "701.692661,394.116025 704.570026,398.066947 L701.579605,406.983798 L710.804449,404.035539 " +
  "C714.598605,406.546975 719.126434,408 724.006967,408 C737.237748,408 748,397.234315 " +
  "748,384.000199 C748,370.765685 737.237748,360.000398 724.006967,360.000398 " +
  "L723.993033,360.000398 L723.993033,360 Z M717.29285,372.190836 C716.827488,371.07628 " +
  "716.474784,371.034071 715.769774,371.005401 C715.529728,370.991464 715.262214,370.977527 " +
  "714.96564,370.977527 C714.04845,370.977527 713.089462,371.245514 712.511043,371.838033 " +
  "C711.806033,372.557577 710.056843,374.23638 710.056843,377.679202 C710.056843,381.122023 " +
  "712.567571,384.451756 712.905944,384.917648 C713.258648,385.382743 717.800808,392.55031 " +
  "724.853297,395.471492 C730.368379,397.757149 732.00491,397.545307 733.260074,397.27732 " +
  "C735.093658,396.882308 737.393002,395.527239 737.971421,393.891043 C738.54984,392.25405 " +
  "738.54984,390.857171 738.380255,390.560912 C738.211068,390.264652 737.745308,390.095816 " +
  "737.040298,389.742615 C736.335288,389.389811 732.90737,387.696673 732.25849,387.470894 " +
  "C731.623543,387.231179 731.017259,387.315995 730.537963,387.99333 C729.860819,388.938653 " +
  "729.198006,389.89831 728.661785,390.476494 C728.238619,390.928051 727.547144,390.984595 " +
  "726.969123,390.744481 C726.193254,390.420348 724.021298,389.657798 721.340985,387.273388 " +
  "C719.267356,385.42535 717.856938,383.125756 717.448104,382.434484 C717.038871,381.729275 " +
  "717.405907,381.319529 717.729948,380.938852 C718.082653,380.501232 718.421026,380.191036 " +
  "718.77373,379.781688 C719.126434,379.372738 719.323884,379.160897 719.549599,378.681068 " +
  "C719.789645,378.215575 719.62006,377.735746 719.450874,377.382942 C719.281687,377.030139 " +
  "717.871269,373.587317 717.29285,372.190836 Z ";

// 48-unit glyph -> a 320px square centred in the 512px plate.
const GLYPH_SCALE = 320 / 48;
const GLYPH_TRANSFORM = (x, y) => [(x - 700) * GLYPH_SCALE + 96, (y - 360) * GLYPH_SCALE + 96];

// Minimal path parser: the artwork only ever uses M / L / C / Z, absolute and
// relative, which is all this handles -- it is not a general SVG engine.
function parsePath(d, transform) {
  const tokens = d.match(/[MmLlCcZz]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || [];
  const subpaths = [];
  let current = null;
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  let cmd = null;
  let i = 0;

  const num = () => parseFloat(tokens[i++]);
  const push = (x, y) => current.push(transform ? transform(x, y) : [x, y]);

  const cubic = (x1, y1, x2, y2, x, y) => {
    for (let s = 1; s <= CURVE_STEPS; s++) {
      const t = s / CURVE_STEPS;
      const u = 1 - t;
      const a = u * u * u;
      const b = 3 * u * u * t;
      const c = 3 * u * t * t;
      const e = t * t * t;
      push(a * cx + b * x1 + c * x2 + e * x, a * cy + b * y1 + c * y2 + e * y);
    }
    cx = x;
    cy = y;
  };

  while (i < tokens.length) {
    if (/[MmLlCcZz]/.test(tokens[i])) cmd = tokens[i++];
    else if (cmd === 'M') cmd = 'L'; // implicit lineto after a moveto
    else if (cmd === 'm') cmd = 'l';

    const rel = cmd === cmd.toLowerCase();
    const ox = rel ? cx : 0;
    const oy = rel ? cy : 0;

    switch (cmd.toUpperCase()) {
      case 'M':
        if (current && current.length > 1) subpaths.push(current);
        cx = ox + num();
        cy = oy + num();
        sx = cx;
        sy = cy;
        current = [];
        push(cx, cy);
        break;
      case 'L':
        cx = ox + num();
        cy = oy + num();
        push(cx, cy);
        break;
      case 'C': {
        const x1 = ox + num();
        const y1 = oy + num();
        const x2 = ox + num();
        const y2 = oy + num();
        cubic(x1, y1, x2, y2, ox + num(), oy + num());
        break;
      }
      case 'Z':
        if (current && current.length > 1) subpaths.push(current);
        current = null;
        cx = sx;
        cy = sy;
        break;
      default:
        throw new Error(`unsupported path command: ${cmd}`);
    }
  }
  if (current && current.length > 1) subpaths.push(current);
  return subpaths;
}

function roundedRect(x, y, w, h, r) {
  const pts = [];
  const arc = (ccx, ccy, from) => {
    for (let s = 0; s <= 16; s++) {
      const a = from + (s / 16) * (Math.PI / 2);
      pts.push([ccx + r * Math.cos(a), ccy + r * Math.sin(a)]);
    }
  };
  arc(x + w - r, y + h - r, 0); // right -> bottom
  arc(x + r, y + h - r, Math.PI / 2); // bottom -> left
  arc(x + r, y + r, Math.PI); // left -> top
  arc(x + w - r, y + r, -Math.PI / 2); // top -> right
  return [pts];
}

function circle(ccx, ccy, r) {
  const pts = [];
  for (let s = 0; s < 96; s++) {
    const a = (s / 96) * 2 * Math.PI;
    pts.push([ccx + r * Math.cos(a), ccy + r * Math.sin(a)]);
  }
  return [pts];
}

// --- scene ----------------------------------------------------------------

const GREEN = [37, 211, 102];
const WHITE = [255, 255, 255];
const BADGE_RING = [23, 23, 28];
const BADGE = [255, 77, 79];

function scene(unreadMarker) {
  const layers = [
    { shape: roundedRect(0, 0, VIEWBOX, VIEWBOX, 116), color: GREEN, alpha: 1 },
    { shape: parsePath(GLYPH_PATH, GLYPH_TRANSFORM), color: WHITE, alpha: 1, evenOdd: true }
  ];

  if (unreadMarker) {
    layers.push(
      { shape: circle(404, 108, 104), color: BADGE_RING, alpha: 1 },
      { shape: circle(404, 108, 82), color: BADGE, alpha: 1 }
    );
  }
  return layers;
}

// --- rasteriser -----------------------------------------------------------

// Coverage of one polygon set over a size x size grid, in [0, 1] per pixel.
// Sub-scanlines handle the vertical edge, span overlap handles the horizontal
// one, so a 4x sample count still gives clean diagonals.
function coverage(shape, size, evenOdd) {
  const cov = new Float64Array(size * size);
  const scale = VIEWBOX / size;
  const rowWeight = 1 / SAMPLES;
  const crossings = [];

  for (let sy = 0; sy < size * SAMPLES; sy++) {
    const yu = ((sy + 0.5) / SAMPLES) * scale;
    crossings.length = 0;

    for (const pts of shape) {
      for (let p = 0; p < pts.length; p++) {
        const [x0, y0] = pts[p];
        const [x1, y1] = pts[(p + 1) % pts.length];
        if (y0 === y1) continue;
        if (yu < Math.min(y0, y1) || yu >= Math.max(y0, y1)) continue;
        crossings.push({ x: x0 + ((yu - y0) / (y1 - y0)) * (x1 - x0), dir: y1 > y0 ? 1 : -1 });
      }
    }
    if (crossings.length < 2) continue;
    crossings.sort((a, b) => a.x - b.x);

    const row = Math.floor(sy / SAMPLES) * size;
    let winding = 0;
    for (let c = 0; c < crossings.length - 1; c++) {
      winding += evenOdd ? 1 : crossings[c].dir;
      const inside = evenOdd ? winding % 2 !== 0 : winding !== 0;
      if (!inside) continue;

      // Span in device pixels; add its overlap with each pixel it touches.
      const dx0 = crossings[c].x / scale;
      const dx1 = crossings[c + 1].x / scale;
      const first = Math.max(0, Math.floor(dx0));
      const last = Math.min(size - 1, Math.ceil(dx1) - 1);
      for (let px = first; px <= last; px++) {
        const overlap = Math.min(px + 1, dx1) - Math.max(px, dx0);
        if (overlap > 0) cov[row + px] += overlap * rowWeight;
      }
    }
  }
  return cov;
}

function render(size, unreadMarker) {
  const layers = scene(unreadMarker).map((layer) => ({
    ...layer,
    cov: coverage(layer.shape, size, layer.evenOdd)
  }));
  const rgba = Buffer.alloc(size * size * 4);

  for (let i = 0; i < size * size; i++) {
    let r = 0;
    let g = 0;
    let b = 0;
    let a = 0;

    // Composite the stack back to front, premultiplied.
    for (const layer of layers) {
      const la = Math.min(1, layer.cov[i]) * layer.alpha;
      if (la <= 0) continue;
      r = layer.color[0] * la + r * (1 - la);
      g = layer.color[1] * la + g * (1 - la);
      b = layer.color[2] * la + b * (1 - la);
      a = la + a * (1 - la);
    }

    // Un-premultiply so edge pixels keep their colour on any backdrop.
    const norm = a > 0 ? 1 / a : 0;
    const o = i * 4;
    rgba[o] = Math.round(Math.min(255, r * norm));
    rgba[o + 1] = Math.round(Math.min(255, g * norm));
    rgba[o + 2] = Math.round(Math.min(255, b * norm));
    rgba[o + 3] = Math.round(Math.min(255, a * 255));
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

// --- targets --------------------------------------------------------------

// The full hicolor ladder, so desktops and the .deb/AppImage can pick a size
// they do not have to resample. icon-512.png is what package.json and
// packaging/PKGBUILD point at; the rest are there for hicolor installs.
const ICON_SIZES = [16, 24, 32, 48, 64, 96, 128, 256, 512, 1024];

const TARGETS = [
  ...ICON_SIZES.map((size) => ({ out: `icon-${size}.png`, size, unread: false })),
  { out: 'tray.png', size: 22, unread: false },
  { out: 'tray-unread.png', size: 22, unread: true },
  { out: 'tray@2x.png', size: 44, unread: false },
  { out: 'tray-unread@2x.png', size: 44, unread: true }
];

for (const target of TARGETS) {
  fs.writeFileSync(
    path.join(BUILD, target.out),
    encodePNG(target.size, render(target.size, target.unread))
  );
  console.log(`  ${target.out}  ${target.size}x${target.size}`);
}
