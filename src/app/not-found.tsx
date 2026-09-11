import Link from 'next/link'

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: '70vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 56, fontWeight: 800, color: '#245BEB', margin: 0 }}>404</p>
        <h1 style={{ fontSize: 22, marginTop: 8 }}>Страница не найдена · Бет табылган жок</h1>
        <p style={{ color: '#46566b', marginTop: 8 }}>Проверьте адрес · Даректи текшериңиз</p>
        <Link href="/ru" className="btn btn--primary" style={{ marginTop: 20 }}>
          На главную · Башкы бетке
        </Link>
      </div>
    </main>
  )
}
