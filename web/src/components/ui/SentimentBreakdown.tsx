interface SentimentBreakdownProps {
  positive: number
  mixed: number
  negative: number
  format?: 'inline' | 'bar'
}

export default function SentimentBreakdown({ positive, mixed, negative, format = 'inline' }: SentimentBreakdownProps) {
  const total = positive + mixed + negative

  if (format === 'bar') {
    const pct = (n: number) => total > 0 ? (n / total) * 100 : 0
    return (
      <div>
        <div style={{ display: 'flex', height: 8, borderRadius: 'var(--radius-pill)', overflow: 'hidden', gap: 1, background: 'var(--border)' }}>
          {positive > 0 && (
            <div style={{ width: `${pct(positive)}%`, background: 'var(--sentiment-positive)', borderRadius: 'var(--radius-pill) 0 0 var(--radius-pill)' }} />
          )}
          {mixed > 0 && (
            <div style={{ width: `${pct(mixed)}%`, background: 'var(--sentiment-mixed)' }} />
          )}
          {negative > 0 && (
            <div style={{ width: `${pct(negative)}%`, background: 'var(--sentiment-negative)', borderRadius: '0 var(--radius-pill) var(--radius-pill) 0' }} />
          )}
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)' }}>
          <span style={{ color: 'var(--sentiment-positive)' }}>{positive} pos</span>
          <span style={{ color: 'var(--sentiment-mixed)' }}>{mixed} mixed</span>
          <span style={{ color: 'var(--sentiment-negative)' }}>{negative} neg</span>
        </div>
      </div>
    )
  }

  return (
    <span style={{ fontSize: 'var(--text-sm)' }}>
      <span style={{ color: 'var(--sentiment-positive)' }}>{positive} pos</span>
      {' · '}
      <span style={{ color: 'var(--sentiment-mixed)' }}>{mixed} mixed</span>
      {' · '}
      <span style={{ color: 'var(--sentiment-negative)' }}>{negative} neg</span>
    </span>
  )
}
