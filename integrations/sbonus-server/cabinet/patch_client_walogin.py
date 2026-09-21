"""
Кабинет SBonus — страница входа: кнопка «Войти через WhatsApp».

Правит /opt/sbonus/sbonus-client/app/login/page.tsx и lib/api.ts.
Запуск на сервере: python3 patch_client_walogin.py /opt/sbonus/sbonus-client
Повторный запуск ничего не меняет.
"""
import sys
from pathlib import Path


def patch(path: Path, pairs: list[tuple[str, str]], mark: str) -> None:
    src = path.read_text(encoding="utf-8")
    if mark in src:
        print(f"• {path.name}: уже пропатчен")
        return
    for old, new in pairs:
        if old not in src:
            raise SystemExit(f"❌ {path.name}: не нашёл ожидаемый кусок:\n{old[:120]}")
        src = src.replace(old, new, 1)
    path.write_text(src, encoding="utf-8")
    print(f"✓ {path.name}")


def main(root: str) -> None:
    client = Path(root)

    patch(client / "lib" / "api.ts", [(
        "  sendOtp: (phone: string) =>\n    api.post('/api/v1/customer-auth/send-otp', { phone }),",
        "  sendOtp: (phone: string) =>\n    api.post('/api/v1/customer-auth/send-otp', { phone }),\n"
        "  waLoginStart: () =>\n    api.post<{ code: string; wa_phone: string; ttl: number }>('/api/v1/customer-auth/wa-login/start', {}),\n"
        "  waLoginCheck: (code: string) =>\n    api.post<{ pending: boolean; access_token?: string }>('/api/v1/customer-auth/wa-login/check', { code }),",
    )], "waLoginStart")

    page = client / "app" / "login" / "page.tsx"
    patch(page, [
        (
            "import { ArrowLeft, Loader2, Lock, Phone, ShieldCheck } from 'lucide-react';",
            "import { ArrowLeft, Loader2, Lock, MessageCircle, Phone, ShieldCheck } from 'lucide-react';",
        ),
        (
            "  const [step, setStep] = useState<'phone' | 'code'>('phone');",
            "  const [step, setStep] = useState<'phone' | 'code' | 'wa'>('phone');\n"
            "  // Вход через WhatsApp «наоборот»: покупатель сам шлёт магазину код.\n"
            "  const [wa, setWa] = useState<{ code: string; waPhone: string; startedAt: number } | null>(null);",
        ),
        (
            "  const handleSendOtp = async (e: React.FormEvent) => {",
            "  const handleWaStart = async () => {\n"
            "    setError('');\n"
            "    setLoading(true);\n"
            "    try {\n"
            "      const res = await customerAuthAPI.waLoginStart();\n"
            "      setWa({ code: res.data.code, waPhone: res.data.wa_phone, startedAt: Date.now() });\n"
            "      setStep('wa');\n"
            "    } catch (err: any) {\n"
            "      const detail = err?.response?.data?.detail;\n"
            "      setError(typeof detail === 'string' ? detail : 'WhatsApp сейчас недоступен. Войдите по коду.');\n"
            "    } finally {\n"
            "      setLoading(false);\n"
            "    }\n"
            "  };\n\n"
            "  // Пока открыт экран WhatsApp — раз в 3 секунды спрашиваем, пришло ли сообщение.\n"
            "  useEffect(() => {\n"
            "    if (step !== 'wa' || !wa) return;\n"
            "    let stopped = false;\n"
            "    let timer: ReturnType<typeof setTimeout> | null = null;\n"
            "    const tick = async () => {\n"
            "      if (stopped) return;\n"
            "      if (Date.now() - wa.startedAt > 5 * 60_000) {\n"
            "        setError('Время вышло. Нажмите «Войти через WhatsApp» ещё раз.');\n"
            "        setStep('phone');\n"
            "        return;\n"
            "      }\n"
            "      try {\n"
            "        const res = await customerAuthAPI.waLoginCheck(wa.code);\n"
            "        if (stopped) return;\n"
            "        if (!res.data.pending && res.data.access_token) {\n"
            "          setToken(res.data.access_token);\n"
            "          router.replace('/');\n"
            "          return;\n"
            "        }\n"
            "      } catch (err: any) {\n"
            "        if (stopped) return;\n"
            "        const status = err?.response?.status;\n"
            "        const detail = err?.response?.data?.detail;\n"
            "        if (status === 404 || status === 410 || status === 429) {\n"
            "          setError(typeof detail === 'string' ? detail : 'Не получилось войти.');\n"
            "          setStep('phone');\n"
            "          return;\n"
            "        }\n"
            "      }\n"
            "      timer = setTimeout(tick, 3000);\n"
            "    };\n"
            "    timer = setTimeout(tick, 3000);\n"
            "    return () => {\n"
            "      stopped = true;\n"
            "      if (timer) clearTimeout(timer);\n"
            "    };\n"
            "    // eslint-disable-next-line react-hooks/exhaustive-deps\n"
            "  }, [step, wa]);\n\n"
            "  const waMessage = wa ? `Код входа: ${wa.code}` : '';\n"
            "  const waHref = wa ? `https://wa.me/${wa.waPhone}?text=${encodeURIComponent(waMessage)}` : '#';\n\n"
            "  const handleSendOtp = async (e: React.FormEvent) => {",
        ),
        (
            "  // ─── STEP 2: CODE INPUT ───",
            "  // ─── STEP WA: ЖДЁМ СООБЩЕНИЕ ИЗ WHATSAPP ───\n"
            "  if (step === 'wa' && wa) {\n"
            "    return (\n"
            "      <div className=\"center\">\n"
            "        <div style={{ maxWidth: 360, width: '100%', textAlign: 'center' }}>\n"
            "          <div style={{\n"
            "            width: 64, height: 64, borderRadius: 16,\n"
            "            background: 'rgba(37, 211, 102, 0.12)',\n"
            "            border: '1px solid rgba(37, 211, 102, 0.35)',\n"
            "            display: 'flex', alignItems: 'center', justifyContent: 'center',\n"
            "            margin: '0 auto 20px',\n"
            "          }}>\n"
            "            <MessageCircle size={28} color=\"#25d366\" />\n"
            "          </div>\n"
            "          <h1 className=\"h1\" style={{ marginBottom: 8 }}>Вход через WhatsApp</h1>\n"
            "          <p className=\"muted\" style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 20 }}>\n"
            "            Нажмите кнопку — откроется WhatsApp с готовым сообщением. Отправьте его и вернитесь сюда: вход произойдёт сам.\n"
            "          </p>\n"
            "          <a\n"
            "            className=\"btn btn-primary\"\n"
            "            href={waHref}\n"
            "            target=\"_blank\"\n"
            "            rel=\"noopener\"\n"
            "            style={{ background: '#25d366', borderColor: '#25d366', color: '#fff', width: '100%', display: 'inline-flex', justifyContent: 'center', gap: 8, marginBottom: 16 }}\n"
            "          >\n"
            "            <MessageCircle size={17} /> Открыть WhatsApp\n"
            "          </a>\n"
            "          <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14, marginBottom: 16 }}>\n"
            "            <Loader2 className=\"spinner\" size={18} color=\"#25d366\" /> Ждём ваше сообщение…\n"
            "          </p>\n"
            "          <p className=\"muted\" style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 20 }}>\n"
            "            Если текст не подставился, отправьте на номер +{wa.waPhone}:<br />\n"
            "            <strong className=\"numeric\" style={{ color: 'var(--text)', fontSize: 15 }}>{waMessage}</strong>\n"
            "          </p>\n"
            "          {error && (\n"
            "            <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</p>\n"
            "          )}\n"
            "          <button\n"
            "            className=\"btn btn-ghost\"\n"
            "            onClick={() => { setWa(null); setStep('phone'); setError(''); }}\n"
            "            style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}\n"
            "          >\n"
            "            <ArrowLeft size={14} /> Назад\n"
            "          </button>\n"
            "        </div>\n"
            "      </div>\n"
            "    );\n"
            "  }\n\n"
            "  // ─── STEP 2: CODE INPUT ───",
        ),
        (
            "        <form onSubmit={handleSendOtp} className=\"card\" style={{ marginBottom: 16 }}>\n"
            "          <h2 className=\"h2\" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>\n"
            "            <Phone size={17} color=\"var(--text-2)\" /> Вход по номеру\n"
            "          </h2>\n"
            "          <p className=\"muted\" style={{ marginBottom: 16, fontSize: 13 }}>\n"
            "            Введите номер — мы отправим 4-значный код в WhatsApp.\n"
            "          </p>",
            "        <div className=\"card\" style={{ marginBottom: 16 }}>\n"
            "          <button\n"
            "            type=\"button\"\n"
            "            className=\"btn btn-primary\"\n"
            "            onClick={handleWaStart}\n"
            "            disabled={loading}\n"
            "            style={{ background: '#25d366', borderColor: '#25d366', color: '#fff', width: '100%', display: 'inline-flex', justifyContent: 'center', gap: 8 }}\n"
            "          >\n"
            "            {loading ? <Loader2 className=\"spinner\" size={17} /> : <MessageCircle size={17} />} Войти через WhatsApp\n"
            "          </button>\n"
            "          <p className=\"muted\" style={{ marginTop: 10, marginBottom: 0, fontSize: 13, textAlign: 'center' }}>\n"
            "            Одно сообщение из вашего WhatsApp — и вы вошли.\n"
            "          </p>\n"
            "        </div>\n\n"
            "        <form onSubmit={handleSendOtp} className=\"card\" style={{ marginBottom: 16 }}>\n"
            "          <h2 className=\"h2\" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>\n"
            "            <Phone size={17} color=\"var(--text-2)\" /> Или код по номеру\n"
            "          </h2>\n"
            "          <p className=\"muted\" style={{ marginBottom: 16, fontSize: 13 }}>\n"
            "            Нет WhatsApp? Введите номер — отправим 4-значный код.\n"
            "          </p>",
        ),
    ], "handleWaStart")


if __name__ == "__main__":
    main(sys.argv[1])
