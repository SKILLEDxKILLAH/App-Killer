#!/usr/bin/env bash
# One-command LoRA training launcher for kohya-ss / sd-scripts (SDXL / Illustrious XL).
#
# Prereqs (see README):
#   - sd-scripts cloned & its venv active, OR set SD_SCRIPTS to its path
#   - dataset/processed/ filled by prepare_dataset.py + caption_images.py
#   - configs/train_config.toml edited: pretrained_model_name_or_path -> your Illustrious XL
#
# Usage:
#   ./scripts/train.sh
#   SD_SCRIPTS=~/sd-scripts ./scripts/train.sh
set -euo pipefail

# Resolve project root (parent of this script's dir) so paths work from anywhere.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

SD_SCRIPTS="${SD_SCRIPTS:-./sd-scripts}"
TRAIN_PY="$SD_SCRIPTS/sdxl_train_network.py"

if [[ ! -f "$TRAIN_PY" ]]; then
  echo "ERROR: $TRAIN_PY not found."
  echo "Clone the trainer:  git clone https://github.com/kohya-ss/sd-scripts"
  echo "or point SD_SCRIPTS at your existing checkout:  SD_SCRIPTS=/path/to/sd-scripts ./scripts/train.sh"
  exit 1
fi

if [[ -z "$(ls -A dataset/processed 2>/dev/null | grep -Ei '\.(png|jpg|jpeg|webp)$' || true)" ]]; then
  echo "ERROR: dataset/processed is empty."
  echo "Run:  python scripts/prepare_dataset.py  &&  python scripts/caption_images.py --trigger gls2p5d_style"
  exit 1
fi

mkdir -p output logs

echo "Launching SDXL LoRA training..."
accelerate launch --num_cpu_threads_per_process 8 "$TRAIN_PY" \
  --config_file  configs/train_config.toml \
  --dataset_config configs/dataset.toml

echo
echo "Done. Trained LoRA(s) in ./output/"
echo "Test it:  python scripts/generate_samples.py --lora output/gls2p5d_illustrious_style.safetensors --base /path/to/illustriousXL.safetensors"
