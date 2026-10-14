# Thorn & Quill

*A bio atelier for JanitorAI — bind your bot's bio in velvet, thorns and gold.*

Thorn & Quill is an iOS, iPadOS and Android app (Expo / React Native, also runs on web) for
designing richly themed JanitorAI bot bios from selectable, deeply customisable HTML/CSS
elements — then exporting HTML that survives JanitorAI's server untouched.

The app itself is dressed like a romantasy hardback: parchment pages (or a midnight
clothbound "Nightfall" mode), wine-red ribbon, gold-foil ornaments, Cinzel and Cormorant
Garamond type.

## Built on two guides

Every rule the generator follows comes from these community guides (credited in-app, in the
**Codex** screen):

- **DelightfulTempe — *JanitorAI Unrestricted Bot Bio Guide*** — what the server strips
  (`<style>`, `<script>`, `position`, the literal text `z-index`), the 14 fonts JAI loads,
  confirmed-working CSS (flex, grid on `<div>`, `clip-path`, `backdrop-filter`, `border-image`,
  SVG data-URI backgrounds…), minifying, and backtick-escaping for the console upload script.
- **105th — *A (probably) helpful HTML/CSS guide for bot card bios*** (Forgeworks) — the
  19-element kit (banner, hook, warning, pills, premise, divider, `<details>` character
  dropdowns, nested whispers, swipe gallery, stat chips & bars, relationship rows, quote,
  polaroid, music player, voice note, routes, footer), the swipe-gallery rules, image/audio
  hosting rules, and "boxes need lids".

## What you can do

- **Library** of bios shown as book covers; long-press to rename, duplicate or delete.
- **10 romantasy themes** (Velvet Throne, Thornbound Rose, Moonlit Grimoire, Dragon's Hoard,
  Fae Hollow, Winter Court, Starfall Elvenhall, Blood Oath, Parchment & Ink, Rosewater Sonnet).
  Every colour, font, frame (bound card, holo-foil edge, gilded double rule, frosted glass),
  texture, corner radius, padding, max width, aura and ornament glyph is editable.
- **24 elements** in the Codex of Elements: Banner, Name Plate, Hook Line, Content Warning,
  Tag Pills, Chapter Heading, Story Text (drop cap, columns), Quote, Enchanted Panel (sealed
  letter / frosted / gradient border / clipped diagonal / layered gradient), Two Columns,
  Opening Routes, Character Dropdown (photo/avatar/plain header + nested "court whispers"),
  Stat Chips, Stat Bars, Relationships, Swipe Gallery, Polaroids, Music Player, Voice Note,
  Divider, Wax Seal, Spacer, Footer and Custom HTML.
  Each element has Content / Style / Layout controls: colour picker (HSL + opacity + theme
  swatches), JAI-font picker that shows each real typeface, sliders, toggles and list editors.
- **Live preview** with phone/desktop widths (iPad), dark/light JAI backdrop, and
  **tap-to-edit**: tap any part of the bio to open its controls.
- **Undo / redo** for every change, auto-saved locally.
- **Rules of the Realm** check before export: stripped tags/properties, `z-index` in text,
  viewport units, grid on `<p>`, unknown fonts, unbalanced tags, bad image/audio links, SVG
  encoding.
- **Export** as Minified, Readable (for the Forgeworks Code tab) or Console-ready (for
  DelightfulTempe's script) — copy or share — plus step-by-step publishing for both methods.

Exported HTML is inline-style only, contains no placeholder art, and caps the card with
`max-width` so it never overflows JAI's layout.

## Develop

```bash
npm install
npx expo start          # press i (iOS), a (Android) or w (web)
npm test                # HTML engine tests (rules, escaping, every element × every theme)
npm run typecheck
npx expo lint
```

`react-native-webview` is in Expo Go, so no custom dev build is needed. For store builds use
EAS (`npx eas-cli@latest build`).

## Layout

```
src/
  app/            Expo Router screens: Library (index), editor/[id], codex
  core/           Platform-free engine: elements (blocks.ts), themes, fonts, HTML helpers,
                  renderer, rules linter, guides/publishing info, tests
  editor/         Composer, Inspector, Theme panel, Element Codex, Preview pane, Export sheet
  state/          Library store (AsyncStorage) + undo/redo history
  ui/             Book-binding UI kit, colour & font pickers, slider, WebView/iframe preview
```
