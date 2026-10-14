// Fonts that render inside a JanitorAI bio.
//
// Source: DelightfulTempe's "JanitorAI Unrestricted Bot Bio Guide" — JAI loads 14 Google Font
// families and custom fonts via <link> do not survive the server, so a bio is limited to these.
// Georgia is a system font used throughout the Forgeworks/105th templates, so it is offered too.

export interface JaiFont {
  family: string;
  /** CSS fallback appended after the family. */
  fallback: 'serif' | 'sans-serif' | 'monospace' | 'cursive' | 'system-ui';
  mood: string;
  weights: string;
  /** Pre-fetched by JAI's own UI, so no first-load delay. */
  preloaded?: boolean;
  /** Not a JAI web font: relies on the reader's system having it. */
  system?: boolean;
}

export const JAI_FONTS: JaiFont[] = [
  { family: 'Fraunces', fallback: 'serif', mood: 'Versatile literary serif — editorial at large weights', weights: '400–700', preloaded: true },
  { family: 'Crimson Text', fallback: 'serif', mood: 'Classical Garamond-like serif for atmospheric prose', weights: '400, 600, 700' },
  { family: 'Berkshire Swash', fallback: 'cursive', mood: 'Ornate swashy display serif — fantasy & period titles', weights: '400' },
  { family: 'Dancing Script', fallback: 'cursive', mood: 'Romantic handwritten cursive — accents, not body text', weights: '400–700' },
  { family: 'Inter', fallback: 'sans-serif', mood: 'Clean neutral body text, the safe default', weights: '400–700', preloaded: true },
  { family: 'Poppins', fallback: 'sans-serif', mood: 'Warm rounded sans with personality', weights: '300–700' },
  { family: 'Lexend', fallback: 'sans-serif', mood: 'Built for reading comfort in dense text', weights: '300–700' },
  { family: 'Jura', fallback: 'sans-serif', mood: 'Geometric sans for tags, labels and stat lines', weights: '300–700', preloaded: true },
  { family: 'JetBrains Mono', fallback: 'monospace', mood: 'Monospace with a technical feel', weights: '400–700' },
  { family: 'Rock Salt', fallback: 'cursive', mood: 'Rough grunge handwriting for darker tales', weights: '400' },
  { family: 'Monoton', fallback: 'cursive', mood: 'Loud neon/retro display — accent titles only', weights: '400' },
  { family: 'Press Start 2P', fallback: 'monospace', mood: '8-bit retro game lettering', weights: '400' },
  { family: 'VT323', fallback: 'monospace', mood: 'Pixel terminal type for lo-fi settings', weights: '400' },
  { family: 'Noto Sans JP', fallback: 'sans-serif', mood: 'CJK fallback (also KR / SC) — only for Japanese, Korean or Chinese text', weights: '400, 500, 700', preloaded: true },
  { family: 'Georgia', fallback: 'serif', mood: 'Classic system serif used by the Forgeworks templates', weights: 'system', system: true },
];

export const JAI_FONT_FAMILIES = JAI_FONTS.map((f) => f.family);

/** Lowercased family names accepted by the linter (Noto Sans KR/SC and Noto Sans count too). */
export const ALLOWED_FONT_NAMES = new Set(
  [
    ...JAI_FONT_FAMILIES,
    'Noto Sans KR',
    'Noto Sans SC',
    'Noto Sans',
    'MS UI Gothic',
    'serif',
    'sans-serif',
    'monospace',
    'cursive',
    'system-ui',
    'inherit',
  ].map((f) => f.toLowerCase()),
);

/** CSS font-family value for inline styles, e.g. `'Crimson Text', serif`. */
export function fontStack(family: string): string {
  const f = JAI_FONTS.find((x) => x.family === family);
  const fallback = f?.fallback ?? 'serif';
  const name = /\s/.test(family) ? `'${family}'` : family;
  return `${name}, ${fallback}`;
}

/** Families to request from Google Fonts in the in-app preview only (never in exported HTML). */
export const PREVIEW_GOOGLE_FONTS_URL =
  'https://fonts.googleapis.com/css2?' +
  [
    'family=Berkshire+Swash',
    'family=Crimson+Text:ital,wght@0,400;0,600;0,700;1,400',
    'family=Dancing+Script:wght@400..700',
    'family=Fraunces:ital,wght@0,400..700;1,400..700',
    'family=Inter:wght@400..700',
    'family=JetBrains+Mono:wght@400..700',
    'family=Jura:wght@300..700',
    'family=Lexend:wght@300..700',
    'family=Monoton',
    'family=Noto+Sans+JP:wght@400;500;700',
    'family=Poppins:ital,wght@0,300;0,400;0,600;0,700;1,400',
    'family=Press+Start+2P',
    'family=Rock+Salt',
    'family=VT323',
  ].join('&') +
  '&display=swap';
