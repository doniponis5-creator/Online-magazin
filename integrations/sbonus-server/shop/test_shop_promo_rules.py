"""
Тесты правил рассылок «Скидка» / «Новинка» (shop_promo_rules.py).

Модуль правил не импортирует приложение, поэтому тесты идут без сервера:
    uv run python -m unittest integrations/sbonus-server/shop/test_shop_promo_rules.py

Бишкек = UTC+6 круглый год: 10:00 по Бишкеку = 04:00 UTC, 20:00 = 14:00 UTC.
"""
import importlib.util
import pathlib
import unittest
from datetime import date, datetime, timezone

_path = pathlib.Path(__file__).with_name("shop_promo_rules.py")
_spec = importlib.util.spec_from_file_location("shop_promo_rules", _path)
rules = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(rules)


def item(**changes):
    """Товар из каталога сервера — как его прислала 1С."""
    row = {
        "id": "a1b2", "code": "ЦБ-00001234", "name": "Холодильник Artel HD 455", "price": 32900,
        "oldPrice": 36900, "isNew": False, "stock": 3, "availability": "По остатку",
    }
    row.update(changes)
    return row


def utc(*parts):
    return datetime(*parts, tzinfo=timezone.utc)


class TemplateTest(unittest.TestCase):
    def test_sale_uses_catalog_prices(self):
        self.assertEqual(
            rules.template("sale", item()),
            ("Скидка на Холодильник Artel HD 455",
             "Было 36 900 сом, стало 32 900 сом. Можно заказать в приложении."),
        )

    def test_sale_needs_old_price_above_price(self):
        # Нет старой цены или она не больше нынешней — это не скидка, шаблон недоступен.
        self.assertIsNone(rules.template("sale", item(oldPrice=None)))
        self.assertIsNone(rules.template("sale", item(oldPrice=32900)))
        self.assertIsNone(rules.template("sale", item(oldPrice=30000)))

    def test_new(self):
        self.assertEqual(
            rules.template("new", item()),
            ("Новинка: Холодильник Artel HD 455",
             "Холодильник Artel HD 455 уже в магазине — можно заказать в приложении."),
        )

    def test_custom_is_empty(self):
        self.assertEqual(rules.template("custom", item()), ("", ""))

    def test_unknown_kind(self):
        self.assertIsNone(rules.template("promo", item()))

    def test_long_name_is_cut_to_fit(self):
        long = "Стиральная машина " + "очень длинное название " * 5
        title, body = rules.template("new", item(name=long))
        self.assertLessEqual(len(title), rules.TITLE_MAX)
        self.assertTrue(title.startswith("Новинка: Стиральная машина"))
        self.assertTrue(title.endswith("…"))
        self.assertLessEqual(len(body), rules.BODY_MAX)
        self.assertTrue(body.endswith("можно заказать в приложении."))
        sale_title, _ = rules.template("sale", item(name=long))
        self.assertLessEqual(len(sale_title), rules.TITLE_MAX)

    def test_name_spaces_are_squeezed(self):
        self.assertEqual(rules.template("new", item(name="  Чайник   Tefal \n"))[0], "Новинка: Чайник Tefal")


class CandidatesTest(unittest.TestCase):
    def test_row_for_1c(self):
        self.assertEqual(rules.candidate(item(isNew=True)), {
            "code": "ЦБ-00001234", "name": "Холодильник Artel HD 455", "price": 32900, "oldPrice": 36900,
            "sale": True, "isNew": True, "url": "/ru/product/cb-00001234",
            "saleTitle": "Скидка на Холодильник Artel HD 455",
            "saleBody": "Было 36 900 сом, стало 32 900 сом. Можно заказать в приложении.",
            "newTitle": "Новинка: Холодильник Artel HD 455",
            "newBody": "Холодильник Artel HD 455 уже в магазине — можно заказать в приложении.",
        })

    def test_no_sale_texts_without_old_price(self):
        row = rules.candidate(item(oldPrice=0))
        self.assertFalse(row["sale"])
        self.assertEqual(row["oldPrice"], 0)
        self.assertNotIn("saleTitle", row)
        self.assertIn("newTitle", row)

    def test_cannot_order_means_not_offered(self):
        # «Можно заказать» не должно врать: без цены или остатка товар в список не попадает.
        self.assertIsNone(rules.candidate(item(price=0)))
        self.assertIsNone(rules.candidate(item(stock=0)))
        self.assertIsNone(rules.candidate(item(availability="Нет в наличии", stock=5)))
        self.assertIsNotNone(rules.candidate(item(availability="В наличии", stock=0)))
        self.assertIsNone(rules.candidate(item(name="  ")))

    def test_order_sale_then_new_then_rest(self):
        rows = rules.candidates([
            item(code="3", name="Б обычный", oldPrice=0),
            item(code="2", name="А новинка", oldPrice=0, isNew=True),
            item(code="1", name="В скидка"),
            item(code="4", name="Нет цены", price=0),
        ])
        self.assertEqual([row["code"] for row in rows], ["1", "2", "3"])

    def test_bad_numbers_do_not_break(self):
        row = rules.candidate(item(price="32900.00", oldPrice="abc"))
        self.assertEqual((row["price"], row["oldPrice"]), (32900, 0))


