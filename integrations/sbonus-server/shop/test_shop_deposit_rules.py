"""python -m unittest integrations/sbonus-server/shop/test_shop_deposit_rules.py — без сервера и базы."""
import os
import sys
import unittest
from decimal import Decimal

sys.path.insert(0, os.path.dirname(__file__))
import shop_deposit_rules as r  # noqa: E402


class Deposit(unittest.TestCase):
    def test_amounts(self):
        self.assertIsNone(r.check_deposit(0, 21400))
        self.assertIsNone(r.check_deposit(None, 21400))
        self.assertEqual(r.check_deposit(3000, 21400), Decimal("3000"))
        self.assertEqual(r.check_deposit("2500.7", 21400), Decimal("2500"))   # копейки не берём
        self.assertIsNone(r.check_deposit(21400, 21400))                        # всё сразу — обычный заказ
        with self.assertRaises(ValueError):
            r.check_deposit(500, 21400)                                          # меньше 1 000
        self.assertEqual(r.rest_amount(21400, 3000), Decimal("18400"))

    def test_ref(self):
        self.assertEqual(r.rest_ref("SC-261008-FAWC9"), "SC-261008-FAWC9-R")
        self.assertEqual(r.parse_ref("SC-261008-FAWC9-R"), ("SC-261008-FAWC9", True))
        self.assertEqual(r.parse_ref("SC-261008-FAWC9"), ("SC-261008-FAWC9", False))
        self.assertEqual(r.parse_ref("SC-261008-FAWC9-R2"), ("SC-261008-FAWC9", True))
        self.assertEqual(r.parse_ref("SC-251008-R1234"), ("SC-251008-R1234", False))   # сам номер похож на «-R»
        self.assertEqual(r.parse_ref("SC-251008-R1234-R"), ("SC-251008-R1234", True))
        self.assertEqual(r.next_rest_ref("SC-1", None), "SC-1-R")
        self.assertEqual(r.next_rest_ref("SC-1", "SC-1-R"), "SC-1-R2")
        self.assertEqual(r.next_rest_ref("SC-1", "SC-1-R2"), "SC-1-R3")

    def test_taxi(self):
        self.assertEqual(r.clean_taxi(" 01 KG  123 ABC ", "0555 123 456"), {"car": "01 KG 123 ABC", "driver_phone": "+996555123456"})
        self.assertEqual(r.clean_taxi("Ош 777", "+996 700 11 22 33")["driver_phone"], "+996700112233")
        with self.assertRaises(ValueError):
            r.clean_taxi("", "0555123456")
        with self.assertRaises(ValueError):
            r.clean_taxi("01KG123", "12345")

    def test_taxi_command(self):
        p = r.parse_taxi_command
        self.assertEqual(p("такси 7k3qf 01 KG 123 ABC 0555 123 456"),
                         {"code": "7K3QF", "car": "01 KG 123 ABC", "body": "7k3qf 01 KG 123 ABC", "phone": "0555 123 456"})
        self.assertEqual(p("Taksi SC-261008-7K3QF Ош777 +996 700 11 22 33")["code"], "7K3QF")
        self.assertEqual(p("такси 01KG123ABC 0555123456"),                                 # без номера заказа
                         {"code": None, "car": "01KG123ABC", "body": "01KG123ABC", "phone": "0555123456"})
        self.assertEqual(p("Такси: 01 KG 123 ABC, 0555 12 34 56")["car"], "01 KG 123 ABC")
        self.assertEqual(p("такси AB123 KG 0555123456")["body"], "AB123 KG")            # 5 знаков — может быть и машиной
        self.assertIsNone(p("такси 7K3QF <номер машины> <телефон водителя>"))               # подсказка — не команда
        self.assertIsNone(p("такси 0555123456"))                                          # нет машины
        self.assertIsNone(p("такси 7K3QF 0555123456"))                                    # номер заказа, а машины нет
        self.assertIsNone(p("📦 Заказ\nтакси 7K3QF 01KG 0555123456"))                     # кусок сообщения
        self.assertIsNone(p("такси керекпи?"))
        self.assertEqual(p("такси 7K3QF 01 123 0555123456")["car"], "01 123")             # цифры в номере машины
        self.assertIn("такси 01KG123ABC 0555123456", r.taxi_hint("SC-261008-7K3QF"))
        self.assertIn("7K3QF", r.taxi_hint("SC-261008-7K3QF"))

    def test_texts(self):
        taxi = {"car": "01KG123ABC", "driver_phone": "+996555123456"}
        ky = r.taxi_text("ky", "SC-1", taxi, Decimal("18400"), "https://pay/x")
        self.assertIn("18 400 сом", ky)
        self.assertIn("+996555123456", ky)
        self.assertIn("https://pay/x", ky)
        self.assertIn("Остаток — 18 400 сом", r.taxi_text("ru", "SC-1", taxi, 18400, "u"))
        self.assertIn("3 000 сом", r.deposit_paid_text("ky", "Айбек Т", "SC-1", 3000, 18400))
        self.assertIn("Айбек", r.deposit_paid_text("ru", "Айбек Т", "SC-1", 3000, 18400))


if __name__ == "__main__":
    unittest.main()
