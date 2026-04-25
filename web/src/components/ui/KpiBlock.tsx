import { ReactNode, CSSProperties } from 'react'

const VALUE_SIZE: Record<string, string> = {
  sm: 'var(--text-xl)',
  md: 'var(--text-2xl)',
  lg: 'var(--text-3xl)',
}

interface KpiBlockProps {
  label: string
  value: ReactNode
  sub?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  valueStyle?: CSSProperties
}

export default function KpiBlock({ label, value, sub, size = 'md', loading = false, valueStyle }: KpiBlockProps) {
  const valueFontSize = VALUE_SIZE[size]
  const display = loading ? '…' : value

  if (size === 'sm') {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: valueFontSize, fontWeight: 700, color: 'var(--text)', lineHeight: 1.1, ...valueStyle }}>
          {display}
        </div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 2 }}>
          {label}
        </div>
        {sub && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginTop: 2 }}>{sub}</div>}
      </div>
    )
  }

  if (size === 'lg') {
    return (
      <div className="card">
        <h3 style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 500, marginBottom: 'var(--space-3)' }}>
          {label}
        </h3>
        <div style={{ fontSize: valueFontSize, fontWeight: 700, color: 'var(--text)', lineHeight: 1, ...valueStyle }}>
          {display}
        </div>
        {sub && <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', marginTop: 'var(--space-2)' }}>{sub}</div>}
      </div>
    )
  }

  // md — standard kpi card
  return (
    <div className="kpi">
      <div style={{ fontSize: valueFontSize, fontWeight: 700, color: 'var(--text)', lineHeight: 1.1, ...valueStyle }}>
        {display}
      </div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 4 }}>
        {label}
      </div>
      {sub && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}
