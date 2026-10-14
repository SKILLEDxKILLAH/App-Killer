import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { previewDocument, previewUpdateScript, SITE_BACKGROUND } from '../core/render';
import type { BioPreviewProps } from './BioPreview';

export type { BioPreviewProps };

export function BioPreview({ bio, opts, width, onSelect }: BioPreviewProps) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const [initial] = useState(() => previewDocument(bio, opts));
  const cb = useRef(onSelect);
  useEffect(() => {
    cb.current = onSelect;
  }, [onSelect]);
  const background = SITE_BACKGROUND[opts.site];

  const apply = () => {
    const win = frame.current?.contentWindow as (Window & { eval: (s: string) => unknown }) | null | undefined;
    try {
      win?.eval(previewUpdateScript(bio, opts));
    } catch {
      // frame not ready yet; onLoad will apply
    }
  };

  useEffect(apply, [bio, opts]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!frame.current || e.source !== frame.current.contentWindow) return;
      try {
        const msg = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (msg?.type === 'select' && msg.id) cb.current?.(msg.id);
      } catch {
        // ignore
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: background, alignItems: 'center' }}>
      <View style={{ flex: 1, width: width ?? '100%', maxWidth: '100%' }}>
        {React.createElement('iframe', {
          ref: frame,
          srcDoc: initial,
          title: 'Bio preview',
          onLoad: apply,
          sandbox: 'allow-scripts allow-same-origin',
          style: { border: 0, width: '100%', height: '100%', background },
        })}
      </View>
    </View>
  );
}
