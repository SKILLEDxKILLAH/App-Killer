import React from 'react';
import { Text, View } from 'react-native';

import type { PreviewOptions, PreviewSite } from '../core/render';
import type { Bio } from '../core/types';
import { usePalette } from '../state/store';
import { BioPreview } from '../ui/BioPreview';
import { Chip, useIsWide } from '../ui/kit';
import { FONTS, SPACE } from '../ui/theme';

export type DeviceWidth = 'phone' | 'desktop';

export function PreviewPane({
  bio,
  opts,
  device,
  onDevice,
  onSite,
  onTapToEdit,
  onSelect,
}: {
  bio: Bio;
  opts: PreviewOptions;
  device: DeviceWidth;
  onDevice: (d: DeviceWidth) => void;
  onSite: (s: PreviewSite) => void;
  onTapToEdit: (b: boolean) => void;
  onSelect: (id: string) => void;
}) {
  const p = usePalette();
  const wide = useIsWide();
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, borderBottomWidth: 1, borderBottomColor: p.line, backgroundColor: p.card }}>
        {wide ? (
          <>
            <Chip label="📱 Phone" selected={device === 'phone'} onPress={() => onDevice('phone')} />
            <Chip label="🖥 Desktop" selected={device === 'desktop'} onPress={() => onDevice('desktop')} />
          </>
        ) : null}
        <Chip label={opts.site === 'dark' ? '☾ Dark site' : '☀ Light site'} selected={false} onPress={() => onSite(opts.site === 'dark' ? 'light' : 'dark')} />
        <Chip label={opts.tapToEdit ? '✎ Tap to edit: on' : '✎ Tap to edit: off'} selected={opts.tapToEdit} onPress={() => onTapToEdit(!opts.tapToEdit)} />
      </View>
      <BioPreview bio={bio} opts={opts} width={wide ? (device === 'phone' ? 400 : 820) : undefined} onSelect={onSelect} />
      <Text style={{ position: 'absolute', bottom: 8, alignSelf: 'center', fontFamily: FONTS.italic, fontSize: 13, color: '#9a93a0', opacity: 0.9 }} pointerEvents="none">
        {opts.tapToEdit ? 'Tap any part of the bio to edit it' : 'Preview mode — dropdowns and galleries are live'}
      </Text>
    </View>
  );
}
