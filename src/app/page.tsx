import { redirect } from 'next/navigation'
import { defaultLang } from '@/lib/i18n/config'

export default function RootPage() {
  redirect(`/${defaultLang}`)
}
