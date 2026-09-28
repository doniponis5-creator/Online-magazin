"""
Тесты правил напоминания о корзине (shop_cart_rules.py).

Модуль правил не импортирует приложение, поэтому тесты идут без сервера:
    uv run python -m unittest integrations/sbonus-server/shop/test_shop_cart_rules.py

Время в примерах разобрано вручную: Бишкек = UTC+6 круглый год,
10:00 по Бишкеку = 04:00 UTC, 20:00 по Бишкеку = 14:00 UTC.
"""
import importlib.util
import pathlib
import unittest
from datetime import datetime, timezone
from unittest import mock

_path = pathlib.Path(__file__).with_name("shop_cart_rules.py")
_spec = importlib.util.spec_from_file_location("shop_cart_rules", _path)
rules = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(rules)


class ReminderTextTest(unittest.TestCase):
    def test_one_item(self):
        self.assertEqual(
            rules.reminder_text(["Диван Верона"], 1),
            ("Товары ждут в корзине", "Диван Верона — оформите заказ, когда будет удобно."),
        )

    def test_several_items_name_the_first_and_count_the_rest(self):
        # В снимке не больше трёх названий, а позиций в корзине может быть больше.
        self.assertEqual(
            rules.reminder_text(["Диван Верона", "Стол Лофт", "Стул Нордик"], 5),
            ("Товары ждут в корзине", "Диван Верона и ещё 4 — оформите заказ, когда будет удобно."),
        )


def utc(*parts):
    return datetime(*parts, tzinfo=timezone.utc)


def cart(**changes):
    """Строка таблицы shop_cart_reminders: время в базе — UTC без зоны."""
    row = {
        "consent": True,
        "count": 2,
        "changed_at": datetime(2026, 9, 20, 6, 0),  # 12:00 по Бишкеку
        "sent": 0,
        "last_sent_at": None,
    }
    row.update(changes)
    return row


class ScheduleTest(unittest.TestCase):
    """Вариант 1: через 1 день после изменения, ещё через 3, ещё через 7 — и тишина."""

    def test_first_reminder_one_day_after_the_cart_changed(self):
        self.assertFalse(rules.due(cart(), utc(2026, 9, 21, 5, 59)))
        self.assertTrue(rules.due(cart(), utc(2026, 9, 21, 6, 0)))

    def test_second_reminder_three_days_after_the_first(self):
        row = cart(sent=1, last_sent_at=datetime(2026, 9, 21, 6, 0))
        self.assertFalse(rules.due(row, utc(2026, 9, 23, 6, 0)))
        self.assertTrue(rules.due(row, utc(2026, 9, 24, 6, 0)))

    def test_third_reminder_seven_days_after_the_second(self):
        row = cart(sent=2, last_sent_at=datetime(2026, 9, 24, 6, 0))
        self.assertFalse(rules.due(row, utc(2026, 9, 30, 6, 0)))
        self.assertTrue(rules.due(row, utc(2026, 10, 1, 6, 0)))

    def test_silence_after_three_reminders(self):
        row = cart(sent=3, last_sent_at=datetime(2026, 10, 1, 6, 0))
        self.assertFalse(rules.due(row, utc(2026, 10, 20, 6, 0)))
        self.assertFalse(rules.due(row, utc(2027, 3, 1, 6, 0)))


def schedule(test: unittest.TestCase, days=None, limit=None):
    """Другая схема или предел — только на время теста, потом всё как было."""
    for name, value in (("SCHEDULE_DAYS", days), ("MAX_REMINDERS", limit)):
        if value is not None:
            patcher = mock.patch.object(rules, name, value)
            patcher.start()
            test.addCleanup(patcher.stop)


class RepeatUntilPurchaseTest(unittest.TestCase):
    """Вариант 2 — «...» в конце: последнюю паузу повторяем, пока человек не купит."""

    def test_every_three_days(self):
        schedule(self, days=(3, ...))
        self.assertEqual([rules.pause_days(sent) for sent in range(6)], [3, 3, 3, 3, 3, 3])

    def test_first_pauses_then_the_last_one_repeats(self):
        schedule(self, days=(1, 3, ...))
        self.assertEqual([rules.pause_days(sent) for sent in range(6)], [1, 3, 3, 3, 3, 3])

    def test_fifth_reminder_three_days_after_the_fourth(self):
        # Без «...» после трёх напоминаний была бы тишина, а тут — ещё через 3 дня.
        schedule(self, days=(3, ...))
        row = cart(sent=4, last_sent_at=datetime(2026, 10, 2, 6, 0))
        self.assertFalse(rules.due(row, utc(2026, 10, 5, 5, 59)))
        self.assertTrue(rules.due(row, utc(2026, 10, 5, 6, 0)))


class MaxRemindersTest(unittest.TestCase):
    """Даже «до покупки» больше MAX_REMINDERS напоминаний на одну корзину не шлём."""

    def test_repeat_stops_at_the_limit(self):
        schedule(self, days=(3, ...))
        self.assertEqual(rules.pause_days(rules.MAX_REMINDERS - 1), 3)
        self.assertIsNone(rules.pause_days(rules.MAX_REMINDERS))
        self.assertIsNone(rules.pause_days(rules.MAX_REMINDERS + 5))

    def test_last_allowed_goes_then_silence(self):
        schedule(self, days=(3, ...), limit=4)
        last = cart(sent=3, last_sent_at=datetime(2026, 9, 29, 6, 0))
        self.assertTrue(rules.due(last, utc(2026, 10, 2, 6, 0)))
        over = cart(sent=4, last_sent_at=datetime(2026, 10, 2, 6, 0))
        self.assertFalse(rules.due(over, utc(2026, 10, 5, 6, 0)))
        self.assertFalse(rules.due(over, utc(2027, 3, 1, 6, 0)))

    def test_limit_also_cuts_a_fixed_schedule(self):
        # Предел меньше длины расписания — третьего (через 7 дней) уже не будет.
        schedule(self, limit=2)
        self.assertEqual([rules.pause_days(sent) for sent in range(4)], [1, 3, None, None])


class QuietHoursTest(unittest.TestCase):
    """Напоминаем только с 10:00 до 20:00 по Бишкеку; ночь и вечер — тишина."""

    row = cart(changed_at=datetime(2026, 9, 19, 0, 0))  # пауза давно прошла

    def test_morning_boundary(self):
        self.assertFalse(rules.due(self.row, utc(2026, 9, 21, 3, 59)))  # 09:59
        self.assertTrue(rules.due(self.row, utc(2026, 9, 21, 4, 0)))    # 10:00

    def test_evening_boundary(self):
        self.assertTrue(rules.due(self.row, utc(2026, 9, 21, 13, 59)))  # 19:59
        self.assertFalse(rules.due(self.row, utc(2026, 9, 21, 14, 0)))  # 20:00

    def test_night(self):
        self.assertFalse(rules.due(self.row, utc(2026, 9, 21, 20, 0)))  # 02:00


class WhoGetsRemindersTest(unittest.TestCase):
    """Только с согласия и только если в корзине что-то есть."""

    noon_two_days_later = utc(2026, 9, 22, 6, 0)

    def test_empty_cart_is_never_reminded(self):
        self.assertFalse(rules.due(cart(count=0), self.noon_two_days_later))

    def test_no_consent_yet_means_no_reminder(self):
        self.assertFalse(rules.due(cart(consent=None), self.noon_two_days_later))

    def test_refused_consent_means_no_reminder(self):
        self.assertFalse(rules.due(cart(consent=False), self.noon_two_days_later))


if __name__ == "__main__":
    unittest.main()
