// The element library. Each element knows its editable fields, sensible defaults and how to
// render itself as JAI-safe inline-styled HTML.
//
// Recipes follow the two field guides:
//  - Forgeworks/105th "19-element kit": banner, hook, warning, pills, premise, divider, character
//    dropdown (<details>/<summary>), nested whispers, swipe gallery, stat chips, stat bars,
//    relationship rows, quote, polaroid, music player, voice note, routes, footer.
//  - DelightfulTempe snippets: pill badges, two-column grid (on <div> only), SVG divider,
//    frosted glass, gradient border, clipped diagonal, layered gradient, multi-column text.

import { alpha, luminance } from './color';
import { fontStack } from './fonts';
import { attrUrl, cssUrl, esc, paragraphs, rich, st, svgDataUri, toRoman } from './html';
import type { BioTheme, BlockDef, FieldSpec, Props } from './types';

// ─── shared helpers ────────────────────────────────────────────────────────────

const mb = (p: Props) => `${p.spaceBelow ?? 1.2}rem`;
const or = <T,>(v: T | '' | undefined | null, fallback: T): T => (v === '' || v === undefined || v === null ? fallback : v);
const font = (p: Props, key: string, t: BioTheme, token: 'display' | 'body' | 'label') => fontStack(or(p[key], t.fonts[token]));
/** A darkening wash on dark themes, a soft accent tint on light ones. */
const shade = (t: BioTheme, a: number) => (luminance(t.colors.canvas) > 0.4 ? alpha(t.colors.accent, a * 0.3) : `rgba(0,0,0,${a})`);
const radius = (t: BioTheme, scale = 1) => `${Math.round(t.radius * scale)}px`;

function gradientText(from: string, to: string, angle = 180): Record<string, string> {
  return {
    background: `linear-gradient(${angle}deg, ${from}, ${to})`,
    '-webkit-background-clip': 'text',
    'background-clip': 'text',
    '-webkit-text-fill-color': 'transparent',
  };
}

/** Theme-tinted placeholder art so an empty image slot still previews nicely. */
export function placeholderImage(t: BioTheme, w = 600, h = 300, label = 'Add an image'): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.colors.canvas}"/><stop offset="1" stop-color="${alpha(t.colors.accent2, 0.55)}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><text x="50%" y="50%" fill="${t.colors.accent}" font-family="Georgia, serif" font-size="${Math.round(Math.min(w, h) / 9)}" text-anchor="middle" dominant-baseline="middle">${t.ornament} ${label} ${t.ornament}</text></svg>`;
  return svgDataUri(svg).slice(5, -2); // strip url(' … ')
}

// Placeholder art is drawn only in the in-app preview. Exported HTML never carries it:
// empty <img> tags are removed and empty backgrounds fall back to a soft theme tint.
let placeholders = false;

/** Run `fn` with preview placeholders on or off (rendering is synchronous). */
export function withPlaceholders<T>(on: boolean, fn: () => T): T {
  const prev = placeholders;
  placeholders = on;
  try {
    return fn();
  } finally {
    placeholders = prev;
  }
}

const hasImg = (url: string | undefined) => !!(url && url.trim());
/** Keep list items that have an image (all of them while previewing). */
const withImage = (items: Props[] | undefined) => ((items || []) as Props[]).filter((x) => placeholders || hasImg(x.image));
const imgSrc = (url: string | undefined, t: BioTheme, w?: number, h?: number, label?: string) =>
  hasImg(url) ? attrUrl(url) : placeholders ? placeholderImage(t, w, h, label) : '';
const bgImg = (url: string | undefined, t: BioTheme, w?: number, h?: number) =>
  hasImg(url)
    ? `url('${cssUrl(url)}')`
    : placeholders
      ? `url('${placeholderImage(t, w, h, '')}')`
      : `linear-gradient(135deg, ${alpha(t.colors.accent, 0.35)}, ${alpha(t.colors.accent2, 0.35)})`;

function textParas(text: string, style: string, firstPrefix = ''): string {
  return paragraphs(text)
    .map((para, i) => `<p style="${style}">${i === 0 ? firstPrefix : ''}${rich(para)}</p>`)
    .join('');
}

// Common fields appended to every element.
const spaceBelow: FieldSpec = { key: 'spaceBelow', label: 'Space below', kind: 'number', min: 0, max: 4, step: 0.1, unit: 'rem', group: 'Layout' };
const outside: FieldSpec = {
  key: 'outside', label: 'Place above the card', kind: 'toggle', group: 'Layout',
  help: 'Renders this element before the framed card, like the banner in the Forgeworks templates.',
};

const align: FieldSpec = {
  key: 'align', label: 'Alignment', kind: 'select', group: 'Layout',
  options: [{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }],
};

const color = (key: string, label: string, token: FieldSpec['themeToken'], help?: string): FieldSpec => ({
  key, label, kind: 'color', themeToken: token, group: 'Style', help,
});
const fontField = (key: string, label: string, token: 'display' | 'body' | 'label'): FieldSpec => ({
  key, label, kind: 'font', themeToken: token, group: 'Style',
});
const num = (key: string, label: string, min: number, max: number, step: number, unit = '', group: FieldSpec['group'] = 'Style'): FieldSpec => ({
  key, label, kind: 'number', min, max, step, unit, group,
});
const toggle = (key: string, label: string, help?: string, group: FieldSpec['group'] = 'Style'): FieldSpec => ({ key, label, kind: 'toggle', help, group });
const select = (key: string, label: string, options: [string, string][], group: FieldSpec['group'] = 'Style', help?: string): FieldSpec => ({
  key, label, kind: 'select', group, help, options: options.map(([value, l]) => ({ value, label: l })),
});
const text = (key: string, label: string, placeholder?: string, help?: string): FieldSpec => ({ key, label, kind: 'text', group: 'Content', placeholder, help });
const multiline = (key: string, label: string, placeholder?: string, help?: string): FieldSpec => ({
  key, label, kind: 'multiline', group: 'Content', placeholder,
  help: help ?? 'Blank line = new paragraph. **bold**, *italic*, __underline__, ~~strike~~. {{char}} and {{user}} work as usual.',
});
const image = (key: string, label: string, help?: string): FieldSpec => ({
  key, label, kind: 'image', group: 'Content',
  help: help ?? 'Must be a direct link that is already online (ella.janitorai.com from your media tab, files.catbox.moe, image2url.com).',
});

// ─── element definitions ───────────────────────────────────────────────────────

const banner: BlockDef = {
  type: 'banner', name: 'Banner', flavor: 'The frontispiece', glyph: '▣', category: 'Opening', canSitOutside: true,
  description: 'A wide image that opens the bio.',
  fields: [
    image('image', 'Image link'),
    num('height', 'Height (0 = natural)', 0, 500, 10, 'px', 'Layout'),
    select('fit', 'Crop', [['cover', 'Fill & crop'], ['contain', 'Fit whole image']], 'Layout'),
    num('radius', 'Corner roundness', 0, 40, 1, 'px'),
    toggle('border', 'Gilded edge'),
    toggle('shadow', 'Drop shadow'),
    outside, spaceBelow,
  ],
  defaults: () => ({ image: '', height: 0, fit: 'cover', radius: 12, border: false, shadow: true, outside: true, spaceBelow: 1 }),
  summary: (p) => (p.image ? 'Image set' : 'No image yet'),
  render: (p, t) => {
    if (!placeholders && !hasImg(p.image)) return '';
    const h = Number(p.height) || 0;
    const img = st({
      width: '100%',
      display: 'block',
      height: h > 0 ? `${h}px` : undefined,
      'object-fit': h > 0 ? p.fit || 'cover' : undefined,
      'border-radius': `${p.radius ?? 12}px`,
      border: p.border ? `1px solid ${alpha(t.colors.accent, 0.6)}` : undefined,
      'box-shadow': p.shadow ? '0 12px 32px rgba(0,0,0,0.45)' : undefined,
    });
    return `<p style="${st({ 'text-align': 'center', margin: `0 0 ${mb(p)} 0` })}"><img alt="" src="${imgSrc(p.image, t, 900, 360, 'Banner')}" style="${img}"/></p>`;
  },
};

const title: BlockDef = {
  type: 'title', name: 'Name Plate', flavor: 'A title worthy of a crown', glyph: '♛', category: 'Opening', canSitOutside: true,
  description: 'The character or story name with an optional subtitle line.',
  fields: [
    text('name', 'Name', 'Prince Caelan Vire'),
    text('subtitle', 'Subtitle', 'Heir of the Thorn Court · {{char}}'),
    fontField('font', 'Name font', 'display'),
    num('size', 'Name size', 1, 4.5, 0.1, 'rem'),
    color('color', 'Name colour', 'heading'),
    toggle('gradient', 'Gilded gradient text', 'Uses the background-clip:text recipe from the Royal Court template.'),
    { ...color('gradFrom', 'Gradient from', 'accent'), showIf: (p: Props) => !!p.gradient },
    { ...color('gradTo', 'Gradient to', 'accent2'), showIf: (p: Props) => !!p.gradient },
    num('glow', 'Glow', 0, 1, 0.05),
    toggle('uppercase', 'All caps'),
    num('tracking', 'Letter spacing', 0, 0.5, 0.01, 'em'),
    fontField('subFont', 'Subtitle font', 'label'),
    color('subColor', 'Subtitle colour', 'accent3'),
    align, outside, spaceBelow,
  ],
  defaults: () => ({
    name: 'Prince Caelan Vire', subtitle: 'Heir of the Thorn Court · {{char}}', font: '', size: 2.4, color: '', gradient: true,
    gradFrom: '', gradTo: '', glow: 0.35, uppercase: false, tracking: 0.02, subFont: '', subColor: '', align: 'center', outside: false, spaceBelow: 1.2,
  }),
  summary: (p) => p.name,
  render: (p, t) => {
    const from = or(p.gradFrom, t.colors.accent);
    const to = or(p.gradTo, t.colors.accent2);
    const glowColor = alpha(p.gradient ? from : or(p.color, t.colors.heading), 0.7);
    const glowPx = Math.round((Number(p.glow) || 0) * 22);
    const name = st({
      'font-family': font(p, 'font', t, 'display'),
      'font-size': `${p.size ?? 2.4}rem`,
      'font-weight': 700,
      'line-height': 1.15,
      'letter-spacing': `${p.tracking ?? 0}em`,
      'text-transform': p.uppercase ? 'uppercase' : undefined,
      color: p.gradient ? undefined : or(p.color, t.colors.heading),
      ...(p.gradient ? gradientText(from, to) : {}),
      'text-shadow': !p.gradient && glowPx ? `0 0 ${glowPx}px ${glowColor}` : undefined,
      filter: p.gradient && glowPx ? `drop-shadow(0 0 ${Math.round(glowPx / 2)}px ${alpha(glowColor, 0.6)})` : undefined,
    });
    const sub = p.subtitle
      ? `<div style="${st({
          'font-family': font(p, 'subFont', t, 'label'),
          'font-size': '0.72rem',
          'font-weight': 700,
          'letter-spacing': '0.25em',
          'text-transform': 'uppercase',
          color: or(p.subColor, t.colors.accent3),
          'margin-top': '0.55rem',
        })}">${esc(p.subtitle)}</div>`
      : '';
    return `<div style="${st({ 'text-align': p.align || 'center', margin: `0 0 ${mb(p)} 0` })}"><div style="${name}">${esc(p.name)}</div>${sub}</div>`;
  },
};

