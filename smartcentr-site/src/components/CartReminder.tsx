'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { getProduct } from '@/data/products'
import { useCart } from '@/lib/cart/CartProvider'
import { formatSom } from '@/lib/format'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { IconArrowUpRight, IconClose } from './Icons'
import { ProductImage } from './ProductImage'

/**
 * Полоска «в корзине остались товары» — внизу экрана, на всех страницах
 * магазина, кроме самой корзины и оформления.
 *
 * Зачем вообще: корзина живёт только в браузере покупателя, сервер о ней не
 * знает, поэтому напомнить письмом или уведомлением не получится. Единственное
 * честное напоминание — на самом сайте, когда человек вернулся.
 *
 * Чтобы не надоедать, три правила:
 *  • показывается один раз на состав корзины — и уходит сама через 9 секунд;
 *  • закрыл крестиком — молчит до конца сессии;
 *  • добавил ещё товар — состав изменился, напоминание снова уместно.
 * Дальше о корзине напоминает только цифра на значке внизу — она не мешает.
 */
const OFF_KEY = 'sc-cart-bar-off'
/** Сколько полоска висит на экране, прежде чем уехать сама. */
const LIFETIME = 9000
/** Задержка перед появлением: страница успевает нарисоваться. */
const DELAY = 1500

export function CartReminder() {
  const { t, lang } = useI18n()
  const cart = useCart()
  const pathname = usePathname() || ''
  const [hiddenFor, setHiddenFor] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [leaving, setLeaving] = useState(false)

  // Состав корзины одной строкой: по нему понимаем, что покупатель что-то
  // изменил после того, как закрыл полоску.
  const signature = cart.lines.map((l) => `${l.productId}:${l.variantId}:${l.qty}`).join('|')

  useEffect(() => {
    try {
      setHiddenFor(window.sessionStorage.getItem(OFF_KEY))
    } catch {
      // приватный режим — полоска просто не запомнит отказ
    }
  }, [])

  useEffect(() => {
    const id = setTimeout(() => setReady(true), DELAY)
    return () => clearTimeout(id)
  }, [])

  // На страницах самой покупки напоминать не о чем — человек уже там.
  const onPurchasePages =
    pathname.startsWith(`/${lang}/cart`) ||
    pathname.startsWith(`/${lang}/checkout`) ||
    pathname.startsWith(`/${lang}/order`)

  const visible =
    ready && cart.hydrated && cart.lines.length > 0 && !onPurchasePages && hiddenFor !== signature

  const hide = useCallback(() => {
    setHiddenFor(signature)
    try {
      window.sessionStorage.setItem(OFF_KEY, signature)
    } catch {
      // ничего страшного: в этой вкладке полоска всё равно скрыта
    }
  }, [signature])

  // Сама уезжает: напомнили — и хватит. Сначала анимация ухода, потом скрытие.
  useEffect(() => {
    if (!visible) return
    setLeaving(false)
    const out = setTimeout(() => setLeaving(true), LIFETIME)
    const off = setTimeout(hide, LIFETIME + 260)
    return () => {
      clearTimeout(out)
      clearTimeout(off)
    }
  }, [visible, hide])

  if (!visible) return null

  // Считаем от товаров, которые действительно есть в каталоге: иначе «+1»
  // могло указывать на строку, для которой картинку показать нечем.
  const known = cart.lines
    .map((line) => ({ line, product: getProduct(line.productId) }))
    .filter((x) => x.product)
  const thumbs = known.slice(0, 3)
  const rest = known.length - thumbs.length

  return (
    <div className={`cart-bar${leaving ? ' is-leaving' : ''}`} role="status" aria-label={t.cart.title}>
      <span className="cart-bar__thumbs" aria-hidden="true">
        {thumbs.map(({ line, product }) => (
          <span className="cart-bar__thumb" key={`${line.productId}:${line.variantId}`}>
            <ProductImage kind={product!.art} image={product!.image} alt="" />
          </span>
        ))}
        {rest > 0 && <span className="cart-bar__more">+{rest}</span>}
      </span>

      <span className="cart-bar__text">
        <strong>
          {t.cart.title} · {cart.itemsCount}
        </strong>
        <span className="cart-bar__sum">{formatSom(cart.subtotal)}</span>
      </span>

      {/* На телефоне рядом с суммой помещается только короткое слово */}
      <Link href={`/${lang}/checkout`} className="btn btn--primary btn--sm cart-bar__cta">
        <span className="cart-bar__cta-long">{t.cart.checkout}</span>
        <span className="cart-bar__cta-short">{t.cart.barCta}</span>
        <IconArrowUpRight size={16} />
      </Link>

      <button type="button" className="cart-bar__close" onClick={hide} aria-label={t.cart.barHide}>
        <IconClose size={18} />
      </button>
    </div>
  )
}
