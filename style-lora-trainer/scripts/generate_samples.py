#!/usr/bin/env python3
"""Quick smoke-test of a trained style LoRA with diffusers.

Loads an SDXL / Illustrious XL base checkpoint + your LoRA and renders a few
images so you can eyeball whether the style transferred. This is only for
testing — day-to-day generation is nicer in A1111 / Forge / ComfyUI
(see prompts/inference_guide.txt).

Requires GPU-appropriate torch + diffusers (see requirements.txt).

Usage:
    python scripts/generate_samples.py \
        --base /path/to/illustriousXL.safetensors \
        --lora output/gls2p5d_illustrious_style.safetensors \
        --trigger gls2p5d_style --weight 0.8
"""
import argparse
import pathlib
import sys


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--base", required=True, help="SDXL/Illustrious XL checkpoint (.safetensors) or HF repo id")
    ap.add_argument("--lora", required=True, help="trained LoRA .safetensors")
    ap.add_argument("--trigger", default="gls2p5d_style")
    ap.add_argument("--weight", type=float, default=0.8, help="LoRA scale")
    ap.add_argument("--out", default="samples")
    ap.add_argument("--steps", type=int, default=28)
    ap.add_argument("--cfg", type=float, default=6.0)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    try:
        import torch
        from diffusers import StableDiffusionXLPipeline, EulerAncestralDiscreteScheduler
    except ImportError as e:
        sys.exit(f"Missing deps ({e}). Install torch (matching your CUDA) + "
                 "diffusers transformers accelerate safetensors.")

    dtype = torch.float16 if torch.cuda.is_available() else torch.float32
    device = "cuda" if torch.cuda.is_available() else "cpu"

    base = args.base
    if base.endswith(".safetensors"):
        pipe = StableDiffusionXLPipeline.from_single_file(base, torch_dtype=dtype)
    else:
        pipe = StableDiffusionXLPipeline.from_pretrained(base, torch_dtype=dtype)
    pipe.scheduler = EulerAncestralDiscreteScheduler.from_config(pipe.scheduler.config)
    pipe = pipe.to(device)

    lora_path = pathlib.Path(args.lora)
    pipe.load_lora_weights(str(lora_path.parent), weight_name=lora_path.name)
    pipe.fuse_lora(lora_scale=args.weight)

    neg = ("lowres, worst quality, low quality, bad anatomy, bad hands, "
           "extra digits, text, watermark, signature, jpeg artifacts, blurry, deformed")
    prompts = [
        f"{args.trigger}, 1girl, solo, long black hair, black dress, luxury lounge at night, "
        f"city lights, cinematic warm lighting, glossy skin, high detail, masterpiece",
        f"{args.trigger}, 1girl, solo, blonde hair, elegant outfit, indoor bar, bokeh, "
        f"dewy skin, dramatic lighting, high detail, masterpiece",
        f"{args.trigger}, 1girl, solo, dark skin, curly hair, cozy cafe, soft window light, "
        f"glossy highlights, high detail, masterpiece",
    ]

    out_dir = pathlib.Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    for i, prompt in enumerate(prompts):
        g = torch.Generator(device=device).manual_seed(args.seed + i)
        img = pipe(prompt=prompt, negative_prompt=neg, num_inference_steps=args.steps,
                   guidance_scale=args.cfg, width=832, height=1216, generator=g).images[0]
        p = out_dir / f"sample_{i:02d}.png"
        img.save(p)
        print(f"saved {p}")

    print(f"\nDone. {len(prompts)} images in {out_dir}/")


if __name__ == "__main__":
    main()
