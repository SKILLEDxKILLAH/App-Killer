// Shared UI primitives with the Thorn & Quill book-binding look.

import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePalette } from '../state/store';
import { FONTS, RADIUS, SPACE, type Palette } from './theme';

export function tap(kind: 'light' | 'medium' | 'success' = 'light') {
  if (Platform.OS === 'web') return;
  try {
    if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else Haptics.impactAsync(kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // haptics are a nicety
  }
}

export function useIsWide() {
  const { width } = useWindowDimensions();
  return width >= 900;
}

/** Page background: parchment (or night cloth) with a soft vignette. */
export function Page({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const p = usePalette();
  return (
    <View style={[{ flex: 1, backgroundColor: p.page }, style]}>
      <LinearGradient
        pointerEvents="none"
        colors={p.dark ? ['#241630', p.page, p.pageDeep] : ['#f8efdc', p.page, p.pageDeep]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

type Tone = 'ink' | 'soft' | 'muted' | 'wine' | 'gold' | 'onWine' | 'danger';
const toneColor = (p: Palette, tone: Tone) =>
  ({ ink: p.ink, soft: p.inkSoft, muted: p.muted, wine: p.wine, gold: p.gold, onWine: p.onWine, danger: p.danger })[tone];

export function Title({ children, size = 26, tone = 'ink', style, ...rest }: TextProps & { size?: number; tone?: Tone }) {
  const p = usePalette();
  return (
    <Text {...rest} style={[{ fontFamily: FONTS.title, fontSize: size, color: toneColor(p, tone), letterSpacing: 0.5 }, style]}>
      {children}
    </Text>
  );
}

export function Body({ children, size = 18, tone = 'soft', italic, style, ...rest }: TextProps & { size?: number; tone?: Tone; italic?: boolean }) {
  const p = usePalette();
  return (
    <Text {...rest} style={[{ fontFamily: italic ? FONTS.italic : FONTS.body, fontSize: size, lineHeight: size * 1.35, color: toneColor(p, tone) }, style]}>
      {children}
    </Text>
  );
}

/** Small-caps label, Cinzel. */
export function Label({ children, tone = 'muted', size = 11, style, ...rest }: TextProps & { tone?: Tone; size?: number }) {
  const p = usePalette();
  return (
    <Text {...rest} style={[{ fontFamily: FONTS.titleMedium, fontSize: size, letterSpacing: 1.6, textTransform: 'uppercase', color: toneColor(p, tone) }, style]}>
      {children}
    </Text>
  );
}

export function Ornament({ glyph = '❦', style }: { glyph?: string; style?: StyleProp<ViewStyle> }) {
  const p = usePalette();
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: SPACE.md }, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <LinearGradient colors={['transparent', p.goldSoft]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, height: 1 }} />
      <Text style={{ color: p.gold, fontSize: 16 }}>{glyph}</Text>
      <LinearGradient colors={[p.goldSoft, 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, height: 1 }} />
    </View>
  );
}

export function Card({ children, style, raised }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; raised?: boolean }) {
  const p = usePalette();
  return (
    <View
      style={[
        {
          backgroundColor: raised ? p.cardRaised : p.card,
          borderRadius: RADIUS.md,
          borderWidth: StyleSheet.hairlineWidth * 2,
          borderColor: p.line,
          padding: SPACE.lg,
          shadowColor: '#2b0f1c',
          shadowOpacity: p.dark ? 0.4 : 0.08,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

type ButtonVariant = 'wine' | 'gold' | 'ghost' | 'danger';

export function Button({
  label,
  onPress,
  variant = 'wine',
  icon,
  small,
  disabled,
  style,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: string;
  small?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const p = usePalette();
  const bg = variant === 'wine' ? p.wine : variant === 'danger' ? p.danger : 'transparent';
  const fg = variant === 'wine' || variant === 'danger' ? p.onWine : variant === 'gold' ? p.gold : p.inkSoft;
  const border = variant === 'gold' ? p.gold : variant === 'ghost' ? p.line : 'transparent';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          backgroundColor: bg,
          borderColor: border,
          borderWidth: variant === 'gold' || variant === 'ghost' ? 1 : 0,
          borderRadius: RADIUS.pill,
          paddingHorizontal: small ? 14 : 20,
          minHeight: small ? 36 : 46,
          opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        variant === 'wine' && !disabled && { shadowColor: p.wineDeep, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
        style,
      ]}
    >
      {icon ? <Text style={{ color: fg, fontSize: small ? 14 : 16 }}>{icon}</Text> : null}
      <Text style={{ fontFamily: FONTS.titleMedium, fontSize: small ? 12 : 14, letterSpacing: 1.2, color: fg, textTransform: 'uppercase' }}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({
  glyph,
  onPress,
  label,
  disabled,
  size = 40,
  active,
  tone,
}: {
  glyph: string;
  onPress: () => void;
  label: string;
  disabled?: boolean;
  size?: number;
  active?: boolean;
  tone?: Tone;
}) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      disabled={disabled}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: active ? p.wine : pressed ? (p.dark ? '#ffffff14' : '#00000010') : 'transparent',
        opacity: disabled ? 0.3 : 1,
      })}
    >
      <Text style={{ fontSize: size * 0.45, color: active ? p.onWine : tone ? toneColor(p, tone) : p.inkSoft }}>{glyph}</Text>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, style }: { label: string; selected?: boolean; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [
        {
          paddingHorizontal: 14,
          paddingVertical: 8,
          minHeight: 36,
          justifyContent: 'center',
          borderRadius: RADIUS.pill,
          borderWidth: 1,
          borderColor: selected ? p.wine : p.line,
          backgroundColor: selected ? p.wine : pressed ? p.cardRaised : p.card,
        },
        style,
      ]}
    >
      <Text style={{ fontFamily: FONTS.bodySemi, fontSize: 16, color: selected ? p.onWine : p.inkSoft }}>{label}</Text>
    </Pressable>
  );
}

/** Segmented control styled as ribbon tabs. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  style,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const p = usePalette();
  return (
    <View style={[{ flexDirection: 'row', backgroundColor: p.dark ? '#00000040' : '#0000000a', borderRadius: RADIUS.pill, padding: 4, gap: 4 }, style]} accessibilityRole="tablist">
      {options.map((o) => {
        const sel = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: sel }}
            onPress={() => {
              tap();
              onChange(o.value);
            }}
            style={{ flex: 1, minHeight: 36, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: sel ? p.card : 'transparent', borderWidth: sel ? 1 : 0, borderColor: p.line }}
          >
            <Text style={{ fontFamily: FONTS.titleMedium, fontSize: 11.5, letterSpacing: 1.2, textTransform: 'uppercase', color: sel ? p.wine : p.muted }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Bottom sheet on phones, centred panel on tablets. Content scrolls; `footer` stays pinned.
 */
export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  scroll = true,
  tall,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  scroll?: boolean;
  tall?: boolean;
}) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const wide = useIsWide();
  const { height } = useWindowDimensions();
  const panel: ViewStyle = wide
    ? { width: 620, maxHeight: height * 0.88, borderRadius: RADIUS.lg, alignSelf: 'center' }
    : { width: '100%', maxHeight: height * (tall ? 0.94 : 0.88), minHeight: tall ? height * 0.7 : undefined, borderTopLeftRadius: 22, borderTopRightRadius: 22 };
  return (
    <Modal visible={visible} transparent animationType={wide ? 'fade' : 'slide'} onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: wide ? 'center' : 'flex-end' }}>
        <Pressable accessibilityLabel="Close" style={[StyleSheet.absoluteFill, { backgroundColor: p.overlay }]} onPress={onClose} />
        <View style={[{ backgroundColor: p.page, borderWidth: 1, borderColor: p.line, overflow: 'hidden' }, panel]}>
          <LinearGradient colors={[p.wine, p.gold, p.wine]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 3 }} />
          {!wide && <View style={{ alignSelf: 'center', width: 44, height: 4, borderRadius: 2, backgroundColor: p.line, marginTop: 8 }} />}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACE.lg, paddingTop: SPACE.md, paddingBottom: SPACE.sm, gap: SPACE.sm }}>
            <View style={{ flex: 1 }}>
              <Title size={19}>{title}</Title>
              {subtitle ? <Body size={16} italic tone="muted">{subtitle}</Body> : null}
            </View>
            <IconButton glyph="✕" label="Close" onPress={onClose} />
          </View>
          {scroll ? (
            <ScrollView
              style={{ flexGrow: 0 }}
              contentContainerStyle={{ padding: SPACE.lg, paddingTop: SPACE.sm, paddingBottom: footer ? SPACE.lg : SPACE.lg + insets.bottom }}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
          ) : (
            <View style={{ flexShrink: 1, padding: SPACE.lg, paddingTop: SPACE.sm }}>{children}</View>
          )}
          {footer ? (
            <View style={{ borderTopWidth: 1, borderTopColor: p.line, padding: SPACE.md, paddingBottom: SPACE.md + insets.bottom, backgroundColor: p.card }}>{footer}</View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export const textInputStyle = (p: Palette, multiline?: boolean): StyleProp<TextStyle> => ({
  fontFamily: FONTS.body,
  fontSize: 18,
  color: p.ink,
  backgroundColor: p.cardRaised,
  borderWidth: 1,
  borderColor: p.line,
  borderRadius: RADIUS.sm,
  paddingHorizontal: 12,
  paddingVertical: multiline ? 10 : 8,
  minHeight: multiline ? 110 : 44,
  textAlignVertical: multiline ? 'top' : 'center',
});
