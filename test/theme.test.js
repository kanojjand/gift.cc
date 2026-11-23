import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { issueCard, makeContext } from './helpers.js';

const APP_CSS = fileURLToPath(new URL('../public/css/app.css', import.meta.url));

test('buyer pages start light and offer a switch to the dark theme', async (t) => {
  const { app, repo } = makeContext(t);
  const code = issueCard(repo);
  for (const path of [`/c/${code}`, `/c/${code}?template=birthday`]) {
    const body = await (await app.request(path)).text();
    assert.match(body, /<html lang="ru">/, `${path}: the server does not force a theme`);
    assert.match(body, /<script src="[^"]*js\/theme\.js[^"]*"><\/script>/, `${path}: theme script runs before paint`);
    assert.match(body, /data-theme-toggle/, `${path}: has the theme switch`);
  }
});

test('app styles are light unless the dark theme is chosen', () => {
  const css = readFileSync(APP_CSS, 'utf8');
  const [, root] = /:root\s*\{([^}]*)\}/.exec(css);
  assert.match(root, /color-scheme:\s*light/);
  assert.match(css, /:root\[data-theme="dark"\]\s*\{[^}]*color-scheme:\s*dark/);
});
