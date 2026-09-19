/**
 * Чем покупатель может оплатить заказ.
 *
 * Деньги принимает O!Деньги, но платить можно из приложения почти любого банка
 * Кыргызстана: страница оплаты показывает QR и список приложений. Покупатель
 * об этом не знает и уходит, решив, что нужен именно кошелёк O!Деньги, —
 * поэтому список показываем до перехода на оплату.
 *
 * Список взят со страницы оплаты paylink.dengi.kg. Если O!Деньги добавят банк,
 * его нужно дописать сюда руками: сервер такой список не отдаёт.
 *
 * Значки взяты со страницы оплаты O!Деньги (minio.o.kg/catalog/logos) — тот же
 * набор, который покупатель увидит после нажатия «Оплатить», поэтому значки
 * совпадают и он узнаёт своё приложение. Перерисованы только в размер 64×64.
 * Нет файла у способа оплаты — показывается название текстом, вёрстка не ломается.
 */

export type PaymentMethod = {
  /** как банк называет себя сам */
  name: string
  /** путь к логотипу в public, если он добавлен */
  logo?: string
  /** значки квадратные 64×64; размер задан в стилях, тут он не нужен */
}

export const paymentMethods: PaymentMethod[] = [
  { name: 'O!Bank', logo: '/pay/obank.webp' },
  { name: 'MBANK', logo: '/pay/mbank.webp' },
  { name: 'Bakai', logo: '/pay/bakai.webp' },
  { name: 'Demir', logo: '/pay/demir.webp' },
  { name: 'Optima', logo: '/pay/optima.webp' },
  { name: 'RSK', logo: '/pay/rsk.webp' },
  { name: 'KICB', logo: '/pay/kicb.webp' },
  { name: 'MegaPay', logo: '/pay/megapay.webp' },
  { name: 'Айыл Банк', logo: '/pay/ayil.webp' },
  { name: 'Namba One', logo: '/pay/namba.webp' },
  { name: 'Компаньон', logo: '/pay/kompanion.webp' },
  { name: 'Simbank', logo: '/pay/simbank.webp' },
]
