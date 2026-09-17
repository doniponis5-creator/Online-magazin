"""
Чтение настроек из .env.local в корне проекта — для программ 1С и сервера.

Файл заполняет владелец. Если значения нет в файле, программа спросит его вручную,
как раньше. Переменные окружения Windows имеют приоритет над файлом.
"""
import getpass
import os
from pathlib import Path

ENV_FILE = Path(__file__).resolve().parents[1] / ".env.local"


def _load() -> dict:
    values = {}
    if not ENV_FILE.exists():
        return values
    for raw in ENV_FILE.read_text(encoding="utf-8-sig").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


_VALUES = _load()


def get(name: str, default: str = "") -> str:
    return os.environ.get(name) or _VALUES.get(name) or default


def onec_credentials(default_user: str) -> tuple:
    """Пользователь и пароль 1С: из .env.local (ONEC_USER, ONEC_PASSWORD) или вопросом в консоли."""
    user = get("ONEC_USER")
    if not user:
        user = input(f"Пользователь 1С [{default_user}]: ").strip() or default_user
    password = get("ONEC_PASSWORD")
    if password:
        print(f"Пользователь 1С «{user}» — пароль взят из .env.local")
    else:
        password = getpass.getpass("Пароль 1С (символы не отображаются): ")
    return user, password
