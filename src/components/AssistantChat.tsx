'use client'

import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import './assistant-chat.css'
import { instagram, phones, telHref, telegramHref, whatsappHref } from '@/data/contacts'
import { getProduct } from '@/data/products'
import { formatSom } from '@/lib/format'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { IconClose, IconInstagram, IconPhone, IconTelegram, IconWhatsApp } from './Icons'

/**
 * Одна кнопка помощи в углу экрана: сначала чат, под ним — живые люди.
 *
 * Раньше кнопок было две: слева консультант, справа «Связаться». Покупатель
 * видел два круга в углах и не понимал, куда жать. Теперь кнопка одна, и
 * порядок в ней задан намеренно: сперва чат — он отвечает сразу и ночью, —
 * а телефоны и мессенджеры спрятаны в строку внизу и открываются нажатием.
 *
 * Разговор живёт только в этой вкладке. Ничего не сохраняется ни на сервере,
 * ни в телефоне: консультант не должен становиться ещё одним местом, где
 * лежат чужие переписки.
 */

type Hit = {
  id: string
  name: string
  priceLabel: string
  inStock: boolean
  href: string
}

type Msg = {
  role: 'user' | 'assistant'
  text: string
  products?: Hit[]
}

export function AssistantChat() {
  const { t, lang } = useI18n()
  const a = t.assistant
  const c = t.contactWidget
  const pathname = usePathname() || ''

  const [open, setOpen] = useState(false)
  const [contactsOpen, setContactsOpen] = useState(false)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const feed = useRef<HTMLDivElement>(null)
  const people = useRef<HTMLDivElement>(null)
  const field = useRef<HTMLTextAreaElement>(null)
  const box = useRef<HTMLDivElement>(null)

  const close = useCallback(() => setOpen(false), [])

  // Первое сообщение пишем при открытии, а не при загрузке страницы: пока
  // окно закрыто, приветствие никому не нужно.
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ role: 'assistant', text: a.hello }])
    }
    // На телефоне поле не фокусируем: клавиатура выскакивала сразу и закрывала
    // половину чата, человек не успевал прочитать приветствие. Нажмёт на поле —
    // тогда и клавиатура.
    if (open && !isTouch()) field.current?.focus()
  }, [open, messages.length, a.hello])

  // Телефон: чат во весь экран, ровно в видимую часть — над клавиатурой.
  // iPhone не уменьшает окно, когда выезжает клавиатура, а просто наезжает
  // ею на страницу; размер видимой части знает только visualViewport.
  // Страницу под чатом не прокручиваем, иначе она уезжает вместе с пальцем.
  useEffect(() => {
    if (!open || !isPhone()) return
    const root = document.documentElement
    const node = box.current
    const vv = window.visualViewport
    const fit = () => {
      if (!node) return
      node.style.setProperty('--vv-h', `${vv ? vv.height : window.innerHeight}px`)
      node.style.setProperty('--vv-top', `${vv ? vv.offsetTop : 0}px`)
      const list = feed.current
      if (list) list.scrollTop = list.scrollHeight
    }
    fit()
    root.classList.add('assistant-lock')
    vv?.addEventListener('resize', fit)
    vv?.addEventListener('scroll', fit)
    return () => {
      root.classList.remove('assistant-lock')
      vv?.removeEventListener('resize', fit)
      vv?.removeEventListener('scroll', fit)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, close])

  // Лента всегда показывает последнее сообщение. Прокручиваем не сразу, а
  // следующим кадром: пока браузер не нарисовал новый пузырь, высота ленты
  // ещё старая, и прокрутка останавливалась на середине ответа.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const list = feed.current
      if (list) list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' })
    })
    return () => cancelAnimationFrame(id)
  }, [messages, busy])

  // Развернули телефоны — показываем их целиком, а не край списка.
  useEffect(() => {
    if (!contactsOpen) return
    const id = requestAnimationFrame(() => {
      people.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
    return () => cancelAnimationFrame(id)
  }, [contactsOpen])

  async function send() {
    const question = input.trim()
    if (!question || busy) return

    const history = [...messages, { role: 'user' as const, text: question }]
    setMessages(history)
    setInput('')
    setBusy(true)

    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          lang,
          messages: history.map((m) => ({ role: m.role, text: m.text })),
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data?.error ?? 'failed')
      setMessages((prev) => [...prev, { role: 'assistant', text: data.text, products: data.products ?? [] }])
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', text: a.error }])
    } finally {
      setBusy(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter отправляет, Shift+Enter переносит строку — как в мессенджерах.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  /**
   * Готовое сообщение сотруднику.
   *
   * Разговор уже был — пересказываем его. Разговора нет, но человек стоит на
   * странице товара — подставляем товар. В обоих случаях сотруднику не надо
   * спрашивать «а о чём речь?».
   */
  const askText = (() => {
    const fromChat = handoffText(messages, c.askAbout, a.handoffProducts)
    if (fromChat) return fromChat

    const match = pathname.match(new RegExp(`^/${lang}/product/([^/]+)`))
    const product = match ? getProduct(decodeURIComponent(match[1])) : undefined
    if (!product) return undefined
    const name = lang === 'ky' ? product.nameKy : product.nameRu
    const price = product.price > 0 ? ` — ${formatSom(product.price)}` : ''
    const link = typeof window === 'undefined' ? '' : `\n${window.location.href}`
    return `${c.askAbout} ${name}${price}${link}`
  })()

  return (
    <div className={`assistant${open ? ' is-open' : ''}`} ref={box}>
      {/* Подложка на весь экран: нажатие в любом пустом месте закрывает панель.
          Заодно слегка притемняет каталог, чтобы переписка читалась. */}
      {open && <div className="assistant__backdrop" onClick={close} aria-hidden="true" />}

      {open && (
        <div className="assistant__panel" role="dialog" aria-label={a.title}>
          <div className="assistant__head">
            <strong>{a.title}</strong>
            <button type="button" onClick={close} aria-label={a.close}>
              <IconClose size={18} />
            </button>
          </div>

          <p className="assistant__note">{a.note}</p>

          <div className="assistant__feed" ref={feed}>
            {messages.map((msg, i) => (
              <div key={i} className={`assistant__msg assistant__msg--${msg.role}`}>
                <div className="assistant__bubble">{msg.text}</div>
                {msg.products && msg.products.length > 0 && (
                  <ul className="assistant__hits">
                    {msg.products.map((hit) => (
                      <li key={hit.id}>
                        <a href={hit.href}>
                          <span className="assistant__hit-name">{hit.name}</span>
                          <span className="assistant__hit-price">{hit.priceLabel}</span>
                          {!hit.inStock && <span className="assistant__hit-out">{a.outOfStock}</span>}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            {busy && (
              <div className="assistant__msg assistant__msg--assistant">
                <div className="assistant__bubble assistant__bubble--typing">{a.thinking}</div>
              </div>
            )}
          </div>

          <div className="assistant__form">
            <textarea
              ref={field}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={a.placeholder}
              maxLength={800}
              aria-label={a.placeholder}
            />
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => void send()}
              disabled={busy || !input.trim()}
            >
              {a.send}
            </button>
          </div>

          {/* Живые люди — вторым слоем. Свёрнуто, потому что чат отвечает
              быстрее; но одно нажатие — и вот телефоны. */}
          <div className={`assistant__people${contactsOpen ? ' is-open' : ''}`} ref={people}>
            <button
              type="button"
              className="assistant__people-toggle"
              onClick={() => setContactsOpen((v) => !v)}
              aria-expanded={contactsOpen}
            >
              <IconPhone size={16} />
              <span>
                {a.toHumanLead} <strong>{c.title}</strong>
              </span>
              <span className="assistant__chev" aria-hidden="true" />
            </button>

            {contactsOpen && (
              <div className="assistant__people-body">
                <p className="assistant__hint">{askText ? c.hintProduct : c.hint}</p>
                <ul className="assistant__phones">
                  {phones.map((phone) => (
                    <li key={phone.raw}>
                      <span className="assistant__number">{phone.display}</span>
                      <span className="assistant__actions">
                        <a
                          href={whatsappHref(phone, askText)}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`WhatsApp ${phone.display}`}
                          title="WhatsApp"
                        >
                          <IconWhatsApp size={26} />
                        </a>
                        <a
                          href={telegramHref(phone)}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Telegram ${phone.display}`}
                          title="Telegram"
                        >
                          <IconTelegram size={26} />
                        </a>
                        <a
                          href={telHref(phone)}
                          className="assistant__call"
                          aria-label={`${c.call} ${phone.display}`}
                          title={c.call}
                        >
                          <IconPhone size={18} />
                        </a>
                      </span>
                    </li>
                  ))}
                </ul>
                <a href={instagram.url} target="_blank" rel="noopener noreferrer" className="assistant__ig">
                  <IconInstagram size={22} />@{instagram.handle}
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        className="assistant__button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={a.title}
      >
        <span className="assistant__icon">{open ? <IconClose size={22} /> : <ChatIcon />}</span>
        <span className="assistant__label">{a.short}</span>
      </button>
    </div>
  )
}

/**
 * Из чего сотрудник поймёт, о чём речь, не переспрашивая.
 *
 * Берём вопросы покупателя и названия товаров, которые чат показал: этого
 * хватает, чтобы продолжить разговор с середины. Ответы робота не шлём —
 * сотруднику важно, что спросил человек, а не что ответила программа.
 */
/** Палец вместо мыши — значит, клавиатура экранная. */
function isTouch(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
}

/** Та же граница, что в assistant-chat.css: уже — чат во весь экран. */
function isPhone(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 560px)').matches
}

function handoffText(messages: Msg[], intro: string, productsLead: string): string | undefined {
  const asked = messages
    .filter((m) => m.role === 'user')
    .slice(-3)
    .map((m) => `— ${m.text}`)
  if (asked.length === 0) return undefined

  const seen = [...new Set(messages.flatMap((m) => m.products ?? []).map((p) => p.name))].slice(0, 3)

  const parts = [intro, ...asked]
  if (seen.length > 0) parts.push('', `${productsLead} ${seen.join(', ')}`)
  if (typeof window !== 'undefined') parts.push('', window.location.href)
  return parts.join('\n')
}

function ChatIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="12" r="1" fill="currentColor" />
      <circle cx="12.5" cy="12" r="1" fill="currentColor" />
      <circle cx="16" cy="12" r="1" fill="currentColor" />
    </svg>
  )
}
