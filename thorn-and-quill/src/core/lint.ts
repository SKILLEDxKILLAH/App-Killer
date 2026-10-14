// "Rules of the Realm" — checks a bio against what the two field guides say JanitorAI keeps,
// strips, or breaks on.

import { BLOCK_MAP } from './blocks';
import { ALLOWED_FONT_NAMES } from './fonts';
import { renderBio } from './render';
import type { Bio, FieldSpec, Props } from './types';

export type Severity = 'error' | 'warn' | 'info';

export interface Finding {
  severity: Severity;
  title: string;
  detail: string;
  /** Element the finding belongs to, when known. */
  blockId?: string;
  /** Which guide the rule comes from. */
  source: 'DelightfulTempe' | 'Forgeworks/105th' | 'Thorn & Quill';
}

const KNOWN_IMAGE_HOSTS = ['ella.janitorai.com', 'files.catbox.moe', 'image2url.com', 'www.image2url.com', 'i.ibb.co', 'i.imgur.com'];
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i;

function checkImageUrl(url: string): string | null {
  const u = url.trim();
  if (!u) return null;
  if (u.startsWith('data:')) return null;
  if (!/^https:\/\//i.test(u)) return 'Image links must start with https:// and already be online — a file on your device will not show.';
  let host = '';
  try {
    host = new URL(u).hostname.toLowerCase();
  } catch {
    return 'This does not look like a valid link.';
  }
  if (!IMAGE_EXT.test(u) && !KNOWN_IMAGE_HOSTS.some((h) => host === h || host.endsWith('.' + h))) {
    return 'This may not be a direct image link (it does not end in .png/.jpg/.gif/.webp). Use the “copy image address” link, or host it on catbox / image2url / your JAI media tab.';
  }
  return null;
}

function walkFields(fields: FieldSpec[], props: Props, visit: (f: FieldSpec, value: any) => void) {
  for (const f of fields) {
    const v = props[f.key];
    if (f.kind === 'list' && Array.isArray(v) && f.itemFields) {
      for (const item of v) walkFields(f.itemFields, item, visit);
    } else {
      visit(f, v);
    }
  }
}

export function lintHtml(html: string): Finding[] {
  const out: Finding[] = [];
  const add = (severity: Severity, title: string, detail: string, source: Finding['source'] = 'DelightfulTempe') =>
    out.push({ severity, title, detail, source });

  const css = (html.match(/style="[^"]*"/gi) || []).join(';');
  if (/<style[\s>]/i.test(html)) add('error', '<style> tag', 'JAI’s server strips <style> tags entirely. Use inline style="…" instead.');
  if (/<script[\s>]/i.test(html)) add('error', '<script> tag', 'Scripts are stripped by the server.');
  if (/<link[\s>]/i.test(html)) add('error', '<link> tag', 'Custom fonts and stylesheets via <link> do not survive the server. Use one of the 14 JAI fonts.');
  if (/(^|[;"'\s])position\s*:/i.test(css)) add('error', 'position', '`position` is stripped by the server (all values). Elements can’t overlap — use negative margins, clip-path or SVG backgrounds to fake layering.');
  if (/z-index/i.test(html)) add('error', 'The word “z-index”', 'The server deletes the literal text “z-index” anywhere — even in normal text — leaving garbage behind. Remove it.');
  if (/(^|[;"'\s])animation(-name)?\s*:/i.test(css) || /@keyframes/i.test(html))
    add('warn', 'Animation', 'Without a <style> tag you can’t define @keyframes. JAI’s own keyframe names are hashed and change on updates, so animations are not reliable.');
  if (/\d\s*(vw|vh)\b/i.test(css)) add('warn', 'Viewport units (vw/vh)', 'Sizes like 100vw can overflow the bio container and break the page for visitors. Prefer % or max-width.');
  if (/<p\b[^>]*style="[^"]*display\s*:\s*grid/i.test(html)) add('warn', 'Grid on <p>', '`display:grid` only works correctly on <div> elements, not <p>.');
  if (/<(iframe|object|embed|form|input|button)\b/i.test(html)) add('warn', 'Interactive/embedded tags', 'Iframes, forms and buttons are unlikely to survive or work in a bio.', 'Thorn & Quill');
  if (/javascript:/i.test(html)) add('error', 'javascript: link', 'Blocked by JAI’s Content Security Policy.');
  if (/backdrop-filter/i.test(css))
    add('info', 'backdrop-filter', 'Works per DelightfulTempe’s testing, but the Forgeworks templates avoid it. Layered rgba() fills are a zero-risk alternative.', 'Forgeworks/105th');

  // fonts
  const fontRe = /font-family\s*:\s*([^;"]+)/gi;
  const unknown = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = fontRe.exec(css))) {
    for (const raw of m[1].split(',')) {
      const name = raw.trim().replace(/^['"]|['"]$/g, '').toLowerCase();
      if (name && !ALLOWED_FONT_NAMES.has(name)) unknown.add(raw.trim());
    }
  }
  if (unknown.size)
    add('warn', 'Font not loaded by JAI', `${[...unknown].join(', ')} — JAI only loads 14 font families; anything else falls back to a default font.`);

  // balanced tags
  for (const tag of ['div', 'details', 'p', 'span']) {
    const opens = (html.match(new RegExp(`<${tag}\\b`, 'gi')) || []).length;
    const closes = (html.match(new RegExp(`</${tag}>`, 'gi')) || []).length;
    if (opens !== closes)
      add('error', `Unbalanced <${tag}>`, `${opens} opening vs ${closes} closing. “Boxes need lids” — a missing </${tag}> swallows everything after it.`, 'Forgeworks/105th');
  }

  // svg data uris
  if (/data:image\/svg\+xml,[^'")]*[#"]/i.test(html))
    add('warn', 'SVG data URI encoding', 'Inside data:image/svg+xml,… every " must be %22 and every # must be %23, or the background disappears.', 'Forgeworks/105th');

  // gallery track misuse (custom HTML)
  if (/scroll-snap-type[^"]*"[^>]*>/i.test(html) && /overflow-x\s*:\s*auto[^"]*display\s*:\s*flex|display\s*:\s*flex[^"]*overflow-x\s*:\s*auto/i.test(html))
    add('warn', 'Flex inside a swipe gallery', 'Do NOT use flex inside the gallery track — it breaks the swipe. Use white-space:nowrap on the track and inline-block cards.', 'Forgeworks/105th');

  return out;
}

export function lintBio(bio: Bio): Finding[] {
  const out: Finding[] = [];
  for (const block of bio.blocks) {
    if (block.hidden) continue;
    const def = BLOCK_MAP[block.type];
    if (!def) continue;
    let missingImages = 0;
    walkFields(def.fields, block.props, (f, v) => {
      if (f.kind === 'image') {
        if (!v || !String(v).trim()) missingImages++;
        else {
          const problem = checkImageUrl(String(v));
          if (problem) out.push({ severity: 'warn', title: `${def.name}: image link`, detail: problem, blockId: block.id, source: 'Forgeworks/105th' });
        }
      }
      if (f.kind === 'audio') {
        const s = String(v ?? '').trim();
        if (!s) out.push({ severity: 'warn', title: `${def.name}: no audio yet`, detail: 'Add a direct .mp3 link or the player will be empty.', blockId: block.id, source: 'Forgeworks/105th' });
        else if (!/^https:\/\//i.test(s) || !/\.mp3(\?.*)?$/i.test(s))
          out.push({ severity: 'warn', title: `${def.name}: audio link`, detail: 'Audio must be a direct https link ending in .mp3 (catbox works).', blockId: block.id, source: 'Forgeworks/105th' });
      }
      if ((f.kind === 'text' || f.kind === 'multiline') && typeof v === 'string' && /z-index/i.test(v)) {
        out.push({
          severity: 'info', title: `${def.name}: “z-index” in text`,
          detail: 'JAI deletes this word from any text. Thorn & Quill auto-swaps the hyphen for a look-alike so it survives.',
          blockId: block.id, source: 'DelightfulTempe',
        });
      }
    });
    if (missingImages)
      out.push({
        severity: 'info', title: `${def.name}: ${missingImages} image${missingImages > 1 ? 's' : ''} still a placeholder`,
        detail: 'Shown as placeholder art in the preview and left out of the export until you paste a hosted image link.', blockId: block.id, source: 'Thorn & Quill',
      });
  }

  const html = renderBio(bio);
  for (const f of lintHtml(html)) out.push(f);
  return out;
}

export function summarize(findings: Finding[]) {
  return {
    errors: findings.filter((f) => f.severity === 'error').length,
    warnings: findings.filter((f) => f.severity === 'warn').length,
    infos: findings.filter((f) => f.severity === 'info').length,
  };
}
