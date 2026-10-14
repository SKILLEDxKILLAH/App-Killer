import React from 'react';
import { ScrollView, View } from 'react-native';

import { cloneTheme, THEMES } from '../core/themes';
import type { BioTheme, FieldSpec, ThemeColorKey } from '../core/types';
import { COLOR_NAMES, FieldEditor } from '../ui/Fields';
import { Body, Label, Title } from '../ui/kit';
import { ThemeCover } from '../ui/ThemeCover';
import { SPACE } from '../ui/theme';

const COLOR_HELP: Partial<Record<ThemeColorKey, string>> = {
  canvas: 'Main card background (top of the gradient).',
  surface: 'Fill of boxed text panels. Low opacity looks like tinted glass.',
  accent: 'Gilded details: borders, labels, bars, dividers.',
  warn: 'Content warning boxes and “enemy” bonds.',
};

const FRAME_FIELDS: FieldSpec[] = [
  {
    key: 'frame', label: 'Card frame', kind: 'select',
    options: [
      { value: 'card', label: 'Bound card' },
      { value: 'holo', label: 'Holo foil edge' },
      { value: 'gilded', label: 'Gilded double rule' },
      { value: 'glass', label: 'Frosted glass' },
      { value: 'none', label: 'No frame' },
    ],
    help: 'The holo edge is the conic-gradient wrapper from the Royal Court template; frosted glass uses backdrop-filter.',
  },
  {
    key: 'texture', label: 'Page texture', kind: 'select',
    options: [
      { value: 'none', label: 'Plain' },
      { value: 'damask', label: 'Damask' },
      { value: 'stars', label: 'Starfield' },
      { value: 'thorns', label: 'Thorn vines' },
      { value: 'dots', label: 'Pearl dots' },
    ],
    help: 'An SVG data-URI pattern layered over the gradient.',
  },
  { key: 'radius', label: 'Corner roundness', kind: 'number', min: 0, max: 32, step: 1, unit: 'px' },
  { key: 'padding', label: 'Inner padding', kind: 'number', min: 0.4, max: 3, step: 0.1, unit: 'rem' },
  { key: 'maxWidth', label: 'Max card width', kind: 'number', min: 320, max: 960, step: 10, unit: 'px', help: 'Keeps the bio from overflowing JAI’s layout on wide screens.' },
  { key: 'aura', label: 'Aura glow', kind: 'number', min: 0, max: 1, step: 0.05 },
  { key: 'ornament', label: 'Ornament glyph', kind: 'text', placeholder: '❦', help: 'Used by dividers, footers and placeholders. Try ❦ ❧ ✦ ⚜ ☾ ❀ ✠ ♡' },
];

export function ThemePanel({ theme, onChange }: { theme: BioTheme; onChange: (next: BioTheme, mergeKey?: string) => void }) {
  const set = (patch: Partial<BioTheme>, mk?: string) => onChange({ ...theme, ...patch }, mk);
  return (
    <View>
      <Label style={{ marginBottom: 8 }}>Dress it in a theme</Label>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4, paddingRight: 8 }}>
        {THEMES.map((t) => (
          <ThemeCover key={t.id} theme={t} selected={theme.id === t.id} onPress={() => onChange(cloneTheme(t))} style={{ width: 112 }} height={150} />
        ))}
      </ScrollView>
      <Body italic size={15} tone="muted" style={{ marginTop: 6, marginBottom: SPACE.lg }}>
        Choosing a theme restyles every element. Colours you set on a single element stay as they are.
      </Body>

      <Title size={17} style={{ marginBottom: 10 }}>
        Palette
      </Title>
      {(Object.keys(COLOR_NAMES) as ThemeColorKey[]).map((k) => (
        <FieldEditor
          key={k}
          field={{ key: k, label: COLOR_NAMES[k], kind: 'color', help: COLOR_HELP[k] }}
          value={theme.colors[k]}
          theme={theme}
          noDefault
          onChange={(v, mk) => v && set({ colors: { ...theme.colors, [k]: v } }, mk ? `theme:${mk}` : undefined)}
        />
      ))}

      <Title size={17} style={{ marginTop: SPACE.md, marginBottom: 10 }}>
        Typography
      </Title>
      {(
        [
          ['display', 'Display font (titles, names, quotes)'],
          ['body', 'Body font (prose)'],
          ['label', 'Label font (tags, small caps)'],
        ] as const
      ).map(([k, label]) => (
        <FieldEditor key={k} field={{ key: k, label, kind: 'font' }} value={theme.fonts[k]} theme={theme} onChange={(v) => v && set({ fonts: { ...theme.fonts, [k]: v } })} />
      ))}

      <Title size={17} style={{ marginTop: SPACE.md, marginBottom: 10 }}>
        Binding
      </Title>
      {FRAME_FIELDS.map((f) => (
        <FieldEditor key={f.key} field={f} value={(theme as any)[f.key]} theme={theme} onChange={(v, mk) => set({ [f.key]: v } as Partial<BioTheme>, mk ? `theme:${mk}` : undefined)} />
      ))}
    </View>
  );
}
