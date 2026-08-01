# Style LoRA Trainer — "Glossy 2.5D" Illustrious XL style

A complete, ready-to-run toolkit that trains a **style LoRA** which reproduces
the art style of your reference images: a glossy, semi-realistic "2.5D" anime
look with cinematic warm lighting, dewy skin, and high contrast
(see [`STYLE_ANALYSIS.md`](STYLE_ANALYSIS.md)).

The output is a single portable `.safetensors` LoRA that works in **any
Stable Diffusion SDXL environment** (Automatic1111, Forge, ComfyUI, InvokeAI)
**and Illustrious XL**, because Illustrious XL *is* an SDXL-architecture model.

> **Why a LoRA and not a full "model"?** A LoRA is the industry-standard way to
> capture and reliably reproduce an art style. It's small (tens of MB), trains
> on a modest GPU in under an hour, and loads on top of *any* compatible
> checkpoint — exactly the "compatible in any SD env + Illustrious XL"
> requirement. Training happens on your GPU (local, Colab, or RunPod); this repo
> gives you every script and config to do it in a few commands.

---

## Pipeline at a glance

```
your images ──▶ prepare_dataset.py ──▶ caption_images.py ──▶ train.sh ──▶ output/*.safetensors
  (raw/)          (clean/resize)        (trigger + tags)     (kohya)        (use anywhere)
```

## Requirements

- An NVIDIA GPU with **≥ 12 GB VRAM** (16 GB+ comfortable) for SDXL LoRA training.
  No local GPU? Use the same steps on **Google Colab** or **RunPod**.
- Python 3.10/3.11
- An **Illustrious XL** base checkpoint (`.safetensors`) — download from Civitai/HF.

## Setup

```bash
cd style-lora-trainer
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Install the trainer (kohya-ss / sd-scripts) once:
git clone https://github.com/kohya-ss/sd-scripts
cd sd-scripts && pip install -r requirements.txt && cd ..
#   (follow sd-scripts' README to run `accelerate config` the first time)
```

## Step 1 — Add your reference images

Drop all your reference images (`.webp`, `.png`, `.jpg`) into
[`dataset/raw/`](dataset/raw/). **15–40 images** is a good style set; more
variety in hair/skin/setting = a more flexible style, less "copy one character".

## Step 2 — Prepare the dataset

```bash
python scripts/prepare_dataset.py
# Reference images have an "AI Generated"/caption band? Trim it so the model
# doesn't learn to stamp text on every image:
python scripts/prepare_dataset.py --crop-bottom 0.08
```

Cleans, flattens, and resizes into `dataset/processed/`.

## Step 3 — Caption

```bash
# Recommended: auto-tag with WD14 (anime tagger). Prepends the style trigger word.
python scripts/caption_images.py --trigger gls2p5d_style

# No ML deps / tiny set? Trigger-only captions:
python scripts/caption_images.py --trigger gls2p5d_style --no-tagger --base "1girl, solo"
```

The **trigger word** (`gls2p5d_style` by default) is what you'll type at
generation time to invoke the style. Keep it identical in the config and at
inference. Change it everywhere if you prefer a different word.

## Step 4 — Point the config at your base model

Edit [`configs/train_config.toml`](configs/train_config.toml):

```toml
pretrained_model_name_or_path = "/path/to/illustriousXL.safetensors"
```

(Defaults for rank, learning rate, epochs, min-SNR, bucketing are already tuned
for a small style set — see the comments in that file and `dataset.toml`.)

## Step 5 — Train

```bash
./scripts/train.sh
# or, if sd-scripts lives elsewhere:
SD_SCRIPTS=~/sd-scripts ./scripts/train.sh
```

Intermediate epochs land in `output/` (every 2 epochs). Sample images render
during training from `prompts/sample_prompts.txt` so you can watch the style
emerge and pick the best epoch (later isn't always better — overtraining makes
it rigid).

## Step 6 — Use it anywhere

Copy `output/gls2p5d_illustrious_style.safetensors` into your UI's LoRA folder and
prompt with the trigger word. Full settings and a prompt template are in
[`prompts/inference_guide.txt`](prompts/inference_guide.txt):

```
<lora:gls2p5d_illustrious_style:0.8> gls2p5d_style, 1girl, solo, long black hair,
black dress, luxury lounge at night, cinematic warm lighting, glossy skin, masterpiece
```

Optional local smoke test (needs torch+diffusers):

```bash
python scripts/generate_samples.py \
  --base /path/to/illustriousXL.safetensors \
  --lora output/gls2p5d_illustrious_style.safetensors \
  --trigger gls2p5d_style --weight 0.8
```

---

## Tuning cheatsheet

| Symptom | Fix |
|---|---|
| Style barely shows | ↑ LoRA weight to 0.9–1.0; train more epochs; add "glossy skin, dewy" tags |
| Style overpowers / same face every time | ↓ weight to 0.6; fewer epochs; more varied dataset |
| Model stamps text/watermarks | crop the caption band (`--crop-bottom`), keep "text, watermark" in negatives |
| Learns one character not the style | add more people/hair/skin variety; caption those attributes explicitly |
| Blurry / artifacts | ↓ learning rate to 7e-5; ensure `no_half_vae=true` |

## Repo layout

```
style-lora-trainer/
├── README.md                  ← you are here
├── STYLE_ANALYSIS.md          ← the visual fingerprint the LoRA targets
├── requirements.txt
├── configs/
│   ├── train_config.toml      ← hyperparameters (edit base model path)
│   └── dataset.toml           ← dataset/bucketing config
├── scripts/
│   ├── prepare_dataset.py     ← clean + resize + optional watermark crop
│   ├── caption_images.py      ← WD14 auto-tagger + trigger word
│   ├── train.sh               ← one-command launcher
│   └── generate_samples.py    ← diffusers smoke test
├── prompts/
│   ├── sample_prompts.txt     ← rendered during training
│   └── inference_guide.txt    ← how to use the LoRA in any SD UI
└── dataset/
    ├── raw/                   ← put your reference images here
    └── processed/             ← generated: cleaned images + captions
```

## Notes on scope & content

- These are **your own reference images**; you're training a personal style
  LoRA. Keep generated content lawful and, wherever you publish or share, follow
  the terms of the platform and model licenses (Illustrious XL, sd-scripts).
- Depict only adults. Keep the "text/watermark" negatives if you don't want the
  meme-caption look baked in.
