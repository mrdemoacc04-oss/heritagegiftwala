"""U^2-Net salient-object matte (rembg 'u2net' pre/post-processing), same framing as cutout.py."""
import sys, os, numpy as np, onnxruntime as ort
from PIL import Image
sess = ort.InferenceSession(os.path.expanduser("~/.u2net/u2net.onnx"), providers=["CPUExecutionProvider"])
inp = sess.get_inputs()[0].name
mean, std = (0.485, 0.456, 0.406), (0.229, 0.224, 0.225)
for src in sys.argv[2:]:
    img = Image.open(src).convert("RGB")
    a = np.array(img.resize((320, 320), Image.LANCZOS)).astype(np.float32); a /= max(a.max(), 1e-6)
    t = np.stack([(a[:, :, i] - mean[i]) / std[i] for i in range(3)])[None].astype(np.float32)
    pred = sess.run(None, {inp: t})[0][:, 0]
    pred = (pred - pred.min()) / (pred.max() - pred.min())
    m = Image.fromarray((np.squeeze(pred) * 255).astype("uint8"), "L").resize(img.size, Image.LANCZOS)
    ma = np.clip((np.array(m).astype(np.float32) / 255 - 0.06) / 0.88, 0, 1)
    rgba = img.convert("RGBA"); rgba.putalpha(Image.fromarray((ma * 255).astype("uint8"), "L"))
    rgba = rgba.crop(rgba.getchannel("A").point(lambda v: 255 if v > 12 else 0).getbbox())
    w, h = rgba.size; side = int(max(w, h) * 1.08)
    c = Image.new("RGBA", (side, side), (0, 0, 0, 0)); c.paste(rgba, ((side - w) // 2, (side - h) // 2))
    out = os.path.join(sys.argv[1], os.path.basename(src)[:-4] + ".png"); c.save(out, optimize=True); print("cut", out)