const hook: BlockDef = {
  type: 'hook', name: 'Hook Line', flavor: 'The first line of the blurb', glyph: '❝', category: 'Opening', canSitOutside: true,
  description: 'One sentence that makes readers stay.',
  fields: [
    text('text', 'Line', 'He swore to hate you. He did not swear to stop.'),
    toggle('quotes', 'Wrap in quotes', undefined, 'Content'),
    fontField('font', 'Font', 'display'),
    num('size', 'Size', 0.8, 2.4, 0.05, 'rem'),
    toggle('italic', 'Italic'),
    color('color', 'Colour', 'accent'),
    toggle('gradient', 'Gradient text'),
    { ...color('gradFrom', 'Gradient from', 'accent'), showIf: (p: Props) => !!p.gradient },
    { ...color('gradTo', 'Gradient to', 'accent3'), showIf: (p: Props) => !!p.gradient },
    align, outside, spaceBelow,
  ],
  defaults: () => ({
    text: 'He swore to hate you. He never swore to stop wanting you.', quotes: true, font: '', size: 1.15, italic: true, color: '',
    gradient: false, gradFrom: '', gradTo: '', align: 'center', outside: false, spaceBelow: 1.4,
  }),
  summary: (p) => p.text,
  render: (p, t) => {
    const s = st({
      'font-family': font(p, 'font', t, 'display'),
      'font-size': `${p.size ?? 1.15}rem`,
      'font-style': p.italic ? 'italic' : 'normal',
      'line-height': 1.5,
      color: p.gradient ? undefined : or(p.color, t.colors.accent),
      ...(p.gradient ? gradientText(or(p.gradFrom, t.colors.accent), or(p.gradTo, t.colors.accent3), 90) : {}),
    });
    const body = p.quotes ? `“${rich(p.text)}”` : rich(p.text);
    return `<p style="${st({ 'text-align': p.align || 'center', margin: `0 0 ${mb(p)} 0` })}"><span style="${s}">${body}</span></p>`;
  },
};

const chapter: BlockDef = {
  type: 'chapter', name: 'Chapter Heading', flavor: 'Turn the page', glyph: '§', category: 'Story',
  description: 'A section heading with a small kicker line, like a chapter opening.',
  fields: [
    text('kicker', 'Kicker', 'Chapter I'),
    text('title', 'Title', 'The Bargain'),
    fontField('font', 'Title font', 'display'),
    num('size', 'Title size', 1, 3, 0.05, 'rem'),
    color('color', 'Title colour', 'heading'),
    fontField('kickerFont', 'Kicker font', 'label'),
    color('kickerColor', 'Kicker colour', 'accent'),
    toggle('rule', 'Hairline under heading'),
    align, spaceBelow,
  ],
  defaults: () => ({
    kicker: 'Chapter I', title: 'The Bargain', font: '', size: 1.6, color: '', kickerFont: '', kickerColor: '', rule: true, align: 'center', spaceBelow: 1,
  }),
  summary: (p) => [p.kicker, p.title].filter(Boolean).join(' — '),
  render: (p, t) => {
    const a = p.align || 'center';
    const kicker = p.kicker
      ? `<div style="${st({
          'font-family': font(p, 'kickerFont', t, 'label'),
          'font-size': '0.68rem',
          'font-weight': 700,
          'letter-spacing': '0.3em',
          'text-transform': 'uppercase',
          color: or(p.kickerColor, t.colors.accent),
          'margin-bottom': '0.35rem',
        })}">${esc(p.kicker)}</div>`
      : '';
    const ttl = `<div style="${st({
      'font-family': font(p, 'font', t, 'display'),
      'font-size': `${p.size ?? 1.6}rem`,
      'font-weight': 700,
      'line-height': 1.2,
      color: or(p.color, t.colors.heading),
    })}">${esc(p.title)}</div>`;
    const ruleDir = a === 'center' ? '90deg, transparent, ' + alpha(t.colors.accent, 0.7) + ', transparent' : `${a === 'left' ? '90deg' : '270deg'}, ${alpha(t.colors.accent, 0.7)}, transparent`;
    const rule = p.rule ? `<div style="${st({ height: '1px', background: `linear-gradient(${ruleDir})`, 'margin-top': '0.7rem' })}"></div>` : '';
    return `<div style="${st({ 'text-align': a, margin: `0 0 ${mb(p)} 0` })}">${kicker}${ttl}${rule}</div>`;
  },
};

const warning: BlockDef = {
  type: 'warning', name: 'Content Warning', flavor: 'Here be dragons', glyph: '⚠', category: 'Opening',
  description: 'A small alert box for warnings and content notes.',
  fields: [
    text('label', 'Label', '⚠ Content Warning'),
    multiline('text', 'Warnings', 'Intrigue, betrayal, possessive royals…'),
    color('color', 'Colour', 'warn'),
    select('style', 'Style', [['boxed', 'Boxed'], ['bar', 'Accent bar'], ['minimal', 'Minimal']]),
    fontField('labelFont', 'Label font', 'label'),
    color('textColor', 'Text colour', 'text'),
    align, spaceBelow,
  ],
  defaults: () => ({
    label: '⚠ Content Warning', text: 'Enemies to lovers · court intrigue · morally grey royalty · possessive behaviour · all characters are 18+',
    color: '', style: 'boxed', labelFont: '', textColor: '', align: 'center', spaceBelow: 1.2,
  }),
  summary: (p) => p.text,
  render: (p, t) => {
    const c = or(p.color, t.colors.warn);
    const box = st({
      background: p.style === 'minimal' ? undefined : alpha(c, 0.08),
      border: p.style === 'boxed' ? `1px solid ${alpha(c, 0.4)}` : undefined,
      'border-left': p.style === 'bar' ? `3px solid ${c}` : undefined,
      'border-radius': p.style === 'minimal' ? undefined : radius(t, 0.75),
      padding: p.style === 'minimal' ? '0' : '0.9rem 1.2rem',
      margin: `0 0 ${mb(p)} 0`,
      'text-align': p.align || 'center',
    });
    const label = `<div style="${st({
      'font-family': font(p, 'labelFont', t, 'label'),
      'font-size': '0.7rem',
      'font-weight': 700,
      'letter-spacing': '0.25em',
      'text-transform': 'uppercase',
      color: c,
    })}">${esc(p.label)}</div>`;
    const body = `<div style="${st({ 'font-size': '0.85rem', 'line-height': 1.6, color: alpha(or(p.textColor, t.colors.text), 0.9), 'margin-top': '0.4rem' })}">${rich(p.text)}</div>`;
    return `<div style="${box}">${label}${body}</div>`;
  },
};

