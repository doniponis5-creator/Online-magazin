import { products } from '@/data/products'
import { catalogNow } from '@/lib/assistant/live'
import { metaFeedCsv } from '@/lib/feed/meta'
import { SITE_URL } from '@/lib/seo'

// Каталог для WhatsApp Business через Meta Commerce Manager (см. src/lib/feed/meta.ts).
// Цены и наличие — сегодняшние из 1С; ссылка — только на товар, у которого есть страница.
export const dynamic = 'force-dynamic'

export async function GET() {
  const pages = new Set(products.map((p) => p.id))
  const csv = metaFeedCsv(await catalogNow(), SITE_URL, pages)
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Cache-Control': 'public, max-age=600',
    },
  })
}
