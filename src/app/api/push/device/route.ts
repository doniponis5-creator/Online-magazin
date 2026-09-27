import type { NextRequest } from 'next/server'
import { registerPushDevice, type PushPlatform } from '@/lib/customer/gateway'
import { currentSession } from '../../customer/route-helpers'

/**
 * Какой адрес какой платформе годится. Чужое сюда не пускаем.
 * iPhone (Apple): шестнадцатеричная строка. Android (Google FCM): буквы, цифры и `_ - :`,
 * длиннее и без строгого формата — Google его не обещает, проверяем только набор знаков и длину.
 */
const TOKEN_SHAPE: Record<PushPlatform, RegExp> = {
  ios: /^[0-9a-fA-F]{60,200}$/,
  android: /^[A-Za-z0-9_:-]{100,1024}$/,
}

/**
 * Приложение прислало «адрес» телефона для уведомлений.
 *
 * Адрес привязываем к покупателю, если он вошёл. Не вошёл — всё равно запоминаем:
 * он войдёт позже, и адрес допишется к нему.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { token?: unknown; platform?: unknown } | null
  // Старые установки на iPhone платформу не присылают — для них это iPhone.
  const platform = body?.platform ?? 'ios'
  if (platform !== 'ios' && platform !== 'android') {
    return Response.json({ ok: false, error: 'platform' }, { status: 400 })
  }
  const token = typeof body?.token === 'string' ? body.token.trim() : ''
  if (!TOKEN_SHAPE[platform].test(token)) {
    return Response.json({ ok: false, error: 'token' }, { status: 400 })
  }
  const session = await currentSession()
  try {
    await registerPushDevice(token, session?.phone ?? null, platform)
    return Response.json({ ok: true })
  } catch (error) {
    // Уведомления — не повод ломать приложение: молча забываем.
    console.error('[push] не удалось сохранить адрес телефона:', error)
    return Response.json({ ok: true, saved: false })
  }
}