const tags: BlockDef = {
  type: 'tags', name: 'Tag Pills', flavor: 'Tropes, sealed in wax', glyph: '⬭', category: 'Opening',
  description: 'Genre and trope chips in a wrapping row.',
  fields: [
    {
      key: 'items', label: 'Tags', kind: 'list', group: 'Content', itemLabel: 'Tag', itemTitleKey: 'text', maxItems: 24,
      newItem: () => ({ text: 'New tag', color: '' }),
      itemFields: [
        { key: 'text', label: 'Text', kind: 'text' },
        { key: 'color', label: 'Colour (empty = cycle theme accents)', kind: 'color' },
      ],
    },
    select('shape', 'Shape', [['pill', 'Pill'], ['seal', 'Seal (sharp)'], ['soft', 'Soft square'], ['leaf', 'Leaf']]),
    select('variant', 'Fill', [['tint', 'Tinted glass'], ['solid', 'Solid'], ['outline', 'Outline only']]),
    toggle('uppercase', 'All caps'),
    fontField('font', 'Font', 'label'),
    num('size', 'Text size', 0.55, 1.2, 0.01, 'rem'),
    select('justify', 'Alignment', [['center', 'Center'], ['flex-start', 'Left'], ['flex-end', 'Right']], 'Layout'),
    spaceBelow,
  ],
  defaults: () => ({
    items: [{ text: 'Enemies to Lovers' }, { text: 'Slow Burn' }, { text: 'Fae Court' }, { text: 'Forbidden' }, { text: 'Arranged Marriage' }].map((x) => ({ ...x, color: '' })),
    shape: 'pill', variant: 'tint', uppercase: true, font: '', size: 0.7, justify: 'center', spaceBelow: 1.4,
  }),
  summary: (p) => (p.items || []).map((x: Props) => x.text).join(' · '),
  render: (p, t) => {
    const cycle = [t.colors.accent, t.colors.accent2, t.colors.accent3];
    const r = { pill: '999px', seal: '0', soft: '6px', leaf: '12px 0 12px 0' }[p.shape as string] ?? '999px';
    const pills = (p.items || [])
      .filter((x: Props) => x.text)
      .map((x: Props, i: number) => {
        const c = or(x.color, cycle[i % cycle.length]);
        const s = st({
          display: 'inline-block',
          background: p.variant === 'solid' ? c : p.variant === 'outline' ? 'transparent' : alpha(c, 0.1),
          color: p.variant === 'solid' ? t.colors.canvas : c,
          border: `1px solid ${p.variant === 'solid' ? c : alpha(c, 0.5)}`,
          'border-radius': r,
          padding: '0.32rem 0.9rem',
          'font-family': font(p, 'font', t, 'label'),
          'font-size': `${p.size ?? 0.7}rem`,
          'font-weight': 700,
          'letter-spacing': '0.08em',
          'text-transform': p.uppercase ? 'uppercase' : undefined,
        });
        return `<span style="${s}">${esc(x.text)}</span>`;
      })
      .join('');
    return `<div style="${st({ display: 'flex', 'flex-wrap': 'wrap', gap: '0.45rem', 'justify-content': p.justify || 'center', margin: `0 0 ${mb(p)} 0` })}">${pills}</div>`;
  },
};

const prose: BlockDef = {
  type: 'prose', name: 'Story Text', flavor: 'The blurb on the back cover', glyph: '¶', category: 'Story',
  description: 'Premise or any body text — boxed or open, with drop cap and columns.',
  fields: [
    text('heading', 'Heading (optional)', 'The Premise'),
    multiline('text', 'Text'),
    toggle('dropCap', 'Illuminated drop cap', undefined, 'Content'),
    select('box', 'Box', [['tinted', 'Tinted box'], ['bar', 'Accent bar box'], ['open', 'No box']]),
    num('columns', 'Columns', 1, 3, 1, '', 'Layout'),
    fontField('font', 'Font', 'body'),
    num('size', 'Text size', 0.75, 1.3, 0.01, 'rem'),
    num('lineHeight', 'Line height', 1.2, 2.4, 0.05),
    color('color', 'Text colour', 'text'),
    color('headingColor', 'Heading colour', 'accent'),
    { ...color('dropCapFrom', 'Drop cap gold (from)', 'accent'), showIf: (p: Props) => !!p.dropCap },
    { ...color('dropCapTo', 'Drop cap gold (to)', 'accent2'), showIf: (p: Props) => !!p.dropCap },
    select('textAlign', 'Text alignment', [['left', 'Left'], ['justify', 'Justified'], ['center', 'Center']], 'Layout'),
    spaceBelow,
  ],
  defaults: () => ({
    heading: 'The Premise',
    text:
      'Three winters ago, {{user}} cut the Thorn Prince’s bargain-mark from their own wrist and fled his court. Now the High Queen has named a successor — and the only way to keep {{char}} off the throne is to stand beside him as his betrothed.\n\nHe remembers every lie you told. He has not forgotten a single one of your kisses, either.',
    dropCap: true, box: 'bar', columns: 1, font: '', size: 0.95, lineHeight: 1.85, color: '', headingColor: '', dropCapFrom: '', dropCapTo: '',
    textAlign: 'left', spaceBelow: 1.4,
  }),
  summary: (p) => p.heading || (p.text || '').slice(0, 60),
  render: (p, t) => {
    const c = or(p.color, t.colors.text);
    const accent = or(p.headingColor, t.colors.accent);
    const box = st({
      background: p.box === 'open' ? undefined : t.colors.surface,
      border: p.box === 'open' ? undefined : `1px solid ${t.colors.border}`,
      'border-left': p.box === 'bar' ? `3px solid ${accent}` : undefined,
      'border-radius': p.box === 'open' ? undefined : radius(t, 0.75),
      padding: p.box === 'open' ? undefined : '1.1rem 1.3rem',
      margin: `0 0 ${mb(p)} 0`,
    });
    const heading = p.heading
      ? `<div style="${st({ 'font-family': fontStack(t.fonts.label), 'font-size': '0.7rem', 'font-weight': 700, 'letter-spacing': '0.25em', 'text-transform': 'uppercase', color: accent, 'margin-bottom': '0.6rem' })}">${esc(p.heading)}</div>`
      : '';
    const pStyle = st({
      'font-family': font(p, 'font', t, 'body'),
      'font-size': `${p.size ?? 0.95}rem`,
      'line-height': p.lineHeight ?? 1.85,
      color: c,
      'text-align': p.textAlign || 'left',
      margin: '0 0 0.8em 0',
    });
    let raw = String(p.text ?? '');
    let cap = '';
    if (p.dropCap) {
      const m = /^(\s*)([\p{L}\p{N}])/u.exec(raw);
      if (m) {
        raw = raw.slice(m[0].length);
        cap = `<span style="${st({
          float: 'left',
          'font-family': fontStack(t.fonts.display),
          'font-size': '3.2em',
          'font-weight': 700,
          'line-height': 0.8,
          margin: '0.12em 0.12em 0 0',
          ...gradientText(or(p.dropCapFrom, t.colors.accent), or(p.dropCapTo, t.colors.accent2)),
        })}">${esc(m[2])}</span>`;
      }
    }
    const cols = Math.max(1, Math.min(3, Number(p.columns) || 1));
    const body = textParas(raw, pStyle, cap);
    const wrapped = cols > 1 ? `<div style="${st({ 'column-count': cols, 'column-gap': '1.6rem' })}">${body}</div>` : body;
    return `<div style="${box}">${heading}${wrapped}</div>`;
  },
};

const divider: BlockDef = {
  type: 'divider', name: 'Divider', flavor: 'A flourish between chapters', glyph: '❦', category: 'Ornaments',
  description: 'Ornamental separators: flourish with label, gilded hairline, glyph row or SVG rule.',
  fields: [
    select('style', 'Style', [['flourish', 'Flourish & label'], ['line', 'Gilded hairline'], ['glyphs', 'Glyph row'], ['svg', 'SVG rule (Tempe snippet)']], 'Content'),
    text('label', 'Label', '❦ The Court ❦'),
    text('glyph', 'Glyph (empty = theme ornament)', '❦'),
    color('color', 'Colour', 'accent'),
    fontField('font', 'Label font', 'display'),
    num('thickness', 'Line thickness', 1, 4, 1, 'px'),
    spaceBelow,
  ],
  defaults: () => ({ style: 'flourish', label: 'The Court', glyph: '', color: '', font: '', thickness: 1, spaceBelow: 1.2 }),
  summary: (p) => `${p.style}${p.label ? ' · ' + p.label : ''}`,
  render: (p, t) => {
    const c = or(p.color, t.colors.accent);
    const g = or(p.glyph, t.ornament);
    const th = `${p.thickness ?? 1}px`;
    const wrap = `margin:0 0 ${mb(p)} 0`;
    if (p.style === 'line') {
      return `<div style="${st({ height: th, background: `linear-gradient(90deg, transparent, ${alpha(c, 0.8)}, transparent)`, margin: `0 0 ${mb(p)} 0` })}"></div>`;
    }
    if (p.style === 'glyphs') {
      return `<div style="${st({ 'text-align': 'center', color: c, 'letter-spacing': '0.8em', 'font-size': '0.9rem', margin: `0 0 ${mb(p)} 0` })}">${esc(`${g} ${g} ${g}`)}</div>`;
    }
    if (p.style === 'svg') {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="${p.thickness ?? 1}"><rect width="100%" height="${p.thickness ?? 1}" fill="${c}"/></svg>`;
      return `<p style="${st({
        'background-image': svgDataUri(svg),
        'background-repeat': 'no-repeat',
        'background-size': `100% ${th}`,
        'background-position': 'center',
        height: th,
        margin: `0 0 ${mb(p)} 0`,
      })}"></p>`;
    }
    const line = (dir: string) => `<div style="${st({ height: th, flex: 1, background: `linear-gradient(${dir}, transparent, ${alpha(c, 0.75)})` })}"></div>`;
    const label = p.label ? `${g} ${p.label} ${g}` : g;
    return `<div style="${st({ display: 'flex', 'align-items': 'center', gap: '0.8rem' })};${wrap}">${line('90deg')}<span style="${st({
      'font-family': font(p, 'font', t, 'display'),
      'font-size': '1.15rem',
      'font-style': 'italic',
      'font-weight': 700,
      color: c,
      'white-space': 'nowrap',
    })}">${esc(label)}</span>${line('270deg')}</div>`;
  },
};

const whisperFields: FieldSpec[] = [
  { key: 'name', label: 'Who whispers', kind: 'text' },
  { key: 'mood', label: 'Mood tag', kind: 'text', placeholder: 'jealous' },
  { key: 'image', label: 'Avatar link', kind: 'image' },
  { key: 'text', label: 'Whisper', kind: 'multiline' },
];

