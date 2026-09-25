import { products } from '@/data/products'
import { catalogNow } from '@/lib/assistant/live'
import { googleFeedXml } from '@/lib/feed/google'
import { SITE_URL } from '@/lib/seo'

// Каталог для Google Merchant Center (см. src/lib/feed/google.ts).
export const dynamic = 'force-dynamic'

export async function GET() {
  const pages = new Set(products.map((p) => p.id))
  const body = googleFeedXml(await catalogNow(), SITE_URL, pages)
  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=600',
    },
  })
}
