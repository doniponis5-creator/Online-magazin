'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { categories } from '@/data/categories'
import { buildCatalogHref } from '@/lib/links'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { IconChevronDown } from './Icons'

/**
 * Строка разделов под шапкой (только компьютер).
 *
 * Разделов 11, вместе с кухней — 13 пунктов: в одну строку не помещались даже
 * на 1440 px, «Галерея кухонь» уходила за край (владелец, 01.10.2026), а мышью
 * строку вбок не пролистать. Теперь разделы, которым не хватило места, уходят
 * в меню «Ещё», а «3D-кухня» и «Галерея кухонь» всегда стоят справа.
 *
 * Как узнаём, что не влезло: строка разделов переносится (flex-wrap), а видна
 * только первая её линия. Всё, что ушло ниже, — в меню. Пересчёт — при каждом
 * изменении ширины, поэтому работает и для длинных кыргызских названий.
 */
export function HeaderSubnav({
  activeCat,
  kitchenCurrent,
  galleryCurrent,
}: {
  activeCat: string | null
  kitchenCurrent: 'page' | undefined
  galleryCurrent: 'page' | undefined
}) {
  const { t, lang } = useI18n()
  const row = useRef<HTMLDivElement>(null)
  const more = useRef<HTMLDivElement>(null)
  // С какого раздела начинается невлезшее; null — влезли все
  const [cut, setCut] = useState<number | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const box = row.current
    if (!box) return
    const measure = () => {
      const links = [...box.querySelectorAll<HTMLElement>('[data-cat]')]
      const top = links[0]?.offsetTop ?? 0
      const first = links.findIndex((a) => a.offsetTop > top)
      setCut(first === -1 ? null : first)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(box)
    return () => observer.disconnect()
  }, [lang])

  // Меню закрывается щелчком мимо и клавишей Esc
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!more.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      more.current?.querySelector('button')?.focus()
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Перешли в раздел — меню больше не нужно
  useEffect(() => setOpen(false), [activeCat])

  const name = (c: (typeof categories)[number]) => (lang === 'ky' ? c.nameKy : c.nameRu)
  const hidden = cut === null ? [] : categories.slice(cut)
  const activeHidden = hidden.some((c) => c.id === activeCat)

  return (
    <nav className="header__subnav" aria-label={t.categories.title}>
      <div className="subnav__row" ref={row}>
        {categories.map((c, i) => {
          const away = cut !== null && i >= cut
          return (
            <Link
              key={c.id}
              data-cat={c.id}
              href={buildCatalogHref(lang, { cat: c.id })}
              className="subnav__link"
              aria-current={activeCat === c.id ? 'page' : undefined}
              // ушедший на вторую линию не виден — не даём на него попасть с клавиатуры
              tabIndex={away ? -1 : undefined}
              aria-hidden={away || undefined}
            >
              {name(c)}
            </Link>
          )
        })}
      </div>
      {hidden.length > 0 && (
        <div className="subnav__more" ref={more}>
          <button
            type="button"
            className="subnav__link subnav__more-btn"
            aria-expanded={open}
            aria-haspopup="true"
            data-current={activeHidden || undefined}
            onClick={() => setOpen((v) => !v)}
          >
            {t.nav.more}
            <IconChevronDown size={14} />
          </button>
          {open && (
            <div className="subnav__menu">
              {hidden.map((c) => (
                <Link
                  key={c.id}
                  href={buildCatalogHref(lang, { cat: c.id })}
                  className="subnav__menu-link"
                  aria-current={activeCat === c.id ? 'page' : undefined}
                  onClick={() => setOpen(false)}
                >
                  {name(c)}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
      <span className="subnav__divider" aria-hidden="true" />
      {/* «3D-кухня» не подсвечивается в галерее: там подсвечена «Галерея кухонь» */}
      <Link href={`/${lang}/kitchen`} className="subnav__link subnav__link--kitchen" aria-current={kitchenCurrent}>
        {lang === 'ky' ? '3D-ашкана' : '3D-кухня'}
      </Link>
      <Link href={`/${lang}/kitchen/gallery`} className="subnav__link subnav__link--kitchen" aria-current={galleryCurrent}>
        {t.nav.kitchenGallery}
      </Link>
    </nav>
  )
}
