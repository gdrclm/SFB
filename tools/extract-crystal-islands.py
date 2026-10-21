"""Separate distant crystal islands from the supplied illustration (requires Pillow).
Run after extract-backdrop-layers.py. Atlas cells are 160x192, matching
src/scene/CrystalSceneryLayout.ts. No image processing runs on the phone.
"""
from PIL import Image
from pathlib import Path
import math

root = Path('src/assets/worlds')
source = Image.open(root / 'neon-crystal.webp').convert('RGB').resize((941, 1672))
regions = [(205,165,282,255), (238,380,308,455), (641,600,745,716),
           (271,1420,368,1533), (590,1228,706,1377), (678,148,816,289),
           (177,1122,319,1247)]
atlas = Image.new('RGBA', (1120, 192))
for index, (x0,y0,x1,y1) in enumerate(regions):
    island = source.crop((x0,y0,x1,y1)).convert('RGBA')
    alpha = Image.new('L', island.size)
    for y in range(island.height):
        for x in range(island.width):
            pixel = island.getpixel((x,y))[:3]
            sky = source.getpixel((470,y0+y))
            distance = math.sqrt(sum((a-b)**2 for a,b in zip(pixel, sky)))
            matte = max(0, min(1, (distance-24)/28))
            edge = min(1, x/10, y/10, (island.width-1-x)/10, (island.height-1-y)/10)
            alpha.putpixel((x,y), round(255*matte*edge))
    island.putalpha(alpha)
    atlas.paste(island, (index*160+(160-island.width)//2, (192-island.height)//2))
atlas.save(root / 'neon-crystal-distant-atlas.webp', quality=92)

# Clear the original copies from foreground cards, so they no longer move
# together with the nearer cloud bank or appear twice at different depths.
bands = ([0,390,700,1010,1330,1672],[0,350,700,1010,1320,1672])
for side, edges in enumerate(bands):
    for i, (start,end) in enumerate(zip(edges,edges[1:])):
        y0,y1=max(0,start-34),min(1672,end+34)
        x0=0 if side==0 else 531
        path=root/f'neon-crystal-card-{side}-{i}.webp'
        card=Image.open(path).convert('RGBA')
        for left,top,right,bottom in regions:
            for y in range(max(top-40,y0), min(bottom+40,y1)):
                for x in range(max(left-40,x0),min(right+40,x0+410)):
                    r,g,b,a=card.getpixel((x-x0,y-y0))
                    radius=math.sqrt(((x-(left+right)/2)/((right-left)/2+20))**2 + ((y-(top+bottom)/2)/((bottom-top)/2+20))**2)
                    t=max(0,min(1,(radius-.65)/.65))
                    clear=1-t*t*(3-2*t)
                    card.putpixel((x-x0,y-y0),(r,g,b,round(a*(1-clear))))
        card.save(path,quality=92)
