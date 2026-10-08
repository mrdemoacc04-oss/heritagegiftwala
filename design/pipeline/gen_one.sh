#!/usr/bin/env bash
S=${S:-$(cd "$(dirname "$0")" && pwd)}  # working dir: crops/, logs/ and gpt-image-ref live here
name="$1"; ref="$2"; desc="$3"
out=/Users/dhrubajit/gift-site/design/studio/$name.png
[[ -f "$out" ]] && { echo "skip $name"; exit 0; }
p="The attached photo is the REFERENCE for a real product sold in our gift shop. Create a professional e-commerce studio product photograph of exactly this same product: ${desc} Keep the exact shape, proportions, colours, materials, print and details from the reference - do not redesign it. Remove hands, shelves, other products, price tags and the shop background. Composition: one single product, centred, product fills about 75% of the frame, square 1:1. Background: seamless flat pale grey (#E8E8E8), evenly lit, no props, no added text. Lighting: large soft diffused softbox from upper left with gentle fill, subtle soft contact shadow directly under the product. Photoreal, tack-sharp, premium Shopify catalog quality."
for attempt in 1 2; do
  if $S/gpt-image-ref "$p" "$out" --size 1024x1024 --ref "$S/crops/$ref.jpg" >/dev/null 2>"$S/logs/$name.err"; then echo "ok $name"; exit 0; fi
done
echo "FAIL $name"
