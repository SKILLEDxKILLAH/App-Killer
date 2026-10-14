import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BLOCK_MAP } from '../../core/blocks';
import { cloneBlock, newBlock } from '../../core/factory';
import { lintBio, summarize } from '../../core/lint';
import type { PreviewOptions, PreviewSite } from '../../core/render';
import type { Bio, BioTheme } from '../../core/types';
import { Composer } from '../../editor/Composer';
import { ElementCodex } from '../../editor/ElementCodex';
import { ExportSheet } from '../../editor/ExportSheet';
import { InspectorBody, InspectorHeader, type BlockActions } from '../../editor/Inspector';
import { PreviewPane, type DeviceWidth } from '../../editor/PreviewPane';
import { ThemePanel } from '../../editor/ThemePanel';
import { useHistory, useStore } from '../../state/store';
import { Body, Button, IconButton, Page, Segmented, Sheet, Title, tap, textInputStyle, useIsWide } from '../../ui/kit';
import { FONTS, SPACE } from '../../ui/theme';

type Tab = 'compose' | 'theme' | 'preview';

export default function EditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getBio } = useStore();
  const bio = getBio(String(id));
  if (!bio) return <Missing />;
  return <Editor initial={bio} />;
}

function Missing() {
  const insets = useSafeAreaInsets();
  return (
    <Page style={{ paddingTop: insets.top + 40, alignItems: 'center', padding: SPACE.xl }}>
      <Title size={22}>This volume is lost</Title>
      <Body italic style={{ marginVertical: SPACE.md, textAlign: 'center' }}>
        It may have been deleted, or the link is from another device.
      </Body>
      <Button label="Back to the library" onPress={() => router.replace('/')} />
    </Page>
  );
}

