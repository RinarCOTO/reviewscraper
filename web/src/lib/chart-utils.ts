// Resolves a CSS variable expression (e.g. 'var(--green)') to its computed hex value.
// Falls back to hardcoded values during SSR when the DOM is unavailable.
const SSR_FALLBACKS: Record<string, string> = {
  '--green':       '#22c55e',
  '--yellow':      '#f59e0b',
  '--red':         '#ef4444',
  '--blue':        '#3b82f6',
  '--muted':       '#94a3b8',
  '--border':      '#2a2d3a',
  '--text':        '#e2e8f0',
  '--orange':      '#f97316',
  '--green-light': '#86efac',
  '--gray-dim':    '#374151',
}

export function resolveToken(varExpr: string): string {
  const name = varExpr.replace(/^var\(/, '').replace(/\)$/, '').trim()
  if (typeof window === 'undefined') return SSR_FALLBACKS[name] ?? varExpr
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || (SSR_FALLBACKS[name] ?? varExpr)
}

export function getChartColors() {
  const r = (name: string) => resolveToken(`var(${name})`)
  return {
    green:      r('--green'),
    yellow:     r('--yellow'),
    red:        r('--red'),
    blue:       r('--blue'),
    muted:      r('--muted'),
    border:     r('--border'),
    text:       r('--text'),
    orange:     r('--orange'),
    greenLight: r('--green-light'),
    grayDim:    r('--gray-dim'),
  }
}
