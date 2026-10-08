# Product photo pipeline

1. `python3 crop.py <folder with WhatsApp photos> crops/` — crops each product out of the shop photos.
2. `./gen_one.sh <name> <crop-name> "<description>"` — gpt-image studio shot from the crop (via the codex CLI, ChatGPT login). `jobs.tsv` has every product's prompt; run them all with:
   `while IFS=$'\t' read -r n r d; do printf '%s\0%s\0%s\0' "$n" "$r" "$d"; done < jobs.tsv | xargs -0 -n 3 -P 3 ./gen_one.sh`
3. `uvx --python 3.12 --with onnxruntime --with pillow --with numpy python cutout.py cut/ ../studio/*.png` — ISNet background removal (model in `~/.u2net`).
4. `python3 export.py . ../studio ../../storefront/public` — writes web-sized cutouts and studio shots into the storefront.

ISNet (`cutout.py`) drops black or cream surfaces that sit close to the grey backdrop. For those products use `cutout_u2net.py` (U²-Net) or `cutout_key.py` (U²-Net plus a colour key on the neutral backdrop; needs `--with scipy`). The calendar and canvas tote use `cutout_key.py`; the wall art uses `cutout_u2net.py`.
