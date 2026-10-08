"""ISNet background removal (same pre/post-processing as rembg's isnet-general-use session)."""
import sys, os, numpy as np, onnxruntime as ort
from PIL import Image
model = os.path.expanduser("~/.u2net/isnet-general-use.onnx")
sess = ort.InferenceSession(model, providers=["CPUExecutionProvider"])
inp = sess.get_inputs()[0].name
def mask_for(img):
    im = img.convert("RGB").resize((1024, 1024), Image.LANCZOS)
    a = np.array(im).astype(np.float32); a = a / max(a.max(), 1e-6)
    mean = (0.485, 0.456, 0.406)
    t = np.stack([(a[:, :, i] - mean[i]) / 1.0 for i in range(3)])[None].astype(np.float32)
    pred = sess.run(None, {inp: t})[0][:, 0]
    pred = (pred - pred.min()) / (pred.max() - pred.min())
    m = Image.fromarray((np.squeeze(pred) * 255).astype("uint8"), "L")
    return m.resize(img.size, Image.LANCZOS)
for src in sys.argv[2:]:
    out = os.path.join(sys.argv[1], os.path.splitext(os.path.basename(src))[0] + ".png")
    img = Image.open(src).convert("RGB")
    m = mask_for(img)
    # firm up the matte: crush faint haze, keep soft edges
    ma = np.array(m).astype(np.float32) / 255
    ma = np.clip((ma - 0.06) / 0.88, 0, 1)
    rgba = img.convert("RGBA"); rgba.putalpha(Image.fromarray((ma * 255).astype("uint8"), "L"))
    bbox = rgba.getchannel("A").point(lambda v: 255 if v > 12 else 0).getbbox()
    rgba = rgba.crop(bbox)
    # pad to square-ish canvas with 4% margin so every cutout sits on the same frame
    w, h = rgba.size; side = int(max(w, h) * 1.08)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(rgba, ((side - w) // 2, (side - h) // 2))
    canvas.save(out, optimize=True)
    print("cut", out, canvas.size)
