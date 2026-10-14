import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { alpha } from '../core/color';
import type { BioTheme } from '../core/types';
import { usePalette } from '../state/store';
import { appFontFor } from './FontPicker';
import { tap } from './kit';
import { FONTS } from './theme';

/** A theme rendered as a little clothbound book cover. */
export function ThemeCover({
  theme,
  title,
  subtitle,
  footer,
  selected,
  onPress,
  onLongPress,
  style,
  height = 190,
  accessibilityLabel,
}: {
  theme: BioTheme;
  title?: string;
  subtitle?: string;
  footer?: string;
  selected?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  height?: number;
  accessibilityLabel?: string;
}) {
  const p = usePalette();
  const c = theme.colors;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${title ?? theme.name}${subtitle ? ', ' + subtitle : ''}`}
      accessibilityState={{ selected: !!selected }}
      onPress={() => {
        tap();
        onPress?.();
      }}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={({ pressed }) => [
        {
          height,
          borderRadius: 6,
          borderTopRightRadius: 12,
          borderBottomRightRadius: 12,
          overflow: 'hidden',
          borderWidth: selected ? 3 : 1,
          borderColor: selected ? p.wine : alpha(c.accent, 0.5),
          transform: [{ scale: pressed ? 0.97 : 1 }, { rotate: pressed ? '-0.6deg' : '0deg' }],
          shadowColor: '#000',
          shadowOpacity: 0.35,
          shadowRadius: 8,
          shadowOffset: { width: 2, height: 5 },
          elevation: 4,
          backgroundColor: c.canvas,
        },
        style,
      ]}
    >
      <LinearGradient colors={[c.canvas, c.canvas2]} style={{ flex: 1, flexDirection: 'row' }}>
        {/* spine */}
        <LinearGradient colors={[alpha(c.accent2, 0.9), alpha(c.accent2, 0.5)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: 12 }} />
        <View style={{ width: 1, backgroundColor: alpha(c.accent, 0.6) }} />
        <View style={{ flex: 1, padding: 10, justifyContent: 'space-between' }}>
          <View style={{ borderWidth: 1, borderColor: alpha(c.accent, 0.5), borderRadius: 4, flex: 1, padding: 8, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Text style={{ color: c.accent, fontSize: 16 }}>{theme.ornament}</Text>
            <Text
              numberOfLines={3}
              adjustsFontSizeToFit
              style={{ fontFamily: appFontFor(theme.fonts.display) ?? FONTS.title, fontSize: Math.max(11, Math.min(18, Math.round(height * 0.075))), color: c.heading, textAlign: 'center' }}
            >
              {title ?? theme.name}
            </Text>
            {subtitle ? (
              <Text numberOfLines={2} style={{ fontFamily: FONTS.italic, fontSize: 13, color: c.muted, textAlign: 'center' }}>
                {subtitle}
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 4, marginTop: 2 }}>
              {[c.accent, c.accent2, c.accent3].map((x, i) => (
                <View key={i} style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: x }} />
              ))}
            </View>
          </View>
          {footer ? (
            <Text numberOfLines={1} style={{ fontFamily: FONTS.titleRegular, fontSize: 9, letterSpacing: 1.2, color: c.muted, textAlign: 'center', marginTop: 6, textTransform: 'uppercase' }}>
              {footer}
            </Text>
          ) : null}
        </View>
      </LinearGradient>
    </Pressable>
  );
}
