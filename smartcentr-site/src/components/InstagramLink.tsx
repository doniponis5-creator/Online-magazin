'use client'

import { useState } from 'react'
import { instagram } from '@/data/contacts'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { IconArrowUpRight, IconInstagram } from './Icons'

/**
 * Ссылка на Instagram магазина. На компьютере при наведении показывает QR-код.
 *
 * Сидящий за компьютером не полезет набирать @smartcentrr на телефоне — он
 * наведёт камеру и откроет профиль за секунду. На телефоне наведения нет,
 * и ссылка просто открывает Instagram, поэтому QR там не рисуется.
 *
 * Картинка QR лежит готовой в public/qr — сайт не ходит за ней в чужой сервис.
 */
export function InstagramLink({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n()
  const g = t.instagram
  const [hover, setHover] = useState(false)

  return (
    <span
      className={`ig-link${compact ? ' ig-link--compact' : ''}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <a
        href={instagram.url}
        target="_blank"
        rel="noopener noreferrer"
        className="ig-link__button"
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
      >
        <IconInstagram size={compact ? 20 : 24} />
        <span className="ig-link__handle">@{instagram.handle}</span>
      </a>
      {hover && (
        <span className="ig-link__qr" role="tooltip">
          <img src={instagram.qr} alt="" width={132} height={132} />
          <span>{g.scan}</span>
        </span>
      )}
    </span>
  )
}

/**
 * Профиль в рамке телефона. Навёл мышкой — экран гаснет и выезжает QR-код.
 *
 * Скриншот живого профиля работает лучше любого описания: видно 73 тысячи
 * подписчиков, видео и обложки. Кнопки владельца («Редактировать», «Панель»)
 * с картинки вырезаны — посетитель должен видеть профиль своими глазами.
 */
export function InstagramPhone() {
  const { t } = useI18n()
  const g = t.instagram
  const [hover, setHover] = useState(false)

  return (
    <a
      href={instagram.url}
      target="_blank"
      rel="noopener noreferrer"
      className="ig-phone"
      aria-label={`${g.open} @${instagram.handle}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
    >
      <span className="ig-phone__frame">
        <img
          className="ig-phone__shot"
          src="/instagram/profile.webp"
          alt=""
          width={497}
          height={1080}
          loading="lazy"
        />
        <span className={`ig-phone__veil${hover ? ' is-open' : ''}`} aria-hidden="true">
          <img src={instagram.qr} alt="" width={140} height={140} />
          <IconInstagram size={26} />
          <strong>{g.open}</strong>
          <em>@{instagram.handle}</em>
          <IconArrowUpRight size={18} />
        </span>
      </span>
    </a>
  )
}

/** Блок для страницы: слева текст, справа телефон с профилем. */
export function InstagramCard() {
  const { t } = useI18n()
  const g = t.instagram

  return (
    <article className="ig-showcase">
      <div className="ig-showcase__text">
        <h2>{g.title}</h2>
        <p>{g.text}</p>
        <p className="ig-showcase__hint">{g.hoverHint}</p>
        <a href={instagram.url} target="_blank" rel="noopener noreferrer" className="btn btn--primary ig-showcase__cta">
          <IconInstagram size={20} />
          {g.open}
        </a>
      </div>
      <InstagramPhone />
    </article>
  )
}
