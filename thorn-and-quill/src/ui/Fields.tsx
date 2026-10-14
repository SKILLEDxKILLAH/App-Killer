// Renders editable controls for an element's FieldSpecs.

import React, { useState } from 'react';
import { Image, Pressable, Switch, Text, TextInput, View } from 'react-native';

import type { BioTheme, FieldSpec, Props, ThemeColorKey, ThemeFontKey } from '../core/types';
import { usePalette } from '../state/store';
import { ColorPickerSheet, Swatch } from './ColorPicker';
import { appFontFor, FontPickerSheet } from './FontPicker';
import { Body, Chip, IconButton, Label, tap, textInputStyle } from './kit';
import { Slider } from './Slider';
import { FONTS, RADIUS } from './theme';

export const COLOR_NAMES: Record<ThemeColorKey, string> = {
  canvas: 'Page',
  canvas2: 'Page (fade to)',
  surface: 'Panels',
  border: 'Borders',
  accent: 'Gold accent',
  accent2: 'Second accent',
  accent3: 'Third accent',
  heading: 'Headings',
  text: 'Body text',
  muted: 'Muted text',
  warn: 'Warnings',
};

export function themeSwatches(theme: BioTheme) {
  return (Object.keys(COLOR_NAMES) as ThemeColorKey[]).map((k) => ({ label: COLOR_NAMES[k], color: theme.colors[k] }));
}

const isColorToken = (t: string | undefined): t is ThemeColorKey => !!t && t in COLOR_NAMES;
const isFontToken = (t: string | undefined): t is ThemeFontKey => t === 'display' || t === 'body' || t === 'label';

function insertToken(current: string, token: string) {
  return (current ?? '') + token;
}

