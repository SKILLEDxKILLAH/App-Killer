// HTML/CSS string helpers that keep every generated bio inside what JanitorAI keeps.
//
// Rules applied here come straight from the two field guides the app is built on:
//  - DelightfulTempe: inline `style` only; the server strips <style>, <script>, `position`,
//    and does a naive text replace of the literal string "z-index" anywhere in the payload.
//  - Forgeworks/105th: inside `data:image/svg+xml,…` every quote must be %22 and every # %23.

/** CSS properties the JAI server strips. The generator refuses to emit them. */
export const STRIPPED_PROPERTIES = ['position', 'z-index'];

type StyleValue = string | number | false | null | undefined;

/** Build an inline style string from an ordered map, skipping empty values. */
export function st(map: Record<string, StyleValue>): string {
  const out: string[] = [];
  for (const [prop, value] of Object.entries(map)) {
    if (value === false || value === null || value === undefined || value === '') continue;
    if (STRIPPED_PROPERTIES.includes(prop)) {
      throw new Error(`"${prop}" is stripped by JanitorAI and must not be generated`);
    }
    out.push(`${prop}:${value}`);
  }
  return out.join(';');
}

/** Escape text for HTML content and defuse the literal "z-index" (which JAI's server deletes). */
export function esc(text: string | undefined | null): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/z-index/gi, (m) => `${m[0]}&#8209;${m.slice(2)}`);
}

/**
 * Escape text and apply a tiny bit of markup that bio writers expect:
 * **bold**, *italic*, __underline__, ~~strike~~ and single newlines become <br/>.
 */
export function rich(text: string | undefined | null): string {
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/__(.+?)__/g, '<u>$1</u>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    .replace(/\r?\n/g, '<br/>');
}

/** Split text into paragraphs on blank lines. */
export function paragraphs(text: string | undefined | null): string[] {
  return String(text ?? '')
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Make a URL safe for an HTML attribute value. */
export function attrUrl(url: string | undefined | null): string {
  return String(url ?? '')
    .trim()
    .replace(/&/g, '&amp;')
    .replace(/"/g, '%22')
    .replace(/</g, '%3C')
    .replace(/>/g, '%3E');
}

/** Make a URL safe for `url('…')` inside an inline style attribute. */
export function cssUrl(url: string | undefined | null): string {
  return String(url ?? '')
    .trim()
    .replace(/'/g, '%27')
    .replace(/"/g, '%22')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\s/g, '%20')
    .replace(/</g, '%3C')
    .replace(/>/g, '%3E');
}

/** Encode an SVG for use as `url('data:image/svg+xml,…')` inside an inline style. */
export function svgDataUri(svg: string): string {
  const body = svg
    .replace(/\s+/g, ' ')
    .replace(/%/g, '%25')
    .replace(/"/g, '%22')
    .replace(/'/g, '%27')
    .replace(/#/g, '%23')
    .replace(/</g, '%3C')
    .replace(/>/g, '%3E');
  return `url('data:image/svg+xml,${body}')`;
}

const BLOCK_TAGS = 'div|p|details|summary|ul|ol|li|h[1-6]|blockquote|hr|table|thead|tbody|tr|td|th|section|article|header|footer|figure|figcaption|audio|br';

/** Strip comments and collapse insignificant whitespace (the guide recommends minifying before upload). */
export function minify(html: string): string {
  const blockRe = new RegExp(`\\s+(<\\/?(?:${BLOCK_TAGS})\\b)`, 'gi');
  const blockEndRe = new RegExp(`(<\\/?(?:${BLOCK_TAGS})\\b[^>]*>)\\s+`, 'gi');
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+/g, ' ')
    .replace(/style="([^"]*)"/g, (_m, css: string) => {
      const tidy = css
        .trim()
        .replace(/\s*;\s*/g, ';')
        .replace(/\s*:\s*/g, ':')
        .replace(/;+$/, '');
      return `style="${tidy}"`;
    })
    .replace(blockRe, '$1')
    .replace(blockEndRe, '$1')
    .trim();
}

/**
 * Escape HTML so it can be pasted between the backticks of DelightfulTempe's console script
 * (`const HTML_CONTENT = \`…\``). The guide calls out backticks; backslashes and `${` also
 * break a template literal, so they are escaped too.
 */
export function escapeForTemplateLiteral(html: string): string {
  return html.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

const BLOCK_OPEN = /^<(div|p|details|summary|section|blockquote)\b/i;
const BLOCK_CLOSE = /^<\/(div|p|details|summary|section|blockquote)>/i;

/** Indent block-level tags so the HTML is readable (e.g. for the Forgeworks Code tab). */
export function prettyHtml(html: string): string {
  const tokens = minify(html).split(/(<\/?(?:div|p|details|summary|section|blockquote)\b[^>]*>)/i).filter((t) => t !== '');
  const lines: string[] = [];
  let depth = 0;
  let inline = '';
  const flush = () => {
    if (inline.trim()) lines.push('  '.repeat(depth) + inline.trim());
    inline = '';
  };
  for (const tok of tokens) {
    if (BLOCK_CLOSE.test(tok)) {
      flush();
      depth = Math.max(0, depth - 1);
      lines.push('  '.repeat(depth) + tok);
    } else if (BLOCK_OPEN.test(tok)) {
      flush();
      lines.push('  '.repeat(depth) + tok);
      depth += 1;
    } else {
      inline += tok;
    }
  }
  flush();
  return lines.join('\n');
}

export function toRoman(n: number): string {
  const map: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let out = '';
  let x = Math.max(1, Math.floor(n));
  for (const [v, s] of map) {
    while (x >= v) {
      out += s;
      x -= v;
    }
  }
  return out;
}
