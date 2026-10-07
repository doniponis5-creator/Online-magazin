"""Фото владельца (магазин, прилавок, рука) → товар на белом квадрате 1200×1200, по центру, с полями.

Запускать Python'ом навыка (там rembg — локальный вырез фона, без интернета после первой загрузки модели ~170 МБ):
  ~/.claude/venvs/rembg/Scripts/python.exe clean_bg.py <куда> фото1.jpg [фото2 …]
Выход: <куда>/<имя>-white.jpg. Форма товара не меняется — только фон; если вырез съел часть товара или оставил кусок
фона — эту картинку не брать (проверить глазами).
"""
import sys
from pathlib import Path

from PIL import Image
from rembg import new_session, remove

SIDE, PAD = 1200, 0.08


def main_object(cut):
    """Оставить один товар: самое большое пятно выреза и мелочь внутри его рамки (ручки, ножки).
    Продавец, покупатель, соседний товар — отдельные пятна, они уходят в фон."""
    import numpy as np
    from scipy import ndimage

    alpha = np.array(cut.getchannel("A"))
    labels, count = ndimage.label(alpha > 20)
    if count <= 1:
        return cut
    sizes = ndimage.sum(np.ones_like(labels), labels, range(1, count + 1))
    main = int(np.argmax(sizes)) + 1
    ys, xs = np.where(labels == main)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    keep = np.zeros(count + 1, bool)
    keep[main] = True
    for n, sl in enumerate(ndimage.find_objects(labels), 1):
        if sl and sl[0].start >= y0 and sl[0].stop <= y1 + 1 and sl[1].start >= x0 and sl[1].stop <= x1 + 1:
            keep[n] = True
    alpha[~keep[labels]] = 0
    out = cut.copy()
    out.putalpha(Image.fromarray(alpha))
    return out


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    session = new_session("isnet-general-use")
    for src in sys.argv[2:]:
        with Image.open(src) as im:
            cut = remove(im.convert("RGB"), session=session, post_process_mask=True)  # RGBA, фон прозрачный
        cut = main_object(cut)
        box = cut.getchannel("A").point(lambda a: 255 if a > 20 else 0).getbbox()
        if not box:
            print(f"{src}: товар не найден на фото — не брать")
            continue
        item = cut.crop(box)
        inner = int(SIDE * (1 - 2 * PAD))
        # товар заполняет квадрат одинаково на всех фото; мелкий тянем не больше чем в 2,5 раза — дальше мыло
        k = min(inner / item.width, inner / item.height, 2.5)
        item = item.resize((max(1, round(item.width * k)), max(1, round(item.height * k))), Image.LANCZOS)
        canvas = Image.new("RGB", (SIDE, SIDE), (255, 255, 255))
        canvas.paste(item, ((SIDE - item.width) // 2, (SIDE - item.height) // 2), item)
        path = out / f"{Path(src).stem}-white.jpg"
        canvas.save(path, "JPEG", quality=90, optimize=True, progressive=True)
        print(f"{src} → {path} (товар {item.width}×{item.height})")


if __name__ == "__main__":
    main()
