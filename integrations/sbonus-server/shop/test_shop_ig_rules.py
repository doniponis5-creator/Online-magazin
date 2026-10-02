"""
Тесты правил Instagram-продавца (shop_ig_rules.py).

Модуль правил не импортирует приложение, поэтому тесты идут без сервера:
    uv run python -m unittest integrations/sbonus-server/shop/test_shop_ig_rules.py
"""
import hashlib
import hmac
import importlib.util
import json
import pathlib
import unittest

_path = pathlib.Path(__file__).with_name("shop_ig_rules.py")
_spec = importlib.util.spec_from_file_location("shop_ig_rules", _path)
rules = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(rules)

SHOP = "17841400000000001"      # аккаунт магазина
BUYER = "1234567890123456"      # покупатель (IGSID)


def webhook(*items, own=SHOP):
    return {"object": "instagram", "entry": [{"id": own, "time": 1, "messaging": list(items)}]}


def incoming(message, ts=1_759_400_000_000, sender=BUYER):
    return {"sender": {"id": sender}, "recipient": {"id": SHOP}, "timestamp": ts, "message": message}


class Signature(unittest.TestCase):
    def test_valid_and_forged(self):
        body = json.dumps(webhook(incoming({"mid": "m1", "text": "Салам"}))).encode()
        good = "sha256=" + hmac.new(b"secret", body, hashlib.sha256).hexdigest()
        self.assertTrue(rules.signature_ok("secret", body, good))
        self.assertFalse(rules.signature_ok("other", body, good))
        self.assertFalse(rules.signature_ok("secret", body + b" ", good))
        self.assertFalse(rules.signature_ok("secret", body, good.removeprefix("sha256=")))
        # Два секрета через запятую: Meta подписала любым из них — верим.
        self.assertTrue(rules.signature_ok("meta-app-secret, secret", body, good))
        # Секрет не задан — никому не верим, даже «правильной» подписи пустым ключом.
        empty = "sha256=" + hmac.new(b"", body, hashlib.sha256).hexdigest()
        self.assertFalse(rules.signature_ok("", body, empty))


class Events(unittest.TestCase):
    def test_text_from_buyer(self):
        [event] = rules.events(webhook(incoming({"mid": "m1", "text": " Холодильник барбы? "})))
        self.assertEqual(event["kind"], "in")
        self.assertEqual(event["user"], BUYER)
        self.assertEqual(event["text"], "Холодильник барбы?")
        self.assertEqual(event["ts"], 1_759_400_000)  # миллисекунды → секунды

    def test_echo_belongs_to_buyer_chat(self):
        echo = {"sender": {"id": SHOP}, "recipient": {"id": BUYER}, "timestamp": 1, "message": {"mid": "m2", "text": "Есть", "is_echo": True}}
        [event] = rules.events(webhook(echo))
        self.assertEqual((event["kind"], event["user"]), ("echo", BUYER))

    def test_skips_noise(self):
        payload = webhook(
            incoming({"mid": "m3", "is_deleted": True}),
            incoming({"mid": "m4", "is_unsupported": True}),
            {"sender": {"id": BUYER}, "recipient": {"id": SHOP}, "timestamp": 1, "read": {"mid": "m1"}},
            {"sender": {"id": BUYER}, "recipient": {"id": SHOP}, "timestamp": 1, "reaction": {"mid": "m1", "emoji": "❤"}},
            incoming({"text": "без id"}),
            incoming({"mid": "m5", "text": "сам себе"}, sender=SHOP),
        )
        self.assertEqual(rules.events(payload), [])
        self.assertEqual(rules.events({"object": "page", "entry": []}), [])
        self.assertEqual(rules.events("мусор"), [])

    def test_ad_share_and_story_become_context(self):
        message = {
            "mid": "m6",
            "text": "Канча?",
            "referral": {"source": "ADS", "ad_id": "1", "ads_context_data": {"ad_title": "Стиральная Artel 7 кг"}},
            "reply_to": {"story": {"id": "s1", "url": "https://cdn/story.jpg"}},
            "attachments": [{"type": "ig_reel", "payload": {"title": "Новые холодильники", "url": "https://cdn/reel"}}],
        }
        [event] = rules.events(webhook(incoming(message)))
        self.assertEqual(
            rules.describe(event),
            "[Пришёл по рекламе: Стиральная Artel 7 кг]\n[Ответ на историю магазина]\n[Прислал публикацию: Новые холодильники]\nКанча?",
        )
        self.assertEqual(event["media"], [])  # рилс не читаем как фото

    def test_photo_and_voice_go_to_media(self):
        message = {"mid": "m7", "attachments": [
            {"type": "image", "payload": {"url": "https://cdn/p.jpg"}},
            {"type": "audio", "payload": {"url": "https://cdn/v.mp4"}},
            {"type": "image", "payload": {"url": "https://cdn/sticker.png", "sticker_id": 369}},
            {"type": "video", "payload": {"url": "https://cdn/v2.mp4"}},
            {"type": "image", "payload": {"url": "http://insecure/p.jpg"}},
        ]}
        [event] = rules.events(webhook(incoming(message)))
        self.assertEqual(event["media"], [{"kind": "image", "url": "https://cdn/p.jpg"}, {"kind": "audio", "url": "https://cdn/v.mp4"}])
        self.assertEqual(rules.describe(event), "")

    def test_changes_format_and_order(self):
        later = incoming({"mid": "b", "text": "второе"}, ts=2_000)
        first = incoming({"mid": "a", "text": "первое"}, ts=1_000)
        payload = {"object": "instagram", "entry": [{"id": SHOP, "changes": [{"field": "messages", "value": later}], "messaging": [first]}]}
        self.assertEqual([e["mid"] for e in rules.events(payload)], ["a", "b"])


