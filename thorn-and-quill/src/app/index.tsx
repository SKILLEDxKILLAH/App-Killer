import { router } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { STARTER_KITS } from '../core/factory';
import { THEMES } from '../core/themes';
import type { Bio } from '../core/types';
import { useStore } from '../state/store';
import { Body, Button, Card, Chip, IconButton, Label, Ornament, Page, Sheet, Title, tap, textInputStyle } from '../ui/kit';
import { ThemeCover } from '../ui/ThemeCover';
import { FONTS, SPACE } from '../ui/theme';

function relativeDate(ts: number) {
  const d = Math.round((Date.now() - ts) / 86400000);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 30) return `${d} days ago`;
  return new Date(ts).toLocaleDateString();
}

export default function Library() {
  const { bios, settings, updateSettings, palette: p } = useStore();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [creating, setCreating] = useState(false);
  const [actionsFor, setActionsFor] = useState<Bio | null>(null);

  const contentWidth = Math.min(width, 1100) - SPACE.lg * 2;
  const cols = width >= 1000 ? 5 : width >= 700 ? 4 : 2;
  const coverW = (contentWidth - SPACE.md * (cols - 1)) / cols;
  const sorted = [...bios].sort((a, b) => b.updatedAt - a.updatedAt);
  const nextAppearance = p.dark ? 'parchment' : 'nightfall';

  return (
    <Page>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + SPACE.md, paddingBottom: insets.bottom + 40, paddingHorizontal: SPACE.lg, alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: 1100 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 4 }}>
            <IconButton glyph="❧" label="Open the Codex (rules & publishing guide)" onPress={() => router.push('/codex')} />
            <IconButton
              glyph={p.dark ? '☀' : '☾'}
              label={p.dark ? 'Switch to Parchment (light)' : 'Switch to Nightfall (dark)'}
              onPress={() => updateSettings({ appearance: nextAppearance })}
            />
          </View>

          <View style={{ alignItems: 'center', marginTop: SPACE.sm }}>
            <Label tone="gold">✦ A bio atelier for JanitorAI ✦</Label>
            <Title size={40} style={{ marginTop: 8, textAlign: 'center' }} accessibilityRole="header">
              Thorn & Quill
            </Title>
            <Body italic size={20} style={{ textAlign: 'center', marginTop: 4 }}>
              Bind your bot’s bio in velvet, thorns and gold.
            </Body>
          </View>

          <Ornament />

          {!settings.prologueDismissed ? (
            <Card style={{ marginBottom: SPACE.lg }}>
              <Label tone="wine">Prologue</Label>
              <Title size={20} style={{ marginTop: 6, marginBottom: 8 }}>
                How a tale is bound
              </Title>
              {[
                ['I', 'Choose a theme and a starter kit — every element comes pre-written so you can rewrite rather than start from nothing.'],
                ['II', 'Add elements from the Codex and customise colours, fonts and layout. Tap anything in the preview to edit it.'],
                ['III', 'Export JAI-safe HTML. Every element uses inline styles only, so nothing gets stripped.'],
              ].map(([n, t]) => (
                <View key={n} style={{ flexDirection: 'row', gap: 12, marginBottom: 8 }}>
                  <Text style={{ fontFamily: FONTS.title, color: p.gold, width: 26, fontSize: 15 }}>{n}</Text>
                  <Body style={{ flex: 1 }}>{t}</Body>
                </View>
              ))}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                <Button label="Read the Codex" variant="gold" small onPress={() => router.push('/codex')} />
                <Button label="Close the prologue" variant="ghost" small onPress={() => updateSettings({ prologueDismissed: true })} />
              </View>
            </Card>
          ) : null}

          <Button label="Begin a new tale" icon="✒" onPress={() => setCreating(true)} style={{ alignSelf: 'center', paddingHorizontal: 32, minHeight: 54 }} />

          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: SPACE.xl, marginBottom: SPACE.md }}>
            <Title size={20}>Your Library</Title>
            <Label>{sorted.length} {sorted.length === 1 ? 'volume' : 'volumes'}</Label>
          </View>

          {sorted.length === 0 ? (
            <Card style={{ alignItems: 'center', paddingVertical: SPACE.xxl }}>
              <Text style={{ fontSize: 34, color: p.gold }}>❦</Text>
              <Title size={18} style={{ marginTop: 8 }}>
                The shelves stand empty
              </Title>
              <Body italic style={{ textAlign: 'center', marginTop: 6, maxWidth: 360 }}>
                Every legend begins with a single page. Start a new tale and your bios will be kept here.
              </Body>
            </Card>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.md }}>
              {sorted.map((b) => (
                <ThemeCover
                  key={b.id}
                  theme={b.theme}
                  title={b.name}
                  subtitle={b.theme.name}
                  footer={`${b.blocks.length} elements · ${relativeDate(b.updatedAt)}`}
                  style={{ width: coverW }}
                  height={coverW * 1.42}
                  accessibilityLabel={`${b.name}, ${b.theme.name}. Double tap to open, long press for options.`}
                  onPress={() => router.push({ pathname: '/editor/[id]', params: { id: b.id } })}
                  onLongPress={() => {
                    tap('medium');
                    setActionsFor(b);
                  }}
                />
              ))}
            </View>
          )}
          {sorted.length > 0 ? (
            <Body italic tone="muted" size={15} style={{ textAlign: 'center', marginTop: SPACE.lg }}>
              Long-press a volume to rename, duplicate or delete it.
            </Body>
          ) : null}
        </View>
      </ScrollView>

      <NewTaleSheet visible={creating} onClose={() => setCreating(false)} />
      <VolumeActions bio={actionsFor} onClose={() => setActionsFor(null)} />
    </Page>
  );
}

function NewTaleSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { createBio, palette: p } = useStore();
  const { width } = useWindowDimensions();
  const [name, setName] = useState('');
  const [themeId, setThemeId] = useState(THEMES[0].id);
  const [kit, setKit] = useState('full');
  const coverW = Math.min(150, (Math.min(width, 620) - 64) / 2.4);
  const kitInfo = STARTER_KITS.find((k) => k.id === kit);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Begin a new tale"
      subtitle="Name it, dress it, choose how much is pre-written"
      tall
      footer={
        <Button
          label="Bind the book"
          icon="❦"
          onPress={() => {
            const bio = createBio(name || 'Untitled Tale', themeId, kit);
            onClose();
            setName('');
            router.push({ pathname: '/editor/[id]', params: { id: bio.id } });
          }}
        />
      }
    >
      <Label style={{ marginBottom: 6 }}>Title</Label>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. The Thorn Prince"
        placeholderTextColor={p.muted}
        style={textInputStyle(p)}
        accessibilityLabel="Bio title"
        returnKeyType="done"
      />

      <Label style={{ marginTop: SPACE.lg, marginBottom: 8 }}>Theme</Label>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 4, paddingRight: 8 }}>
        {THEMES.map((t) => (
          <View key={t.id} style={{ width: coverW }}>
            <ThemeCover theme={t} selected={t.id === themeId} onPress={() => setThemeId(t.id)} height={coverW * 1.35} />
            <Body size={14} italic tone="muted" numberOfLines={2} style={{ marginTop: 6, textAlign: 'center' }}>
              {t.tagline}
            </Body>
          </View>
        ))}
      </ScrollView>

      <Label style={{ marginTop: SPACE.lg, marginBottom: 8 }}>Starter kit</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {STARTER_KITS.map((k) => (
          <Chip key={k.id} label={k.name} selected={k.id === kit} onPress={() => setKit(k.id)} />
        ))}
      </View>
      {kitInfo ? (
        <Body italic size={16} tone="muted" style={{ marginTop: 8 }}>
          {kitInfo.flavor} — {kitInfo.description}
        </Body>
      ) : null}
    </Sheet>
  );
}

function VolumeActions({ bio, onClose }: { bio: Bio | null; onClose: () => void }) {
  const { renameBio, duplicate, deleteBio, palette: p } = useStore();
  const [name, setName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [lastId, setLastId] = useState<string | null>(null);
  if (bio && bio.id !== lastId) {
    setLastId(bio.id);
    setName(bio.name);
    setConfirmDelete(false);
  }
  const close = () => {
    setConfirmDelete(false);
    onClose();
  };
  return (
    <Sheet visible={!!bio} onClose={close} title={bio?.name ?? ''} subtitle="Volume options">
      <Label style={{ marginBottom: 6 }}>Rename</Label>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <TextInput value={name} onChangeText={setName} style={[textInputStyle(p), { flex: 1 }]} accessibilityLabel="New title" />
        <Button
          label="Save"
          small
          onPress={() => {
            if (bio) renameBio(bio.id, name);
            close();
          }}
        />
      </View>
      <View style={{ gap: 10, marginTop: SPACE.lg }}>
        <Button label="Open" variant="gold" onPress={() => { if (bio) router.push({ pathname: '/editor/[id]', params: { id: bio.id } }); close(); }} />
        <Button label="Duplicate" variant="ghost" icon="⧉" onPress={() => { if (bio) duplicate(bio.id); close(); }} />
        <Button
          label={confirmDelete ? 'Tap again to burn it forever' : 'Delete'}
          variant={confirmDelete ? 'danger' : 'ghost'}
          icon="✕"
          onPress={() => {
            if (!confirmDelete) return setConfirmDelete(true);
            if (bio) deleteBio(bio.id);
            close();
          }}
        />
      </View>
    </Sheet>
  );
}
