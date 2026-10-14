import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { BLOCKS, CATEGORIES } from '../core/blocks';
import { usePalette } from '../state/store';
import { Body, Label, Sheet, Title, tap, useIsWide } from '../ui/kit';
import { FONTS, RADIUS, SPACE } from '../ui/theme';

/** The "add element" sheet: every element, grouped like chapters of a book. */
export function ElementCodex({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (type: string) => void }) {
  const p = usePalette();
  const wide = useIsWide();
  return (
    <Sheet visible={visible} onClose={onClose} title="The Codex of Elements" subtitle="Choose an element to add to your tale" tall>
      {CATEGORIES.map((cat) => {
        const items = BLOCKS.filter((b) => b.category === cat.id);
        if (!items.length) return null;
        return (
          <View key={cat.id} style={{ marginBottom: SPACE.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
              <Title size={16}>{cat.label}</Title>
              <Body italic size={15} tone="muted">
                {cat.flavor}
              </Body>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {items.map((b) => (
                <Pressable
                  key={b.type}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${b.name}. ${b.description}`}
                  onPress={() => {
                    tap('medium');
                    onPick(b.type);
                  }}
                  style={({ pressed }) => ({
                    width: wide ? '48.5%' : '100%',
                    flexDirection: 'row',
                    gap: 12,
                    padding: 12,
                    borderRadius: RADIUS.md,
                    borderWidth: 1,
                    borderColor: pressed ? p.gold : p.line,
                    backgroundColor: pressed ? p.cardRaised : p.card,
                  })}
                >
                  <View style={{ width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: p.goldSoft, alignItems: 'center', justifyContent: 'center', backgroundColor: p.page }}>
                    <Text style={{ color: p.wine, fontSize: b.glyph.length > 1 ? 13 : 19, fontFamily: b.glyph.length > 1 ? FONTS.mono : undefined }}>{b.glyph}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: FONTS.titleMedium, fontSize: 14, color: p.ink }}>{b.name}</Text>
                    <Text style={{ fontFamily: FONTS.italic, fontSize: 15, color: p.gold }}>{b.flavor}</Text>
                    <Text style={{ fontFamily: FONTS.body, fontSize: 15.5, color: p.inkSoft, marginTop: 2 }}>{b.description}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        );
      })}
      <Label style={{ textAlign: 'center', marginTop: 4 }}>New elements are added after the one you last selected</Label>
    </Sheet>
  );
}
