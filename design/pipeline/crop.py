import sys, os
from PIL import Image, ImageOps, ImageDraw, ImageFont
src, out = sys.argv[1], sys.argv[2]
P = "WhatsApp Image 2026-10-02 at "
C = {
 "tumbler-butterfly": ("20.48.42", (230,300,830,1470)),
 "plush-sunflower-bunny": ("20.51.15", (100,140,840,1440)),
 "showpiece-gold-yoga": ("20.51.46", (100,420,740,1280)),
 "lamp-kitty-camera": ("20.52.33", (150,200,820,1440)),
 "lamp-brass-drum": ("20.52.43", (90,500,470,1300)),
 "lamp-brass-mushroom": ("20.52.43", (420,300,840,1340)),
 "clock-ivory-gear": ("20.53.11", (290,430,615,820)),
 "clock-black-gear": ("20.53.11", (600,410,900,800)),
 "bag-caramel-slouch": ("20.53.51", (170,480,810,1220)),
 "bag-canvas-tote": ("20.54.00", (290,300,780,760)),
 "bouquet-crochet-sunflower": ("20.54.54", (60,280,720,1600)),
 "pot-blush-peony": ("20.55.54", (0,260,500,1260)),
 "pot-love-basket": ("20.55.54", (410,460,900,1200)),
 "keychain-bunny-hood": ("20.56.36", (80,180,780,1540)),
 "cap-fuchsia": ("20.57.00", (210,420,770,1100)),
 "jewellery-tray": ("20.58.55", (40,460,1010,1130)),
 "cup-bow-kitty": ("20.59.52", (130,500,830,1180)),
 "kids-dino-box": ("21.00.22", (90,440,810,1220)),
 "office-perpetual-calendar": ("21.01.02", (100,560,820,1180)),
 "idol-krishna-flute": ("21.01.37", (30,320,850,1380)),
 "box-heart": ("21.02.11", (40,400,850,1200)),
 "wallart-gold-palm": ("21.02.51", (40,280,860,1140)),
 "hamper-just-for-you": ("21.04.01", (330,560,1990,3260)),
 "bottle-butter-yellow": ("21.04.21", (170,230,470,1200)),
 "crochet-snowman": ("21.05.08", (170,290,520,970)),
 "basket-bunny-ear": ("21.05.25", (60,260,700,1070)),
 "perfume-leather-strap": ("22.39.28", (150,370,570,960)),
}
for name,(ts,box) in C.items():
    f = os.path.join(src, P+ts+".jpeg")
    im = ImageOps.exif_transpose(Image.open(f)).convert("RGB")
    c = im.crop(box)
    c.save(os.path.join(out, name+".jpg"), quality=92)
# contact sheet
names=list(C); W=300; H=380
font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 16)
for s in range(0,len(names),12):
    ch=names[s:s+12]; sheet=Image.new("RGB",(W*6,(H+24)*2),"white")
    for i,n in enumerate(ch):
        im=Image.open(os.path.join(out,n+".jpg")); im.thumbnail((W-6,H))
        x=(i%6)*W; y=(i//6)*(H+24)
        sheet.paste(im,(x,y+24)); ImageDraw.Draw(sheet).text((x+4,y+4),n,fill="black",font=font)
    sheet.save(os.path.join(out,f"_sheet{s//12+1}.jpg"),quality=85)
