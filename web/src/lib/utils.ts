export function starColor(rating: number): string {
  if (rating >= 4.8) return 'var(--green)'
  if (rating >= 4.5) return 'var(--blue)'
  if (rating >= 4.0) return 'var(--yellow)'
  return 'var(--red)'
}