function Editor({ initial }: { initial: Bio }) {
  const { saveBio, palette: p } = useStore();
  const insets = useSafeAreaInsets();
  const wide = useIsWide();
  const h = useHistory<Bio>(initial);
  const bio = h.value;

  // Persist every change (the store debounces writes).
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    saveBio(bio);
  }, [bio, saveBio]);

  const [tab, setTab] = useState<Tab>('compose');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [codexOpen, setCodexOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [device, setDevice] = useState<DeviceWidth>('phone');
  const [previewOpts, setPreviewOpts] = useState<Omit<PreviewOptions, 'selectedId'>>({
    site: initial.theme.light ? 'light' : 'dark',
    tapToEdit: true,
  });

  const selected = bio.blocks.find((b) => b.id === selectedId) ?? null;
  const opts = useMemo<PreviewOptions>(() => ({ ...previewOpts, selectedId: inspectorOpen ? selectedId : null }), [previewOpts, selectedId, inspectorOpen]);

  // ── mutations ───────────────────────────────────────────────────────────────
  const setBlocks = useCallback((fn: (b: Bio['blocks']) => Bio['blocks'], mergeKey?: string) => h.set((prev) => ({ ...prev, blocks: fn(prev.blocks) }), mergeKey), [h]);

  const actions: BlockActions = useMemo(
    () => ({
      update: (bid, key, value, mergeKey) => setBlocks((bs) => bs.map((b) => (b.id === bid ? { ...b, props: { ...b.props, [key]: value } } : b)), mergeKey),
      move: (bid, dir) =>
        setBlocks((bs) => {
          const i = bs.findIndex((b) => b.id === bid);
          const j = i + dir;
          if (i < 0 || j < 0 || j >= bs.length) return bs;
          const next = bs.slice();
          [next[i], next[j]] = [next[j], next[i]];
          return next;
        }),
      duplicate: (bid) =>
        setBlocks((bs) => {
          const i = bs.findIndex((b) => b.id === bid);
          if (i < 0) return bs;
          const copy = cloneBlock(bs[i]);
          setSelectedId(copy.id);
          return [...bs.slice(0, i + 1), copy, ...bs.slice(i + 1)];
        }),
      remove: (bid) => {
        setBlocks((bs) => bs.filter((b) => b.id !== bid));
        setSelectedId((s) => (s === bid ? null : s));
        setInspectorOpen(false);
      },
      toggleHidden: (bid) => setBlocks((bs) => bs.map((b) => (b.id === bid ? { ...b, hidden: !b.hidden } : b))),
    }),
    [setBlocks],
  );

  const addBlock = (type: string) => {
    const block = newBlock(type);
    setBlocks((bs) => {
      let at = bs.findIndex((b) => b.id === selectedId);
      if (at >= 0) at += 1;
      else {
        // default: at the end, but before a trailing footer
        at = bs.length && bs[bs.length - 1].type === 'footer' ? bs.length - 1 : bs.length;
      }
      return [...bs.slice(0, at), block, ...bs.slice(at)];
    });
    setCodexOpen(false);
    openInspector(block.id);
  };

  const setTheme = (theme: BioTheme, mergeKey?: string) => h.set((prev) => ({ ...prev, theme }), mergeKey);

  const openInspector = (bid: string) => {
    setSelectedId(bid);
    setInspectorOpen(true);
    if (wide && tab === 'theme') setTab('compose');
  };

  const lintCounts = useMemo(() => summarize(lintBio(bio)), [bio]);

  // ── layout pieces ───────────────────────────────────────────────────────────
  const topBar = (
    <View style={{ paddingTop: insets.top + 4, paddingHorizontal: SPACE.sm, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: p.line, backgroundColor: p.card }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        <IconButton glyph="‹" label="Back to library" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            onPress={() => setRenaming(true)}
            accessibilityRole="button"
            accessibilityHint="Rename this bio"
            style={{ fontFamily: FONTS.title, fontSize: 17, color: p.ink }}
          >
            {bio.name}
          </Text>
          <Text numberOfLines={1} style={{ fontFamily: FONTS.italic, fontSize: 14, color: p.muted }}>
            {bio.theme.name} · {bio.blocks.length} elements
          </Text>
        </View>
        <IconButton glyph="↶" label="Undo" disabled={!h.canUndo} onPress={h.undo} />
        <IconButton glyph="↷" label="Redo" disabled={!h.canRedo} onPress={h.redo} />
        <Button
          small
          label="Export"
          icon={lintCounts.errors ? '⚠' : '❦'}
          accessibilityLabel={lintCounts.errors ? `Export, ${lintCounts.errors} problems` : 'Export'}
          onPress={() => setExportOpen(true)}
          style={{ marginLeft: 4 }}
        />
      </View>
    </View>
  );

  const inspectorInline = selected ? (
    <View>
      <InspectorHeader block={selected} onBack={() => setInspectorOpen(false)} />
      <InspectorBody key={selected.id} block={selected} theme={bio.theme} actions={actions} onDone={() => setInspectorOpen(false)} />
    </View>
  ) : null;

  const composer = (
    <Composer bio={bio} selectedId={selectedId} onSelect={openInspector} onAdd={() => setCodexOpen(true)} actions={actions} />
  );

  const preview = (
    <PreviewPane
      bio={bio}
      opts={opts}
      device={device}
      onDevice={setDevice}
      onSite={(site: PreviewSite) => setPreviewOpts((o) => ({ ...o, site }))}
      onTapToEdit={(tapToEdit) => setPreviewOpts((o) => ({ ...o, tapToEdit }))}
      onSelect={(bid) => {
        tap();
        openInspector(bid);
      }}
    />
  );

  let body: React.ReactNode;
  if (wide) {
    body = (
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <View style={{ width: 460, borderRightWidth: 1, borderRightColor: p.line }}>
          {!inspectorOpen || !selected ? (
            <View style={{ padding: SPACE.md, paddingBottom: 0 }}>
              <Segmented
                value={tab === 'preview' ? 'compose' : tab}
                onChange={(t) => setTab(t)}
                options={[
                  { value: 'compose', label: 'Compose' },
                  { value: 'theme', label: 'Theme' },
                ]}
              />
            </View>
          ) : null}
          <ScrollView contentContainerStyle={{ padding: SPACE.md, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
            {inspectorOpen && selected ? inspectorInline : tab === 'theme' ? <ThemePanel theme={bio.theme} onChange={setTheme} /> : composer}
          </ScrollView>
        </View>
        <View style={{ flex: 1 }}>{preview}</View>
      </View>
    );
  } else {
    body = (
      <View style={{ flex: 1 }}>
        <View style={{ padding: SPACE.md, paddingBottom: SPACE.sm }}>
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: 'compose', label: 'Compose' },
              { value: 'theme', label: 'Theme' },
              { value: 'preview', label: 'Preview' },
            ]}
          />
        </View>
        {tab === 'preview' ? (
          preview
        ) : (
          <ScrollView contentContainerStyle={{ padding: SPACE.md, paddingTop: SPACE.xs, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
            {tab === 'theme' ? <ThemePanel theme={bio.theme} onChange={setTheme} /> : composer}
          </ScrollView>
        )}
        <Sheet
          visible={inspectorOpen && !!selected}
          onClose={() => setInspectorOpen(false)}
          title={selected ? BLOCK_MAP[selected.type].name : ''}
          subtitle={selected ? BLOCK_MAP[selected.type].flavor : ''}
          tall
          footer={
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button small variant="ghost" label="See preview" style={{ flex: 1 }} onPress={() => { setInspectorOpen(false); setTab('preview'); }} />
              <Button small label="Done" style={{ flex: 1 }} onPress={() => setInspectorOpen(false)} />
            </View>
          }
        >
          {selected ? <InspectorBody key={selected.id} block={selected} theme={bio.theme} actions={actions} onDone={() => setInspectorOpen(false)} /> : null}
        </Sheet>
      </View>
    );
  }

  return (
    <Page>
      {topBar}
      {body}
      <ElementCodex visible={codexOpen} onClose={() => setCodexOpen(false)} onPick={addBlock} />
      <ExportSheet bio={bio} visible={exportOpen} onClose={() => setExportOpen(false)} onJumpTo={openInspector} />
      {renaming ? (
        <RenameSheet
        name={bio.name}
        onClose={() => setRenaming(false)}
          onSave={(name) => h.set((prev) => ({ ...prev, name: name.trim() || prev.name }))}
        />
      ) : null}
    </Page>
  );
}

function RenameSheet({ name, onClose, onSave }: { name: string; onClose: () => void; onSave: (n: string) => void }) {
  const { palette: p } = useStore();
  const [value, setValue] = useState(name);
  return (
    <Sheet
      visible
      onClose={onClose}
      title="Retitle this tale"
      footer={
        <Button
          label="Save title"
          onPress={() => {
            onSave(value);
            onClose();
          }}
        />
      }
    >
      <TextInput value={value} onChangeText={setValue} autoFocus style={textInputStyle(p)} accessibilityLabel="Title" returnKeyType="done" onSubmitEditing={() => { onSave(value); onClose(); }} />
    </Sheet>
  );
}
