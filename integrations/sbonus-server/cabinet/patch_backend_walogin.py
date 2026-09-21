"""
Кабинет SBonus (cabinet.smartcentr.store): вход через WhatsApp «наоборот».

Дописывает в /opt/sbonus/sbonus-backend/app/api/v1/customer_auth.py два
эндпоинта. Логику (номер магазина, чтение журнала Green API, ключи Redis)
берёт из app/shop/shop_customers.py — той же, что и сайт. Запускать на
сервере: python3 patch_backend_walogin.py <путь к customer_auth.py>.
Повторный запуск ничего не меняет.
"""
import sys

MARK = "/wa-login/start"
CODE = '''

# ── Вход через WhatsApp «наоборот» ───────────────────────────────────────────
# Покупатель сам шлёт магазину «Код входа: 482913» (wa.me с готовым текстом).
# Магазин ничего не отправляет — Green API нечего блокировать; номер
# подтверждён отправителем. Общая часть — в app/shop/shop_customers.py.

class WaLoginCheckRequest(BaseModel):
    code: str


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()[:45]
    return (request.client.host if request.client else "")[:45]


@router.post("/wa-login/start", status_code=200)
async def wa_login_start(request: Request):
    from app.core.redis import redis_client
    from app.shop.shop_customers import WA_LOGIN_TTL, _own_wa_number

    ip = _client_ip(request)
    if ip and not await check_rate_limit(f"cab_walogin_ip:{ip}", max_attempts=60, window_seconds=3600):
        raise HTTPException(status_code=429, detail="Слишком много запросов. Попробуйте позже.")
    try:
        own = await _own_wa_number()
    except Exception as error:
        logger.error(f"cabinet wa-login start: {error}")
        raise HTTPException(status_code=502, detail="WhatsApp магазина сейчас недоступен. Войдите по коду.")
    code = f"{secrets.randbelow(900000) + 100000}"
    await redis_client.setex(f"shop_walogin:{code}", WA_LOGIN_TTL, ip or "-")
    return {"code": code, "wa_phone": own, "ttl": WA_LOGIN_TTL}


@router.post("/wa-login/check", status_code=200)
async def wa_login_check(
    body: WaLoginCheckRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    import re
    from app.core.redis import redis_client
    from app.shop.shop_customers import _scan_wa_logins

    code = body.code.strip()
    if not re.fullmatch(r"\\d{6}", code):
        raise HTTPException(status_code=400, detail="Код — 6 цифр")
    if not await redis_client.get(f"shop_walogin:{code}"):
        raise HTTPException(status_code=410, detail="Время вышло. Начните заново.")
    phone = await redis_client.get(f"shop_walogin_done:{code}")
    if not phone:
        await _scan_wa_logins()
        phone = await redis_client.get(f"shop_walogin_done:{code}")
    if isinstance(phone, bytes):
        phone = phone.decode()
    if not phone:
        return {"pending": True}
    await redis_client.delete(f"shop_walogin:{code}", f"shop_walogin_done:{code}")

    result = await db.execute(select(Customer).where(Customer.phone == phone))
    customer = result.scalar_one_or_none()
    if not customer or not customer.is_active:
        raise HTTPException(status_code=404, detail="Клиент не найден. Зарегистрируйтесь.")

    days = settings.customer_token_expire_days
    jwt_token = create_customer_token(str(customer.id), days=days)
    response.set_cookie(
        key="customer_token",
        value=jwt_token,
        max_age=days * 24 * 3600,
        httponly=True,
        secure=True,
        samesite="strict",
        path="/",
    )
    logger.info(f"WA-login success: ...{phone[-4:]}")
    return {
        "pending": False,
        "access_token": jwt_token,
        "expires_in": days * 24 * 3600,
        "customer_id": str(customer.id),
    }
'''


def main(path: str) -> None:
    with open(path, encoding="utf-8") as f:
        src = f.read()
    if MARK in src:
        print("• customer_auth.py: wa-login уже есть")
        return
    for needle in ("create_customer_token", "check_rate_limit", "class OTPVerifyRequest"):
        if needle not in src:
            raise SystemExit(f"❌ customer_auth.py не похож на ожидаемый: нет {needle}")
    with open(path, "w", encoding="utf-8") as f:
        f.write(src.rstrip("\n") + "\n" + CODE)
    print("✓ customer_auth.py: добавлены /wa-login/start и /wa-login/check")


if __name__ == "__main__":
    main(sys.argv[1])
