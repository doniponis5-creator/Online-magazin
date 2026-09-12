# -*- coding: utf-8 -*-
"""Листы проверки: только кадрирование/одинаковая высота, без ретуши модели."""
from pathlib import Path
import shutil
from PIL import Image, ImageChops, ImageDraw, ImageFont

ASSET = Path(__file__).resolve().parent
REVIEW = ASSET.parents[1] / 'review' / 'task-04'
FONT = 'C:/Windows/Fonts/segoeui.ttf'
font = ImageFont.truetype(FONT, 25)
small = ImageFont.truetype(FONT, 18)


def product(path, rendered=False):
    image = Image.open(path).convert('RGBA')
    if rendered:
        bounds = image.getchannel('A').getbbox()
    else:
        difference = ImageChops.difference(image.convert('RGB'), Image.new('RGB', image.size, 'white'))
        bounds = difference.convert('L').point(lambda v: 255 if v > 28 else 0).getbbox()
    return image.crop(bounds)


def place(sheet, image, center, top, height):
    resized = image.resize((round(image.width * height / image.height), height), Image.Resampling.LANCZOS)
    sheet.alpha_composite(resized, (round(center - resized.width/2), top))


front = product(REVIEW / '_v7-front.png', True)
quarter = product(REVIEW / '_v7-quarter.png', True)
official = product(ASSET / 'references' / '01-front.jpg')
sheet = Image.new('RGBA', (1240, 890), 'white')
draw = ImageDraw.Draw(sheet)
draw.text((45, 25), 'v7 · наш 3D-рендер', fill='#2455dc', font=font)
draw.text((670, 25), 'Официальное фото LG', fill='#172334', font=font)
place(sheet, front, 310, 90, 720)
place(sheet, official, 930, 90, 720)
draw.text((45, 845), 'Одинаковая высота с ножками · пропорции сохранены · без зеркалирования', fill='#54616c', font=small)
archive = REVIEW / '_compare-v6-archive.jpg'
current = REVIEW / '_compare-quick.jpg'
if current.exists() and not archive.exists():
    shutil.copyfile(current, archive)
sheet.convert('RGB').save(current, quality=95)
sheet.convert('RGB').save(REVIEW / '_compare-v7.jpg', quality=95)

angles = Image.new('RGBA', (1380, 930), 'white')
draw = ImageDraw.Draw(angles)
draw.text((45, 25), 'v7 · фронт', fill='#2455dc', font=font)
draw.text((740, 25), 'v7 · 3/4 из той же сцены', fill='#2455dc', font=font)
place(angles, front, 340, 95, 740)
place(angles, quarter, 1035, 95, 740)
draw.text((45, 875), 'Превью 48 сэмплов · геометрический барабан упрощён · анимация ещё не добавлена', fill='#54616c', font=small)
angles.convert('RGB').save(REVIEW / '_v7-contact-sheet.jpg', quality=95)
print('Created _compare-quick.jpg, _compare-v7.jpg, _v7-contact-sheet.jpg')
