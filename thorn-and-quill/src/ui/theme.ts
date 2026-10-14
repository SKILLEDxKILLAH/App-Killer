// The app's own look: a romantasy hardback. Parchment pages by day, a midnight
// clothbound cover by night, wine-red ribbon and gold foil throughout.

export interface Palette {
  name: 'parchment' | 'nightfall';
  dark: boolean;
  page: string;
  pageDeep: string;
  card: string;
  cardRaised: string;
  ink: string;
  inkSoft: string;
  muted: string;
  line: string;
  wine: string;
  wineDeep: string;
  gold: string;
  goldSoft: string;
  onWine: string;
  danger: string;
  success: string;
  overlay: string;
}

export const PARCHMENT: Palette = {
  name: 'parchment',
  dark: false,
  page: '#f3e8d2',
  pageDeep: '#e8d8b8',
  card: '#fbf5e8',
  cardRaised: '#fffaf0',
  ink: '#2b1b2c',
  inkSoft: '#4a3446',
  muted: '#7d6670',
  line: '#dcc8a3',
  wine: '#7a1f3d',
  wineDeep: '#5a1229',
  gold: '#b0832b',
  goldSoft: '#d8b46a',
  onWine: '#f8e9c8',
  danger: '#a3243b',
  success: '#3f7a4f',
  overlay: 'rgba(30,14,24,0.55)',
};

export const NIGHTFALL: Palette = {
  name: 'nightfall',
  dark: true,
  page: '#140d18',
  pageDeep: '#0c0710',
  card: '#1e1524',
  cardRaised: '#271b2f',
  ink: '#f1e5cf',
  inkSoft: '#d9c7b0',
  muted: '#a08f9f',
  line: '#3b2a43',
  wine: '#b8365e',
  wineDeep: '#7a1f3d',
  gold: '#d9b46a',
  goldSoft: '#a8873f',
  onWine: '#fff3da',
  danger: '#ef6b86',
  success: '#7cc493',
  overlay: 'rgba(0,0,0,0.65)',
};

export const FONTS = {
  title: 'Cinzel_700Bold',
  titleRegular: 'Cinzel_400Regular',
  titleMedium: 'Cinzel_600SemiBold',
  body: 'CormorantGaramond_500Medium',
  bodySemi: 'CormorantGaramond_600SemiBold',
  bodyBold: 'CormorantGaramond_700Bold',
  italic: 'CormorantGaramond_500Medium_Italic',
  mono: 'JAI-JetBrains Mono',
};

/** Keys used to register the JAI bio fonts with expo-font so pickers can show the real typeface. */
export const jaiFontKey = (family: string) => `JAI-${family}`;

export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const RADIUS = { sm: 8, md: 12, lg: 18, pill: 999 };
