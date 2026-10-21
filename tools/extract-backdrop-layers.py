"""Split the supplied illustrations into feathered scenery cards (requires Pillow).
Run from the repository root. Runtime uses the resulting small WebP cards directly;
there is no image readback, segmentation or per-frame texture upload on phones.
"""
from PIL import Image
from pathlib import Path
import math

root = Path('src/assets/worlds')
# Overlapping bands avoid slicing through island silhouettes. Sky/cloud colours
# remain in each card, with a soft matte blending them into the distant sky.
bands = {
    'sky-islands': ([0, 480, 735, 1020, 1230, 1672], [0, 550, 810, 1110, 1330, 1672]),
    'neon-crystal': ([0, 390, 700, 1010, 1330, 1672], [0, 350, 700, 1010, 1320, 1672]),
}
for name, sides in bands.items():
    source = Image.open(root / f'{name}.webp').convert('RGB')
    source = source.resize((941, 1672))
    # The unoccupied central corridor supplies the original atmosphere/palette.
    base = Image.new('RGB', source.size)
    for y in range(1672):
        color = source.getpixel((470, y))
        for x in range(941):
            base.putpixel((x, y), color)
    base.resize((64, 512)).save(root / f'{name}-distance.webp', quality=88)
    for side, edges in enumerate(sides):
        for i, (start, end) in enumerate(zip(edges, edges[1:])):
            y0, y1 = max(0, start - 34), min(1672, end + 34)
            x0 = 0 if side == 0 else 531
            card = source.crop((x0, y0, x0 + 410, y1)).convert('RGBA')
            alpha = Image.new('L', card.size)
            for y in range(card.height):
                vertical = min(1, (y + 1) / 50, (card.height - y) / 50)
                for x in range(card.width):
                    inner = (410 - x) / 95 if side == 0 else (x + 1) / 95
                    pixel = card.getpixel((x, y))[:3]
                    background = source.getpixel((470, y0 + y))
                    distance = math.sqrt(sum((a - b) ** 2 for a, b in zip(pixel, background)))
                    # Remove the sky matte rather than moving rectangular pieces
                    # of sky with the islands. Preserve white clouds and rock faces.
                    matte = max(0, min(1, (distance - (18 if name == 'sky-islands' else 8)) / (22 if name == 'sky-islands' else 24)))
                    alpha.putpixel((x, y), round(255 * min(1, inner) * vertical * matte))
            card.putalpha(alpha)
            card.save(root / f'{name}-card-{side}-{i}.webp', quality=88)
