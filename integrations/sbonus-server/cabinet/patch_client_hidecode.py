"""
Кабинет SBonus — страница входа: форма «код по номеру» свёрнута.

После patch_client_walogin.py. Вместо карточки с полем номера — одна строка
«Нет WhatsApp? Получить код по номеру»; нажали — карточка раскрывается.
Запуск на сервере: python3 patch_client_hidecode.py /opt/sbonus/sbonus-client
Повторный запуск ничего не меняет.
"""
import sys
from pathlib import Path

MARK = "showCode"


def main(root: str) -> None:
    page = Path(root) / "app" / "login" / "page.tsx"
    src = page.read_text(encoding="utf-8")
    if MARK in src:
        print("• page.tsx: форма уже свёрнута")
        return
    pairs = [
        (
            "  const [wa, setWa] = useState<{ code: string; waPhone: string; startedAt: number } | null>(null);",
            "  const [wa, setWa] = useState<{ code: string; waPhone: string; startedAt: number } | null>(null);\n"
            "  // Код по номеру — запасной путь: форма свёрнута, пока не попросят.\n"
            "  const [showCode, setShowCode] = useState(false);",
        ),
        (
            "        <form onSubmit={handleSendOtp} className=\"card\" style={{ marginBottom: 16 }}>\n"
            "          <h2 className=\"h2\" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>\n"
            "            <Phone size={17} color=\"var(--text-2)\" /> Или код по номеру\n"
            "          </h2>",
            "        {!showCode && (\n"
            "          <p style={{ textAlign: 'center', marginBottom: 16 }}>\n"
            "            <button type=\"button\" className=\"btn btn-ghost\" onClick={() => setShowCode(true)} style={{ fontSize: 14 }}>\n"
            "              Нет WhatsApp? Получить код по номеру\n"
            "            </button>\n"
            "          </p>\n"
            "        )}\n\n"
            "        {showCode && (\n"
            "        <form onSubmit={handleSendOtp} className=\"card\" style={{ marginBottom: 16 }}>\n"
            "          <h2 className=\"h2\" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>\n"
            "            <Phone size={17} color=\"var(--text-2)\" /> Код по номеру\n"
            "          </h2>",
        ),
        (
            "        </form>\n\n"
            "        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-3)' }}>\n"
            "          Нет аккаунта?",
            "        </form>\n"
            "        )}\n\n"
            "        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-3)' }}>\n"
            "          Нет аккаунта?",
        ),
    ]
    for old, new in pairs:
        if old not in src:
            raise SystemExit(f"❌ page.tsx: не нашёл ожидаемый кусок:\n{old[:100]}")
        src = src.replace(old, new, 1)
    page.write_text(src, encoding="utf-8")
    print("✓ page.tsx: форма «код по номеру» свёрнута")


if __name__ == "__main__":
    main(sys.argv[1])
