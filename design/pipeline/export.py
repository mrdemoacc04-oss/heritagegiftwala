"""Export cutouts + studio shots into the storefront's public/ folder at web sizes."""
import os, glob, sys
from PIL import Image
S, studio, pub = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(f"{pub}/products/studio", exist_ok=True)
names = {os.path.basename(f)[:-4] for f in glob.glob(f"{S}/cut/*.png") + glob.glob(f"{S}/cut-tmp/*.png") if not os.path.basename(f).startswith("_")}
for n in sorted(names):
    src = f"{S}/cut/{n}.png" if os.path.exists(f"{S}/cut/{n}.png") else f"{S}/cut-tmp/{n}.png"
    im = Image.open(src); im.thumbnail((1000, 1000), Image.LANCZOS); im.save(f"{pub}/products/{n}.png", optimize=True)
    st = f"{studio}/{n}.png"
    if os.path.exists(st):
        s = Image.open(st).convert("RGB"); s.thumbnail((1200, 1200), Image.LANCZOS); s.save(f"{pub}/products/studio/{n}.jpg", quality=88, optimize=True)
    print(n, "studio" if os.path.exists(st) else "TEMP")
