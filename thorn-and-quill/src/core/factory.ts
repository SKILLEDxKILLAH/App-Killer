import { BLOCK_MAP } from './blocks';
import { cloneTheme, getTheme } from './themes';
import type { Bio, Block, Props } from './types';

export function uid(prefix = ''): string {
  return prefix + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}

export function newBlock(type: string, overrides: Props = {}): Block {
  const def = BLOCK_MAP[type];
  if (!def) throw new Error(`Unknown element type: ${type}`);
  return { id: uid('b_'), type, props: { ...def.defaults(), ...overrides } };
}

export function cloneBlock(b: Block): Block {
  return { ...b, id: uid('b_'), props: JSON.parse(JSON.stringify(b.props)) };
}

export interface StarterKit {
  id: string;
  name: string;
  flavor: string;
  description: string;
  build: () => Block[];
}

export const STARTER_KITS: StarterKit[] = [
  {
    id: 'full',
    name: 'The Full Tale',
    flavor: 'Every chapter, ready to rewrite',
    description: 'Banner, name plate, warnings, tropes, premise, character dropdown, stats, alliances, gallery, letter, routes and footer.',
    build: () => [
      newBlock('banner'),
      newBlock('title'),
      newBlock('hook'),
      newBlock('warning'),
      newBlock('tags'),
      newBlock('prose'),
      newBlock('divider', { label: 'The Prince' }),
      newBlock('character'),
      newBlock('statChips'),
      newBlock('statBars'),
      newBlock('relationships'),
      newBlock('divider', { label: 'Keepsakes', style: 'flourish' }),
      newBlock('gallery'),
      newBlock('quote'),
      newBlock('panel'),
      newBlock('seal'),
      newBlock('routes'),
      newBlock('footer'),
    ],
  },
  {
    id: 'novella',
    name: 'The Novella',
    flavor: 'Elegant and quick to fill',
    description: 'Banner, name plate, hook, tropes, premise, quote, routes and a footer.',
    build: () => [
      newBlock('banner'),
      newBlock('title'),
      newBlock('hook'),
      newBlock('tags'),
      newBlock('prose'),
      newBlock('quote', { style: 'bar' }),
      newBlock('routes'),
      newBlock('footer'),
    ],
  },
  {
    id: 'blank',
    name: 'A Blank Page',
    flavor: 'Begin with nothing but ink',
    description: 'Just a name plate — add every element yourself.',
    build: () => [newBlock('title')],
  },
];

export function newBio(name: string, themeId: string, kitId = 'full'): Bio {
  const kit = STARTER_KITS.find((k) => k.id === kitId) ?? STARTER_KITS[0];
  const now = Date.now();
  return {
    id: uid('bio_'),
    name: name.trim() || 'Untitled Tale',
    theme: cloneTheme(getTheme(themeId)),
    blocks: kit.build(),
    createdAt: now,
    updatedAt: now,
  };
}

export function duplicateBio(b: Bio): Bio {
  const now = Date.now();
  const copy: Bio = JSON.parse(JSON.stringify(b));
  copy.id = uid('bio_');
  copy.name = `${b.name} (copy)`;
  copy.blocks = copy.blocks.map((x) => ({ ...x, id: uid('b_') }));
  copy.createdAt = now;
  copy.updatedAt = now;
  return copy;
}