class SlugTest(unittest.TestCase):
    def test_same_as_site(self):
        # Как slugFromCode в src/data/1c/adapter.ts.
        self.assertEqual(rules.slug_from_code("ЦБ-00001234"), "cb-00001234")
        self.assertEqual(rules.slug_from_code("  Ж/Щ 12 "), "zh-sch-12")

    def test_url_falls_back_to_id(self):
        self.assertEqual(rules.product_url(item(code="", id="abc-1")), "/ru/product/abc-1")
        self.assertEqual(rules.product_url(item(code="", id="")), "/ru")


class BlockedTest(unittest.TestCase):
    def test_daytime_first_send_is_fine(self):
        self.assertIsNone(rules.blocked_reason(utc(2026, 9, 28, 6, 0), None))  # 12:00

    def test_quiet_hours(self):
        # 09:59 и 20:00 по Бишкеку — уже нельзя; 10:00 и 19:59 — можно.
        self.assertIn("09:59", rules.blocked_reason(utc(2026, 9, 28, 3, 59), None))
        self.assertIn("20:00", rules.blocked_reason(utc(2026, 9, 28, 14, 0), None))
        self.assertIsNone(rules.blocked_reason(utc(2026, 9, 28, 4, 0), None))
        self.assertIsNone(rules.blocked_reason(utc(2026, 9, 28, 13, 59), None))

    def test_one_a_day_by_bishkek(self):
        sent = datetime(2026, 9, 28, 5, 30)  # 11:30 по Бишкеку, из базы — без зоны
        reason = rules.blocked_reason(utc(2026, 9, 28, 10, 0), sent)
        self.assertIn("11:30", reason)
        # Назавтра по Бишкеку — снова можно, хотя по UTC может быть тот же день.
        self.assertIsNone(rules.blocked_reason(utc(2026, 9, 29, 4, 0), sent))

    def test_day_turns_at_bishkek_midnight(self):
        # 19:00 UTC 28-го — это уже 01:00 29-го по Бишкеку.
        self.assertEqual(rules.shop_day(utc(2026, 9, 28, 19, 0)), date(2026, 9, 29))
        self.assertEqual(rules.shop_day(datetime(2026, 9, 28, 17, 59)), date(2026, 9, 28))


class TextProblemTest(unittest.TestCase):
    def test_ok(self):
        self.assertIsNone(rules.text_problem("Скидка", "Текст"))

    def test_empty_and_long(self):
        self.assertEqual(rules.text_problem("", "Текст"), "Заполните заголовок.")
        self.assertEqual(rules.text_problem("Заголовок", ""), "Заполните текст.")
        self.assertIn("61", rules.text_problem("я" * 61, "Текст"))
        self.assertIn("181", rules.text_problem("Заголовок", "я" * 181))
        self.assertIsNone(rules.text_problem("я" * 60, "я" * 180))

    def test_clean_text(self):
        self.assertEqual(rules.clean_text("  Скидка \n на\tчайник  "), "Скидка на чайник")
        self.assertEqual(rules.clean_text(None), "")


class TargetTest(unittest.TestCase):
    items = [item(), item(code="ЦБ-2", oldPrice=0), item(code="ЦБ-3", stock=0)]

    def test_product(self):
        self.assertEqual(rules.target("sale", "ЦБ-00001234", self.items), ("/ru/product/cb-00001234", "ЦБ-00001234", None))
        self.assertEqual(rules.target("new", "ЦБ-2", self.items), ("/ru/product/cb-2", "ЦБ-2", None))

    def test_custom_without_product_opens_home(self):
        self.assertEqual(rules.target("custom", "", self.items), ("/ru", None, None))
        self.assertEqual(rules.target("custom", "ЦБ-2", self.items)[0], "/ru/product/cb-2")

    def test_refusals(self):
        self.assertEqual(rules.target("sale", "", self.items)[2], "Выберите товар.")
        self.assertIn("старой цены", rules.target("sale", "ЦБ-2", self.items)[2])
        self.assertIn("нельзя заказать", rules.target("new", "ЦБ-3", self.items)[2])
        self.assertIn("нет в каталоге", rules.target("new", "ЦБ-999", self.items)[2])
        self.assertEqual(rules.target("spam", "", self.items)[2], "Неизвестный шаблон.")


if __name__ == "__main__":
    unittest.main()
