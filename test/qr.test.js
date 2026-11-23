import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inflateSync } from 'node:zlib';
import QRCode from 'qrcode';
import { MARK } from '../src/brand.js';
import { qrPng, qrSvg } from '../src/qr.js';

const LINK = 'https://gift.cclab.kz/c/abcd2345efgh';

/** Reads the 8-bit grayscale PNG that qrPng writes (filter 0 on every row). */
function readPng(buffer) {
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const idat = [];
  for (let at = 8; at < buffer.length; ) {
    const length = buffer.readUInt32BE(at);
    if (buffer.toString('ascii', at + 4, at + 8) === 'IDAT') idat.push(buffer.subarray(at + 8, at + 8 + length));
    at += 12 + length;
  }
  const rows = inflateSync(Buffer.concat(idat));
  return { width, height, pixel: (x, y) => rows[y * (width + 1) + 1 + x] };
}

test('QR in SVG carries the CC Lab mark in the middle', () => {
  const svg = qrSvg(LINK);
  assert.equal(svg.match(/<svg/g).length, 1);
  assert.match(svg, /class="qr-mark"/);
  assert.ok(svg.includes(MARK.paths));
});

test('QR uses high error correction, so the mark does not break scanning', () => {
  const high = QRCode.create(LINK, { errorCorrectionLevel: 'H' }).modules.size;
  const medium = QRCode.create(LINK, { errorCorrectionLevel: 'M' }).modules.size;
  assert.notEqual(high, medium, 'this link must need a bigger code at H than at M for the check to mean anything');
  const [, side] = /viewBox="0 0 (\d+) \d+"/.exec(qrSvg(LINK, { margin: 1 }));
  assert.equal(Number(side), high + 2);
});

test('QR PNG for the print size is drawn fast enough not to stall the server', () => {
  const started = performance.now();
  qrPng(LINK, { width: 1024 });
  assert.ok(performance.now() - started < 400, 'a 1024 px QR takes under 0.4 s');
});

test('QR PNG has the requested size, a quiet zone and the mark on a white box in the centre', () => {
  const png = readPng(qrPng(LINK, { width: 512 }));
  assert.equal(png.width, 512);
  assert.equal(png.height, 512);
  assert.equal(png.pixel(3, 3), 255);
  const centre = [];
  for (let dy = -40; dy <= 40; dy += 1) {
    for (let dx = -40; dx <= 40; dx += 1) centre.push(png.pixel(256 + dx, 256 + dy));
  }
  assert.ok(centre.some((value) => value < 64), 'the mark is drawn');
  assert.ok(centre.some((value) => value > 240), 'there is white space around the mark');
});
