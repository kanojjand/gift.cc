import { crc32, deflateSync } from 'node:zlib';
import QRCode from 'qrcode';
import { MARK } from './brand.js';

/** H keeps the code readable with up to 30% of it covered, so the mark in the middle does not break scanning. */
const ERROR_CORRECTION = 'H';
/** Side of the white box under the mark, as a share of the code without its quiet zone. */
const MARK_BOX_SHARE = 0.22;
/** White space between the box edge and the mark, as a share of the box side. */
const MARK_PADDING_SHARE = 0.12;
/** Samples per pixel side when the mark is drawn into a PNG, for smooth edges. */
const SUPERSAMPLE = 4;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function codeMatrix(text) {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: ERROR_CORRECTION });
  return { size: modules.size, isDark: (x, y) => modules.data[y * modules.size + x] === 1 };
}

/** The white box in the centre, in modules; its side has the code's parity so it sits on whole modules. */
function markBox(size) {
  let side = Math.round(size * MARK_BOX_SHARE);
  if ((size - side) % 2 !== 0) side += 1;
  const start = (size - side) / 2;
  return { start, side, covers: (x, y) => x >= start && x < start + side && y >= start && y < start + side };
}

/** Where the mark sits inside the box: top-left corner in modules and the scale from mark units to modules. */
function markPlacement(box) {
  const scale = (box.side * (1 - 2 * MARK_PADDING_SHARE)) / Math.max(MARK.width, MARK.height);
  return {
    scale,
    x: box.start + (box.side - MARK.width * scale) / 2,
    y: box.start + (box.side - MARK.height * scale) / 2,
  };
}

const round = (value) => Number(value.toFixed(4));

/**
 * QR code as SVG with the CC Lab mark in the middle.
 * @param {string} text
 * @param {{ margin?: number }} [options] quiet zone in modules
 */
export function qrSvg(text, { margin = 1 } = {}) {
  const { size, isDark } = codeMatrix(text);
  const box = markBox(size);
  const mark = markPlacement(box);
  const full = size + margin * 2;
  let d = '';
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!isDark(x, y) || box.covers(x, y)) continue;
      let run = 1;
      while (x + run < size && isDark(x + run, y) && !box.covers(x + run, y)) run += 1;
      d += `M${x + margin} ${y + margin}h${run}v1h-${run}z`;
      x += run - 1;
    }
  }
  const markTransform = `translate(${round(mark.x + margin)} ${round(mark.y + margin)}) scale(${round(mark.scale)})`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${full} ${full}" shape-rendering="crispEdges">` +
    `<rect width="${full}" height="${full}" fill="#fff"/><path fill="#000" d="${d}"/>` +
    `<g class="qr-mark" fill="#000" shape-rendering="geometricPrecision" transform="${markTransform}">${MARK.paths}</g></svg>`
  );
}

/** The mark's outlines as point lists, read from its path data (only M, L, H, V and Z are used). */
function markPolygons() {
  return [...MARK.paths.matchAll(/d="([^"]+)"/g)].map(([, d]) => {
    const points = [];
    let x = 0;
    let y = 0;
    for (const [, command, args] of d.matchAll(/([A-Za-z])([^A-Za-z]*)/g)) {
      const numbers = args.trim().split(/[\s,]+/).filter(Boolean).map(Number);
      if (command === 'Z') continue;
      if (command === 'M' || command === 'L') [x, y] = numbers;
      else if (command === 'H') [x] = numbers;
      else if (command === 'V') [y] = numbers;
      else throw new Error(`the mark uses path command ${command}, which the PNG renderer does not draw`);
      points.push([x, y]);
    }
    return points;
  });
}

const MARK_POLYGONS = markPolygons();

/** Where a horizontal line at mark height `y` crosses the mark's outlines, left to right. */
function crossingsAt(y) {
  const xs = [];
  for (const points of MARK_POLYGONS) {
    for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
      const [xi, yi] = points[i];
      const [xj, yj] = points[j];
      if (yi > y !== yj > y) xs.push(xi + ((y - yi) * (xj - xi)) / (yj - yi));
    }
  }
  return xs.sort((a, b) => a - b);
}

/**
 * Adds one sample row to `hits`: a sample is inside the mark when an odd number of crossings lie to its left
 * (the outlines never overlap, so even-odd over all of them works). Samples go left to right, so one pass is enough.
 */
function addRowHits(hits, xs, sampleXs) {
  let next = 0;
  sampleXs.forEach((x, index) => {
    while (next < xs.length && xs[next] <= x) next += 1;
    if (next % 2 === 1) hits[Math.floor(index / SUPERSAMPLE)] += 1;
  });
}

/** Paints the mark into the (already white) box, shading edge pixels by how much of them it covers. */
function drawMark(pixels, width, perModule, mark) {
  const toMark = (pixel, offset) => (pixel / perModule - offset) / mark.scale;
  const left = Math.floor(mark.x * perModule);
  const top = Math.floor(mark.y * perModule);
  const right = Math.ceil((mark.x + MARK.width * mark.scale) * perModule);
  const bottom = Math.ceil((mark.y + MARK.height * mark.scale) * perModule);
  const sampleXs = Array.from({ length: (right - left) * SUPERSAMPLE }, (_, i) =>
    toMark(left + (i + 0.5) / SUPERSAMPLE, mark.x),
  );
  for (let py = top; py < bottom; py += 1) {
    const hits = new Uint8Array(right - left);
    for (let sy = 0; sy < SUPERSAMPLE; sy += 1) {
      addRowHits(hits, crossingsAt(toMark(py + (sy + 0.5) / SUPERSAMPLE, mark.y)), sampleXs);
    }
    hits.forEach((count, i) => {
      pixels[py * width + left + i] = Math.round(255 * (1 - count / SUPERSAMPLE ** 2));
    });
  }
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodeGrayPng(pixels, width, height) {
  const rows = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y += 1) pixels.copy(rows, y * (width + 1) + 1, y * width, (y + 1) * width);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth; colour type 0 (grayscale), default compression, filter and interlace
  return Buffer.concat([PNG_SIGNATURE, pngChunk('IHDR', header), pngChunk('IDAT', deflateSync(rows)), pngChunk('IEND', Buffer.alloc(0))]);
}

/**
 * QR code as a square grayscale PNG with the CC Lab mark in the middle.
 * @param {string} text
 * @param {{ width: number, margin?: number }} options width in pixels, quiet zone in modules
 */
export function qrPng(text, { width, margin = 2 }) {
  if (!Number.isInteger(width) || width < 64) throw new Error('QR PNG width must be an integer of at least 64 px');
  const { size, isDark } = codeMatrix(text);
  const box = markBox(size);
  const mark = markPlacement(box);
  const perModule = width / (size + margin * 2);
  const pixels = Buffer.alloc(width * width, 255);
  for (let py = 0; py < width; py += 1) {
    const y = Math.floor(py / perModule) - margin;
    for (let px = 0; px < width; px += 1) {
      const x = Math.floor(px / perModule) - margin;
      const onCode = x >= 0 && y >= 0 && x < size && y < size;
      if (onCode && isDark(x, y) && !box.covers(x, y)) pixels[py * width + px] = 0;
    }
  }
  drawMark(pixels, width, perModule, { scale: mark.scale, x: mark.x + margin, y: mark.y + margin });
  return encodeGrayPng(pixels, width, width);
}
