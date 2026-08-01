#!/usr/bin/env python3
"""Auto-caption processed images for style-LoRA training.

Writes a ``<image>.txt`` next to every image in the processed dir. Every caption
begins with the STYLE TRIGGER WORD (kept as token #1 so ``keep_tokens=1`` in the
dataset config never shuffles it away), followed by content tags describing what
is *variable* per image (hair color, clothing, setting, pose). That split is what
lets the trigger word absorb the *style* while the content tags stay generic.

Two modes:

1. WD14 tagger (recommended for anime/illustration). Requires:
       pip install onnxruntime huggingface-hub numpy Pillow
   Downloads the SmilingWolf WD14 ONNX tagger on first run.

       python scripts/caption_images.py --trigger gls2p5d_style

2. Trigger-only fallback (no ML deps). Writes just the trigger word (optionally
   plus a fixed base caption). Fine for a pure style LoRA on a tiny set:

       python scripts/caption_images.py --trigger gls2p5d_style --no-tagger \
           --base "1girl, solo"
"""
import argparse
import csv
import pathlib
import sys

IMG_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".bmp"}

# Tags we never want the model to associate with the trigger word -> dropped.
BLOCKLIST = {
    "text", "english_text", "speech_bubble", "watermark", "signature",
    "artist_name", "web_address", "logo", "border", "comic",
}


def load_tagger():
    """Return (session, tag_names, input_size) for the WD14 ONNX tagger."""
    import numpy as np  # noqa: F401  (validated available)
    import onnxruntime as ort
    from huggingface_hub import hf_hub_download

    repo = "SmilingWolf/wd-v1-4-moat-tagger-v2"
    model_path = hf_hub_download(repo, "model.onnx")
    csv_path = hf_hub_download(repo, "selected_tags.csv")

    providers = ["CUDAExecutionProvider", "CPUExecutionProvider"]
    session = ort.InferenceSession(model_path, providers=providers)
    _, h, _, _ = session.get_inputs()[0].shape
    size = int(h) if isinstance(h, int) else 448

    tags = []
    with open(csv_path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            tags.append((row["name"], int(row["category"])))
    return session, tags, size


def tag_image(path, session, tags, size, threshold):
    import numpy as np
    from PIL import Image

    img = Image.open(path).convert("RGB")
    # square pad to model input
    w, h = img.size
    s = max(w, h)
    canvas = Image.new("RGB", (s, s), (255, 255, 255))
    canvas.paste(img, ((s - w) // 2, (s - h) // 2))
    canvas = canvas.resize((size, size), Image.BICUBIC)

    arr = np.asarray(canvas, dtype=np.float32)[:, :, ::-1]  # RGB->BGR
    arr = np.expand_dims(arr, 0)
    name = session.get_inputs()[0].name
    preds = session.run(None, {name: arr})[0][0]

    out = []
    for (tag_name, category), score in zip(tags, preds):
        if category == 0:            # 0 = general tags (skip 4=rating, 9=character)
            if score >= threshold and tag_name not in BLOCKLIST:
                out.append((tag_name.replace("_", " "), float(score)))
    out.sort(key=lambda t: t[1], reverse=True)
    return [t for t, _ in out]


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dir", default="dataset/processed")
    ap.add_argument("--trigger", required=True,
                    help="style trigger word, e.g. gls2p5d_style")
    ap.add_argument("--threshold", type=float, default=0.35,
                    help="WD14 confidence threshold (default 0.35)")
    ap.add_argument("--max-tags", type=int, default=25)
    ap.add_argument("--no-tagger", action="store_true",
                    help="skip WD14; write trigger (+ --base) only")
    ap.add_argument("--base", default="",
                    help="fixed caption appended after the trigger in --no-tagger mode")
    ap.add_argument("--overwrite", action="store_true",
                    help="rewrite existing .txt files")
    args = ap.parse_args()

    d = pathlib.Path(args.dir)
    if not d.is_dir():
        sys.exit(f"dir not found: {d}")
    images = sorted(p for p in d.iterdir() if p.suffix.lower() in IMG_EXTS)
    if not images:
        sys.exit(f"no images in {d}")

    session = tags = size = None
    if not args.no_tagger:
        try:
            print("Loading WD14 tagger (first run downloads ~300MB)...")
            session, tags, size = load_tagger()
        except Exception as e:  # noqa: BLE001
            print(f"! tagger unavailable ({e}). Falling back to trigger-only.")
            args.no_tagger = True

    written = 0
    for p in images:
        txt = p.with_suffix(".txt")
        if txt.exists() and not args.overwrite:
            continue
        if args.no_tagger:
            parts = [args.trigger] + ([args.base] if args.base else [])
        else:
            content = tag_image(p, session, tags, size, args.threshold)[: args.max_tags]
            parts = [args.trigger] + content
        caption = ", ".join(x for x in parts if x)
        txt.write_text(caption, encoding="utf-8")
        written += 1
        print(f"  {p.name}: {caption}")

    print(f"\nWrote {written} caption(s). Trigger word = '{args.trigger}'.")
    print("Review a few .txt files, then run scripts/train.sh")


if __name__ == "__main__":
    main()
