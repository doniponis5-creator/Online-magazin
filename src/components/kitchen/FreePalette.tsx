'use client'

import type { ReactNode } from 'react'
import type { FreeAdd } from '@/lib/kitchen/free'
import type { BaseFront, ItemKey, WallId } from '@/lib/kitchen/types'
import type { KitchenTexts } from './texts'

/** Плитка техники, мойки или колонны: стоит ли уже (на какой стене) и почему нельзя. */
export type FreeTile = { key: ItemKey | 'corner:start' | 'corner:end'; name: string; on?: WallId; off?: string }

/** Ширины шкафов на палитре, см: самые ходовые у мебельщиков. */
const DOORS = [30, 40, 45, 50, 60, 80, 90]
const DRAWERS = [40, 60, 80]
const SHELVES = [15, 20, 30, 40, 60]
const UPPERS = [30, 40, 45, 60, 80]

/**
 * Палитра пустой комнаты (PRO, шаг «Кухня»): стена, свободное место, шкафы низа по
 * ширинам, мойка и техника, верхние шкафы; в конце — `extra` (остров, стол). Нажатие ставит сразу — в свободное
 * место стены рядом с выбранным; поставленное нажатием выбирается в 3D.
 */
export function FreePalette({
  t,
  walls,
  wall,
  lengths,
  free,
  tiles,
  gaps,
  onWall,
  onAdd,
  onFill,
  onTile,
  onUpper,
  onOverLower,
  extra,
}: {
  t: KitchenTexts
  walls: WallId[]
  wall: WallId
  /** длина каждой стены, см */
  lengths: Partial<Record<WallId, number>>
  /** свободно у низа выбранной стены, см */
  free: number
  tiles: FreeTile[]
  /** пустые места низа выбранной стены, см от угла */
  gaps: [number, number][]
  onWall: (w: WallId) => void
  onAdd: (what: FreeAdd) => void
  /** заполнить пустое место полками ровно по его ширине */
  onFill: (gap: [number, number]) => void
  onTile: (tile: FreeTile) => void
  onUpper: (w: number) => void
  onOverLower: () => void
  /** последние разделы палитры (поворот острова, обеденная зона) — их же показывает шаг «Размер» */
  extra?: ReactNode
}) {
  const f = t.free
  const sizes = (list: number[], front: BaseFront) => (
    <div className="kp-free__sizes">
      {list.map((w) => (
        <button key={w} type="button" className="kp-chip" aria-label={`${front === 'doors' ? f.doors : front === 'open' ? f.shelves : f.drawers} ${w} ${t.cm}`} onClick={() => onAdd({ kind: 'cabinet', w, front })}>
          {w}
        </button>
      ))}
    </div>
  )
  return (
    <div className="kp-free">
      <p className="kp-note">{f.hint}</p>
      <div className="kp-free__walls" role="radiogroup" aria-label={f.wallsLabel}>
        {walls.map((w) => (
          <button key={w} type="button" role="radio" aria-checked={w === wall} className="kp-chip" onClick={() => onWall(w)}>
            {w === 'I' ? f.island : `${w} · ${lengths[w] ?? ''} ${t.cm}`}
          </button>
        ))}
      </div>
      <p className={`kp-free__room${free > 0 ? '' : ' is-full'}`} role="status">
        {free > 0 ? f.freeSpace(free) : f.noSpace}
      </p>

      <h3 className="kp-free__title">{f.lowerTitle}</h3>
      <div className="kp-free__row">
        <span className="kp-free__label">{f.doors}</span>
        {sizes(DOORS, 'doors')}
      </div>
      <div className="kp-free__row">
        <span className="kp-free__label">{f.drawers}</span>
        {sizes(DRAWERS, 'drawers3')}
      </div>
      <div className="kp-free__row">
        <span className="kp-free__label">{f.shelves}</span>
        {sizes(SHELVES, 'open')}
      </div>
      {/* пустое место — одним нажатием полками ровно по его ширине */}
      {gaps.some(([a, b]) => b - a >= 15 - 0.01) && (
        <div className="kp-free__row">
          <span className="kp-free__label">
            {f.fillTitle}
            <small className="kp-free__hint">{f.fillNote}</small>
          </span>
          <div className="kp-free__sizes">
            {gaps
              .filter(([a, b]) => b - a >= 15 - 0.01)
              .map((g) => (
                <button key={g[0]} type="button" className="kp-chip kp-chip--fill" aria-label={`${f.fillTitle}: ${Math.floor(g[1] - g[0])} ${t.cm}`} onClick={() => onFill(g)}>
                  {Math.floor(g[1] - g[0])} {t.cm}
                </button>
              ))}
          </div>
        </div>
      )}

      <h3 className="kp-free__title">{f.techTitle}</h3>
      <div className="kp-free__grid">
        {tiles.map((tile) => (
          <button key={tile.key} type="button" className="kp-free__tile" aria-pressed={Boolean(tile.on)} disabled={Boolean(tile.off)} onClick={() => onTile(tile)}>
            <span className="kp-free__name">{tile.name}</span>
            {(tile.on || tile.off) && (
              <span className="kp-free__state">{tile.off ?? `✓ ${f.standing}${tile.on && tile.on !== wall ? ` · ${tile.on === 'I' ? f.island : tile.on}` : ''}`}</span>
            )}
          </button>
        ))}
      </div>

      {wall !== 'I' && (
        <>
          <h3 className="kp-free__title">{f.upperTitle}</h3>
          <div className="kp-free__row">
            <span className="kp-free__label">{f.upperCab}</span>
            <div className="kp-free__sizes">
              {UPPERS.map((w) => (
                <button key={w} type="button" className="kp-chip" aria-label={`${f.upperCab} ${w} ${t.cm}`} onClick={() => onUpper(w)}>
                  {w}
                </button>
              ))}
            </div>
          </div>
          <button type="button" className="btn btn--outline btn--sm kp-free__over" onClick={onOverLower}>
            {f.overLower}
          </button>
        </>
      )}
      {extra}
    </div>
  )
}
