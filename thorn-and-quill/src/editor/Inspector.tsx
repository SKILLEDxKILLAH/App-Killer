import React, { useState } from 'react';
import { Text, View } from 'react-native';

import { BLOCK_MAP } from '../core/blocks';
import type { BioTheme, Block, FieldSpec } from '../core/types';
import { usePalette } from '../state/store';
import { FieldEditor } from '../ui/Fields';
import { Body, Button, IconButton, Segmented, Title } from '../ui/kit';
import { FONTS, SPACE } from '../ui/theme';

type Group = NonNullable<FieldSpec['group']>;

export interface BlockActions {
  update: (id: string, key: string, value: any, mergeKey?: string) => void;
  move: (id: string, dir: -1 | 1) => void;
  duplicate: (id: string) => void;
  remove: (id: string) => void;
  toggleHidden: (id: string) => void;
}

/** Header strip for an element: glyph, name, flavour. */
export function InspectorHeader({ block, onBack }: { block: Block; onBack?: () => void }) {
  const p = usePalette();
  const def = BLOCK_MAP[block.type];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: SPACE.md }}>
      {onBack ? <IconButton glyph="‹" label="Back to elements" onPress={onBack} /> : null}
      <View style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: p.goldSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: p.wine, fontSize: def.glyph.length > 1 ? 12 : 18 }}>{def.glyph}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Title size={18}>{def.name}</Title>
        <Body italic size={15} tone="gold">
          {def.flavor}
        </Body>
      </View>
    </View>
  );
}

/** Mount with key={block.id} so the tab resets when switching elements. */
export function InspectorBody({ block, theme, actions, onDone }: { block: Block; theme: BioTheme; actions: BlockActions; onDone?: () => void }) {
  const p = usePalette();
  const def = BLOCK_MAP[block.type];
  const groups = (['Content', 'Style', 'Layout'] as Group[]).filter((g) => def.fields.some((f) => (f.group ?? 'Content') === g));
  const [group, setGroup] = useState<Group>(groups[0] ?? 'Content');

  const fields = def.fields.filter((f) => (f.group ?? 'Content') === group && (!f.showIf || f.showIf(block.props)));
  return (
    <View>
      <Body size={16} tone="muted" style={{ marginBottom: SPACE.md }}>
        {def.description}
      </Body>
      {groups.length > 1 ? <Segmented value={group} onChange={setGroup} options={groups.map((g) => ({ value: g, label: g }))} style={{ marginBottom: SPACE.lg }} /> : null}
      {fields.map((f) => (
        <FieldEditor key={`${block.id}:${f.key}`} field={f} value={block.props[f.key]} theme={theme} onChange={(v, mk) => actions.update(block.id, f.key, v, mk ? `${block.id}:${mk}` : undefined)} />
      ))}

      <View style={{ height: 1, backgroundColor: p.line, marginVertical: SPACE.md }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Button small variant="ghost" icon="↑" label="Up" onPress={() => actions.move(block.id, -1)} />
        <Button small variant="ghost" icon="↓" label="Down" onPress={() => actions.move(block.id, 1)} />
        <Button small variant="ghost" icon="⧉" label="Duplicate" onPress={() => actions.duplicate(block.id)} />
        <Button small variant="ghost" icon={block.hidden ? '◉' : '◌'} label={block.hidden ? 'Show' : 'Hide'} onPress={() => actions.toggleHidden(block.id)} />
        <Button
          small
          variant="ghost"
          icon="✕"
          label="Remove"
          onPress={() => {
            actions.remove(block.id);
            onDone?.();
          }}
        />
      </View>
      <Text style={{ fontFamily: FONTS.italic, fontSize: 14, color: p.muted, marginTop: SPACE.md }}>Every change can be undone with ↶ in the top bar.</Text>
    </View>
  );
}
