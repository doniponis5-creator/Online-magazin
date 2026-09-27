'use client'

import { useCallback, useEffect, useState, type ComponentType } from 'react'
import { Modal } from './Modal'
import type { PublishDialog } from './PublishDialog'

type Props = Parameters<typeof PublishDialog>[0]

/**
 * Окно «В галерею» грузится отдельным куском только по нажатию (вход и
 * кабинет не тянутся в бандл конструктора). Кусок не пришёл (нет сети) —
 * «Нет связи — Повторить», конструктор работает дальше.
 */
export function PublishLoader(props: Props) {
  const [Loaded, setLoaded] = useState<ComponentType<Props> | null>(null)
  const [failed, setFailed] = useState(false)
  const load = useCallback(() => {
    import('./PublishDialog')
      .then((m) => setLoaded(() => m.PublishDialog))
      .catch(() => setFailed(true))
  }, [])
  useEffect(() => load(), [load])

  if (Loaded) return <Loaded {...props} />
  const g = props.t.gallery
  if (!failed)
    return (
      <Modal label={g.dialogTitle} small onClose={props.onClose}>
        <h2 className="kp-dialog__title">{g.dialogTitle}</h2>
        <p className="kp-dialog__lead" role="status">
          {g.loading}
        </p>
      </Modal>
    )
  return (
    <Modal label={g.dialogTitle} small onClose={props.onClose}>
      <h2 className="kp-dialog__title">{g.dialogTitle}</h2>
      <p className="kp-dialog__lead" role="alert">
        {g.loadFailed}
      </p>
      <div className="kp-dialog__actions">
        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={() => {
            setFailed(false)
            load()
          }}
        >
          {g.retry}
        </button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={props.onClose}>
          {g.close}
        </button>
      </div>
    </Modal>
  )
}