export function FieldEditor({
  field,
  value,
  onChange,
  theme,
  noDefault,
}: {
  field: FieldSpec;
  value: any;
  onChange: (v: any, mergeKey?: string) => void;
  theme: BioTheme;
  /** Hide the "use theme colour" option (used when editing the theme itself). */
  noDefault?: boolean;
}) {
  const p = usePalette();
  const [colorOpen, setColorOpen] = useState(false);
  const [fontOpen, setFontOpen] = useState(false);
  const mergeKey = `field:${field.key}`;

  const header = (right?: React.ReactNode) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 8 }}>
      <Label style={{ flexShrink: 1 }}>{field.label}</Label>
      {right}
    </View>
  );
  const help = field.help ? (
    <Body size={14.5} italic tone="muted" style={{ marginTop: 4 }}>
      {field.help}
    </Body>
  ) : null;

  switch (field.kind) {
    case 'text':
    case 'multiline':
    case 'code': {
      const multiline = field.kind !== 'text';
      return (
        <View style={{ marginBottom: 16 }}>
          {header(
            field.kind !== 'code' ? (
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {['{{char}}', '{{user}}'].map((tok) => (
                  <Pressable
                    key={tok}
                    accessibilityRole="button"
                    accessibilityLabel={`Insert ${tok}`}
                    onPress={() => {
                      tap();
                      onChange(insertToken(value, tok));
                    }}
                    style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: p.goldSoft }}
                  >
                    <Text style={{ fontFamily: FONTS.mono, fontSize: 11, color: p.gold }}>{tok}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null,
          )}
          <TextInput
            value={value ?? ''}
            onChangeText={(t) => onChange(t, mergeKey)}
            placeholder={field.placeholder}
            placeholderTextColor={p.muted}
            multiline={multiline}
            autoCapitalize={field.kind === 'code' ? 'none' : 'sentences'}
            autoCorrect={field.kind !== 'code'}
            accessibilityLabel={field.label}
            style={[textInputStyle(p, multiline), field.kind === 'code' && { fontFamily: FONTS.mono, fontSize: 13, minHeight: 200 }]}
          />
          {help}
        </View>
      );
    }

    case 'image':
    case 'audio': {
      const url = String(value ?? '').trim();
      const ok = /^https:\/\//i.test(url);
      return (
        <View style={{ marginBottom: 16 }}>
          {header(url ? <Text style={{ fontFamily: FONTS.body, fontSize: 14, color: ok ? p.success : p.danger }}>{ok ? '✓ online link' : '⚠ needs https://'}</Text> : null)}
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            {field.kind === 'image' ? (
              <View style={{ width: 52, height: 52, borderRadius: 8, overflow: 'hidden', backgroundColor: p.pageDeep, borderWidth: 1, borderColor: p.line, alignItems: 'center', justifyContent: 'center' }}>
                {ok ? <Image source={{ uri: url }} style={{ width: 52, height: 52 }} resizeMode="cover" /> : <Text style={{ color: p.muted }}>▣</Text>}
              </View>
            ) : null}
            <TextInput
              value={value ?? ''}
              onChangeText={(t) => onChange(t.trim(), mergeKey)}
              placeholder={field.kind === 'image' ? 'https://files.catbox.moe/….png' : 'https://files.catbox.moe/….mp3'}
              placeholderTextColor={p.muted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              accessibilityLabel={field.label}
              style={[textInputStyle(p), { flex: 1, fontSize: 15, fontFamily: FONTS.mono }]}
            />
            {url ? <IconButton glyph="✕" label="Clear link" size={34} onPress={() => onChange('')} /> : null}
          </View>
          {help}
        </View>
      );
    }

    case 'color': {
      const token = isColorToken(field.themeToken) ? field.themeToken : undefined;
      const fallback = token ? theme.colors[token] : undefined;
      const shown = value || fallback || 'transparent';
      return (
        <View style={{ marginBottom: 14 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${field.label}: ${value || 'theme colour'}`}
            onPress={() => setColorOpen(true)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              padding: 10,
              borderRadius: RADIUS.md,
              borderWidth: 1,
              borderColor: p.line,
              backgroundColor: pressed ? p.cardRaised : p.card,
            })}
          >
            <Swatch color={shown} size={32} />
            <View style={{ flex: 1 }}>
              <Label>{field.label}</Label>
              <Text style={{ fontFamily: FONTS.mono, fontSize: 12, color: p.muted, marginTop: 2 }}>
                {value ? value : token ? `theme · ${COLOR_NAMES[token]}` : 'not set'}
              </Text>
            </View>
            <Text style={{ color: p.gold, fontSize: 18 }}>›</Text>
          </Pressable>
          {colorOpen ? (
          <ColorPickerSheet
            visible
            title={field.label}
            value={value ?? ''}
            fallback={fallback}
            themeSwatches={themeSwatches(theme)}
            allowThemeDefault={!noDefault}
            onChange={(v) => onChange(v, mergeKey)}
            onClose={() => setColorOpen(false)}
          />
          ) : null}
        </View>
      );
    }

    case 'font': {
      const token = isFontToken(field.themeToken) ? field.themeToken : undefined;
      const family = value || (token ? theme.fonts[token] : 'Georgia');
      return (
        <View style={{ marginBottom: 14 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${field.label}: ${family}`}
            onPress={() => setFontOpen(true)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              padding: 10,
              borderRadius: RADIUS.md,
              borderWidth: 1,
              borderColor: p.line,
              backgroundColor: pressed ? p.cardRaised : p.card,
            })}
          >
            <Text style={{ fontFamily: appFontFor(family), fontSize: 24, color: p.wine, width: 40, textAlign: 'center' }}>Aa</Text>
            <View style={{ flex: 1 }}>
              <Label>{field.label}</Label>
              <Text style={{ fontFamily: FONTS.body, fontSize: 16, color: p.ink }}>{value ? family : `${family} (theme)`}</Text>
            </View>
            <Text style={{ color: p.gold, fontSize: 18 }}>›</Text>
          </Pressable>
          {fontOpen ? (
          <FontPickerSheet
            visible
            title={field.label}
            value={value ?? ''}
            themeDefault={token ? theme.fonts[token] : undefined}
            onChange={(f) => onChange(f)}
            onClose={() => setFontOpen(false)}
          />
          ) : null}
        </View>
      );
    }

    case 'number': {
      const v = Number(value ?? field.min ?? 0);
      const step = field.step ?? 1;
      const clampV = (n: number) => Math.min(field.max ?? Infinity, Math.max(field.min ?? -Infinity, Number(n.toFixed(4))));
      return (
        <View style={{ marginBottom: 12 }}>
          {header(
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <IconButton glyph="−" label={`Decrease ${field.label}`} size={30} onPress={() => onChange(clampV(v - step))} />
              <Text style={{ fontFamily: FONTS.mono, fontSize: 13, color: p.ink, minWidth: 64, textAlign: 'center' }}>
                {Number.isInteger(step) ? v : v.toFixed(String(step).split('.')[1]?.length ?? 2)}
                {field.unit ?? ''}
              </Text>
              <IconButton glyph="+" label={`Increase ${field.label}`} size={30} onPress={() => onChange(clampV(v + step))} />
            </View>,
          )}
          <Slider value={v} min={field.min ?? 0} max={field.max ?? 100} step={step} onChange={(n) => onChange(n, mergeKey)} accessibilityLabel={field.label} />
          {help}
        </View>
      );
    }

    case 'select':
      return (
        <View style={{ marginBottom: 16 }}>
          {header()}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(field.options ?? []).map((o) => (
              <Chip key={o.value} label={o.label} selected={value === o.value} onPress={() => onChange(o.value)} />
            ))}
          </View>
          {help}
        </View>
      );

    case 'toggle':
      return (
        <View style={{ marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 40 }}>
            <Text style={{ fontFamily: FONTS.bodySemi, fontSize: 18, color: p.ink, flex: 1 }}>{field.label}</Text>
            <Switch
              value={!!value}
              onValueChange={(b) => {
                tap();
                onChange(b);
              }}
              trackColor={{ false: p.line, true: p.wine }}
              thumbColor={value ? p.goldSoft : p.cardRaised}
              {...({ activeThumbColor: p.goldSoft } as object) /* react-native-web */}
              accessibilityLabel={field.label}
            />
          </View>
          {help}
        </View>
      );

    case 'list':
      return <ListEditor field={field} value={Array.isArray(value) ? value : []} onChange={onChange} theme={theme} />;

    default:
      return null;
  }
}

