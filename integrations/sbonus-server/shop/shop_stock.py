"""
Интернет-магазин Smart Centr — не продать то, чего уже нет.

Случай 20.09.2026: на складе одна стиральная машина. Первый покупатель
оплатил, через пять минут второй — тоже оплатил: сайт всё ещё показывал
«есть», потому что 1С узнаёт о продаже, только когда заберёт заказ (раз в
5 минут, а если компьютер выключен — утром), и только потом присылает новый
остаток (раз в 10 минут).

Поэтому остаток на сайте = остаток из 1С минус то, что уже «занято»
заказами, о которых 1С ещё не знает:
  • оплачен, но 1С его ещё не забрала (или забрать не смогла);
  • 1С забрала недавно — новый остаток из 1С ещё не пришёл;
  • ждёт оплаты — первые 30 минут. Счёт живёт сутки, но держать товар сутки
    нельзя: брошенные корзины прятали с сайта товар, который лежит на складе.

Касается только товаров «По остатку». «В наличии» владелец ставит руками,
когда готов продавать без склада, — там считать нечего.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import timedelta

# 1С забрала заказ и провела реализацию, но новый остаток пришлёт только со
# следующим каталогом (раз в 10 минут). С запасом — 20 минут держим товар.
SYNC_GRACE = timedelta(minutes=20)
# Неоплаченный заказ держит товар столько. Обычно платят за пару минут.
HOLD_UNPAID = timedelta(minutes=30)

FORCED_IN_STOCK = "В наличии"
FORCED_OUT = "Нет в наличии"


def reserved_by(orders: list[dict]) -> dict[str, int]:
    """{oneCId: сколько штук занято} по строкам удерживающих заказов."""
    taken: dict[str, int] = defaultdict(int)
    for order in orders:
        for line in order.get("lines") or []:
            key = str(line.get("oneCId") or "")
            if key:
                taken[key] += int(line.get("qty") or 0)
    return taken


def shortages(lines: list[dict], catalog: list[dict], taken: dict[str, int]) -> list[str]:
    """
    Названия товаров, которых не хватает на этот заказ. Пусто — всё есть.

    Товар, которого нет в каталоге 1С (демо, старый код), не проверяем:
    решает 1С при загрузке заказа, как раньше.
    """
    by_id = {str(item.get("id")): item for item in catalog if item.get("id")}
    wanted: dict[str, int] = defaultdict(int)
    names: dict[str, str] = {}
    for line in lines:
        key = str(line.get("oneCId") or "")
        if key:
            wanted[key] += int(line.get("qty") or 0)
            names[key] = str(line.get("name") or key)

    short = []
    for key, qty in wanted.items():
        item = by_id.get(key)
        if item is None:
            continue
        availability = str(item.get("availability") or "")
        if availability == FORCED_IN_STOCK:
            continue
        stock = 0 if availability == FORCED_OUT else max(int(float(item.get("stock") or 0)), 0)
        if stock - taken.get(key, 0) < qty:
            short.append(names[key])
    return short


def free_stock(catalog: list[dict], taken: dict[str, int]) -> dict[str, int]:
    """Сколько каждого товара «По остатку» реально можно продать — для каталога сайта."""
    free = {}
    for item in catalog:
        key = str(item.get("id") or "")
        if not key or str(item.get("availability") or "") in (FORCED_IN_STOCK, FORCED_OUT):
            continue
        if taken.get(key):
            free[key] = max(int(float(item.get("stock") or 0)) - taken[key], 0)
    return free