const character: BlockDef = {
  type: 'character', name: 'Character Dropdown', flavor: 'A portrait behind a curtain', glyph: '♞', category: 'Characters',
  description: 'Tap-to-open character card (<details>) with photo, avatar or plain header and optional nested “court whispers”.',
  fields: [
    text('name', 'Name', 'Caelan Vire'),
    text('subtitle', 'Subtitle', 'Crown Prince · 27 · {{char}}'),
    image('image', 'Portrait link'),
    multiline('body', 'Description'),
    select('header', 'Header style', [['photo', 'Photo header'], ['avatar', 'Round avatar'], ['plain', 'Text only']], 'Style'),
    { ...num('photoHeight', 'Photo header height', 100, 320, 10, 'px'), showIf: (p: Props) => p.header === 'photo' },
    text('openLabel', 'Open-pill label', 'Open ▾'),
    toggle('startOpen', 'Start opened', undefined, 'Layout'),
    toggle('nameGradient', 'Gilded name'),
    fontField('nameFont', 'Name font', 'display'),
    color('accent', 'Accent', 'accent'),
    { key: 'whispersTitle', label: 'Whispers title', kind: 'text', group: 'Content', placeholder: '🕯 Court Whispers' },
    {
      key: 'whispers', label: 'Whispers (nested dropdown)', kind: 'list', group: 'Content', itemLabel: 'Whisper', itemTitleKey: 'name', maxItems: 8,
      newItem: () => ({ name: 'Lady Morwen', mood: 'jealous', image: '', text: 'They say he burned the treaty the night you left.' }),
      itemFields: whisperFields,
    },
    spaceBelow,
  ],
  defaults: () => ({
    name: 'Caelan Vire', subtitle: 'Crown Prince · 27 · {{char}}', image: '',
    body:
      'Cold at court, colder in council, and unbearably warm the moment the doors close. Caelan rules the Thorn Court’s war table with a smile no one trusts — least of all {{user}}, who taught him how to wear it.\n\n**Likes:** midnight rides, poetry he will deny writing, being challenged.\n**Hates:** liars, the High Queen, how easily you still undo him.',
    header: 'photo', photoHeight: 180, openLabel: 'Open ▾', startOpen: false, nameGradient: true, nameFont: '', accent: '',
    whispersTitle: '🕯 Court Whispers',
    whispers: [
      { name: 'Lady Morwen', mood: 'jealous', image: '', text: 'They say he burned the treaty the night {{user}} left.' },
      { name: 'Sir Aldric', mood: 'loyal', image: '', text: 'He has kept your chambers exactly as you left them. Every candle.' },
    ],
    spaceBelow: 1.2,
  }),
  summary: (p) => [p.name, p.subtitle].filter(Boolean).join(' — '),
  render: (p, t) => {
    const a = or(p.accent, t.colors.accent);
    const nameStyle = st({
      'font-family': font(p, 'nameFont', t, 'display'),
      'font-size': p.header === 'photo' ? '1.8rem' : '1.3rem',
      'font-weight': 700,
      'line-height': 1.15,
      color: p.nameGradient ? undefined : t.colors.heading,
      ...(p.nameGradient ? gradientText(blendHex(a, '#ffffff', 0.55), a) : {}),
      'text-shadow': !p.nameGradient && p.header === 'photo' ? '0 2px 8px rgba(0,0,0,0.8)' : undefined,
    });
    const subStyle = st({
      'font-family': fontStack(t.fonts.label),
      'font-size': '0.66rem',
      'letter-spacing': '0.2em',
      'text-transform': 'uppercase',
      color: t.colors.accent3,
      'margin-top': '0.35rem',
    });
    const pill = p.openLabel
      ? `<span style="${st({
          'font-family': fontStack(t.fonts.label),
          'font-size': '0.6rem',
          'font-weight': 700,
          'letter-spacing': '0.15em',
          color: t.colors.canvas,
          background: a,
          'border-radius': '999px',
          padding: '0.3rem 0.75rem',
          'white-space': 'nowrap',
        })}">${esc(p.openLabel)}</span>`
      : '';
    const nameBlock = `<div style="min-width:0"><div style="${nameStyle}">${esc(p.name)}</div>${p.subtitle ? `<div style="${subStyle}">${esc(p.subtitle)}</div>` : ''}</div>`;

    let summary: string;
    if (p.header === 'photo') {
      const h = Number(p.photoHeight) || 180;
      summary = `<summary style="cursor:pointer;display:block;padding:0"><div style="${st({
        height: `${h}px`,
        background: `linear-gradient(to bottom, ${alpha(t.colors.canvas, 0.05)} 0%, ${alpha(t.colors.canvas, 0.6)} 55%, ${t.colors.canvas} 100%), ${bgImg(p.image, t, 700, h)}`,
        'background-size': 'cover',
        'background-position': 'center',
        display: 'flex',
        'justify-content': 'space-between',
        'align-items': 'flex-end',
        gap: '1rem',
        padding: '1.1rem 1.3rem',
        'box-sizing': 'border-box',
      })}">${nameBlock}${pill}</div></summary>`;
    } else if (p.header === 'avatar') {
      summary = `<summary style="${st({ cursor: 'pointer', display: 'flex', 'align-items': 'center', gap: '0.8rem', padding: '0.9rem 1.2rem' })}"><img alt="" src="${imgSrc(p.image, t, 120, 120, '')}" style="${st({
        width: '56px', height: '56px', 'min-width': '56px', 'border-radius': '50%', 'object-fit': 'cover', border: `2px solid ${alpha(a, 0.7)}`,
      })}"/><div style="flex:1;min-width:0">${`<div style="${nameStyle}">${esc(p.name)}</div>`}${p.subtitle ? `<div style="${subStyle}">${esc(p.subtitle)}</div>` : ''}</div>${pill}</summary>`;
    } else {
      summary = `<summary style="${st({ cursor: 'pointer', display: 'flex', 'align-items': 'center', 'justify-content': 'space-between', gap: '0.8rem', padding: '0.9rem 1.2rem' })}">${nameBlock}${pill}</summary>`;
    }

    const whispers = (p.whispers || []) as Props[];
    const whisperHtml = whispers.length
      ? `<details style="${st({
          background: shade(t, 0.25),
          border: `1px solid ${alpha(t.colors.accent2, 0.4)}`,
          'border-top': `2px solid ${t.colors.accent2}`,
          'border-radius': radius(t, 0.7),
          margin: '0.8rem 0 0.9rem 0',
        })}"><summary style="${st({ cursor: 'pointer', padding: '0.6rem 0.8rem', 'font-family': fontStack(t.fonts.label), 'font-size': '0.72rem', 'font-weight': 700, 'letter-spacing': '0.15em', 'text-transform': 'uppercase', color: t.colors.accent2 })}">${esc(
          or(p.whispersTitle, '🕯 Court Whispers'),
        )}</summary><div style="padding:0.2rem 0.8rem 0.8rem 0.8rem">${whispers
          .map(
            (w) => `<div style="${st({
              background: alpha(t.colors.accent2, 0.08),
              border: `1px solid ${alpha(t.colors.accent2, 0.25)}`,
              'border-radius': '14px 14px 14px 4px',
              padding: '0.55rem 0.7rem',
              'margin-top': '0.55rem',
            })}"><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><div style="${st({
              width: '22px', height: '22px', 'min-width': '22px', 'border-radius': '50%',
              background: `${bgImg(w.image, t, 60, 60)} center / cover no-repeat`, border: `1px solid ${a}`, 'box-sizing': 'border-box',
            })}"></div><span style="${st({ 'font-size': '0.75rem', 'font-weight': 700, color: a })}">${esc(w.name)}</span>${
              w.mood
                ? `<span style="${st({ 'font-size': '0.55rem', color: t.colors.accent3, border: `1px solid ${alpha(t.colors.accent3, 0.4)}`, 'border-radius': '10px', padding: '1px 7px' })}">${esc(w.mood)}</span>`
                : ''
            }</div><div style="${st({ 'font-size': '0.82rem', 'line-height': 1.55, color: t.colors.text, 'margin-top': '5px' })}">${rich(w.text)}</div></div>`,
          )
          .join('')}</div></details>`
      : '';

    const body = textParas(p.body, st({ 'font-family': fontStack(t.fonts.body), 'font-size': '0.92rem', 'line-height': 1.8, color: t.colors.text, margin: '0 0 0.8em 0' }));
    return `<details${p.startOpen ? ' open' : ''} style="${st({
      background: shade(t, 0.2),
      border: `1px solid ${alpha(a, 0.35)}`,
      'border-radius': radius(t),
      margin: `0 0 ${mb(p)} 0`,
      overflow: 'hidden',
    })}">${summary}<div style="${st({ padding: '1.1rem 1.3rem 0.6rem 1.3rem', 'border-top': `1px solid ${alpha(a, 0.2)}` })}">${whisperHtml}${body}</div></details>`;
  },
};

/** Blend two #rrggbb colours (returns `a` unchanged for other formats). */
function blendHex(a: string, b: string, k: number) {
  const pa = /^#([0-9a-f]{6})$/i.exec(a);
  const pb = /^#([0-9a-f]{6})$/i.exec(b);
  if (!pa || !pb) return a;
  const ch = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16);
  const out = [0, 2, 4].map((i) => Math.round(ch(pa[1], i) + (ch(pb[1], i) - ch(pa[1], i)) * k).toString(16).padStart(2, '0'));
  return `#${out.join('')}`;
}

