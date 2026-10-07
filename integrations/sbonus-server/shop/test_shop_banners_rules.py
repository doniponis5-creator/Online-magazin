"""
Правила баннеров главной (shop_banners_rules.py). Без сервера и базы:
  python -m unittest integrations/sbonus-server/shop/test_shop_banners_rules.py
Картинки рисует Pillow (есть локально); без него тесты картинок пропускаются.
"""
from __future__ import annotations

import importlib.util
import io
import pathlib
import unittest
from datetime import date

spec = importlib.util.spec_from_file_location("rules", pathlib.Path(__file__).with_name("shop_banners_rules.py"))
rules = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rules)

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    Image = None


def picture(w: int, h: int, fmt: str) -> bytes:
    out = io.BytesIO()
    Image.new("RGB", (w, h), (240, 200, 10)).save(out, fmt)
    return out.getvalue()


@unittest.skipIf(Image is None, "нет Pillow")
class Images(unittest.TestCase):
    def test_types_and_sizes(self):
        for fmt, kind in (("JPEG", "jpeg"), ("PNG", "png"), ("WEBP", "webp")):
            info = rules.image_info(picture(2400, 1000, fmt))
            self.assertEqual((info["type"], info["w"], info["h"]), (kind, 2400, 1000), fmt)
        lossless = io.BytesIO()
        Image.new("RGB", (1080, 1080)).save(lossless, "WEBP", lossless=True)
        self.assertEqual(rules.image_info(lossless.getvalue())["w"], 1080)
        self.assertIsNone(rules.image_info(b"GIF89a....."))

    def test_problems(self):
        self.assertIsNone(rules.image_problem("desktop", picture(2400, 1000, "JPEG")))
        self.assertIsNone(rules.image_problem("mobile", picture(1080, 1080, "JPEG")))
        self.assertIn("мелкая", rules.image_problem("desktop", picture(800, 330, "JPEG")))
        # перепутали кнопки: квадрат — «для телефона», широкая — «для компьютера»
        self.assertIn("это картинка для телефона", rules.image_problem("desktop", picture(1080, 1080, "JPEG")))
        self.assertIn("это картинка для компьютера", rules.image_problem("mobile", picture(2400, 1000, "JPEG")))
        self.assertIn("вытянутая", rules.image_problem("desktop", picture(5000, 1000, "JPEG")))
        self.assertIn("не JPG", rules.image_problem("desktop", b"hello"))
        self.assertIn("больше 5 МБ", rules.image_problem("desktop", b"\xff\xd8\xff" + b"0" * (5 * 1024 * 1024)))


class Fields(unittest.TestCase):
    def test_links(self):
        for good in ("", "product:ЦБ-00001882", "cat:fridges", "cat:Телевизоры и ТВ", "/ru/catalog?sale=1", "https://kemalusman.kg/"):
            self.assertIsNotNone(rules.clean_link(good), good)
        for bad in ("http://insecure.kg", "javascript:alert(1)", "//evil.com", "cat:<b>", "product:", "ftp://x"):
            self.assertIsNone(rules.clean_link(bad), bad)

    def test_banner(self):
        b = rules.clean_banner({"id": "3", "title": " Скидки ", "link": "cat:tv", "active": True,
                                "starts": "2026-10-01T00:00:00", "ends": "0001-01-01T00:00:00"})
        self.assertEqual((b["id"], b["title"], b["starts"], b["ends"]), (3, "Скидки", date(2026, 10, 1), None))
        self.assertIsNone(rules.clean_banner({"title": "Новый"})["id"])
        with self.assertRaises(ValueError):
            rules.clean_banner({"link": "javascript:x"})
        with self.assertRaises(ValueError):
            rules.clean_banner({"starts": "2026-10-10", "ends": "2026-10-01"})

    def test_showing(self):
        today = date(2026, 10, 7)
        self.assertTrue(rules.showing_today(True, None, None, today, True))
        self.assertFalse(rules.showing_today(True, None, None, today, False))  # без картинки — нечего показать
        self.assertFalse(rules.showing_today(False, None, None, today, True))
        self.assertFalse(rules.showing_today(True, date(2026, 10, 8), None, today, True))
        self.assertTrue(rules.showing_today(True, date(2026, 10, 1), date(2026, 10, 7), today, True))
        self.assertFalse(rules.showing_today(True, None, date(2026, 10, 6), today, True))


if __name__ == "__main__":
    unittest.main()
