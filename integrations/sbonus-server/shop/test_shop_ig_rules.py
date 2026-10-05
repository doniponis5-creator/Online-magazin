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
        self.assertEqual(event["story"], "s1")  # по id робот узнаёт товар нашей истории
        self.assertEqual(rules.story_note("Утюг", 1200, 1500), "[Ответ на историю магазина: Утюг — 1 200 сом, было 1 500 сом]")
        self.assertEqual(rules.story_note("Утюг", 1200, 0), "[Ответ на историю магазина: Утюг — 1 200 сом]")

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


def comment_hook(value: dict, own: str = "17841427957347118", time_ms: int = 1_759_500_000_000) -> dict:
    return {"object": "instagram", "entry": [{"id": own, "time": time_ms, "changes": [{"field": "comments", "value": value}]}]}


class Comments(unittest.TestCase):
    def test_buyer_comment(self):
        [c] = rules.comment_events(comment_hook({
            "id": "18001", "text": " Канча? ", "from": {"id": "555", "username": "aibek_osh"}, "media": {"id": "9001", "media_product_type": "REELS"},
        }))
        self.assertEqual(c, {"kind": "comment", "id": "18001", "mid": "c:18001", "user": "555", "username": "aibek_osh",
                             "media": "9001", "text": "Канча?", "ts": 1_759_500_000.0})

    def test_own_reply_empty_and_other_fields_skipped(self):
        self.assertEqual(rules.comment_events(comment_hook({"id": "1", "text": "Директке жаздык", "from": {"id": "17841427957347118"}})), [])
        self.assertEqual(rules.comment_events(comment_hook({"id": "2", "text": "  ", "from": {"id": "555"}})), [])
        self.assertEqual(rules.comment_events(comment_hook({"id": "", "text": "+", "from": {"id": "555"}})), [])
        hook = comment_hook({"id": "3", "text": "+", "from": {"id": "555"}})
        hook["entry"][0]["changes"][0]["field"] = "messages"
        self.assertEqual(rules.comment_events(hook), [])
        self.assertEqual(rules.comment_events({"object": "page"}), [])

    def test_messages_ignore_comments(self):
        # Комментарий не должен попасть в разговор Direct: events() их не берёт.
        self.assertEqual(rules.events(comment_hook({"id": "4", "text": "+", "from": {"id": "555"}})), [])


class PostCaption(unittest.TestCase):
    def test_sale(self):
        text = rules.post_caption("sale", "Электро  Эндуро WN-A10**", 15900, 18900)
        lines = text.split("\n")
        self.assertEqual(lines[:5], ["🔥 Скидка −15% · Арзандатуу", "Электро Эндуро WN-A10", "", "Было: 18 900 сом", "Сейчас: 15 900 сом"])
        self.assertIn("📞 WhatsApp: +996 557 100 505", lines)
        self.assertTrue(lines[-1].startswith("#smartcentr"))
        self.assertIsNone(rules.caption_problem(text))

    def test_new_and_plain(self):
        self.assertTrue(rules.post_caption("new", "Холодильник", 52900, 0).startswith("✨ Новинка · Жаңы товар\nХолодильник\n\nЦена: 52 900 сом"))
        plain = rules.post_caption("custom", "Утюг", 1200, 0)
        self.assertTrue(plain.startswith("Утюг\n\nЦена: 1 200 сом"))
        # «Скидка» без старой цены не обещает процент.
        self.assertNotIn("%", rules.post_caption("sale", "Утюг", 1200, 1200))

    def test_image_kind(self):
        self.assertEqual(rules.image_kind("sale", set()), "sale")
        self.assertEqual(rules.image_kind("new", {"sale"}), "new")
        self.assertEqual(rules.image_kind("hit", set()), "hit")  # слот авто-истории — его метка
        # «Свой текст» — самая важная метка товара из 1С.
        self.assertEqual(rules.image_kind("custom", {"sale"}), "sale")
        self.assertEqual(rules.image_kind("custom", {"new", "hit"}), "hit")
        self.assertEqual(rules.image_kind("custom", {"new", "deal", "sale"}), "deal")
        self.assertEqual(rules.image_kind("custom", set()), "plain")
        self.assertEqual(rules.discount_pct(15900, 18900), 15)  # 15,87 % → 15, как на картинке
        self.assertEqual(rules.discount_pct(100, 0), 0)

    def test_caption_checks(self):
        self.assertEqual(rules.clean_caption("  Скидка  на\r\n\n\n\nутюг  "), "Скидка на\n\nутюг")
        self.assertEqual(rules.caption_problem(""), "Заполните текст поста.")
        self.assertIn("2200", rules.caption_problem("ж" * 2201))
        self.assertIn("Хэштегов 31", rules.caption_problem(" ".join(f"#t{i}" for i in range(31))))
        self.assertIsNone(rules.caption_problem("Цена 100 сом #a#b"))  # «#a#b» — один хэштег, как считает Instagram