const gallery: BlockDef = {
  type: 'gallery', name: 'Swipe Gallery', flavor: 'The portrait hall', glyph: '⧉', category: 'Media',
  description: 'Horizontally swipeable images. Uses the guide’s two rules — no flex inside the track.',
  fields: [
    text('label', 'Label', '🖼 Portrait Hall — swipe →'),
    {
      key: 'items', label: 'Images', kind: 'list', group: 'Content', itemLabel: 'Image', itemTitleKey: 'caption', maxItems: 12,
      newItem: () => ({ image: '', caption: 'Caption', muted: false }),
      itemFields: [
        { key: 'image', label: 'Image link', kind: 'image' },
        { key: 'caption', label: 'Caption', kind: 'text' },
        { key: 'muted', label: 'Cursed portrait (greyscale)', kind: 'toggle' },
      ],
    },
    select('frame', 'Frame', [['gilded', 'Gilded double frame'], ['polaroid', 'Polaroid'], ['plain', 'Plain rounded']]),
    select('aspect', 'Shape', [['3/4', 'Portrait 3:4'], ['1/1', 'Square'], ['4/3', 'Landscape 4:3'], ['16/9', 'Wide 16:9']]),
    num('cardWidth', 'Card width', 35, 90, 1, '%', 'Layout'),
    num('maxCard', 'Max card width', 120, 360, 10, 'px', 'Layout'),
    color('color', 'Accent', 'accent'),
    spaceBelow,
  ],
  defaults: () => ({
    label: '🖼 Portrait Hall — swipe →',
    items: [
      { image: '', caption: 'The coronation', muted: false },
      { image: '', caption: 'The night you fled', muted: false },
      { image: '', caption: 'The face nobody names', muted: true },
    ],
    frame: 'gilded', aspect: '3/4', cardWidth: 56, maxCard: 190, color: '', spaceBelow: 1.4,
  }),
  summary: (p) => `${(p.items || []).length} images`,
  render: (p, t) => {
    const c = or(p.color, t.colors.accent);
    const label = p.label
      ? `<div style="${st({ 'font-family': fontStack(t.fonts.label), 'font-size': '0.72rem', 'font-weight': 700, 'letter-spacing': '0.15em', color: c, margin: '0 0 0.6rem 0' })}">${esc(p.label)}</div>`
      : '';
    const frameStyle =
      p.frame === 'polaroid'
        ? st({ background: '#f3ece0', padding: '7px 7px 4px 7px', 'border-radius': '2px', 'box-shadow': '0 8px 20px rgba(0,0,0,0.5)' })
        : p.frame === 'plain'
          ? st({ 'border-radius': radius(t), overflow: 'hidden' })
          : st({ border: `3px double ${alpha(c, 0.65)}`, 'border-radius': '4px', padding: '5px', background: t.colors.canvas2, 'box-shadow': '0 10px 28px rgba(0,0,0,0.6)' });
    const capColor = p.frame === 'polaroid' ? '#6a4a3a' : t.colors.accent3;
    const cards = withImage(p.items)
      .map(
        (it) => `<div style="${st({
          display: 'inline-block',
          width: `${p.cardWidth ?? 56}%`,
          'max-width': `${p.maxCard ?? 190}px`,
          'margin-right': '12px',
          'vertical-align': 'top',
          'white-space': 'normal',
          'scroll-snap-align': 'center',
        })}"><div style="${frameStyle}"><img alt="" src="${imgSrc(it.image, t, 300, 400, '')}" style="${st({
          width: '100%',
          'aspect-ratio': p.aspect || '3/4',
          'object-fit': 'cover',
          display: 'block',
          'border-radius': p.frame === 'plain' ? radius(t) : '1px',
          filter: it.muted ? 'grayscale(0.6) brightness(0.7)' : undefined,
        })}"/>${
          it.caption
            ? `<div style="${st({ 'font-family': fontStack(t.fonts.display), 'font-size': '0.66rem', 'font-style': 'italic', color: it.muted ? t.colors.accent2 : capColor, 'text-align': 'center', padding: '6px 2px 2px 2px' })}">${esc(it.caption)}</div>`
            : ''
        }</div></div>`,
      )
      .join('');
    return `<div style="margin:0 0 ${mb(p)} 0">${label}<div style="${st({ 'overflow-x': 'auto', 'white-space': 'nowrap', 'padding-bottom': '12px', 'scroll-snap-type': 'x mandatory' })}">${cards}</div></div>`;
  },
};

const statChips: BlockDef = {
  type: 'statChips', name: 'Stat Chips', flavor: 'Name, rank and secrets', glyph: '▤', category: 'Characters',
  description: 'Quick facts in small accent-bar chips.',
  fields: [
    {
      key: 'items', label: 'Facts', kind: 'list', group: 'Content', itemLabel: 'Fact', itemTitleKey: 'label', maxItems: 16,
      newItem: () => ({ label: 'Label', value: 'Value' }),
      itemFields: [
        { key: 'label', label: 'Label', kind: 'text' },
        { key: 'value', label: 'Value', kind: 'text' },
      ],
    },
    color('color', 'Accent', 'accent'),
    fontField('font', 'Font', 'label'),
    select('justify', 'Alignment', [['center', 'Center'], ['flex-start', 'Left'], ['flex-end', 'Right']], 'Layout'),
    spaceBelow,
  ],
  defaults: () => ({
    items: [{ label: 'Title', value: 'Crown Prince' }, { label: 'Age', value: '27' }, { label: 'Height', value: '6′3″' }, { label: 'Magic', value: 'Thornweaving' }, { label: 'Secret', value: '???' }],
    color: '', font: '', justify: 'center', spaceBelow: 1.4,
  }),
  summary: (p) => (p.items || []).map((x: Props) => x.label).join(' · '),
  render: (p, t) => {
    const c = or(p.color, t.colors.accent);
    const chips = ((p.items || []) as Props[])
      .map(
        (x) => `<span style="${st({
          'font-family': font(p, 'font', t, 'label'),
          'font-size': '0.72rem',
          color: t.colors.text,
          background: shade(t, 0.3),
          padding: '0.35rem 0.8rem',
          'border-left': `3px solid ${c}`,
          'border-radius': '0 6px 6px 0',
        })}"><b style="color:${c}">${esc(x.label)}</b> · ${esc(x.value)}</span>`,
      )
      .join('');
    return `<div style="${st({ display: 'flex', 'flex-wrap': 'wrap', 'justify-content': p.justify || 'center', gap: '0.5rem', margin: `0 0 ${mb(p)} 0` })}">${chips}</div>`;
  },
};

const statBars: BlockDef = {
  type: 'statBars', name: 'Stat Bars', flavor: 'Measures of a heart', glyph: '▰', category: 'Characters',
  description: 'Meters drawn with a track and a width-% fill.',
  fields: [
    text('heading', 'Heading (optional)', 'Temperament'),
    {
      key: 'items', label: 'Bars', kind: 'list', group: 'Content', itemLabel: 'Bar', itemTitleKey: 'label', maxItems: 12,
      newItem: () => ({ label: 'Devotion', value: 50, color: '' }),
      itemFields: [
        { key: 'label', label: 'Label', kind: 'text' },
        { key: 'value', label: 'Value', kind: 'number', min: 0, max: 100, step: 1, unit: '%' },
        { key: 'color', label: 'Colour (empty = cycle accents)', kind: 'color' },
      ],
    },
    select('columns', 'Layout', [['auto', 'Auto grid'], ['1', 'One column'], ['2', 'Two columns']], 'Layout'),
    num('height', 'Bar thickness', 4, 18, 1, 'px'),
    toggle('showValue', 'Show percentage'),
    fontField('font', 'Label font', 'label'),
    spaceBelow,
  ],
  defaults: () => ({
    heading: 'Temperament',
    items: [{ label: 'Power', value: 82, color: '' }, { label: 'Pride', value: 96, color: '' }, { label: 'Devotion to {{user}}', value: 100, color: '' }],
    columns: 'auto', height: 9, showValue: true, font: '', spaceBelow: 1.4,
  }),
  summary: (p) => (p.items || []).map((x: Props) => `${x.label} ${x.value}%`).join(' · '),
  render: (p, t) => {
    const cycle = [t.colors.accent, t.colors.accent2, t.colors.accent3];
    const cols = p.columns === '1' ? '1fr' : p.columns === '2' ? '1fr 1fr' : 'repeat(auto-fit, minmax(140px, 1fr))';
    const h = `${p.height ?? 9}px`;
    const bars = ((p.items || []) as Props[])
      .map((x, i) => {
        const c = or(x.color, cycle[i % cycle.length]);
        const v = Math.max(0, Math.min(100, Number(x.value) || 0));
        return `<div><div style="${st({ display: 'flex', 'justify-content': 'space-between', 'font-family': font(p, 'font', t, 'label'), 'font-size': '0.62rem', 'font-weight': 700, 'letter-spacing': '0.15em', 'text-transform': 'uppercase', color: c, 'margin-bottom': '0.3rem' })}"><span>${esc(x.label)}</span>${p.showValue ? `<span>${v}%</span>` : ''}</div><div style="${st({
          height: h, 'border-radius': '999px', background: shade(t, 0.35), border: `1px solid ${alpha(c, 0.35)}`, overflow: 'hidden',
        })}"><div style="${st({ width: `${v}%`, height: '100%', 'border-radius': '999px', background: `linear-gradient(90deg, ${alpha(c, 0.7)}, ${c})` })}"></div></div></div>`;
      })
      .join('');
    const heading = p.heading
      ? `<div style="${st({ 'font-family': fontStack(t.fonts.label), 'font-size': '0.7rem', 'font-weight': 700, 'letter-spacing': '0.25em', 'text-transform': 'uppercase', color: t.colors.accent3, margin: '0 0 0.7rem 0' })}">${esc(p.heading)}</div>`
      : '';
    return `<div style="margin:0 0 ${mb(p)} 0">${heading}<div style="${st({ display: 'grid', 'grid-template-columns': cols, gap: '0.9rem' })}">${bars}</div></div>`;
  },
};

const BONDS: [string, string][] = [['ally', 'Ally'], ['lover', 'Lover'], ['neutral', 'Neutral'], ['rival', 'Rival'], ['enemy', 'Enemy']];

