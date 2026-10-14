import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { BLOCK_MAP } from '../core/blocks';
import type { Bio } from '../core/types';
import { usePalette } from '../state/store';
import { Body, Button, IconButton, Label, tap } from '../ui/kit';
import { FONTS, RADIUS, SPACE } from '../ui/theme';
import type { BlockActions } from './Inspector';

/** The table of contents: every element in order, tap to edit. */
export function Composer({
  bio,
  selectedId,
  onSelect,
  onAdd,
  actions,
}: {
  bio: Bio;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  actions: BlockActions;
}) {
  const p = usePalette();
  const firstInsideIdx = bio.blocks.findIndex((b) => !(BLOCK_MAP[b.type]?.canSitOutside && b.props.outside));
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: SPACE.sm }}>
        <Label>Table of contents · {bio.blocks.length}</Label>
        <Label tone="gold">tap to edit</Label>
      </View>
      {bio.blocks.length === 0 ? (
        <Body italic tone="muted" style={{ textAlign: 'center', marginVertical: SPACE.xl }}>
          An empty page. Add your first element below.
        </Body>
      ) : null}
      {bio.blocks.map((b, i) => {
        const def = BLOCK_MAP[b.type];
        if (!def) return null;
        const sel = b.id === selectedId;
        const summary = def.summary?.(b.props) ?? def.description;
        const showFrameMarker = i === firstInsideIdx;
        return (
          <View key={b.id}>
            {showFrameMarker ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 6 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: p.goldSoft }} />
                <Text style={{ fontFamily: FONTS.titleRegular, fontSize: 10, letterSpacing: 1.5, color: p.gold }}>INSIDE THE CARD</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: p.goldSoft }} />
              </View>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${def.name}${b.hidden ? ' (hidden)' : ''}: ${summary}. Edit.`}
              onPress={() => {
                tap();
                onSelect(b.id);
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingVertical: 8,
                paddingLeft: 10,
                paddingRight: 4,
                marginBottom: 8,
                borderRadius: RADIUS.md,
                borderWidth: sel ? 2 : 1,
                borderColor: sel ? p.wine : p.line,
                backgroundColor: pressed ? p.cardRaised : p.card,
                opacity: b.hidden ? 0.55 : 1,
              })}
            >
              <View style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: p.goldSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: p.wine, fontSize: def.glyph.length > 1 ? 11 : 16 }}>{def.glyph}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontFamily: FONTS.titleMedium, fontSize: 13, color: p.ink }}>
                  {def.name}
                  {b.hidden ? '  · hidden' : ''}
                </Text>
                <Text numberOfLines={1} style={{ fontFamily: FONTS.body, fontSize: 15.5, color: p.muted }}>
                  {summary}
                </Text>
              </View>
              <IconButton glyph="↑" label={`Move ${def.name} up`} size={34} disabled={i === 0} onPress={() => actions.move(b.id, -1)} />
              <IconButton glyph="↓" label={`Move ${def.name} down`} size={34} disabled={i === bio.blocks.length - 1} onPress={() => actions.move(b.id, 1)} />
            </Pressable>
          </View>
        );
      })}
      <Button label="Add an element" icon="+" variant="gold" onPress={onAdd} style={{ marginTop: SPACE.sm }} />
    </View>
  );
}
