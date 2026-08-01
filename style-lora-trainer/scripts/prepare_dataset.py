#!/usr/bin/env python3
"""Prepare reference images for LoRA training.

- Reads .webp/.png/.jpg/.jpeg from an input dir (default: dataset/raw)
- Converts to clean RGB PNG (flattens transparency, strips metadata)
- Optionally crops a bottom/top band to remove watermark/caption text
- Optionally downscales so the long edge <= --max-edge (keeps aspect ratio;
  bucketing in training handles the rest — no hard square crop)
- Writes to an output dir (default: dataset/processed)

Usage:
    python scripts/prepare_dataset.py
    python scripts/prepare_dataset.py --crop-bottom 0.08   # trim bottom 8% (watermark band)
    python scripts/prepare_dataset.py --max-edge 1536
"""
import argparse
import pathlib
import sys

try:
    from PIL import Image, ImageOps
except ImportError:
    sys.exit("Pillow is required:  pip install Pillow")

EXTS = {".webp", ".png", ".jpg", ".jpeg", ".bmp"}


def process(path: pathlib.Path, out_dir: pathlib.Path, max_edge: int,
            crop_top: float, crop_bottom: float, idx: int) -> bool:
    try:
        img = Image.open(path)
    except Exception as e:  # noqa: BLE001
        print(f"  ! skip {path.name}: {e}")
        return False

    img = ImageOps.exif_transpose(img)          # honor orientation
    img = img.convert("RGBA")
    bg = Image.new("RGBA", img.size, (0, 0, 0, 255))
    img = Image.alpha_composite(bg, img).convert("RGB")

    w, h = img.size
    top = int(h * crop_top)
    bottom = h - int(h * crop_bottom)
    if bottom - top < h:                        # something to crop
        img = img.crop((0, top, w, bottom))
        w, h = img.size

    long_edge = max(w, h)
    if long_edge > max_edge:
        scale = max_edge / long_edge
        img = img.resize((round(w * scale), round(h * scale)), Image.LANCZOS)

    out_path = out_dir / f"{idx:04d}.png"
    img.save(out_path, "PNG")
    print(f"  ok {path.name} -> {out_path.name}  ({img.size[0]}x{img.size[1]})")
    return True


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--in", dest="in_dir", default="dataset/raw")
    ap.add_argument("--out", dest="out_dir", default="dataset/processed")
    ap.add_argument("--max-edge", type=int, default=1536,
                    help="downscale so the longest side <= this (default 1536)")
    ap.add_argument("--crop-top", type=float, default=0.0,
                    help="fraction of height to trim from the TOP (0-0.5)")
    ap.add_argument("--crop-bottom", type=float, default=0.0,
                    help="fraction of height to trim from the BOTTOM (0-0.5), "
                         "e.g. 0.08 to drop a watermark band")
    args = ap.parse_args()

    in_dir = pathlib.Path(args.in_dir)
    out_dir = pathlib.Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    if not in_dir.is_dir():
        sys.exit(f"input dir not found: {in_dir}")

    files = sorted(p for p in in_dir.iterdir() if p.suffix.lower() in EXTS)
    if not files:
        sys.exit(f"no images found in {in_dir} (looked for {sorted(EXTS)})")

    print(f"Processing {len(files)} images from {in_dir} -> {out_dir}")
    ok = 0
    for i, p in enumerate(files, 1):
        if process(p, out_dir, args.max_edge, args.crop_top, args.crop_bottom, i):
            ok += 1
    print(f"\nDone: {ok}/{len(files)} images written to {out_dir}")
    print("Next: python scripts/caption_images.py --trigger gls2p5d_style")


if __name__ == "__main__":
    main()