const relationships: BlockDef = {
  type: 'relationships', name: 'Relationships', flavor: 'Allies, lovers and knives', glyph: '♡', category: 'Characters',
  description: 'Rows with a round avatar and a colour-coded bond bar.',
  fields: [
    text('heading', 'Heading', 'Alliances'),
    {
      key: 'items', label: 'People', kind: 'list', group: 'Content', itemLabel: 'Person', itemTitleKey: 'name', maxItems: 12,
      newItem: () => ({ name: 'Name', role: 'Role', image: '', bond: 'neutral' }),
      itemFields: [
        { key: 'name', label: 'Name', kind: 'text' },
        { key: 'role', label: 'Role / note', kind: 'text' },
        { key: 'image', label: 'Avatar link', kind: 'image' },
        { key: 'bond', label: 'Bond', kind: 'select', options: BONDS.map(([value, label]) => ({ value, label })) },
      ],
    },
    num('avatar', 'Avatar size', 32, 72, 2, 'px'),
    spaceBelow,
  ],
  defaults: () => ({
    heading: 'Alliances',
    items: [
      { name: 'Queen Isolde', role: 'Aunt · wants him wed or dead', image: '', bond: 'enemy' },
      { name: 'Sir Aldric', role: 'Sworn shield · trusts {{user}}', image: '', bond: 'ally' },
      { name: 'Lady Morwen', role: 'Former betrothed · smiles too much', image: '', bond: 'rival' },
    ],
    avatar: 44, spaceBelow: 1.4,
  }),
  summary: (p) => (p.items || []).map((x: Props) => x.name).join(' · '),
  render: (p, t) => {
    const bondColor: Record<string, string> = {
      ally: t.colors.accent, lover: t.colors.accent3, neutral: t.colors.muted, rival: t.colors.accent2, enemy: t.colors.warn,
    };
    const size = `${p.avatar ?? 44}px`;
    const rows = ((p.items || []) as Props[])
      .map((x) => {
        const c = bondColor[x.bond] ?? t.colors.muted;
        return `<div style="${st({
          display: 'flex', 'align-items': 'center', gap: '0.8rem', background: shade(t, 0.25), border: `1px solid ${alpha(c, 0.2)}`,
          'border-left': `3px solid ${c}`, 'border-radius': radius(t, 0.6), padding: '0.6rem 0.9rem',
        })}"><div style="${st({
          width: size, height: size, 'min-width': size, 'border-radius': '50%', background: `${bgImg(x.image, t, 100, 100)} center / cover no-repeat`,
          border: `1px solid ${c}`, 'box-sizing': 'border-box',
        })}"></div><div style="min-width:0"><div style="${st({ 'font-family': fontStack(t.fonts.body), 'font-size': '0.92rem', 'font-weight': 700, color: t.colors.heading })}">${esc(x.name)}</div><div style="${st({ 'font-size': '0.74rem', color: c })}">${esc(x.role)}</div></div></div>`;
      })
      .join('');
    const heading = p.heading
      ? `<div style="${st({ 'font-family': fontStack(t.fonts.label), 'font-size': '0.7rem', 'font-weight': 700, 'letter-spacing': '0.25em', 'text-transform': 'uppercase', color: t.colors.accent3, margin: '0 0 0.6rem 0' })}">${esc(p.heading)}</div>`
      : '';
    return `<div style="margin:0 0 ${mb(p)} 0">${heading}<div style="display:flex;flex-direction:column;gap:0.6rem">${rows}</div></div>`;
  },
};

const quote: BlockDef = {
  type: 'quote', name: 'Quote', flavor: 'A vow, or a threat', glyph: '“', category: 'Story',
  description: 'A pull-quote with ornate marks, a side bar, or centred epigraph.',
  fields: [
    multiline('text', 'Quote', undefined, 'Single newlines become line breaks.'),
    text('by', 'Attribution', '— Caelan, to {{user}}'),
    select('style', 'Style', [['marks', 'Ornate marks ❝ ❞'], ['bar', 'Side bar'], ['epigraph', 'Epigraph']]),
    fontField('font', 'Font', 'display'),
    num('size', 'Size', 0.8, 2, 0.05, 'rem'),
    color('color', 'Colour', 'heading'),
    toggle('gradient', 'Gradient text'),
    color('markColor', 'Mark / bar colour', 'accent'),
    spaceBelow,
  ],
  defaults: () => ({
    text: 'Run, if you like. I have always preferred you breathless.', by: '— Caelan, to {{user}}', style: 'marks', font: '', size: 1.1,
    color: '', gradient: true, markColor: '', spaceBelow: 1.4,
  }),
  summary: (p) => p.text,
  render: (p, t) => {
    const mark = or(p.markColor, t.colors.accent);
    const txt = st({
      'font-family': font(p, 'font', t, 'display'),
      'font-size': `${p.size ?? 1.1}rem`,
      'font-style': 'italic',
      'line-height': 1.55,
      color: p.gradient ? undefined : or(p.color, t.colors.heading),
      ...(p.gradient ? gradientText(blendHex(mark, '#ffffff', 0.5), t.colors.accent3) : {}),
    });
    const by = p.by
      ? `<div style="${st({ 'font-family': fontStack(t.fonts.label), 'font-size': '0.68rem', 'letter-spacing': '0.18em', 'text-transform': 'uppercase', color: t.colors.muted, 'margin-top': '0.5rem' })}">${esc(p.by)}</div>`
      : '';
    if (p.style === 'bar') {
      return `<div style="${st({ 'border-left': `3px solid ${mark}`, padding: '0.3rem 0 0.3rem 1rem', margin: `0 0 ${mb(p)} 0` })}"><span style="${txt}">${rich(p.text)}</span>${by}</div>`;
    }
    if (p.style === 'epigraph') {
      return `<div style="${st({ 'text-align': 'right', 'max-width': '80%', margin: `0 0 ${mb(p)} auto` })}"><span style="${txt}">${rich(p.text)}</span>${by}</div>`;
    }
    const m = (g: string) => `<span style="${st({ 'font-size': '1.3rem', color: mark })}">${g}</span>`;
    return `<div style="${st({ 'text-align': 'center', margin: `0 0 ${mb(p)} 0` })}">${m('❝')} <span style="${txt}">${rich(p.text)}</span> ${m('❞')}${by}</div>`;
  },
};

const polaroids: BlockDef = {
  type: 'polaroids', name: 'Polaroids', flavor: 'Keepsakes pressed between pages', glyph: '◫', category: 'Media',
  description: 'Tilted instant photos with handwritten captions.',
  fields: [
    {
      key: 'items', label: 'Photos', kind: 'list', group: 'Content', itemLabel: 'Photo', itemTitleKey: 'caption', maxItems: 4,
      newItem: () => ({ image: '', caption: 'Caption', tilt: 2 }),
      itemFields: [
        { key: 'image', label: 'Image link', kind: 'image' },
        { key: 'caption', label: 'Caption', kind: 'text' },
        { key: 'tilt', label: 'Tilt', kind: 'number', min: -10, max: 10, step: 1, unit: '°' },
      ],
    },
    num('size', 'Photo size', 80, 200, 5, 'px'),
    color('paper', 'Paper colour', undefined),
    fontField('font', 'Caption font', 'display'),
    color('ink', 'Caption ink', undefined),
    spaceBelow,
  ],
  defaults: () => ({
    items: [{ image: '', caption: 'summer solstice', tilt: -3 }, { image: '', caption: 'before the war', tilt: 2 }],
    size: 130, paper: '#f0e8d8', font: 'Dancing Script', ink: '#7a5a46', spaceBelow: 1.4,
  }),
  summary: (p) => `${(p.items || []).length} photos`,
  render: (p, t) => {
    const s = `${p.size ?? 130}px`;
    const cards = withImage(p.items)
      .map(
        (x) => `<div style="${st({
          'text-align': 'center', background: or(p.paper, '#f0e8d8'), padding: '8px 8px 6px 8px', 'border-radius': '2px',
          transform: `rotate(${Number(x.tilt) || 0}deg)`, 'box-shadow': '0 6px 16px rgba(0,0,0,0.5)',
        })}"><img alt="" src="${imgSrc(x.image, t, 200, 200, '')}" style="${st({ width: s, height: s, 'object-fit': 'cover', display: 'block' })}"/><div style="${st({
          'font-family': font(p, 'font', t, 'display'), 'font-size': '0.85rem', color: or(p.ink, '#7a5a46'), padding: '0.35rem 0.2rem 0 0.2rem',
        })}">${esc(x.caption)}</div></div>`,
      )
      .join('');
    return `<div style="${st({ display: 'flex', 'flex-wrap': 'wrap', 'justify-content': 'center', gap: '1rem', margin: `0 0 ${mb(p)} 0`, padding: '0.4rem 0' })}">${cards}</div>`;
  },
};

const music: BlockDef = {
  type: 'music', name: 'Music Player', flavor: 'The court musician plays', glyph: '♫', category: 'Media',
  description: 'Cover art, title and an <audio> player.',
  fields: [
    text('label', 'Label', '♫ Now Playing'),
    text('title', 'Song title', 'Song Title'),
    text('artist', 'Artist', 'Artist'),
    image('cover', 'Cover image link'),
    { key: 'audio', label: 'Audio link (.mp3)', kind: 'audio', group: 'Content', help: 'Must be a direct .mp3 file link (files.catbox.moe works).' },
    color('color', 'Accent', 'accent'),
    spaceBelow,
  ],
  defaults: () => ({ label: '♫ Now Playing · The Court’s Favourite', title: 'Song Title', artist: 'Artist', cover: '', audio: '', color: '', spaceBelow: 1.4 }),
  summary: (p) => [p.title, p.artist].filter(Boolean).join(' — '),
  render: (p, t) => {
    const c = or(p.color, t.colors.accent);
    return `<div style="${st({ 'max-width': '420px', margin: `0 auto ${mb(p)} auto`, background: shade(t, 0.3), border: `1px solid ${alpha(c, 0.4)}`, 'border-radius': radius(t, 0.8), padding: '12px 14px' })}"><div style="${st({
      'font-family': fontStack(t.fonts.label), 'font-size': '0.65rem', 'font-weight': 700, 'letter-spacing': '0.2em', 'text-transform': 'uppercase', color: c, 'margin-bottom': '8px',
    })}">${esc(p.label)}</div><div style="display:flex;gap:12px;align-items:center"><img alt="" src="${imgSrc(p.cover, t, 120, 120, '')}" style="${st({
      width: '52px', height: '52px', 'min-width': '52px', 'border-radius': '50%', 'object-fit': 'cover', border: `1px solid ${c}`,
    })}"/><div style="flex:1;min-width:0"><div style="${st({ 'font-size': '0.86rem', 'font-weight': 700, color: t.colors.heading })}">${esc(p.title)}</div><div style="${st({ 'font-size': '0.7rem', color: t.colors.accent3, margin: '2px 0 6px 0' })}">${esc(p.artist)}</div><audio controls="" preload="none" style="width:100%;height:32px;display:block" src="${attrUrl(p.audio)}"></audio></div></div></div>`;
  },
};

