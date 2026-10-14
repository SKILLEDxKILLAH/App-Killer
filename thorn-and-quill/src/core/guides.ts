// The two field guides this app is built on, and how to publish with each.

export const GUIDES = {
  tempe: {
    title: 'JanitorAI Unrestricted Bot Bio Guide',
    author: 'DelightfulTempe',
    url: 'https://rentry.co/jai-bio-guide-by-delightfultempe',
  },
  forgeworks: {
    title: 'A (probably) helpful HTML/CSS guide for bot card bios',
    author: '105th (using Forgeworks by sk08)',
    url: 'https://rentry.co/forgeworks-bio-guide-105th',
  },
} as const;

export const FORGEWORKS_URL = 'https://forgeworks-platform.vercel.app/';

export interface PublishMethod {
  id: 'forgeworks' | 'console';
  name: string;
  format: 'pretty' | 'minified' | 'console';
  summary: string;
  steps: string[];
  guide: keyof typeof GUIDES;
}

export const PUBLISH_METHODS: PublishMethod[] = [
  {
    id: 'forgeworks',
    name: 'Forgeworks Bio Studio + Bridge',
    format: 'pretty',
    summary: 'Paste into Forgeworks, then send it to your bot with the JAI Bridge userscript.',
    guide: 'forgeworks',
    steps: [
      'Copy the Readable HTML from here.',
      'On Forgeworks open Bot Manager → Bio Studio → Start Blank, and paste into the Code tab.',
      'Create / Save the bio, then press “Send to JAI” and “Copy for JAI Bridge”.',
      'Install Tampermonkey and the Bridge script the first time (Forgeworks links them).',
      'Open your bot’s edit page on JAI (an existing bot, not a new one) and click “Apply bio from Forgeworks”.',
    ],
  },
  {
    id: 'console',
    name: 'DelightfulTempe’s console script',
    format: 'console',
    summary: 'Run the all-in-one script from the guide in your browser console on your bot’s page.',
    guide: 'tempe',
    steps: [
      'Copy the Console-ready HTML from here (already minified, with backticks escaped).',
      'Open your bot’s page on JAI in a desktop browser and open devtools (F12) → Console.',
      'Paste the script from DelightfulTempe’s guide and replace YOUR_HTML_CONTENT with what you copied.',
      'Press Enter. When the captcha appears, close devtools, then solve it within one minute.',
      'Reload the page to see the new bio.',
    ],
  },
];

/** Plain-language rules shown in the Codex, each credited to its guide. */
export const RULES: { title: string; body: string; source: keyof typeof GUIDES }[] = [
  { title: 'Inline styles only', body: 'JAI’s server strips <style> and <script> tags entirely. All styling lives in style="…" attributes — which is exactly what every element here produces.', source: 'tempe' },
  { title: 'No position, no z-index', body: '`position` is removed (all values) and the literal text “z-index” is deleted anywhere — even in your prose. Elements can’t overlap; fake depth with clip-path, negative margins or SVG backgrounds.', source: 'tempe' },
  { title: 'No animations', body: 'Without a <style> tag there are no @keyframes. JAI’s own keyframe names are hashed and change with updates, so they are not worth relying on.', source: 'tempe' },
  { title: '14 fonts, no more', body: 'Fraunces, Crimson Text, Berkshire Swash, Dancing Script, Inter, Poppins, Lexend, Jura, JetBrains Mono, Rock Salt, Monoton, Press Start 2P, VT323 and Noto Sans (JP/KR/SC). Custom fonts via <link> are stripped.', source: 'tempe' },
  { title: 'Be a good neighbour', body: 'Width, height and overflow are unconstrained, so 100vw or huge heights can break the page for visitors. Thorn & Quill caps the card with max-width.', source: 'tempe' },
  { title: 'Grid belongs on <div>', body: 'display:grid works on <div> containers but not on <p>.', source: 'tempe' },
  { title: 'Images must already be online', body: 'Use ella.janitorai.com links from your media tab, files.catbox.moe or image2url.com. A picture on your device has no address until you upload it.', source: 'forgeworks' },
  { title: 'Audio is a direct .mp3', body: 'Music and voice notes need a direct https link ending in .mp3 — catbox works.', source: 'forgeworks' },
  { title: 'Swipe galleries: two rules', body: 'The track gets overflow-x:auto; white-space:nowrap; scroll-snap-type:x mandatory. Each card gets display:inline-block; white-space:normal; scroll-snap-align:center. Never flex inside the track.', source: 'forgeworks' },
  { title: 'Boxes need lids', body: 'Every <div> needs its </div>. A missing lid swallows everything after it. The Rules check counts them for you.', source: 'forgeworks' },
  { title: 'SVG backgrounds need encoding', body: 'Inside data:image/svg+xml,… every quote must be %22 and every # must be %23.', source: 'forgeworks' },
  { title: 'Minify before upload', body: 'Minified HTML keeps the payload clean. For the console script, backticks must be escaped — the Console-ready export does both.', source: 'tempe' },
];
