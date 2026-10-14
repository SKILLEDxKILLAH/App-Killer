/// <reference types="node" />
// Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BLOCKS } from './blocks';
import { newBio, newBlock } from './factory';
import { escapeForTemplateLiteral, esc, minify, prettyHtml, st } from './html';
import { lintBio, lintHtml } from './lint';
import { exportBio, renderBio } from './render';
import { THEMES } from './themes';

test('st() refuses properties JAI strips', () => {
  assert.throws(() => st({ position: 'absolute' }));
  assert.throws(() => st({ 'z-index': 2 }));
  assert.equal(st({ color: '#fff', margin: undefined, padding: 0 }), 'color:#fff;padding:0');
});

test('esc() defuses the literal z-index text', () => {
  assert.ok(!/z-index/i.test(esc('a z-index b')));
});

test('template literal escaping', () => {
  assert.equal(escapeForTemplateLiteral('press `tab` ${x} \\n'), 'press \\`tab\\` \\${x} \\\\n');
});

test('minify keeps inline spacing between spans and strips comments', () => {
  const out = minify('<div>\n  <!-- note -->\n  <span>a</span> <span>b</span>\n</div>');
  assert.equal(out, '<div><span>a</span> <span>b</span></div>');
  assert.equal(minify('<p style=" color : red ; margin: 0 ; ">x</p>'), '<p style="color:red;margin:0">x</p>');
});

for (const theme of THEMES) {
  test(`full kit in ${theme.name} renders clean, balanced, rule-abiding HTML`, () => {
    const bio = newBio('Test', theme.id, 'full');
    // add every element type so all renderers are exercised
    for (const def of BLOCKS) bio.blocks.push(newBlock(def.type));
    const html = renderBio(bio);
    const errors = lintHtml(html).filter((f) => f.severity === 'error');
    assert.deepEqual(errors, [], JSON.stringify(errors, null, 2));
    assert.ok(!/position\s*:/i.test(html.replace(/background-position|object-position/gi, '')));
    assert.ok(!/<style|<script|<link/i.test(html));
    // pretty output round-trips to the same compact HTML
    assert.equal(minify(prettyHtml(html)), html);
  });
}

test('lint catches stripped things in custom HTML', () => {
  const bio = newBio('X', THEMES[0].id, 'blank');
  bio.blocks.push(newBlock('customHtml', { html: '<style>p{}</style><div style="position:absolute;width:100vw">z-index</div><div>' }));
  const titles = lintBio(bio).map((f) => f.title);
  for (const t of ['<style> tag', 'position', 'The word “z-index”', 'Viewport units (vw/vh)', 'Unbalanced <div>']) {
    assert.ok(titles.includes(t), `expected finding ${t}; got ${titles.join(', ')}`);
  }
});

test('lint flags bad image and audio links', () => {
  const bio = newBio('X', THEMES[0].id, 'blank');
  bio.blocks.push(newBlock('banner', { image: 'file:///Users/me/pic.png' }));
  bio.blocks.push(newBlock('music', { audio: 'https://example.com/song.wav' }));
  const titles = lintBio(bio).map((f) => f.title);
  assert.ok(titles.includes('Banner: image link'));
  assert.ok(titles.includes('Music Player: audio link'));
});

test('console export is a valid template literal body', () => {
  const bio = newBio('X', THEMES[0].id, 'full');
  bio.blocks.push(newBlock('customHtml', { html: '<p>press `tab`</p>' }));
  const out = exportBio(bio, 'console');
  const roundTrip = new Function('return `' + out + '`;')();
  assert.equal(roundTrip, exportBio(bio, 'minified'));
});

test('placeholder art never reaches the export, but shows in the preview', () => {
  const bio = newBio('X', THEMES[0].id, 'full');
  const out = renderBio(bio);
  assert.ok(!out.includes('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22900'), 'banner placeholder leaked');
  assert.ok(!/<img[^>]*src=""/.test(out), 'empty img left in export');
  assert.ok(!/Add an image|Banner %E2/.test(out));
  assert.ok(renderBio(bio, { preview: true }).includes('data-tq='));
  assert.ok(renderBio(bio, { preview: true }).length > out.length);
});