const voice: BlockDef = {
  type: 'voice', name: 'Voice Note', flavor: 'A sealed message', glyph: '✉', category: 'Media',
  description: 'A short audio message from the character.',
  fields: [
    text('speaker', 'Speaker', '{{char}}'),
    text('meta', 'Note', 'a message, sealed · 1:13'),
    image('avatar', 'Avatar link'),
    { key: 'audio', label: 'Audio link (.mp3)', kind: 'audio', group: 'Content', help: 'Must be a direct .mp3 file link (files.catbox.moe works).' },
    color('color', 'Accent', 'accent2'),
    spaceBelow,
  ],
  defaults: () => ({ speaker: '{{char}}', meta: 'a message, sealed · 1:13', avatar: '', audio: '', color: '', spaceBelow: 1.4 }),
  summary: (p) => `${p.speaker} — ${p.meta}`,
  render: (p, t) => {
    const c = or(p.color, t.colors.accent2);
    return `<div style="${st({ 'max-width': '400px', margin: `0 auto ${mb(p)} auto`, background: shade(t, 0.3), border: `1px solid ${alpha(c, 0.5)}`, 'border-left': `3px solid ${c}`, 'border-radius': radius(t, 0.7), padding: '12px 14px' })}"><div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><div style="${st({
      width: '34px', height: '34px', 'min-width': '34px', 'border-radius': '50%', background: `${bgImg(p.avatar, t, 80, 80)} center 25% / cover no-repeat`, border: `2px solid ${c}`, 'box-sizing': 'border-box',
    })}"></div><div style="min-width:0"><div style="${st({ 'font-size': '0.8rem', 'font-weight': 700, color: c })}">${esc(p.speaker)}</div><div style="${st({ 'font-size': '0.62rem', color: t.colors.muted })}">${esc(p.meta)}</div></div></div><audio controls="" preload="none" style="width:100%;height:32px;display:block" src="${attrUrl(p.audio)}"></audio></div>`;
  },
};

const routes: BlockDef = {
  type: 'routes', name: 'Opening Routes', flavor: 'Choose your first chapter', glyph: 'Ⅰ', category: 'Story',
  description: 'Numbered starting scenarios with accent bars.',
  fields: [
    text('heading', 'Heading', 'Openings'),
    {
      key: 'items', label: 'Routes', kind: 'list', group: 'Content', itemLabel: 'Route', itemTitleKey: 'title', maxItems: 12,
      newItem: () => ({ title: 'Route name', text: 'What happens in this opening.' }),
      itemFields: [
        { key: 'title', label: 'Title', kind: 'text' },
        { key: 'text', label: 'Description', kind: 'multiline' },
      ],
    },
    select('numbering', 'Numbering', [['roman', 'Roman (I, II)'], ['arabic', 'Numbers (1, 2)'], ['glyph', 'Theme ornament'], ['none', 'None']]),
    toggle('alternate', 'Alternate accent colours'),
    fontField('font', 'Title font', 'display'),
    spaceBelow,
  ],
  defaults: () => ({
    heading: 'Openings',
    items: [
      { title: 'The Betrothal Ball', text: 'Every noble in the realm watches as {{char}} offers you his hand — and a blade hidden in his sleeve.' },
      { title: 'Thorns at Midnight', text: 'You wake bound by your old bargain-mark, and he is standing at the foot of your bed.' },
      { title: 'The Wild Hunt', text: 'A forbidden hunt beyond the veil. Only one of you is supposed to come back.' },
    ],
    numbering: 'roman', alternate: true, font: '', spaceBelow: 1.4,
  }),
  summary: (p) => (p.items || []).map((x: Props) => x.title).join(' · '),
  render: (p, t) => {
    const heading = p.heading
      ? `<div style="${st({ 'font-family': fontStack(t.fonts.label), 'font-size': '0.7rem', 'font-weight': 700, 'letter-spacing': '0.25em', 'text-transform': 'uppercase', color: t.colors.accent3, margin: '0 0 0.6rem 0' })}">${esc(p.heading)}</div>`
      : '';
    const items = ((p.items || []) as Props[])
      .map((x, i) => {
        const c = p.alternate && i % 2 ? t.colors.accent2 : t.colors.accent;
        const n = p.numbering === 'roman' ? `${toRoman(i + 1)} · ` : p.numbering === 'arabic' ? `${i + 1} · ` : p.numbering === 'glyph' ? `${t.ornament} ` : '';
        return `<div style="${st({ background: shade(t, 0.25), border: `1px solid ${alpha(c, 0.2)}`, 'border-left': `3px solid ${c}`, 'border-radius': radius(t, 0.7), padding: '0.9rem 1.1rem', 'margin-bottom': '0.7rem' })}"><div style="${st({
          'font-family': font(p, 'font', t, 'display'), 'font-size': '1.05rem', 'font-weight': 700, 'font-style': 'italic', color: c,
        })}">${esc(n + (x.title ?? ''))}</div><div style="${st({ 'font-family': fontStack(t.fonts.body), 'font-size': '0.88rem', 'line-height': 1.7, color: t.colors.text, 'margin-top': '0.3rem' })}">${rich(x.text)}</div></div>`;
      })
      .join('');
    return `<div style="margin:0 0 ${mb(p)} 0">${heading}${items}</div>`;
  },
};

const columns: BlockDef = {
  type: 'columns', name: 'Two Columns', flavor: 'Two hearts, side by side', glyph: '◧', category: 'Story',
  description: 'Two text columns that stack on narrow screens (grid on a <div>, as the guide requires).',
  fields: [
    text('leftTitle', 'Left title', 'Him'),
    multiline('leftText', 'Left text'),
    text('rightTitle', 'Right title', 'You'),
    multiline('rightText', 'Right text'),
    toggle('boxed', 'Boxed columns'),
    color('titleColor', 'Title colour', 'accent'),
    num('minWidth', 'Stack below width', 140, 320, 10, 'px', 'Layout'),
    spaceBelow,
  ],
  defaults: () => ({
    leftTitle: 'Him', leftText: 'Heir to a throne of thorns. Patient as winter. Has never once lost a game he cared about.',
    rightTitle: 'You', rightText: 'The one who got away. Carries his bargain-mark like a scar and his name like a curse.',
    boxed: true, titleColor: '', minWidth: 200, spaceBelow: 1.4,
  }),
  summary: (p) => `${p.leftTitle} | ${p.rightTitle}`,
  render: (p, t) => {
    const col = (title: string, body: string) =>
      `<div style="${st({
        background: p.boxed ? t.colors.surface : undefined,
        border: p.boxed ? `1px solid ${t.colors.border}` : undefined,
        'border-radius': p.boxed ? radius(t, 0.7) : undefined,
        padding: p.boxed ? '0.9rem 1rem' : undefined,
      })}"><div style="${st({ 'font-family': fontStack(t.fonts.display), 'font-size': '1.1rem', 'font-weight': 700, color: or(p.titleColor, t.colors.accent), 'margin-bottom': '0.4rem' })}">${esc(title)}</div>${textParas(
        body,
        st({ 'font-family': fontStack(t.fonts.body), 'font-size': '0.88rem', 'line-height': 1.7, color: t.colors.text, margin: '0 0 0.6em 0' }),
      )}</div>`;
    return `<div style="${st({ display: 'grid', 'grid-template-columns': `repeat(auto-fit, minmax(${p.minWidth ?? 200}px, 1fr))`, gap: '1rem', margin: `0 0 ${mb(p)} 0` })}">${col(p.leftTitle, p.leftText)}${col(p.rightTitle, p.rightText)}</div>`;
  },
};

