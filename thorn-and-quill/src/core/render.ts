import { BLOCK_MAP, withPlaceholders } from './blocks';
import { alpha } from './color';
import { fontStack, PREVIEW_GOOGLE_FONTS_URL } from './fonts';
import { esc, minify, prettyHtml, escapeForTemplateLiteral, st, svgDataUri } from './html';
import type { Bio, BioTheme, Block } from './types';

/** Subtle background patterns as SVG data URIs (encoded per the Forgeworks troubleshooting notes). */
export function textureLayer(t: BioTheme): { image: string; size: string } | null {
  const c = alpha(t.colors.accent, 0.07);
  const c2 = alpha(t.colors.accent, 0.04);
  switch (t.texture) {
    case 'stars':
      return {
        image: svgDataUri(
          `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="140"><g fill="${c}"><circle cx="12" cy="18" r="1.2"/><circle cx="70" cy="40" r="0.8"/><circle cx="118" cy="12" r="1"/><circle cx="96" cy="88" r="1.4"/><circle cx="30" cy="104" r="0.9"/><circle cx="58" cy="128" r="1.1"/><path d="M110 120 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z"/><path d="M40 52 l1.5 4 4 1.5 -4 1.5 -1.5 4 -1.5 -4 -4 -1.5 4 -1.5z"/></g></svg>`,
        ),
        size: '140px 140px',
      };
    case 'dots':
      return {
        image: svgDataUri(`<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22"><circle cx="11" cy="11" r="1.1" fill="${c}"/></svg>`),
        size: '22px 22px',
      };
    case 'damask':
      return {
        image: svgDataUri(
          `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><g fill="none" stroke="${c}" stroke-width="1"><path d="M32 4 L60 32 L32 60 L4 32 Z"/><path d="M32 18 C40 26 40 38 32 46 C24 38 24 26 32 18 Z" fill="${c2}"/></g></svg>`,
        ),
        size: '64px 64px',
      };
    case 'thorns':
      return {
        image: svgDataUri(
          `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><g fill="none" stroke="${c}" stroke-width="1.2" stroke-linecap="round"><path d="M0 100 C30 80 50 110 80 70 S110 30 120 20"/><path d="M28 86 l-6 -8 M52 92 l4 -9 M78 72 l-8 -4 M100 42 l7 3"/></g></svg>`,
        ),
        size: '120px 120px',
      };
    default:
      return null;
  }
}

function frameOpen(t: BioTheme): { open: string; close: string } {
  const tex = textureLayer(t);
  const grad = `linear-gradient(180deg, ${t.colors.canvas} 0%, ${t.colors.canvas2} 100%)`;
  const r = `${t.radius + 2}px`;
  const aura = t.aura > 0 ? `0 0 ${Math.round(18 + t.aura * 30)}px ${alpha(t.colors.accent, t.aura * 0.45)}` : undefined;
  const base = {
    'font-family': fontStack(t.fonts.body),
    color: t.colors.text,
    'line-height': 1.6,
  };
  const fill = {
    'background-color': t.colors.canvas,
    'background-image': tex ? `${tex.image}, ${grad}` : grad,
    'background-size': tex ? `${tex.size}, 100% 100%` : undefined,
  };
  const pad = `${t.padding}rem ${Math.max(0.8, t.padding - 0.3)}rem`;
  const outer = { 'max-width': `${t.maxWidth}px`, margin: '0 auto' };

  switch (t.frame) {
    case 'none':
      return { open: `<div style="${st({ ...outer, ...base })}">`, close: '</div>' };
    case 'holo':
      return {
        open: `<div style="${st({
          ...outer,
          background: `conic-gradient(from 180deg, ${t.colors.accent}, ${t.colors.accent2}, ${t.colors.accent3}, ${t.colors.accent})`,
          padding: '2px',
          'border-radius': r,
          'box-shadow': aura,
        })}"><div style="${st({ ...fill, ...base, 'border-radius': `${t.radius}px`, padding: pad })}">`,
        close: '</div></div>',
      };
    case 'gilded':
      return {
        open: `<div style="${st({
          ...outer,
          ...fill,
          ...base,
          border: `3px double ${alpha(t.colors.accent, 0.75)}`,
          outline: `1px solid ${alpha(t.colors.accent, 0.25)}`,
          'outline-offset': '-9px',
          'border-radius': `${t.radius}px`,
          padding: `${t.padding + 0.3}rem ${t.padding}rem`,
          'box-shadow': aura,
        })}">`,
        close: '</div>',
      };
    case 'glass':
      return {
        open: `<div style="${st({
          ...outer,
          ...base,
          background: alpha(t.colors.canvas, 0.55),
          'backdrop-filter': 'blur(6px)',
          border: `1px solid ${alpha('#ffffff', 0.16)}`,
          'border-radius': `${t.radius}px`,
          padding: pad,
          'box-shadow': aura,
        })}">`,
        close: '</div>',
      };
    case 'card':
    default:
      return {
        open: `<div style="${st({
          ...outer,
          ...fill,
          ...base,
          border: `1px solid ${t.colors.border}`,
          'border-radius': `${t.radius}px`,
          padding: pad,
          'box-shadow': aura,
        })}">`,
        close: '</div>',
      };
  }
}

