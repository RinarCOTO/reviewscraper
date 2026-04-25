interface LoadingBlockProps {
  message?: string
  inline?: boolean
}

export default function LoadingBlock({ message = 'Loading…', inline = false }: LoadingBlockProps) {
  if (inline) {
    return (
      <span style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)' }}>
        {message}
      </span>
    )
  }

  return (
    <div style={{
      textAlign: 'center',
      padding: 'var(--space-10) var(--space-8)',
      color: 'var(--muted)',
      fontSize: 'var(--text-base)',
    }}>
      {message}
    </div>
  )
}
