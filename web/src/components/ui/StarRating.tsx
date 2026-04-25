import { starColor } from '@/lib/utils'

const SIZE_MAP = {
  sm: 'var(--text-sm)',
  md: 'var(--text-base)',
  lg: 'var(--text-xl)',
}

interface StarRatingProps {
  value: number
  showValue?: boolean
  precision?: number
  size?: 'sm' | 'md' | 'lg'
}

export default function StarRating({ value, showValue = false, precision = 1, size = 'md' }: StarRatingProps) {
  const fontSize = SIZE_MAP[size]
  const color = starColor(value)
  const rounded = Math.round(value)
  const empty = 5 - rounded

  return (
    <span className="stars" style={{ color, fontSize, display: 'inline-flex', alignItems: 'center', gap: 1 }}>
      {'★'.repeat(rounded)}
      {'☆'.repeat(empty)}
      {showValue && (
        <span style={{ marginLeft: 4, color: 'var(--text)', fontSize }}>
          {value.toFixed(precision)}
        </span>
      )}
    </span>
  )
}
