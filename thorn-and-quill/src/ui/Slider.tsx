import { LinearGradient } from 'expo-linear-gradient';
import React, { useRef } from 'react';
import { View, type GestureResponderEvent, type StyleProp, type ViewStyle } from 'react-native';

import { usePalette } from '../state/store';

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const roundTo = (v: number, step: number) => {
  const decimals = (String(step).split('.')[1] || '').length;
  return Number((Math.round(v / step) * step).toFixed(decimals));
};

/** A lightweight slider built on the responder system (works on iOS, Android and web). */
export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  gradient,
  accessibilityLabel,
  style,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  /** Optional track gradient (e.g. hue rainbow). */
  gradient?: string[];
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const p = usePalette();
  const ref = useRef<View>(null);
  const geom = useRef({ x: 0, w: 1 });

  const setFromPageX = (pageX: number) => {
    const t = clamp((pageX - geom.current.x) / Math.max(1, geom.current.w), 0, 1);
    const v = roundTo(min + t * (max - min), step);
    if (v !== value) onChange(v);
  };

  const onGrant = (e: GestureResponderEvent) => {
    const pageX = e.nativeEvent.pageX;
    ref.current?.measure((_x, _y, w, _h, px) => {
      geom.current = { x: px, w };
      setFromPageX(pageX);
    });
  };

  const frac = clamp((value - min) / (max - min || 1), 0, 1);
  return (
    <View
      ref={ref}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={onGrant}
      onResponderMove={(e) => setFromPageX(e.nativeEvent.pageX)}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        const dir = e.nativeEvent.actionName === 'increment' ? 1 : -1;
        onChange(clamp(roundTo(value + dir * step, step), min, max));
      }}
      style={[{ height: 36, justifyContent: 'center' }, style]}
    >
      {gradient ? (
        <LinearGradient
          pointerEvents="none"
          colors={gradient as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ height: 10, borderRadius: 5, borderWidth: 1, borderColor: p.line }}
        />
      ) : (
        <View pointerEvents="none" style={{ height: 4, borderRadius: 2, backgroundColor: p.line, overflow: 'hidden' }}>
          <View style={{ width: `${frac * 100}%`, height: '100%', backgroundColor: p.wine }} />
        </View>
      )}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: `${frac * 100}%`,
          marginLeft: -12,
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: p.cardRaised,
          borderWidth: 2,
          borderColor: p.gold,
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 3,
          shadowOffset: { width: 0, height: 1 },
          elevation: 3,
        }}
      />
    </View>
  );
}