export function renderBlock(block: Block, theme: BioTheme): string {
  const def = BLOCK_MAP[block.type];
  if (!def) return '';
  try {
    return def.render(block.props, theme);
  } catch (e) {
    return `<p style="color:#ff6b6b">⚠ ${esc((e as Error).message)}</p>`;
  }
}

export interface RenderOptions {
  /**
   * In-app preview: wrap each element in a marker div so taps map back to elements,
   * and draw placeholder art for empty image slots.
   */
  preview?: boolean;
}

/** Render a bio to compact HTML ready for JanitorAI. */
export function renderBio(bio: Bio, opts: RenderOptions = {}): string {
  return withPlaceholders(!!opts.preview, () => renderBioInner(bio, opts));
}

function renderBioInner(bio: Bio, opts: RenderOptions): string {
  const visible = bio.blocks.filter((b) => !b.hidden && BLOCK_MAP[b.type]);
  const wrap = (b: Block, html: string) => (opts.preview ? `<div data-tq="${b.id}" style="display:contents">${html}</div>` : html);
  const above = visible.filter((b) => BLOCK_MAP[b.type].canSitOutside && b.props.outside);
  const inside = visible.filter((b) => !(BLOCK_MAP[b.type].canSitOutside && b.props.outside));
  const frame = frameOpen(bio.theme);
  const html =
    above.map((b) => wrap(b, renderBlock(b, bio.theme))).join('') +
    frame.open +
    inside.map((b) => wrap(b, renderBlock(b, bio.theme))).join('') +
    frame.close;
  // Drop image tags left without a source (never in the preview, which draws placeholders).
  return minify(html).replace(/<img alt="" src="" style="[^"]*"\/>/g, '');
}

export type ExportFormat = 'minified' | 'pretty' | 'console';

export function exportBio(bio: Bio, format: ExportFormat): string {
  const html = renderBio(bio);
  if (format === 'pretty') return prettyHtml(html);
  if (format === 'console') return escapeForTemplateLiteral(html);
  return html;
}

export type PreviewSite = 'dark' | 'light';

export interface PreviewOptions {
  site: PreviewSite;
  tapToEdit: boolean;
  selectedId?: string | null;
}

/** Approximate JAI page colours for the preview backdrop. */
export const SITE_BACKGROUND: Record<PreviewSite, string> = { dark: '#16161b', light: '#f4f4f6' };

function previewCss(bio: Bio, opts: PreviewOptions): string {
  const bg = SITE_BACKGROUND[opts.site];
  const fg = opts.site === 'dark' ? '#e6e6ea' : '#202024';
  const sel = opts.selectedId
    ? `[data-tq="${opts.selectedId}"] > *{outline:2px dashed ${alpha(bio.theme.colors.accent, 0.9)};outline-offset:3px}`
    : '';
  const tap = opts.tapToEdit ? '[data-tq] > *{cursor:pointer}[data-tq]:hover > *{outline:1px dashed rgba(127,127,127,.6);outline-offset:2px}' : '';
  return `html,body{margin:0;background:${bg};color:${fg};font-family:Inter,system-ui,sans-serif}.tq-page{padding:16px 14px 48px;box-sizing:border-box}${tap}${sel}`;
}

/**
 * A standalone document for the in-app preview. Google Fonts are linked here so the preview
 * looks like JAI (which already loads these families) — exported HTML never contains the link.
 */
export function previewDocument(bio: Bio, opts: PreviewOptions): string {
  const body = renderBio(bio, { preview: true });
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link rel="stylesheet" href="${PREVIEW_GOOGLE_FONTS_URL}"/>
<style id="tq-dyn">${previewCss(bio, opts)}</style></head><body><div class="tq-page" id="tq-page">${body}</div>
<script>
window.__tqTap=${opts.tapToEdit ? 'true' : 'false'};
(function(){
  function send(id){var msg=JSON.stringify({type:'select',id:id});
    if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(msg);}else if(window.parent!==window){window.parent.postMessage(msg,'*');}}
  document.addEventListener('click',function(e){
    if(!window.__tqTap)return;var el=e.target.closest&&e.target.closest('[data-tq]');
    if(el){e.preventDefault();e.stopPropagation();send(el.getAttribute('data-tq'));}
  },true);
})();
</script></body></html>`;
}

/** JavaScript that updates an already-loaded preview in place (keeps scroll position and open dropdowns' state where possible). */
export function previewUpdateScript(bio: Bio, opts: PreviewOptions): string {
  const body = renderBio(bio, { preview: true });
  return `(function(){window.__tqTap=${opts.tapToEdit ? 'true' : 'false'};var s=document.getElementById('tq-dyn');if(s)s.textContent=${JSON.stringify(
    previewCss(bio, opts),
  )};var p=document.getElementById('tq-page');var h=${JSON.stringify(body)};if(p&&p.__html!==h){var o=Array.prototype.map.call(p.querySelectorAll('details'),function(d){return d.open;});p.innerHTML=h;p.__html=h;var n=p.querySelectorAll('details');if(n.length===o.length){for(var i=0;i<n.length;i++){n[i].open=o[i];}}}})();true;`;
}
