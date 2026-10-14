// Core data model for a JanitorAI bot bio built in Thorn & Quill.

export type Props = Record<string, any>;

export type FieldKind =
  | 'text'
  | 'multiline'
  | 'color'
  | 'font'
  | 'number'
  | 'select'
  | 'toggle'
  | 'image'
  | 'audio'
  | 'list'
  | 'code';

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldSpec {
  key: string;
  label: string;
  kind: FieldKind;
  help?: string;
  /** Inspector section this field lives in. */
  group?: 'Content' | 'Style' | 'Layout';
  placeholder?: string;
  // number
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  // select
  options?: FieldOption[];
  // color / font: when the value is empty the theme token is used instead
  themeToken?: ThemeColorKey | ThemeFontKey;
  // list
  itemFields?: FieldSpec[];
  itemLabel?: string;
  /** Field inside each list item used as that item's title in the editor. */
  itemTitleKey?: string;
  newItem?: () => Props;
  maxItems?: number;
  /** Only show this field when the predicate passes. */
  showIf?: (props: Props) => boolean;
}

export type ThemeColorKey =
  | 'canvas'
  | 'canvas2'
  | 'surface'
  | 'border'
  | 'accent'
  | 'accent2'
  | 'accent3'
  | 'heading'
  | 'text'
  | 'muted'
  | 'warn';

export type ThemeFontKey = 'display' | 'body' | 'label';

export type FrameStyle = 'none' | 'card' | 'holo' | 'gilded' | 'glass';
export type TextureStyle = 'none' | 'stars' | 'damask' | 'dots' | 'thorns';

export interface BioTheme {
  id: string;
  name: string;
  tagline: string;
  colors: Record<ThemeColorKey, string>;
  fonts: Record<ThemeFontKey, string>;
  /** Corner radius for boxes, in px. */
  radius: number;
  frame: FrameStyle;
  texture: TextureStyle;
  /** Strength of the soft aura around the main card, 0..1. */
  aura: number;
  /** Inner padding of the main card, in rem. */
  padding: number;
  /** Max width of the main card, in px (keeps the bio from overflowing JAI's layout). */
  maxWidth: number;
  /** Ornament glyph used by dividers and footers. */
  ornament: string;
  /** Whether this theme is meant for a light page. Only affects the preview backdrop default. */
  light?: boolean;
}

export type BlockCategory = 'Opening' | 'Story' | 'Characters' | 'Media' | 'Ornaments' | 'Advanced';

export interface Block {
  id: string;
  type: string;
  hidden?: boolean;
  props: Props;
}

export interface Bio {
  id: string;
  name: string;
  theme: BioTheme;
  blocks: Block[];
  createdAt: number;
  updatedAt: number;
}

export interface BlockDef {
  type: string;
  name: string;
  /** Short romantasy-flavoured subtitle. */
  flavor: string;
  description: string;
  glyph: string;
  category: BlockCategory;
  fields: FieldSpec[];
  defaults: () => Props;
  render: (props: Props, theme: BioTheme) => string;
  /** One-line summary shown on the block card in the composer. */
  summary?: (props: Props) => string;
  /** Block may be placed above the main card (banner, hook). */
  canSitOutside?: boolean;
}
