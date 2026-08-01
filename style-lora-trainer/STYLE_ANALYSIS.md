# Style Analysis

This document captures the visual "fingerprint" of the reference images so the
captions, trigger word, and training settings all reinforce the *same* look.
When you caption your dataset (see `scripts/caption_images.py`) these are the
traits the trigger word should come to represent.

## One-line summary
A glossy, semi-realistic "2.5D" anime/digital-painting hybrid: cinematic warm
lighting, wet dewy skin with strong specular highlights, high contrast, and
richly rendered hair — pin-up / glamour framing of curvy adult characters.

## Core style traits (what the LoRA should learn)

| Trait | Description |
|---|---|
| Render | Semi-realistic anime ("2.5D"); painterly soft gradients + crisp edge/spec highlights |
| Skin | Glossy, dewy / "wet-look" sheen, pronounced specular highlights, soft subsurface warmth |
| Lighting | Cinematic, warm amber/golden key light, deep shadows, strong chiaroscuro, rim light |
| Palette | Saturated, high-contrast, warm-dominant; moody dark backgrounds |
| Background | Shallow depth of field, heavy bokeh, interior/night-city/bar/beach settings |
| Hair | Long flowing strands, individually rendered highlights, wet clumping |
| Face | Full glossy lips, long lashes, defined brows, blush, detailed eyes |
| Framing | Portrait/pin-up, glamour poses, cinematic crops |
| Subject | Curvy / voluptuous adult (grown-woman) characters |

## What to KEEP variable (do NOT bake into the style)
These change per image, so keep them in captions as separate tags rather than
letting them fuse into the trigger word:

- Hair color (blonde, black, brown), skin tone, ethnicity
- Clothing (dress, bikini, sweater, jewelry)
- Setting (bar, beach, kitchen, bedroom, doorway)
- Pose and camera angle
- Meme/caption text overlays and speech bubbles — **exclude these**; do not
  train the model to always stamp text on images. `prepare_dataset.py` has an
  optional crop to remove watermark/caption bands.

## Recommended trigger word
`gls2p5d_style` (short, unlikely to collide with existing Illustrious tags).
Change it in `configs/train_config.toml` (`--` not needed; it's the first token
prepended to every caption by the captioner). Keep it consistent everywhere.

## Base model choice
Train on **Illustrious XL** (SDXL architecture). The reference images read as
Illustrious/anime-family output, so the base already "speaks" this dialect and
the LoRA converges fast. Because it is SDXL under the hood, the resulting
`.safetensors` LoRA loads in any SDXL environment (A1111 / Forge / ComfyUI /
InvokeAI) as well as any Illustrious XL checkpoint.
