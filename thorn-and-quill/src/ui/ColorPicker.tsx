import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { hslToRgb, parseColor, rgbToHsl, toCss, type HSLA } from '../core/color';
import { usePalette } from '../state/store';
import { Body, Button, Label, Sheet, tap, textInputStyle } from './kit';
import { Slider } from './Slider';
import { FONTS } from './theme';

const ROMANTASY_SWATCHES = [
  '#f0c14b', '#d4a373', '#c9a24a', '#f6e7c1', '#e8dcc8',
  '#c2335e', '#8a2a3b', '#e2475f', '#b5577a', '#f2b5c4',
  '#c9a0ff', '#8f7ad8', '#6a2f9e', '#b8c7ff', '#7fb6e6',
  '#9fe0b0', '#4f7a5a', '#e3c77a', '#ffb347', '#e2552b',
  '#1a1020', '#0f1428', '#17110c', '#f5ead3', '#ffffff',
];

/** Checkerboard-backed swatch so transparency is visible. */
export function Swatch({ color, size = 28, selected, onPress, label }: { color: string; size?: number; selected?: boolean; onPress?: () => void; label?: string }) {
  const p = usePalette();
  const inner = (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', borderWidth: selected ? 3 : 1, borderColor: selected ? p.wine : p.line, backgroundColor: '#ddd' }}>
      <View style={{ position: 'absolute', width: size / 2, height: size / 2, backgroundColor: '#999' }} />
      <View style={{ position: 'absolute', left: size / 2, top: size / 2, width: size / 2, height: size / 2, backgroundColor: '#999' }} />
      <View style={{ flex: 1, backgroundColor: color }} />
    </View>
  );
  if (!onPress) return inner;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label ?? color} onPress={onPress} hitSlop={4}>
      {inner}
    </Pressable>
  );
}

/** Mount only while open — state initialises from the current value on mount. */
export function ColorPickerSheet({
  visible,
  title,
  value,
  fallback,
  themeSwatches,
  onChange,
  onClose,
  allowThemeDefault = true,
}: {
  visible: boolean;
  title: string;
  /** Current explicit value; '' means "use the theme colour". */
  value: string;
  /** The colour shown when value is '' (the theme token). */
  fallback?: string;
  themeSwatches?: { label: string; color: string }[];
  onChange: (v: string) => void;
  onClose: () => void;
  allowThemeDefault?: boolean;
}) {
  const p = usePalette();
  const effective = value || fallback || '#c9a24a';
  const [hsl, setHsl] = useState<HSLA>(() => rgbToHsl(parseColor(effective) ?? { r: 200, g: 160, b: 80, a: 1 }));
  const [hex, setHex] = useState(effective);

  const commit = (next: HSLA) => {
    setHsl(next);
    const css = toCss(hslToRgb(next));
    setHex(css);
    onChange(css);
  };
  const pick = (css: string) => {
    tap();
    const c = parseColor(css);
    if (c) setHsl(rgbToHsl(c));
    setHex(css);
    onChange(css);
  };

  const current = toCss(hslToRgb(hsl));
  const solid = toCss(hslToRgb({ ...hsl, a: 1 }));
  const hueStops = [0, 60, 120, 180, 240, 300, 360].map((h) => toCss(hslToRgb({ h, s: Math.max(40, hsl.s), l: 50, a: 1 })));

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={title}
      subtitle="Pick a pigment for your ink"
      footer={
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {allowThemeDefault ? (
            <Button
              label="Use theme colour"
              variant="ghost"
              small
              style={{ flex: 1 }}
              onPress={() => {
                onChange('');
                onClose();
              }}
            />
          ) : null}
          <Button label="Done" small style={{ flex: 1 }} onPress={onClose} />
        </View>
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <Swatch color={value ? current : effective} size={64} />
        <View style={{ flex: 1, gap: 6 }}>
          <Label>{value ? 'Custom colour' : 'Theme colour'}</Label>
          <TextInput
            value={hex}
            onChangeText={(t) => {
              setHex(t);
              const c = parseColor(t);
              if (c) {
                setHsl(rgbToHsl(c));
                onChange(toCss(c));
              }
            }}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Hex or rgba colour"
            style={[textInputStyle(p), { fontFamily: FONTS.mono, fontSize: 15 }]}
          />
        </View>
      </View>

      {themeSwatches && themeSwatches.length ? (
        <>
          <Label style={{ marginBottom: 8 }}>This bio’s palette</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
            {themeSwatches.map((s) => (
              <Swatch key={s.label} color={s.color} label={s.label} onPress={() => pick(s.color)} />
            ))}
          </View>
        </>
      ) : null}

      <Label style={{ marginBottom: 8 }}>Romantasy pigments</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
        {ROMANTASY_SWATCHES.map((c) => (
          <Swatch key={c} color={c} onPress={() => pick(c)} selected={value.toLowerCase() === c} />
        ))}
      </View>

      <SliderRow label="Hue" value={`${Math.round(hsl.h)}°`}>
        <Slider value={hsl.h} min={0} max={360} step={1} gradient={hueStops} onChange={(h) => commit({ ...hsl, h })} accessibilityLabel="Hue" />
      </SliderRow>
      <SliderRow label="Saturation" value={`${Math.round(hsl.s)}%`}>
        <Slider
          value={hsl.s}
          min={0}
          max={100}
          step={1}
          gradient={[toCss(hslToRgb({ ...hsl, s: 0, a: 1 })), toCss(hslToRgb({ ...hsl, s: 100, a: 1 }))]}
          onChange={(s) => commit({ ...hsl, s })}
          accessibilityLabel="Saturation"
        />
      </SliderRow>
      <SliderRow label="Lightness" value={`${Math.round(hsl.l)}%`}>
        <Slider value={hsl.l} min={0} max={100} step={1} gradient={['#000000', toCss(hslToRgb({ ...hsl, l: 50, a: 1 })), '#ffffff']} onChange={(l) => commit({ ...hsl, l })} accessibilityLabel="Lightness" />
      </SliderRow>
      <SliderRow label="Opacity" value={`${Math.round(hsl.a * 100)}%`}>
        <Slider value={hsl.a} min={0} max={1} step={0.01} gradient={['rgba(0,0,0,0)', solid]} onChange={(a) => commit({ ...hsl, a })} accessibilityLabel="Opacity" />
      </SliderRow>
      <Body size={15} italic tone="muted" style={{ marginTop: 6 }}>
        Lower opacity makes “tinted glass” fills — the rgba() trick from the Forgeworks templates.
      </Body>
    </Sheet>
  );
}

function SliderRow({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  const p = usePalette();
  return (
    <View style={{ marginBottom: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Label>{label}</Label>
        <Text style={{ fontFamily: FONTS.mono, fontSize: 12, color: p.muted }}>{value}</Text>
      </View>
      {children}
    </View>
  );
}
