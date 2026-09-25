import { createHash } from 'node:crypto'
import { categories } from '@/data/categories'
import { products } from '@/data/products'

/**
 * «Снимок» каталога для приложения на телефоне.
 *
 * Приложение забирает его, пока есть интернет, и кладёт в память телефона.
 * Дальше каталог открывается и без связи: названия, цены, наличие — из снимка.
 *
 * Поля названы коротко (n, p, c…) не ради экономии букв, а ради веса: снимок
 * скачивается по мобильному интернету, и каждый лишний килобайт платный.
 *
 * Заказать из снимка нельзя — для этого нужен живой сервер. Снимок только
 * показывает, что есть в магазине и почём.
 */

export const dynamic = 'force-static'

type SnapshotItem = {
  /** адрес товара на сайте: /ru/product/<id> */
  id: string
  /** название по-русски */
  n: string
  /** название по-кыргызски; нет — значит совпадает с русским */
  nk?: string
  /** бренд */
  b?: string
  /** раздел каталога */
  c: string
  /** цена, сом; 0 — «цена по запросу» */
  p: number
  /** прежняя цена, если есть скидка */
  o?: number
  /** 1 — есть в наличии */
  s: 0 | 1
  /** адрес фотографии, если она есть */
  img?: string
}

export function GET() {
  const items: SnapshotItem[] = products.map((product) => {
    const inStock = product.variants.some((v) => v.stock > 0)
    const item: SnapshotItem = {
      id: product.id,
      n: product.nameRu,
      c: product.categoryId,
      p: product.price,
      s: inStock ? 1 : 0,
    }
    if (product.nameKy && product.nameKy !== product.nameRu) item.nk = product.nameKy
    if (product.brand) item.b = product.brand
    if (product.oldPrice) item.o = product.oldPrice
    if (product.image) item.img = product.image
    return item
  })

  const body = {
    categories: categories.map((c) => ({ id: c.id, ru: c.nameRu, ky: c.nameKy })),
    items,
  }

  // Версия — отпечаток содержимого. Приложение по нему понимает, менялся ли
  // каталог, и не скачивает одно и то же дважды.
  const json = JSON.stringify(body)
  const version = createHash('sha1').update(json).digest('hex').slice(0, 16)

  return Response.json(
    { version, count: items.length, ...body },
    {
      headers: {
        // Снимок меняется только при пересборке сайта, а она бывает после
        // выгрузки каталога из 1С.
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
      },
    },
  )
}
