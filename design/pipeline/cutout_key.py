"""U^2-Net matte + colour key against the flat neutral studio backdrop (for products the model alone misses)."""
import sys, os, numpy as np, onnxruntime as ort
from PIL import Image, ImageFilter
from scipy import ndimage
sess = ort.InferenceSession(os.path.expanduser("~/.u2net/u2net.onnx"), providers=["CPUExecutionProvider"])
inp = sess.get_inputs()[0].name
mean, std = (0.485, 0.456, 0.406), (0.229, 0.224, 0.225)

def u2(img):
    a = np.array(img.resize((320, 320), Image.LANCZOS)).astype(np.float32); a /= max(a.max(), 1e-6)
    t = np.stack([(a[:, :, i] - mean[i]) / std[i] for i in range(3)])[None].astype(np.float32)
    p = sess.run(None, {inp: t})[0][:, 0]; p = (p - p.min()) / (p.max() - p.min())
    m = Image.fromarray((np.squeeze(p) * 255).astype("uint8"), "L").resize(img.size, Image.LANCZOS)
    return np.clip((np.array(m).astype(np.float32) / 255 - 0.06) / 0.88, 0, 1)

def key(img):
    a = np.array(img).astype(np.int16); r, g, b = a[..., 0], a[..., 1], a[..., 2]
    L = (r + g + b) / 3
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]]).reshape(-1, 3)
    bgL = np.median(border.mean(axis=1))
    # neutral greys from slightly brighter than the backdrop down to the contact shadow
    cand = (np.abs(r - b) <= 6) & (np.abs(r - g) <= 5) & (L >= bgL - 70) & (L <= bgL + 14)
    # backdrop = every neutral region that touches the image edge
    lab, _ = ndimage.label(cand)
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    bg = np.isin(lab, edge[edge > 0])
    fg = Image.fromarray(np.where(bg, 0, 255).astype("uint8"), "L")
    fg = fg.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.1))   # trim the halo, soften the edge
    return np.array(fg).astype(np.float32) / 255

for src in sys.argv[2:]:
    img = Image.open(src).convert("RGB")
    alpha = np.maximum(u2(img), key(img))
    rgba = img.convert("RGBA"); rgba.putalpha(Image.fromarray((alpha * 255).astype("uint8"), "L"))
    rgba = rgba.crop(rgba.getchannel("A").point(lambda v: 255 if v > 12 else 0).getbbox())
    w, h = rgba.size; side = int(max(w, h) * 1.08)
    c = Image.new("RGBA", (side, side), (0, 0, 0, 0)); c.paste(rgba, ((side - w) // 2, (side - h) // 2))
    out = os.path.join(sys.argv[1], os.path.basename(src)[:-4] + ".png"); c.save(out, optimize=True); print("cut", out)
