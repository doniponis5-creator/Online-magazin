import os
from pathlib import Path

import win32com.client


DEFAULT_ENV = Path(r"D:\Projects\Online-magazin\.env.local")
DEFAULT_BASE = r"D:\doonni\1С Предприятие\Базы\Смарт центр база"


def connect(env_path=DEFAULT_ENV, base=DEFAULT_BASE):
    for raw in Path(env_path).read_text(encoding="utf-8-sig").splitlines():
        if "=" not in raw or raw.lstrip().startswith("#"):
            continue
        key, value = raw.split("=", 1)
        if key in {"ONEC_USER", "ONEC_PASSWORD"}:
            os.environ[key] = value.strip().strip('"').strip("'")
    user = os.environ["ONEC_USER"]
    password = os.environ.get("ONEC_PASSWORD", "")
    auth = f'Usr="{user}";' + (f'Pwd="{password}";' if password else "")
    return win32com.client.Dispatch("V83.COMConnector").Connect(f'File="{base}";{auth}')

