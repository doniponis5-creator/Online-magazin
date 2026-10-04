"""
Интернет-магазин Smart Centr — недельная статистика Instagram владельцу (04.10).

По понедельникам после сводки 9:05 (shop_wa_bot.run_digest) — в WhatsApp владельца:
охват аккаунта, переходы на сайт, подписчики, лучшие посты и истории, сколько человек написало в Direct,
ответило на истории и сколько комментариев разобрал робот. Текст — shop_ig_rules.week_report.

Откуда цифры:
  • Instagram API (нужно право instagram_business_manage_insights; без него — только наши счётчики,
    подписчики и подсказка, что включить);
  • истории Instagram отдаёт цифры только пока история висит (24 часа) — поэтому collect_stories()
    раз в час (из cron робота) запоминает их в Redis ig:stats:stories;
  • свои счётчики робота: ig:stats:dm:<день> (кто написал в Direct), ig:stats:storyreply:<день>,
    ig:stats:comments:<день> — их пишет shop_ig_bot.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone

import httpx

from app.core.redis import redis_client

from . import shop_ig_rules as rules

logger = logging.getLogger("sbonus.shop.ig_stats")

STATS_TTL = 10 * 24 * 3600
PERMISSION_HINT = ("Нет права на статистику: в кабинете Meta включите instagram_business_manage_insights и обновите ключ "
                   "(scripts\\setup-instagram-token.ps1). Пока — только счётчики робота и подписчики.")


def _day(moment: datetime) -> str:
    """Тот же день, что у счётчиков робота (shop_wa_bot._today: Бишкек, ГГГГММДД)."""
    return (moment.astimezone(timezone.utc) + timedelta(hours=6)).strftime("%Y%m%d")


async def count_dm(user: str) -> None:
    key = f"ig:stats:dm:{_day(datetime.now(timezone.utc))}"
    await redis_client.sadd(key, user)
    await redis_client.expire(key, STATS_TTL)


async def count(kind: str) -> None:
    """kind: storyreply | comments."""
    key = f"ig:stats:{kind}:{_day(datetime.now(timezone.utc))}"
    await redis_client.incr(key)
    await redis_client.expire(key, STATS_TTL)


def _when(value: str) -> datetime | None:
    try:
        return datetime.strptime(value, "%Y-%m-%dT%H:%M:%S%z")
    except (TypeError, ValueError):
        return None


def _values(data: dict) -> dict:
    """Ответ /insights → {метрика: число}: у одних — values[0].value, у других — total_value.value."""
    out = {}
    for row in data.get("data") or []:
        if not isinstance(row, dict) or not row.get("name"):
            continue
        total = row.get("total_value") or {}
        if isinstance(total, dict) and "value" in total:
            out[row["name"]] = total.get("value")
        elif row.get("values"):
            out[row["name"]] = (row["values"][-1] or {}).get("value")
    return out


async def collect_stories() -> int:
    """Раз в час: цифры живых историй (через сутки Instagram их уже не отдаст). Возвращает, сколько обновили."""
    from .shop_ig_bot import _load_token
    from .shop_ig_post import _graph
    hour = (datetime.now(timezone.utc)).strftime("%Y%m%d%H")
    if not await redis_client.set(f"ig:stats:storytick:{hour}", "1", ex=2 * 3600, nx=True):
        return 0
    token = await _load_token()
    if not token:
        return 0
    done = 0
    async with httpx.AsyncClient(timeout=20) as client:
        try:
            stories = (await _graph(client, "GET", "me/stories", token, fields="id,timestamp")).get("data") or []
        except Exception as error:
            logger.info(f"ig stats: истории не прочитаны: {error}")
            return 0
        for story in stories:
            sid = str(story.get("id") or "")
            if not sid:
                continue
            try:
                numbers = _values(await _graph(client, "GET", f"{sid}/insights", token, metric="reach,replies,total_interactions"))
            except Exception as error:
                logger.info(f"ig stats: история {sid}: {error}")
                continue
            ours = await redis_client.get(f"ig:story:{sid}")
            try:
                name = str(json.loads(ours).get("name") or "") if ours else ""
            except Exception:
                name = ""
            await redis_client.hset("ig:stats:stories", sid, json.dumps({
                "ts": story.get("timestamp") or "", "name": name or "История",
                "reach": numbers.get("reach"), "replies": numbers.get("replies"),
            }, ensure_ascii=False))
            done += 1
    await redis_client.expire("ig:stats:stories", STATS_TTL)
    return done


async def _followers(token: str, client: httpx.AsyncClient, today: str) -> tuple[int, int | None] | None:
    """Сейчас и неделю назад (запомненное в прошлый понедельник)."""
    from .shop_ig_post import _graph
    try:
        now = int((await _graph(client, "GET", "me", token, fields="followers_count")).get("followers_count") or 0)
    except Exception:
        return None
    before = None
    try:
        last = json.loads(await redis_client.get("ig:stats:followers") or "null")
        if isinstance(last, dict) and last.get("day") != today:
            before = int(last.get("count"))
    except Exception:
        before = None
    await redis_client.set("ig:stats:followers", json.dumps({"day": today, "count": now}), ex=40 * 24 * 3600)
    return now, before


async def week_report(now: datetime | None = None) -> str:
    """Собрать текст недели. Ничего не шлёт."""
    from .shop_ig_bot import _load_token
    from .shop_ig_post import _graph
    now = now or datetime.now(timezone.utc)
    since = now - timedelta(days=7)
    days = [_day(since + timedelta(days=i + 1)) for i in range(7)]
    # Обычными циклами: await внутри sum(...) превращает выражение в асинхронный генератор.
    people: set = set()
    counts = {"dm": 0, "storyreply": 0, "comments": 0}
    for d in days:
        people |= set(await redis_client.smembers(f"ig:stats:dm:{d}") or [])
        counts["storyreply"] += int(await redis_client.get(f"ig:stats:storyreply:{d}") or 0)
        counts["comments"] += int(await redis_client.get(f"ig:stats:comments:{d}") or 0)
    counts["dm"] = len(people)
    period = f"{(since + timedelta(hours=6)):%d.%m} – {(now + timedelta(hours=6)):%d.%m}"
    token = await _load_token()
    if not token:
        return rules.week_report(period, {}, [], [], counts, None, "Ключа Instagram нет — только счётчики робота.")
    problem = ""
    account: dict = {}
    posts: list[dict] = []
    async with httpx.AsyncClient(timeout=25) as client:
        try:
            account = _values(await _graph(
                client, "GET", "me/insights", token, metric="reach,profile_views,website_clicks,accounts_engaged",
                period="day", metric_type="total_value", since=str(int(since.timestamp())), until=str(int(now.timestamp())),
            ))
        except Exception as error:
            problem = PERMISSION_HINT if any(x in str(error) for x in ("(#10)", "(#200)", "403", "permission")) else ""
            logger.info(f"ig stats: аккаунт: {error}")
        followers = await _followers(token, client, _day(now))
        try:
            media = (await _graph(client, "GET", "me/media", token,
                                  fields="id,caption,media_type,timestamp,like_count,comments_count", limit="30")).get("data") or []
        except Exception as error:
            media = []
            logger.info(f"ig stats: посты: {error}")
        for item in media:
            when = _when(str(item.get("timestamp") or ""))
            if not when or when < since:
                continue
            reach = None
            if not problem:
                try:
                    reach = _values(await _graph(client, "GET", f"{item['id']}/insights", token, metric="reach")).get("reach")
                except Exception as error:
                    logger.info(f"ig stats: пост {item.get('id')}: {error}")
            posts.append({"caption": str(item.get("caption") or ""), "type": item.get("media_type"), "reach": reach,
                          "likes": item.get("like_count"), "comments": item.get("comments_count")})
    stories = []
    for raw in (await redis_client.hgetall("ig:stats:stories") or {}).values():
        try:
            story = json.loads(raw)
        except Exception:
            continue
        when = _when(str(story.get("ts") or ""))
        if when and when >= since:
            stories.append(story)
    return rules.week_report(period, account, posts, stories, counts, followers, problem)


async def send_week_report() -> bool:
    """В понедельник после сводки — владельцу в WhatsApp. Нет ключа Instagram — молчим."""
    from .shop_ig_bot import _load_token
    from .shop_router import _admin_phone
    from .shop_wa_bot import _send_text
    if not await _load_token():
        return False
    text = await week_report()
    await _send_text(_admin_phone(), text)
    return True
