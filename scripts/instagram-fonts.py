"""
Шрифты картинки поста Instagram: public/fonts/manrope-600.ttf и manrope-800.ttf.

Satori (next/og) не умеет переменные шрифты — рисует самым тонким начертанием, поэтому
режем статичные срезы из public/fonts/manrope-variable.ttf. В Manrope нет кыргызской «ң»/«Ң»:
дорисовываем её из «н»/«Н» и хвостика справа внизу (как у «ц»), иначе в названии товара
на картинке вместо буквы будет пусто.

Запуск из папки проекта (нужен fontTools):
  uv run --with fonttools python scripts/instagram-fonts.py
"""
from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

SOURCE = "public/fonts/manrope-variable.ttf"


def _glyph(font, char):
    return font.getBestCmap()[ord(char)]


def _bounds(font, name):
    glyph = font["glyf"][name]
    glyph.recalcBounds(font["glyf"])
    return glyph.xMin, glyph.yMin, glyph.xMax, glyph.yMax


def add_en(font, base_char, stem_char, new_code, new_name):
    """«ң» = «н» + прямоугольный хвостик под правой ножкой (ширина ножки — как у stem_char, глубина — как у «ц»)."""
    cmap = font.getBestCmap()
    if new_code in cmap:
        return
    base = _glyph(font, base_char)
    stem_x0, _, stem_x1, _ = _bounds(font, _glyph(font, stem_char))
    _, tail_y, _, _ = _bounds(font, _glyph(font, "ц"))
    _, _, base_x1, _ = _bounds(font, base)
    stem = stem_x1 - stem_x0

    recording = DecomposingRecordingPen(font.getGlyphSet())
    font.getGlyphSet()[base].draw(recording)
    pen = TTGlyphPen(font.getGlyphSet())
    recording.replay(pen)
    # Хвостик чуть шире ножки и выходит вправо — как у «ц» в этом же шрифте.
    x0, x1 = base_x1 - stem, base_x1 + stem * 0.35
    # По часовой стрелке — как внешние контуры TrueType: перекрытие с ножкой закрашивается.
    pen.moveTo((x0, 0))
    pen.lineTo((x1, 0))
    pen.lineTo((x1, tail_y))
    pen.lineTo((x0, tail_y))
    pen.closePath()

    font["glyf"][new_name] = pen.glyph()
    font["hmtx"][new_name] = font["hmtx"][base]
    # glyf сам дописывает новое имя в порядок глифов; второй раз — нельзя.
    if new_name not in font.getGlyphOrder():
        font.setGlyphOrder(font.getGlyphOrder() + [new_name])
    for table in font["cmap"].tables:
        if table.isUnicode():
            table.cmap[new_code] = new_name


def main():
    for weight in (600, 800):
        font = instancer.instantiateVariableFont(TTFont(SOURCE), {"wght": weight})
        add_en(font, "н", "l", 0x04A3, "uni04A3")
        add_en(font, "Н", "I", 0x04A2, "uni04A2")
        font["maxp"].numGlyphs = len(font.getGlyphOrder())
        font.save(f"public/fonts/manrope-{weight}.ttf")
        print(f"public/fonts/manrope-{weight}.ttf")


if __name__ == "__main__":
    main()
