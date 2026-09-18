"""
Интернет-магазин Smart Centr — заказы с сайта (SQLAlchemy).

Один заказ сайта = одна запись ShopOrder. Состав заказа и доставка хранятся в JSONB:
сайт уже проверил и посчитал их по каталогу 1С, сервер хранит как есть.

Статусы:
  awaiting_payment — счёт O!Деньги выставлен, ждём оплату
  paid             — оплата подтверждена (колбэк + перепроверка statusPayment), ждём 1С
  in_1c            — 1С создала Заказ клиента, ПКО и (если товар есть) Реализацию
  failed           — 1С 5 раз не смогла создать документы, разбирается сотрудник
  cancelled        — счёт аннулирован O!Деньги
"""
from datetime import datetime
from uuid import uuid4

from sqlalchemy import Column, String, Text, Integer, Numeric, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class ShopOrder(Base):
    __tablename__ = "shop_orders"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    order_id = Column(String(24), unique=True, nullable=False, index=True)   # SC-260917-7K3QF, он же order_id в O!Деньги
    token = Column(String(64), nullable=False)                               # доступ к странице заказа на сайте

    customer_name = Column(String(160), nullable=False)
    customer_phone = Column(String(20), nullable=False, index=True)
    delivery = Column(JSONB, nullable=False)       # {method, city, address, price}
    comment = Column(Text)
    lines = Column(JSONB, nullable=False)          # [{productId, oneCId, code, name, price, qty, sum}]
    goods_total = Column(Numeric(14, 2), nullable=False)
    total = Column(Numeric(14, 2), nullable=False)
    bonus_spend = Column(Numeric(14, 2), default=0)    # бонусы, которые клиент выбрал при оформлении
    bonus_spent = Column(Numeric(14, 2), default=0)    # фактически списано после оплаты
    pay_amount = Column(Numeric(14, 2))                # деньгами через O!Деньги = total − bonus_spend
    bonus_earned = Column(Numeric(14, 2), default=0)   # начислено 1С при реализации
    lang = Column(String(4), default="ru")

    status = Column(String(20), default="awaiting_payment", index=True)
    paid = Column(Boolean, default=False, index=True)
    paid_at = Column(DateTime)

    obank_invoice_id = Column(String(64))
    obank_trans_id = Column(String(64))
    obank_status = Column(String(32))
    obank_raw = Column(JSONB)
    pay_url = Column(Text)

    order_number_1c = Column(String(32))
    pko_number_1c = Column(String(32))
    rtu_number_1c = Column(String(32))
    realized = Column(Boolean, default=False)
    synced_at = Column(DateTime)
    sync_attempts = Column(Integer, default=0)
    note = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    events = relationship("ShopOrderEvent", back_populates="order", cascade="all, delete-orphan")

    def money_amount(self):
        """Сколько клиент платит деньгами (для старых заказов без бонусов — total)."""
        return self.pay_amount if self.pay_amount is not None else self.total

    def to_site_dict(self) -> dict:
        """Для страницы заказа на сайте: без телефона и адреса."""
        delivery = self.delivery or {}
        return {
            "orderId": self.order_id,
            "status": self.status,
            "total": float(self.total),
            "goodsTotal": float(self.goods_total),
            "bonusSpend": float(self.bonus_spent or self.bonus_spend or 0),
            "payAmount": float(self.money_amount()),
            "bonusEarned": float(self.bonus_earned or 0),
            "deliveryPrice": float(delivery.get("price") or 0),
            "deliveryMethod": delivery.get("method") or "pickup",
            "lines": [
                {"name": l.get("name"), "qty": l.get("qty"), "price": l.get("price"), "sum": l.get("sum")}
                for l in (self.lines or [])
            ],
            "payUrl": self.pay_url if self.status == "awaiting_payment" else None,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "number1c": self.order_number_1c,
        }

    def to_1c_dict(self) -> dict:
        """Для 1С: всё, что нужно для Заказа клиента, ПКО и Реализации."""
        return {
            "order_id": self.order_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "paid_at": self.paid_at.isoformat() if self.paid_at else None,
            "customer_name": self.customer_name,
            "customer_phone": self.customer_phone,
            "delivery": self.delivery,
            "comment": self.comment or "",
            "lines": self.lines,
            "goods_total": float(self.goods_total),
            "total": float(self.total),
            "bonus_spent": float(self.bonus_spent or 0),   # скидка по строкам товаров в 1С
            "pay_amount": float(self.money_amount()),      # сумма ПКО
            "obank_trans_id": self.obank_trans_id or "",
        }


class ShopOrderEvent(Base):
    __tablename__ = "shop_order_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_uuid = Column(PG_UUID(as_uuid=True), ForeignKey("shop_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String(32), nullable=False, index=True)
    event_data = Column(JSONB)
    ip_address = Column(String(45))
    created_at = Column(DateTime, default=datetime.utcnow)

    order = relationship("ShopOrder", back_populates="events")


class ShopEvent(Base):
    """
    Вход покупателя и отправленный код — для счётчиков в «Панели сайта».

    От телефона остаются только четыре последние цифры: для статистики этого
    хватает, а для опознания человека — нет.
    """
    __tablename__ = "shop_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    kind = Column(String(16), nullable=False, index=True)    # code_sent | login | register
    channel = Column(String(16))                             # telegram | whatsapp
    phone_tail = Column(String(4))
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class ShopVisit(Base):
    """
    Посещение страницы сайта. visitor — необратимый отпечаток случайного
    идентификатора из браузера: считать людей можно, узнать человека нельзя.
    """
    __tablename__ = "shop_visits"

    id = Column(Integer, primary_key=True, autoincrement=True)
    visitor = Column(String(32), nullable=False, index=True)
    path = Column(String(200), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
