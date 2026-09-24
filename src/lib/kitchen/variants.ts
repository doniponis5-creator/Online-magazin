/** Сохранённый вариант кухни: ссылка-адрес и картинка. Живёт в localStorage браузера («мои варианты»). */
export type Variant = { id: string; name: string; label: string; q: string; img: string; at: number }

/**
 * Разбор записи `kp-variants`. Запись мог оставить старый код или чужой
 * скрипт: берём только то, что похоже на вариант, иначе битая строка
 * роняла всю страницу конструктора.
 */
export function parseVariants(raw: string | null): Variant[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((v): v is Variant => typeof v?.q === 'string' && typeof v?.name === 'string')
  } catch {
    return []
  }
}
