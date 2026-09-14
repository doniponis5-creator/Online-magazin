/** Фирменная ленточная S: векторный знак для светлой витрины. */
export function Brand({ bonus = false }: { bonus?: boolean }) {
  return (
    <span className="brand">
      <svg className="brand__mark" width="30" height="40" viewBox="0 0 30 40" aria-hidden="true">
        <path fill="currentColor" d="M28 1v8c0 3-2 5-5 6L8 20l14 5c4 1 6 4 6 7v2L2 40v-8c0-3 2-5 5-6l15-6L8 15C4 14 2 11 2 8V7Z" />
      </svg>
      <span className="brand__name">{bonus ? 'SBonus' : 'Смарт Центр'}</span>
    </span>
  )
}
