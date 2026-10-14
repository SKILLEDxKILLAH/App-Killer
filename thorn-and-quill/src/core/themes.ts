import type { BioTheme } from './types';

// Bio themes: the palettes, type pairings and frames a bio can wear.
// Every font is from the JAI-loaded list (see fonts.ts).

export const THEMES: BioTheme[] = [
  {
    id: 'velvet-throne',
    name: 'Velvet Throne',
    tagline: 'Plum velvet, gilt edges, courtly menace',
    colors: {
      canvas: '#1a1020', canvas2: '#120b17', surface: 'rgba(240,185,45,0.05)', border: 'rgba(240,185,45,0.28)',
      accent: '#f0c14b', accent2: '#c2335e', accent3: '#c9a0ff', heading: '#f6e7c1', text: '#e8dcc8', muted: '#9a8494', warn: '#e0507a',
    },
    fonts: { display: 'Fraunces', body: 'Crimson Text', label: 'Jura' },
    radius: 14, frame: 'holo', texture: 'damask', aura: 0.35, padding: 1.4, maxWidth: 720, ornament: '❦',
  },
  {
    id: 'thornbound-rose',
    name: 'Thornbound Rose',
    tagline: 'Blood-red roses on black lacquer',
    colors: {
      canvas: '#160b0e', canvas2: '#0b0507', surface: 'rgba(196,30,58,0.07)', border: 'rgba(196,30,58,0.35)',
      accent: '#e2475f', accent2: '#d4a373', accent3: '#f2b5c4', heading: '#f8dde2', text: '#e9d6d8', muted: '#9c7f84', warn: '#ff6b81',
    },
    fonts: { display: 'Berkshire Swash', body: 'Crimson Text', label: 'Jura' },
    radius: 10, frame: 'card', texture: 'thorns', aura: 0.3, padding: 1.4, maxWidth: 720, ornament: '❀',
  },
  {
    id: 'moonlit-grimoire',
    name: 'Moonlit Grimoire',
    tagline: 'Silver ink on a midnight page',
    colors: {
      canvas: '#0f1428', canvas2: '#080b18', surface: 'rgba(160,180,255,0.06)', border: 'rgba(160,180,255,0.25)',
      accent: '#b8c7ff', accent2: '#8f7ad8', accent3: '#e5d7a8', heading: '#eef1ff', text: '#ccd4ec', muted: '#7d86a6', warn: '#ff7a9a',
    },
    fonts: { display: 'Fraunces', body: 'Lexend', label: 'Jura' },
    radius: 16, frame: 'card', texture: 'stars', aura: 0.3, padding: 1.4, maxWidth: 720, ornament: '☾',
  },
  {
    id: 'dragons-hoard',
    name: "Dragon's Hoard",
    tagline: 'Obsidian scales, ember and molten gold',
    colors: {
      canvas: '#17110c', canvas2: '#0c0806', surface: 'rgba(255,140,40,0.06)', border: 'rgba(255,160,60,0.3)',
      accent: '#ffb347', accent2: '#e2552b', accent3: '#ffd98a', heading: '#ffe9c2', text: '#ead9c4', muted: '#9a8670', warn: '#ff6a3d',
    },
    fonts: { display: 'Fraunces', body: 'Crimson Text', label: 'Jura' },
    radius: 8, frame: 'gilded', texture: 'damask', aura: 0.4, padding: 1.4, maxWidth: 720, ornament: '⚜',
  },
  {
    id: 'fae-hollow',
    name: 'Fae Hollow',
    tagline: 'Moss, dew and a bargain you should not take',
    colors: {
      canvas: '#101a14', canvas2: '#08110c', surface: 'rgba(150,220,170,0.06)', border: 'rgba(150,220,170,0.25)',
      accent: '#9fe0b0', accent2: '#e3c77a', accent3: '#d8a6e8', heading: '#e7f6ea', text: '#d0e2d4', muted: '#7f9a87', warn: '#f08aa0',
    },
    fonts: { display: 'Dancing Script', body: 'Crimson Text', label: 'Jura' },
    radius: 18, frame: 'card', texture: 'dots', aura: 0.3, padding: 1.4, maxWidth: 720, ornament: '✿',
  },
  {
    id: 'winter-court',
    name: 'Winter Court',
    tagline: 'Frost-silver crowns and a cold, clean cruelty',
    colors: {
      canvas: '#121a22', canvas2: '#0a1016', surface: 'rgba(190,225,255,0.06)', border: 'rgba(190,225,255,0.28)',
      accent: '#cfe8ff', accent2: '#7fb6e6', accent3: '#e8eef4', heading: '#f4faff', text: '#d6e2ec', muted: '#8195a6', warn: '#ff8fa3',
    },
    fonts: { display: 'Fraunces', body: 'Inter', label: 'Jura' },
    radius: 6, frame: 'gilded', texture: 'stars', aura: 0.25, padding: 1.4, maxWidth: 720, ornament: '❄',
  },
  {
    id: 'starfall',
    name: 'Starfall Elvenhall',
    tagline: 'Twilight violet and falling starlight',
    colors: {
      canvas: '#1a1430', canvas2: '#0e0a1c', surface: 'rgba(200,170,255,0.07)', border: 'rgba(200,170,255,0.3)',
      accent: '#d9c2ff', accent2: '#ffb8d9', accent3: '#a8e0ff', heading: '#f5eeff', text: '#e0d6f2', muted: '#8f84a8', warn: '#ff8fb8',
    },
    fonts: { display: 'Fraunces', body: 'Poppins', label: 'Jura' },
    radius: 20, frame: 'holo', texture: 'stars', aura: 0.45, padding: 1.4, maxWidth: 720, ornament: '✦',
  },
  {
    id: 'blood-oath',
    name: 'Blood Oath',
    tagline: 'Bone-white vows signed in red',
    colors: {
      canvas: '#0e0c0c', canvas2: '#060505', surface: 'rgba(255,255,255,0.04)', border: 'rgba(170,20,30,0.45)',
      accent: '#c1121f', accent2: '#e9e2d0', accent3: '#8d6e63', heading: '#f3ede0', text: '#d9d2c4', muted: '#857d72', warn: '#ff4d5a',
    },
    fonts: { display: 'Rock Salt', body: 'Crimson Text', label: 'Jura' },
    radius: 4, frame: 'card', texture: 'thorns', aura: 0.25, padding: 1.4, maxWidth: 720, ornament: '✠',
  },
  {
    id: 'parchment-and-ink',
    name: 'Parchment & Ink',
    tagline: 'A love letter on aged vellum',
    colors: {
      canvas: '#f5ead3', canvas2: '#ead9b8', surface: 'rgba(120,70,30,0.06)', border: 'rgba(120,70,30,0.3)',
      accent: '#8a2a3b', accent2: '#a8742e', accent3: '#4b5d7a', heading: '#3a2418', text: '#4a3626', muted: '#8a7360', warn: '#a8322d',
    },
    fonts: { display: 'Berkshire Swash', body: 'Crimson Text', label: 'Jura' },
    radius: 6, frame: 'gilded', texture: 'none', aura: 0.15, padding: 1.4, maxWidth: 720, ornament: '❧', light: true,
  },
  {
    id: 'rosewater-sonnet',
    name: 'Rosewater Sonnet',
    tagline: 'Blush silk, rose gold and soft yearning',
    colors: {
      canvas: '#fbeef0', canvas2: '#f5dfe4', surface: 'rgba(190,90,120,0.06)', border: 'rgba(190,90,120,0.28)',
      accent: '#b5577a', accent2: '#c99a5b', accent3: '#7d6aa8', heading: '#5a2238', text: '#5c3a46', muted: '#9a7882', warn: '#c0394f',
    },
    fonts: { display: 'Dancing Script', body: 'Lexend', label: 'Jura' },
    radius: 18, frame: 'card', texture: 'dots', aura: 0.2, padding: 1.4, maxWidth: 720, ornament: '♡', light: true,
  },
];

export function getTheme(id: string): BioTheme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

/** Deep copy so edits to a bio's theme never mutate the preset. */
export function cloneTheme(t: BioTheme): BioTheme {
  return { ...t, colors: { ...t.colors }, fonts: { ...t.fonts } };
}