function ListEditor({ field, value, onChange, theme }: { field: FieldSpec; value: Props[]; onChange: (v: any, mergeKey?: string) => void; theme: BioTheme }) {
  const p = usePalette();
  const [open, setOpen] = useState<number | null>(null);
  const max = field.maxItems ?? 50;
  const update = (i: number, patch: Props, mergeKey?: string) => onChange(value.map((it, j) => (j === i ? { ...it, ...patch } : it)), mergeKey);
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= value.length) return;
    const next = value.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
    if (open === i) setOpen(j);
  };
  return (
    <View style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Label>
          {field.label} · {value.length}
        </Label>
      </View>
      {value.map((item, i) => {
        const titleKey = field.itemTitleKey ?? field.itemFields?.[0]?.key ?? '';
        const titleText = String(item[titleKey] ?? '').trim() || `${field.itemLabel ?? 'Item'} ${i + 1}`;
        const isOpen = open === i;
        return (
          <View key={i} style={{ borderWidth: 1, borderColor: isOpen ? p.goldSoft : p.line, borderRadius: RADIUS.md, backgroundColor: p.card, marginBottom: 8, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 12 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: isOpen }}
                accessibilityLabel={`${titleText}, ${isOpen ? 'collapse' : 'edit'}`}
                onPress={() => setOpen(isOpen ? null : i)}
                style={{ flex: 1, paddingVertical: 12, flexDirection: 'row', gap: 8, alignItems: 'center' }}
              >
                <Text style={{ color: p.gold }}>{isOpen ? '▾' : '▸'}</Text>
                <Text numberOfLines={1} style={{ flex: 1, fontFamily: FONTS.bodySemi, fontSize: 17, color: p.ink }}>
                  {titleText}
                </Text>
              </Pressable>
              <IconButton glyph="↑" label="Move up" size={34} disabled={i === 0} onPress={() => move(i, -1)} />
              <IconButton glyph="↓" label="Move down" size={34} disabled={i === value.length - 1} onPress={() => move(i, 1)} />
              <IconButton glyph="✕" label={`Remove ${titleText}`} size={34} tone="danger" onPress={() => onChange(value.filter((_, j) => j !== i))} />
            </View>
            {isOpen ? (
              <View style={{ padding: 12, paddingTop: 4, borderTopWidth: 1, borderTopColor: p.line }}>
                {(field.itemFields ?? []).map((f) => (
                  <FieldEditor key={f.key} field={f} value={item[f.key]} theme={theme} onChange={(v, mk) => update(i, { [f.key]: v }, mk ? `${mk}:${i}` : undefined)} />
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
      {value.length < max ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            tap();
            const next = [...value, field.newItem ? field.newItem() : {}];
            onChange(next);
            setOpen(next.length - 1);
          }}
          style={({ pressed }) => ({
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: p.goldSoft,
            borderRadius: RADIUS.md,
            padding: 12,
            alignItems: 'center',
            backgroundColor: pressed ? p.cardRaised : 'transparent',
          })}
        >
          <Text style={{ fontFamily: FONTS.titleMedium, fontSize: 12, letterSpacing: 1.2, color: p.gold, textTransform: 'uppercase' }}>+ Add {field.itemLabel ?? 'item'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
