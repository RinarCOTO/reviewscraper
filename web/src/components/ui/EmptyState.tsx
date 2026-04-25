interface EmptyStateProps {
  icon?: string
  message: string
  hint?: string
}

export default function EmptyState({ icon = '📭', message, hint }: EmptyStateProps) {
  return (
    <div style={{
      textAlign: 'center',
      padding: 'var(--space-10) var(--space-8)',
      color: 'var(--muted)',
    }}>
      <div style={{ fontSize: 32, marginBottom: 'var(--space-3)' }}>{icon}</div>
      <div style={{ fontSize: 'var(--text-md)', fontWeight: 500, color: 'var(--text)', marginBottom: hint ? 'var(--space-2)' : 0 }}>
        {message}
      </div>
      {hint && (
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', marginTop: 'var(--space-2)' }}>
          {hint}
        </div>
      )}
    </div>
  )
}
