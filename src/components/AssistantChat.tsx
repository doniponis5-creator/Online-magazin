'use client'

import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import './assistant-chat.css'
import { instagram, phones, telHref, telegramHref, whatsappHref } from '@/data/contacts'
import { getProduct } from '@/data/products'
import { formatSom } from '@/lib/format'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { IconCamera, IconClose, IconInstagram, IconPhone, IconTelegram, IconWhatsApp } from './Icons'

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
  price: number
  priceLabel: string
  inStock: boolean
  href: string
}

type Msg = {
  role: 'user' | 'assistant'
  /** для фото — описание, которое составил сервер; покупателю его не показываем */
  text: string
  products?: Hit[]
  /** фото покупателя (уменьшенное), чтобы показать его в ленте */
  image?: string
  /** подпись покупателя к фото */
  caption?: string
}

/** Фото, которое уходит на сервер. */
type Picture = { mime: string; data: string; preview: string }

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
  const fileInput = useRef<HTMLInputElement>(null)
  const box = useRef<HTMLDivElement>(null)
  // Ключ вкладки для оформления заказа по шагам. Живёт, пока открыта вкладка,
  // никуда не сохраняется — как и сам разговор.
  const sid = useRef('')

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

  /**
   * Отправить вопрос. buy — «Заказать» у карточки: оформление начинается
   * сразу с этим товаром, без вопроса «какой именно?».
   */
  async function send(say?: string, buy?: string, picture?: Picture) {
    const question = (say ?? input).trim()
    if ((!question && !picture) || busy) return

    if (!sid.current) {
      sid.current =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
    }
    // Товары последнего ответа: на «беру» оформляем именно их.
    const shown = [...messages].reverse().find((m) => m.role === 'assistant' && m.products?.length)?.products ?? []
    // Открыта страница товара — консультант отвечает про него, даже если его не назвали.
    const page = pathname.match(new RegExp(`^/${lang}/product/([^/]+)`))?.[1]

    const mine: Msg = picture
      ? { role: 'user', text: question || a.photo, image: picture.preview, caption: question }
      : { role: 'user', text: question }
    const history = [...messages, mine]
    setMessages(history)
    if (say === undefined) setInput('')
    setBusy(true)

    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          lang,
          sid: sid.current,
          page: page ? decodeURIComponent(page) : undefined,
          buy,
          shown: shown.map((p) => p.id),
          messages: history.map((m) => ({ role: m.role, text: m.text })),
          image: picture ? { mime: picture.mime, data: picture.data, caption: question } : undefined,
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data?.error ?? 'failed')
      setMessages((prev) => {
        // Что сервер разглядел на фото, кладём в текст: следующие вопросы («а дешевле?»)
        // уходят с этим описанием, и консультант помнит, о каком товаре речь.
        const seen = typeof data.heard === 'string' && picture ? data.heard : ''
        const withHeard = seen ? prev.map((m) => (m === mine ? { ...m, text: seen } : m)) : prev
        return [...withHeard, { role: 'assistant', text: data.text, products: data.products ?? [] }]
      })
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', text: a.error }])
    } finally {
      setBusy(false)
    }
  }

  /**
   * Фото товара: уменьшаем в браузере до 1024 px и отправляем как JPEG.
   * Снимок с телефона — 3–5 МБ, а модели хватает и 100 КБ.
   */
  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || busy) return
    if (!file.type.startsWith('image/') || file.size > 15 * 1024 * 1024) {
      setMessages((prev) => [...prev, { role: 'assistant', text: a.photoTooBig }])
      return
    }
    try {
      const picture = await shrink(file)
      await send(input, undefined, picture)
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', text: a.photoTooBig }])
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
                <div className="assistant__bubble">
                  {msg.image ? (
                    <>
                      <img className="assistant__img" src={msg.image} alt={a.photo} />
                      {msg.caption ? <div>{msg.caption}</div> : null}
                    </>
                  ) : (
                    withLinks(msg.text, a.payLink)
                  )}
                </div>
                {msg.products && msg.products.length > 0 && (
                  <ul className="assistant__hits">
                    {msg.products.map((hit) => (
                      <li key={hit.id} className="assistant__hit">
                        {hit.href ? (
                          <a href={hit.href}>
                            <span className="assistant__hit-name">{hit.name}</span>
                            <span className="assistant__hit-price">{hit.priceLabel}</span>
                            {!hit.inStock && <span className="assistant__hit-out">{a.outOfStock}</span>}
                          </a>
                        ) : (
                          // Товар есть в магазине, но страницы на сайте у него нет — только в чате.
                          <div className="assistant__hit-card">
                            <span className="assistant__hit-name">{hit.name}</span>
                            <span className="assistant__hit-price">{hit.priceLabel}</span>
                            <span className="assistant__hit-note">{a.inStoreOnly}</span>
                          </div>
                        )}
                        {/* Без цены заказать нельзя — сначала сотрудник назовёт цену */}
                        {hit.inStock && hit.price > 0 && (
                          <button
                            type="button"
                            className="assistant__buy"
                            disabled={busy}
                            onClick={() => void send(`${a.order}: ${hit.name}`, hit.id)}
                          >
                            {a.order}
                          </button>
                        )}
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
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => void onPickFile(e)}
            />
            <button
              type="button"
              className="assistant__attach"
              onClick={() => fileInput.current?.click()}
              disabled={busy}
              aria-label={a.attach}
              title={a.attach}
            >
              <IconCamera size={20} />
            </button>
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
/** Уменьшить фото до 1024 px по длинной стороне и отдать как JPEG (base64). */
async function shrink(file: File): Promise<Picture> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('bad-image'))
      el.src = url
    })
    const scale = Math.min(1, 1024 / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.width * scale))
    canvas.height = Math.max(1, Math.round(img.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no-canvas')
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const preview = canvas.toDataURL('image/jpeg', 0.8)
    return { mime: 'image/jpeg', data: preview.slice(preview.indexOf(',') + 1), preview }
  } finally {
    URL.revokeObjectURL(url)
  }
}

function isTouch(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
}

/** Та же граница, что в assistant-chat.css: уже — чат во весь экран. */
function isPhone(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 560px)').matches
}

/**
 * Ссылка на оплату приходит текстом — делаем из неё кнопку. Другие адреса —
 * обычными ссылками. Разметку из текста не берём: только адреса https.
 */
function withLinks(text: string, payLabel: string): React.ReactNode {
  const parts = text.split(/(https:\/\/[^\s]+)/g)
  if (parts.length === 1) return text
  return parts.map((part, i) => {
    if (!/^https:\/\//.test(part)) return part
    const pay = /\/order\/|obank|pay|dengi/i.test(part)
    return (
      <a
        key={i}
        href={part}
        className={pay ? 'assistant__paylink' : undefined}
        target={pay ? undefined : '_blank'}
        rel={pay ? undefined : 'noopener noreferrer'}
      >
        {pay ? payLabel : part}
      </a>
    )
  })
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
