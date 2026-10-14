import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { JAI_FONTS } from '../core/fonts';
import { usePalette } from '../state/store';
import { Body, Label, Sheet, tap } from './kit';
import { FONTS, jaiFontKey, RADIUS } from './theme';

const LOADED = new Set(JAI_FONTS.filter((f) => !f.system && f.family !== 'Noto Sans JP').map((f) => f.family));

/** RN fontFamily to show a JAI font in the app itself. */
export function appFontFor(family: string): string | undefined {
  if (LOADED.has(family)) return jaiFontKey(family);
  if (family === 'Georgia') return Platform.select({ ios: 'Georgia', default: 'serif' });
  return undefined;
}

export function FontPickerSheet({
  visible,
  title,
  value,
  themeDefault,
  sample,
  onChange,
  onClose,
}: {
  visible: boolean;
  title: string;
  value: string;
  /** Theme font used when value is ''. Omit to hide the "theme default" option. */
  themeDefault?: string;
  sample?: string;
  onChange: (family: string) => void;
  onClose: () => void;
}) {
  const p = usePalette();
  const choose = (f: string) => {
    tap();
    onChange(f);
    onClose();
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={title} subtitle="Only these fonts render inside a JanitorAI bio" tall>
      {themeDefault !== undefined ? (
        <Row selected={!value} onPress={() => choose('')} family={themeDefault} name={`Theme default · ${themeDefault}`} mood="Follows the bio’s theme typography" sample={sample} />
      ) : null}
      {JAI_FONTS.map((f) => (
        <Row
          key={f.family}
          selected={value === f.family}
          onPress={() => choose(f.family)}
          family={f.family}
          name={f.family}
          mood={`${f.mood}${f.preloaded ? ' · preloaded by JAI' : ''}${f.system ? ' · system font' : ''}`}
          sample={sample}
        />
      ))}
      <Body size={15} italic tone="muted" style={{ marginTop: 8 }}>
        JAI loads 14 Google Font families; custom fonts via &lt;link&gt; are stripped. Fonts not pre-fetched by JAI may take a moment on first load.
      </Body>
    </Sheet>
  );

  function Row({ selected, onPress, family, name, mood, sample: s }: { selected: boolean; onPress: () => void; family: string; name: string; mood: string; sample?: string }) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={onPress}
        style={({ pressed }) => ({
          padding: 12,
          marginBottom: 8,
          borderRadius: RADIUS.md,
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? p.wine : p.line,
          backgroundColor: pressed ? p.cardRaised : p.card,
        })}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Label tone={selected ? 'wine' : 'muted'}>{name}</Label>
          {selected ? <Text style={{ color: p.wine }}>✓</Text> : null}
        </View>
        <Text numberOfLines={1} style={{ fontFamily: appFontFor(family), fontSize: family === 'Press Start 2P' ? 14 : 22, color: p.ink, marginVertical: 4 }}>
          {s || 'The crown, the thorn, the vow'}
        </Text>
        <Text style={{ fontFamily: FONTS.italic, fontSize: 15, color: p.muted }}>{mood}</Text>
      </Pressable>
    );
  }
}
