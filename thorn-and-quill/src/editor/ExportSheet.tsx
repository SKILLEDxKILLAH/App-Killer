import * as Clipboard from 'expo-clipboard';
import React, { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, Share, Text, View } from 'react-native';

import { GUIDES, PUBLISH_METHODS } from '../core/guides';
import { lintBio, summarize, type Finding } from '../core/lint';
import { exportBio, type ExportFormat } from '../core/render';
import type { Bio } from '../core/types';
import { usePalette } from '../state/store';
import { Body, Button, Label, Segmented, Sheet, tap, Title } from '../ui/kit';
import { FONTS, RADIUS, SPACE } from '../ui/theme';

const FORMATS: { value: ExportFormat; label: string; note: string }[] = [
  { value: 'minified', label: 'Minified', note: 'Compact HTML — paste anywhere JAI accepts HTML.' },
  { value: 'pretty', label: 'Readable', note: 'Indented HTML for the Forgeworks Code tab or hand-editing.' },
  { value: 'console', label: 'Console', note: 'Minified with backticks escaped — paste in place of YOUR_HTML_CONTENT in DelightfulTempe’s script.' },
];

const PREVIEW_LIMIT = 12000;

export function ExportSheet({ bio, visible, onClose, onJumpTo }: { bio: Bio; visible: boolean; onClose: () => void; onJumpTo: (blockId: string) => void }) {
  const p = usePalette();
  const [format, setFormat] = useState<ExportFormat>('minified');
  const [copied, setCopied] = useState(false);
  const code = useMemo(() => (visible ? exportBio(bio, format) : ''), [bio, format, visible]);
  const findings = useMemo(() => (visible ? lintBio(bio) : []), [bio, visible]);
  const counts = summarize(findings);
  const bytes = useMemo(() => (typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(code).length : code.length), [code]);

  const copy = async () => {
    await Clipboard.setStringAsync(code);
    tap('success');
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const sevStyle = (f: Finding) =>
    f.severity === 'error' ? { glyph: '✕', color: p.danger } : f.severity === 'warn' ? { glyph: '⚠', color: p.gold } : { glyph: '✦', color: p.muted };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Seal & Export"
      subtitle={bio.name}
      tall
      footer={
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button label="Share" variant="ghost" icon="↗" style={{ flex: 1 }} onPress={() => Share.share({ message: code, title: bio.name }).catch(() => {})} />
          <Button label={copied ? 'Copied ✓' : 'Copy HTML'} icon={copied ? undefined : '⎘'} style={{ flex: 2 }} onPress={copy} />
        </View>
      }
    >
      {/* Rules check */}
      <View
        style={{
          borderRadius: RADIUS.md,
          borderWidth: 1,
          borderColor: counts.errors ? p.danger : p.line,
          backgroundColor: p.card,
          padding: SPACE.md,
          marginBottom: SPACE.lg,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Title size={16}>Rules of the Realm</Title>
          <Text style={{ fontFamily: FONTS.titleMedium, fontSize: 12, color: counts.errors ? p.danger : p.success }}>
            {counts.errors ? `${counts.errors} will be stripped` : counts.warnings ? `${counts.warnings} to check` : 'All clear ✓'}
          </Text>
        </View>
        {findings.length === 0 ? (
          <Body italic tone="muted" size={16} style={{ marginTop: 4 }}>
            Nothing here will be stripped by JanitorAI. Fly, little raven.
          </Body>
        ) : (
          findings.slice(0, 30).map((f, i) => {
            const s = sevStyle(f);
            return (
              <Pressable
                key={i}
                disabled={!f.blockId}
                accessibilityRole={f.blockId ? 'button' : undefined}
                accessibilityLabel={`${f.severity}: ${f.title}. ${f.detail}`}
                onPress={() => {
                  if (f.blockId) {
                    onClose();
                    onJumpTo(f.blockId);
                  }
                }}
                style={{ flexDirection: 'row', gap: 10, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: p.line, marginTop: i ? 0 : 8 }}
              >
                <Text style={{ color: s.color, width: 16, fontSize: 14 }}>{s.glyph}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 16, color: p.ink }}>{f.title}</Text>
                  <Text style={{ fontFamily: FONTS.body, fontSize: 15, color: p.inkSoft }}>{f.detail}</Text>
                  <Text style={{ fontFamily: FONTS.italic, fontSize: 13, color: p.muted }}>
                    {f.source}
                    {f.blockId ? ' · tap to fix' : ''}
                  </Text>
                </View>
              </Pressable>
            );
          })
        )}
      </View>

      <Segmented value={format} onChange={setFormat} options={FORMATS.map((f) => ({ value: f.value, label: f.label }))} />
      <Body italic size={15} tone="muted" style={{ marginTop: 6 }}>
        {FORMATS.find((f) => f.value === format)?.note}
      </Body>

      <View style={{ flexDirection: 'row', gap: SPACE.lg, marginVertical: SPACE.sm }}>
        <Label>{code.length.toLocaleString()} characters</Label>
        <Label>{(bytes / 1024).toFixed(1)} KB</Label>
      </View>

      <ScrollView
        nestedScrollEnabled
        style={{ maxHeight: 260, borderRadius: RADIUS.sm, backgroundColor: p.dark ? '#0b070e' : '#2a1d26', padding: 12 }}
        accessibilityLabel="Exported HTML"
      >
        <Text selectable style={{ fontFamily: FONTS.mono, fontSize: 11.5, lineHeight: 16, color: '#f1e3c8' }}>
          {code.length > PREVIEW_LIMIT ? code.slice(0, PREVIEW_LIMIT) + `\n\n… ${(code.length - PREVIEW_LIMIT).toLocaleString()} more characters (Copy includes everything)` : code}
        </Text>
      </ScrollView>

      <Title size={17} style={{ marginTop: SPACE.xl, marginBottom: 4 }}>
        Publishing to JanitorAI
      </Title>
      <Body size={16} tone="muted" style={{ marginBottom: SPACE.md }}>
        Per the guides, fully styled bios are saved through one of these two community methods rather than JAI’s built-in editor.
      </Body>
      {PUBLISH_METHODS.map((m) => (
        <View key={m.id} style={{ borderRadius: RADIUS.md, borderWidth: 1, borderColor: p.line, backgroundColor: p.card, padding: SPACE.md, marginBottom: SPACE.md }}>
          <Text style={{ fontFamily: FONTS.titleMedium, fontSize: 14, color: p.ink }}>{m.name}</Text>
          <Body size={16} italic tone="muted" style={{ marginBottom: 6 }}>
            {m.summary}
          </Body>
          {m.steps.map((s, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
              <Text style={{ fontFamily: FONTS.title, color: p.gold, width: 18 }}>{i + 1}</Text>
              <Body size={16} style={{ flex: 1 }}>
                {s}
              </Body>
            </View>
          ))}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <Button small variant="gold" label={`Use ${FORMATS.find((f) => f.value === m.format)?.label}`} onPress={() => setFormat(m.format)} />
            <Button small variant="ghost" label="Open guide" icon="↗" onPress={() => Linking.openURL(GUIDES[m.guide].url)} />
          </View>
        </View>
      ))}
    </Sheet>
  );
}
