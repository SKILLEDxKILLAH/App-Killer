import { router } from 'expo-router';
import React from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BLOCKS } from '../core/blocks';
import { JAI_FONTS } from '../core/fonts';
import { toRoman } from '../core/html';
import { FORGEWORKS_URL, GUIDES, PUBLISH_METHODS, RULES } from '../core/guides';
import { useStore } from '../state/store';
import { appFontFor } from '../ui/FontPicker';
import { Body, Button, Card, IconButton, Label, Ornament, Page, Title } from '../ui/kit';
import { FONTS, SPACE } from '../ui/theme';

/** The Codex: rules of the realm, publishing paths and credit to the guides this app is built on. */
export default function Codex() {
  const { palette: p } = useStore();
  const insets = useSafeAreaInsets();
  return (
    <Page>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + SPACE.sm, paddingBottom: insets.bottom + 48, paddingHorizontal: SPACE.lg, alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: 760 }}>
          <IconButton glyph="‹" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
          <Label tone="gold" style={{ textAlign: 'center' }}>
            ✦ Field guide ✦
          </Label>
          <Title size={30} style={{ textAlign: 'center', marginTop: 6 }} accessibilityRole="header">
            The Codex
          </Title>
          <Body italic size={19} style={{ textAlign: 'center', marginTop: 4 }}>
            What JanitorAI keeps, what it burns, and how to send your tale out into the world.
          </Body>
          <Ornament />

          <Title size={20} style={{ marginBottom: SPACE.sm }}>
            Built on two guides
          </Title>
          {(Object.keys(GUIDES) as (keyof typeof GUIDES)[]).map((k) => (
            <Card key={k} style={{ marginBottom: SPACE.md }}>
              <Text style={{ fontFamily: FONTS.titleMedium, fontSize: 14, color: p.ink }}>{GUIDES[k].title}</Text>
              <Body italic tone="muted">by {GUIDES[k].author}</Body>
              <Button small variant="gold" icon="↗" label="Read the guide" style={{ alignSelf: 'flex-start', marginTop: 8 }} onPress={() => Linking.openURL(GUIDES[k].url)} />
            </Card>
          ))}
          <Body size={16} tone="muted">
            Every rule below is enforced by the element library and checked again by the Rules of the Realm before you export.
          </Body>

          <Ornament glyph="⚜" />
          <Title size={20} style={{ marginBottom: SPACE.sm }}>
            Rules of the Realm
          </Title>
          {RULES.map((r, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 12, marginBottom: SPACE.md }}>
              <Text style={{ fontFamily: FONTS.title, color: p.gold, width: 30, fontSize: 14 }}>{toRoman(i + 1)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: FONTS.titleMedium, fontSize: 14, color: p.ink }}>{r.title}</Text>
                <Body>{r.body}</Body>
                <Text style={{ fontFamily: FONTS.italic, fontSize: 14, color: p.muted }}>— {GUIDES[r.source].author}</Text>
              </View>
            </View>
          ))}

          <Ornament glyph="✒" />
          <Title size={20} style={{ marginBottom: SPACE.sm }}>
            Publishing
          </Title>
          {PUBLISH_METHODS.map((m) => (
            <Card key={m.id} style={{ marginBottom: SPACE.md }}>
              <Text style={{ fontFamily: FONTS.titleMedium, fontSize: 14, color: p.ink }}>{m.name}</Text>
              <Body italic tone="muted" style={{ marginBottom: 6 }}>
                {m.summary}
              </Body>
              {m.steps.map((s, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
                  <Text style={{ fontFamily: FONTS.title, color: p.gold, width: 18 }}>{i + 1}</Text>
                  <Body style={{ flex: 1 }}>{s}</Body>
                </View>
              ))}
              {m.id === 'forgeworks' ? (
                <Button small variant="ghost" icon="↗" label="Open Forgeworks" style={{ alignSelf: 'flex-start', marginTop: 8 }} onPress={() => Linking.openURL(FORGEWORKS_URL)} />
              ) : null}
            </Card>
          ))}
          <Body size={16} tone="muted" italic>
            DelightfulTempe asks that this freedom isn’t used to ruin the experience for other readers — keep bios within their container and readable.
          </Body>

          <Ornament glyph="❧" />
          <Title size={20} style={{ marginBottom: SPACE.sm }}>
            Fonts that render in a bio
          </Title>
          {JAI_FONTS.map((f) => (
            <View key={f.family} style={{ marginBottom: 10 }}>
              <Text style={{ fontFamily: appFontFor(f.family), fontSize: f.family === 'Press Start 2P' ? 14 : 22, color: p.ink }}>{f.family}</Text>
              <Body size={15} tone="muted">
                {f.mood} · weights {f.weights}
                {f.preloaded ? ' · preloaded' : ''}
              </Body>
            </View>
          ))}

          <Ornament glyph="✦" />
          <Title size={20} style={{ marginBottom: SPACE.sm }}>
            {BLOCKS.length} elements
          </Title>
          <Body>
            {BLOCKS.map((b) => b.name).join(' · ')}
          </Body>
        </View>
      </ScrollView>
    </Page>
  );
}