const panel: BlockDef = {
  type: 'panel', name: 'Enchanted Panel', flavor: 'Glass, gilt and sealed letters', glyph: '◇', category: 'Story',
  description: 'A text panel in one of Tempe’s effects: frosted glass, gradient border, clipped diagonal, layered gradient — or a sealed letter.',
  fields: [
    select('variant', 'Effect', [['letter', 'Sealed letter'], ['frosted', 'Frosted glass'], ['gradientBorder', 'Gradient border'], ['diagonal', 'Clipped diagonal'], ['layered', 'Layered gradient']], 'Content'),
    text('title', 'Title', 'A letter, unsent'),
    multiline('text', 'Text'),
    text('signature', 'Signature (letter only)', '— C.'),
    color('from', 'Colour A', 'accent'),
    color('to', 'Colour B', 'accent2'),
    fontField('font', 'Text font', 'body'),
    spaceBelow,
  ],
  defaults: () => ({
    variant: 'letter', title: 'A letter, unsent',
    text: 'You left the window open the night you ran. I have not closed it since.\n\nCome home, little thief. Or let me come and find you.',
    signature: '— C.', from: '', to: '', font: '', spaceBelow: 1.4,
  }),
  summary: (p) => `${p.variant} · ${p.title}`,
  render: (p, t) => {
    const a = or(p.from, t.colors.accent);
    const b = or(p.to, t.colors.accent2);
    const v = p.variant || 'letter';
    if (v === 'letter') {
      const ink = '#3b2418';
      const title = p.title ? `<div style="${st({ 'font-family': fontStack('Dancing Script'), 'font-size': '1.5rem', color: '#7a1f2e', 'margin-bottom': '0.5rem' })}">${esc(p.title)}</div>` : '';
      const body = textParas(p.text, st({ 'font-family': font(p, 'font', t, 'body'), 'font-size': '0.95rem', 'line-height': 1.75, color: ink, margin: '0 0 0.7em 0' }));
      const sig = p.signature ? `<div style="${st({ 'font-family': fontStack('Dancing Script'), 'font-size': '1.3rem', color: '#7a1f2e', 'text-align': 'right' })}">${esc(p.signature)}</div>` : '';
      const seal = `<div style="${st({ width: '46px', height: '46px', margin: '0.4rem auto 0 auto', 'border-radius': '50%', background: `radial-gradient(circle at 35% 30%, ${blendHex(b, '#ffffff', 0.35)}, ${b} 55%, ${blendHex(b, '#000000', 0.45)})`, 'box-shadow': '0 3px 8px rgba(0,0,0,0.45)', 'text-align': 'center', 'line-height': '46px', color: alpha('#ffffff', 0.75), 'font-size': '1.2rem' })}">${esc(t.ornament)}</div>`;
      return `<div style="${st({
        background: 'linear-gradient(180deg, #f6ecd6, #ead8b4)', border: '1px solid #c9ad7f', 'border-radius': '3px', padding: '1.3rem 1.4rem 1rem 1.4rem',
        'box-shadow': '0 10px 28px rgba(0,0,0,0.45)', transform: 'rotate(-0.6deg)', margin: `0.3rem 0.2rem ${mb(p)} 0.2rem`,
      })}">${title}${body}${sig}${seal}</div>`;
    }
    const title = p.title ? `<div style="${st({ 'font-family': fontStack(t.fonts.display), 'font-size': '1.15rem', 'font-weight': 700, color: v === 'frosted' || v === 'gradientBorder' ? t.colors.heading : '#ffffff', 'margin-bottom': '0.4rem' })}">${esc(p.title)}</div>` : '';
    const bodyColor = v === 'frosted' || v === 'gradientBorder' ? t.colors.text : '#ffffff';
    const body = textParas(p.text, st({ 'font-family': font(p, 'font', t, 'body'), 'font-size': '0.92rem', 'line-height': 1.75, color: bodyColor, margin: '0 0 0.6em 0' }));
    const base = { margin: `0 0 ${mb(p)} 0`, padding: '1.1rem 1.2rem' };
    const styles: Record<string, Record<string, string>> = {
      frosted: { ...base, 'backdrop-filter': 'blur(4px)', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)', 'border-radius': radius(t, 0.7) },
      gradientBorder: { ...base, 'border-image': `linear-gradient(to right, ${a}, ${b}) 1`, 'border-style': 'solid', 'border-width': '2px' },
      diagonal: { ...base, 'clip-path': 'polygon(0 0, 100% 0, 100% 86%, 0 100%)', background: `linear-gradient(135deg, ${blendHex(b, '#000000', 0.25)}, ${blendHex(b, '#000000', 0.55)})`, 'padding-bottom': '2.2rem' },
      layered: { ...base, 'background-image': `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), linear-gradient(to right, ${a}, ${b})`, 'border-radius': radius(t, 0.7) },
    };
    return `<div style="${st(styles[v] ?? styles.frosted)}">${title}${body}</div>`;
  },
};

const seal: BlockDef = {
  type: 'seal', name: 'Wax Seal', flavor: 'By royal decree', glyph: '◉', category: 'Ornaments',
  description: 'A rotated stamp or a glossy wax seal with a few words.',
  fields: [
    multiline('text', 'Text', 'BY ROYAL\nDECREE', 'Each line becomes a line on the seal.'),
    select('style', 'Style', [['wax', 'Glossy wax'], ['stamp', 'Ink stamp']]),
    color('color', 'Colour', 'accent2'),
    num('size', 'Size', 60, 160, 2, 'px'),
    num('rotate', 'Rotation', -30, 30, 1, '°'),
    select('justify', 'Alignment', [['center', 'Center'], ['flex-start', 'Left'], ['flex-end', 'Right']], 'Layout'),
    spaceBelow,
  ],
  defaults: () => ({ text: 'BY ROYAL\nDECREE', style: 'wax', color: '', size: 92, rotate: -8, justify: 'center', spaceBelow: 1.2 }),
  summary: (p) => String(p.text || '').replace(/\n/g, ' '),
  render: (p, t) => {
    const c = or(p.color, t.colors.accent2);
    const size = `${p.size ?? 92}px`;
    const lines = String(p.text ?? '').split(/\r?\n/).map(esc).join('<br/>');
    const s =
      p.style === 'stamp'
        ? st({
            display: 'flex', 'align-items': 'center', 'justify-content': 'center', width: size, height: size, 'border-radius': '50%',
            border: `2px dashed ${alpha(c, 0.8)}`, 'box-shadow': `inset 0 0 0 4px ${alpha(c, 0.15)}`, color: c,
          })
        : st({
            display: 'flex', 'align-items': 'center', 'justify-content': 'center', width: size, height: size, 'border-radius': '50%',
            background: `radial-gradient(circle at 35% 30%, ${blendHex(c, '#ffffff', 0.35)}, ${c} 55%, ${blendHex(c, '#000000', 0.45)})`,
            'box-shadow': `0 4px 12px rgba(0,0,0,0.5), inset 0 0 0 5px ${shade(t, 0.15)}`, color: alpha('#ffffff', 0.85),
          });
    return `<div style="${st({ display: 'flex', 'justify-content': p.justify || 'center', margin: `0 0 ${mb(p)} 0` })}"><div style="${s};transform:rotate(${Number(p.rotate) || 0}deg)"><span style="${st({
      'font-family': fontStack(t.fonts.label), 'font-size': '0.58rem', 'font-weight': 700, 'letter-spacing': '0.12em', 'text-align': 'center', 'line-height': 1.35,
    })}">${lines}</span></div></div>`;
  },
};

const spacer: BlockDef = {
  type: 'spacer', name: 'Spacer', flavor: 'A breath between scenes', glyph: '↕', category: 'Ornaments',
  description: 'Empty vertical space.',
  fields: [num('height', 'Height', 0.2, 6, 0.1, 'rem', 'Layout')],
  defaults: () => ({ height: 1 }),
  summary: (p) => `${p.height}rem`,
  render: (p) => `<div style="height:${p.height ?? 1}rem"></div>`,
};

const footer: BlockDef = {
  type: 'footer', name: 'Footer', flavor: 'The colophon', glyph: '⁂', category: 'Ornaments',
  description: 'Small credits line at the bottom of the card.',
  fields: [
    text('text', 'Text', 'Credits · all characters are 18+'),
    toggle('ornament', 'Ornament', undefined, 'Content'),
    color('color', 'Colour', 'muted'),
    toggle('rule', 'Top hairline'),
    spaceBelow,
  ],
  defaults: () => ({ text: 'art credits in gallery · all characters are 18+', ornament: true, color: '', rule: true, spaceBelow: 0 }),
  summary: (p) => p.text,
  render: (p, t) => {
    const g = p.ornament ? ` ${t.ornament}` : '';
    return `<div style="${st({ 'border-top': p.rule ? `1px solid ${alpha(t.colors.accent, 0.25)}` : undefined, 'margin-top': '0.5rem', padding: '0.7rem 0', 'text-align': 'center', margin: `0.5rem 0 ${mb(p)} 0` })}"><span style="${st({
      'font-family': fontStack(t.fonts.label), 'font-size': '0.62rem', color: or(p.color, t.colors.muted), 'letter-spacing': '0.15em', 'text-transform': 'uppercase',
    })}">${esc(p.text)}${g}</span></div>`;
  },
};

const customHtml: BlockDef = {
  type: 'customHtml', name: 'Custom HTML', flavor: 'For the spell-wrights', glyph: '</>', category: 'Advanced', canSitOutside: true,
  description: 'Paste your own inline-styled HTML. It is checked against the same rules as everything else.',
  fields: [
    { key: 'html', label: 'HTML', kind: 'code', group: 'Content', help: 'Inline style="…" only — <style>, <script>, position and the word z-index are stripped by JAI.' },
    outside,
  ],
  defaults: () => ({ html: '<p style="text-align:center;font-family:Jura;color:#c9a0ff">Your own spell here.</p>', outside: false }),
  summary: (p) => String(p.html || '').replace(/<[^>]+>/g, ' ').trim().slice(0, 60),
  render: (p) => String(p.html ?? ''),
};

export const BLOCKS: BlockDef[] = [
  banner, title, hook, warning, tags,
  chapter, prose, quote, panel, columns, routes,
  character, statChips, statBars, relationships,
  gallery, polaroids, music, voice,
  divider, seal, spacer, footer,
  customHtml,
];

export const BLOCK_MAP: Record<string, BlockDef> = Object.fromEntries(BLOCKS.map((b) => [b.type, b]));

export const CATEGORIES: { id: BlockDef['category']; label: string; flavor: string }[] = [
  { id: 'Opening', label: 'Opening', flavor: 'Cover & first impressions' },
  { id: 'Story', label: 'Story', flavor: 'Premise, quotes & routes' },
  { id: 'Characters', label: 'Characters', flavor: 'Portraits, stats & bonds' },
  { id: 'Media', label: 'Media', flavor: 'Galleries & music' },
  { id: 'Ornaments', label: 'Ornaments', flavor: 'Dividers, seals & footers' },
  { id: 'Advanced', label: 'Advanced', flavor: 'Raw HTML' },
];