class Text(unittest.TestCase):
    def test_short_text_untouched(self):
        self.assertEqual(rules.split_text("  Есть, 32 900 сом.  "), ["Есть, 32 900 сом."])
        self.assertEqual(rules.split_text("   "), [])

    def test_long_text_split_by_sentences(self):
        text = " ".join(f"Предложение номер {i}." for i in range(200))
        parts = rules.split_text(text, limit=300)
        self.assertTrue(all(len(p.encode("utf-8")) <= 300 for p in parts))
        self.assertEqual(" ".join(parts), text)
        self.assertTrue(all(p.endswith(".") for p in parts))

    def test_one_huge_word(self):
        parts = rules.split_text("x" * 2500)
        self.assertEqual([len(p) for p in parts], [950, 950, 600])

    def test_limit_is_bytes_not_letters(self):
        # 600 букв кириллицы = 1200 байт: одним сообщением Instagram не примет.
        text = "ж" * 600
        parts = rules.split_text(text)
        self.assertTrue(all(len(p.encode("utf-8")) <= rules.TEXT_LIMIT for p in parts))
        self.assertEqual("".join(parts), text)  # букву пополам не режем, ничего не теряем

    def test_text_key_ignores_spacing(self):
        self.assertEqual(rules.text_key("Есть  в\nналичии"), rules.text_key(" Есть в наличии "))
        self.assertNotEqual(rules.text_key("Есть"), rules.text_key("Нет"))


class MentionOnly(unittest.TestCase):
    def test_story_mention_alone_is_not_a_question(self):
        message = {"mid": "m8", "attachments": [{"type": "story_mention", "payload": {"url": "https://cdn/s.jpg"}}]}
        [event] = rules.events(webhook(incoming(message)))
        self.assertTrue(rules.mention_only(event))
        message["text"] = "Бул канча?"
        [event] = rules.events(webhook(incoming(message)))
        self.assertFalse(rules.mention_only(event))


class Window(unittest.TestCase):
    def test_window(self):
        self.assertTrue(rules.window_open(1000, 1000 + 2 * 3600))
        self.assertFalse(rules.window_open(1000, 1000 + 23 * 3600))
        self.assertFalse(rules.window_open(0, 5000))
        self.assertFalse(rules.window_open(5000, 1000))


if __name__ == "__main__":
    unittest.main()
