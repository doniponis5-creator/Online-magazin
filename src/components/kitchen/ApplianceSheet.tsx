'use client'

import { useId, useState } from 'react'
import { formatSom } from '@/lib/format'
import type { ApplianceInfo, KitchenAppliance } from '@/lib/kitchen/types'
import { Modal } from './Modal'
import type { KitchenTexts } from './texts'

/**
 * «Подробнее» о технике — окно поверх конструктора. Раньше это была ссылка на
 * страницу товара в новой вкладке: в приложении она уводила в Safari, и
 * покупатель уходил из своей кухни. Теперь фото, описание и характеристики
 * здесь же, а поставить модель в кухню можно прямо из окна.
 */
export function ApplianceSheet({
  item,
  info,
  size,
  matches,
  chosen,
  t,
  onPick,
  onClose,
}: {
  item: KitchenAppliance
  info?: ApplianceInfo
  /** «55×145 см» или «ширина 60 см» — как в списке */
  size: string
  /** цвет корпуса подходит к стилю кухни */
  matches: boolean
  /** эта модель уже стоит в кухне */
  chosen: boolean
  t: KitchenTexts
  onPick: () => void
  onClose: () => void
}) {
  const titleId = useId()
  const photos = info?.images.length ? info.images : item.image ? [item.image] : []
  const [at, setAt] = useState(0)
  const name = info?.name || item.name
  return (
    <Modal labelledBy={titleId} className="kp-info" onClose={onClose}>
      {/* клавиши внутри окна — окну: стрелки и Ctrl+Z не двигают кухню за ним */}
      <div className="kp-info__body" onKeyDown={(e) => e.stopPropagation()}>
        <button type="button" className="kp-dialog__close kp-info__close" aria-label={t.close} title={t.close} onClick={onClose}>
          ×
        </button>
        <div className="kp-info__scroll">
          {photos.length > 0 && (
            <div className="kp-info__photo">
              <img src={photos[at] ?? photos[0]} alt={name} />
            </div>
          )}
          {photos.length > 1 && (
            <div className="kp-info__thumbs">
              {photos.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  className={`kp-info__thumb${i === at ? ' is-on' : ''}`}
                  aria-label={t.info.photo(i + 1, photos.length)}
                  aria-pressed={i === at}
                  onClick={() => setAt(i)}
                >
                  <img src={src} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          )}
          <h2 className="kp-dialog__title kp-info__title" id={titleId}>
            {name}
          </h2>
          <p className="kp-info__price">
            {formatSom(item.price)}
            {item.oldPrice ? <s>{formatSom(item.oldPrice)}</s> : null}
          </p>
          <p className="kp-info__meta">
            <span>{size}</span>
            {matches && <span className="kp-info__badge">{t.matches}</span>}
          </p>
          {info?.desc && (
            <>
              <h3 className="kp-info__h">{t.info.about}</h3>
              <p className="kp-info__desc">{info.desc}</p>
            </>
          )}
          {info && info.specs.length > 0 && (
            <>
              <h3 className="kp-info__h">{t.info.specs}</h3>
              <dl className="kp-info__specs">
                {info.specs.map(([label, value], i) => (
                  <div className="kp-info__row" key={i}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </div>
        <div className="kp-info__foot">
          {chosen ? (
            <p className="kp-info__in">✓ {t.info.inKitchen}</p>
          ) : (
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => {
                onPick()
                onClose()
              }}
            >
              {t.info.pick}
            </button>
          )}
          <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>
            {t.close}
          </button>
        </div>
      </div>
    </Modal>
  )
}
