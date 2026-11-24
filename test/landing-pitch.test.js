import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QR_STYLES, qrStyledSvg } from '../src/qr-styles.js';
import { CATALOG } from '../src/tiers.js';
import { adminPost, issueCard, loginCookie, makeContext } from './helpers.js';

test('landing explains the idea, links to cclab.kz and invites flower shops', async (t) => {
  const { app } = makeContext(t);
  const body = await (await app.request('/')).text();
  assert.match(body, /class="site-link" href="https:\/\/cclab\.kz"/);
  assert.match(body, /Как это работает/);
  assert.equal((body.match(/class="step-num"/g) ?? []).length, 3);
  assert.match(body, /id="shops"/);
  assert.match(body, /href="https:\/\/wa\.me\/77754815992\?text=/);
  assert.match(body, /Проект <b>CC Lab<\/b>/);
  assert.match(body, new RegExp(`href="/demo/${CATALOG[0].id}"`));
  assert.equal((body.match(/class="tpl-link"/g) ?? []).length, CATALOG.length);
});

test('pitch page shows slides, live demo phones that load lazily and a QR to the site', async (t) => {
  const { app } = makeContext(t);
  const res = await app.request('/pitch');
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.equal((body.match(/data-slide /g) ?? []).length, 8);
  assert.match(body, /<iframe data-src="\/demo\/love"/);
  assert.doesNotMatch(body, /<iframe src=/, 'demos load only when their slide is near');
  assert.match(body, /data-note="Сәлеметсіздер ме!/);
  assert.match(body, /src="\/static\/js\/pitch\.js/);

  const qr = await app.request('/pitch/qr.svg');
  assert.equal(qr.headers.get('content-type'), 'image/svg+xml');
  assert.match(await qr.text(), /^<svg/);
});

test('the site may frame its own pages (for the pitch) but nobody else may', async (t) => {
  const { app } = makeContext(t);
  const policy = (await app.request('/pitch')).headers.get('content-security-policy');
  assert.match(policy, /frame-ancestors 'self'/);
  assert.match(policy, /frame-src 'self' /);
});

test('every QR style keeps the mark, three finder eyes and its own gradient id', () => {
  const url = 'https://gift.cclab.kz/c/abcdefghjkmn';
  for (const id of Object.keys(QR_STYLES)) {
    const svg = qrStyledSvg(url, id);
    assert.match(svg, /^<svg[^>]+viewBox="0 0 \d+ \d+"/, id);
    assert.match(svg, /M229\.8 1L320\.2 79/, `${id}: the CC Lab mark is in the middle`);
    if (QR_STYLES[id].colors.length > 1) assert.match(svg, new RegExp(`id="qr-fill-${id}"`), id);
  }
  assert.equal(qrStyledSvg(url, 'no-such-style'), qrStyledSvg(url, 'classic'));
});

test('print page and single code download use the chosen QR style', async (t) => {
  const { app, repo } = makeContext(t);
  const cookie = await loginCookie(app);
  await adminPost(app, '/admin/batches', cookie, { quantity: '2' });
  const [batch] = repo.listBatches();
  const insta = await (await app.request(`/admin/batches/${batch.id}/print?style=insta`, { headers: { cookie } })).text();
  assert.equal((insta.match(/id="qr-fill-insta"/g) ?? []).length, 2);
  assert.match(insta, /href="\?style=insta" aria-current="true"/);
  const classic = await (await app.request(`/admin/batches/${batch.id}/print?style=<script>`, { headers: { cookie } })).text();
  assert.equal((classic.match(/class="qr-mark"/g) ?? []).length, 2, 'unknown style falls back to the classic code');

  const code = issueCard(repo, 'zzzzzzzzzzzz');
  const res = await app.request(`/admin/cards/${code}/qr.svg?style=telegram`, { headers: { cookie } });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-disposition'), /qr-zzzzzzzzzzzz-telegram\.svg/);
  assert.match(await res.text(), /qr-fill-telegram/);
  assert.equal((await app.request(`/admin/cards/${code}/qr.svg`)).status, 302, 'download needs a login');
});
