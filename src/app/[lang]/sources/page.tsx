import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { defaultLang, isLang, type Lang } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { PEXELS_LICENSE, photoSources } from '@/data/photo-sources'

export const metadata: Metadata = {
  title: 'Источники изображений — Smart Centr (демо)',
}

// Статическая страница: активные баннерные фото + честный архив прежних.
export default async function SourcesPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang: raw } = await params
  if (!isLang(raw)) notFound()
  const lang: Lang = (isLang(raw) ? raw : defaultLang) as Lang
  const t = getDictionary(lang).sources
  const active = photoSources.filter((s) => s.inUse)
  const archived = photoSources.filter((s) => !s.inUse)

  return (
    <section className="section sources-page">
      <div className="container">
        <h1 className="section__title">{t.title}</h1>
        <p className="sources-page__intro">{t.intro}</p>
        <p className="sources-page__license">
          {t.license}:{' '}
          <a href={PEXELS_LICENSE} target="_blank" rel="noopener noreferrer">
            Pexels License
          </a>{' '}
          — {t.licenseNote}
        </p>
        {active.length > 0 ? (
          <div className="table-wrap">
            <table className="sources-table">
              <thead>
                <tr>
                  <th scope="col">{t.file}</th>
                  <th scope="col">{t.author}</th>
                  <th scope="col">{t.role}</th>
                  <th scope="col">{t.source}</th>
                </tr>
              </thead>
              <tbody>
                {active.map((s) => (
                  <tr key={s.file}>
                    <td>
                      <code>{s.file}</code>
                    </td>
                    <td>{s.author}</td>
                    <td>{lang === 'ky' ? s.roleKy : s.roleRu}</td>
                    <td>
                      <a href={s.page} target="_blank" rel="noopener noreferrer">
                        Pexels #{s.pexelsId}
                      </a>
                      {s.verify === 'page+mirrors' && (
                        <span className="sources-table__note">
                          {' '}
                          ({t.verifiedMirrors})
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="sources-page__license">{t.noActive}</p>
        )}
        <p className="sources-page__note">
          {t.verified} {t.placeholderNote}
        </p>

        <details className="sources-page__archive">
          <summary>{t.archivedTitle}</summary>
          <p className="sources-page__note">{t.archivedNote}</p>
          <div className="table-wrap">
            <table className="sources-table">
              <thead>
                <tr>
                  <th scope="col">{t.file}</th>
                  <th scope="col">{t.author}</th>
                  <th scope="col">{t.role}</th>
                  <th scope="col">{t.source}</th>
                </tr>
              </thead>
              <tbody>
                {archived.map((s) => (
                  <tr key={s.file}>
                    <td>
                      <code>{s.file}</code>
                    </td>
                    <td>{s.author}</td>
                    <td>{lang === 'ky' ? s.roleKy : s.roleRu}</td>
                    <td>
                      <a href={s.page} target="_blank" rel="noopener noreferrer">
                        Pexels #{s.pexelsId}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </section>
  )
}
