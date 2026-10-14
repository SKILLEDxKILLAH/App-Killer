import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

import { previewDocument, previewUpdateScript, SITE_BACKGROUND, type PreviewOptions } from '../core/render';
import type { Bio } from '../core/types';

export interface BioPreviewProps {
  bio: Bio;
  opts: PreviewOptions;
  /** Simulated viewport width (px). The preview is centred when narrower than the pane. */
  width?: number;
  onSelect?: (blockId: string) => void;
}

/**
 * Live preview. The document loads once; later edits are patched in place so the
 * scroll position and opened dropdowns survive while you type.
 */
export function BioPreview({ bio, opts, width, onSelect }: BioPreviewProps) {
  const ref = useRef<WebView>(null);
  const [initial] = useState(() => previewDocument(bio, opts));
  const loaded = useRef(false);
  const latest = useRef({ bio, opts });
  const background = SITE_BACKGROUND[opts.site];

  useEffect(() => {
    latest.current = { bio, opts };
    if (loaded.current) ref.current?.injectJavaScript(previewUpdateScript(bio, opts));
  }, [bio, opts]);

  return (
    <View style={{ flex: 1, backgroundColor: background, alignItems: 'center' }}>
      <View style={{ flex: 1, width: width ?? '100%', maxWidth: '100%' }}>
        <WebView
          ref={ref}
          originWhitelist={['*']}
          source={{ html: initial, baseUrl: 'https://janitorai.com/' }}
          style={{ flex: 1, backgroundColor: background }}
          onLoadEnd={() => {
            loaded.current = true;
            ref.current?.injectJavaScript(previewUpdateScript(latest.current.bio, latest.current.opts));
          }}
          onMessage={(e) => {
            try {
              const msg = JSON.parse(e.nativeEvent.data);
              if (msg?.type === 'select' && msg.id) onSelect?.(msg.id);
            } catch {
              // ignore foreign messages
            }
          }}
          onShouldStartLoadWithRequest={(req) => req.url === 'about:blank' || req.url.startsWith('https://janitorai.com/') || req.navigationType !== 'click'}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction
          setSupportMultipleWindows={false}
          automaticallyAdjustContentInsets={false}
        />
      </View>
    </View>
  );
}