class StoryReply(unittest.TestCase):
    def test_lang(self):
        self.assertEqual(rules.talk_lang("Канча?"), "ky")
        self.assertEqual(rules.talk_lang("Баасы канча турат"), "ky")
        self.assertEqual(rules.talk_lang("Сколько стоит?"), "ru")
        self.assertEqual(rules.talk_lang("Нархи қанча"), "uz")
        self.assertEqual(rules.talk_lang("+"), "ky")

    def test_answer_and_status(self):
        link = rules.product_link("https://smarket.kg/", "cb-00002536", "ky")
        self.assertEqual(link, "https://smarket.kg/ky/product/cb-00002536")
        self.assertEqual(rules.product_link("https://smarket.kg", "x", "uz"), "https://smarket.kg/ru/product/x")
        self.assertEqual(
            rules.story_answer("ky", "MIDEA MDWM-218TWO", 23900, 26900, link),
            "Ассаламу алейкум! MIDEA MDWM-218TWO — 23 900 сом (мурун 26 900 сом).\n"
            "Сайттан көрүп, заказ берсеңиз болот: https://smarket.kg/ky/product/cb-00002536\nКайсы шаардан болосуз?",
        )
        self.assertIn("Посмотреть и заказать на сайте:", rules.story_answer("ru", "A", 100, 0, "u"))
        self.assertNotIn("было", rules.story_answer("ru", "A", 100, 0, "u"))
        caption = rules.wa_status_caption("Утюг", 1200, 1500, "https://smarket.kg/ky/product/x")
        self.assertTrue(caption.endswith("https://smarket.kg/ky/product/x"))
        self.assertIn("1 200 сом (мурун 1 500 сом)", caption)


class IceBreakers(unittest.TestCase):
    def test_tap_becomes_message(self):
        tap = {"sender": {"id": BUYER}, "recipient": {"id": SHOP}, "timestamp": 1_759_400_000_000,
               "postback": {"mid": "pb1", "title": "Баасы канча?", "payload": "IB_0"}}
        [event] = rules.events(webhook(tap))
        self.assertEqual((event["kind"], event["user"], event["mid"], event["text"]), ("in", BUYER, "pb1", "Баасы канча?"))
        # Свой же postback (от аккаунта магазина) — не событие.
        self.assertEqual(rules.events(webhook({**tap, "sender": {"id": SHOP}})), [])

    def test_payload(self):
        body = rules.ice_breakers_payload()
        self.assertEqual(body["platform"], "instagram")
        self.assertTrue(all(len(x["call_to_actions"]) <= 4 for x in body["ice_breakers"]))
        self.assertEqual(body["ice_breakers"][0]["locale"], "default")

    def test_carousel_caption(self):
        text = rules.carousel_caption([("Утюг  Philips*", 900, 1200), ("Чайник", 500, 0)])
        self.assertIn("• Утюг Philips — 900 сом (мурун 1 200 сом)", text)
        self.assertIn("• Чайник — 500 сом\n", text)
        self.assertIsNone(rules.caption_problem(text))


class Window(unittest.TestCase):
    def test_window(self):
        self.assertTrue(rules.window_open(1000, 1000 + 2 * 3600))
        self.assertFalse(rules.window_open(1000, 1000 + 23 * 3600))
        self.assertFalse(rules.window_open(0, 5000))
        self.assertFalse(rules.window_open(5000, 1000))


class AnswerPlace(unittest.TestCase):
    """05.10: покупатель дописал, пока думал Gemini, — ответ ложился в конец, и Gemini отвечал 400."""

    def test_answer_goes_after_asked(self):
        u = lambda t: {"role": "user", "text": t}
        a = lambda t: {"role": "assistant", "text": t}
        asked = [a("Директке жаздык"), u("Канча?")]
        now = asked + [u("Жеткирүү барбы?")]
        self.assertEqual(rules.place_answer(now, asked, "23 900 сом"), asked + [a("23 900 сом"), u("Жеткирүү барбы?")])
        # Ничего не дописал — в конец, как раньше.
        self.assertEqual(rules.place_answer(asked, asked, "23 900 сом"), asked + [a("23 900 сом")])
        # Разговор успел смениться (обрезка, сотрудник) — в конец.
        self.assertEqual(rules.place_answer([u("Салам")], asked, "Бар"), [u("Салам"), a("Бар")])
        self.assertEqual(rules.place_answer(now, None, "Бар"), now + [a("Бар")])


class BusyRetry(unittest.TestCase):
    """05.10: Google 503 «high demand» — покупатель ждёт минуту, а не остаётся без ответа."""

    def test_retry(self):
        pending = {"ts": 100, "voice": False}
        self.assertEqual(rules.busy_retry(pending, "busy"), {"ts": 100, "voice": False, "retry": 1})
        self.assertEqual(rules.busy_retry({**pending, "retry": 2}, "timeout")["retry"], 3)
        self.assertEqual(rules.busy_retry(pending, "busy")["ts"], 100)  # время вопроса прежнее: старое не ответим
        self.assertIsNone(rules.busy_retry({**pending, "retry": rules.BUSY_RETRIES}, "busy"))  # хватит — владельцу
        self.assertIsNone(rules.busy_retry(pending, "key"))    # ключ сам не починится
        self.assertIsNone(rules.busy_retry(pending, "limit"))
        self.assertIsNone(rules.busy_retry(None, "busy"))


if __name__ == "__main__":
    unittest.main()
