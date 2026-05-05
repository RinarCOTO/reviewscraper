'use client'

export const CEO_CONFIG_KEY = 'ceo_config'

export type CeoMetricKey =
  | 'stars'
  | 'positive'
  | 'negative'
  | 'scarring'
  | 'review_count'
  | 'momentum'

export interface CeoConfig {
  citySlugs: string[]
  providerSlugs: string[]
  visibleMetrics: CeoMetricKey[]
  benchmarkSlug: string | null
  dateWindowMonths: 3 | 6 | 12
}

export const DEFAULT_VISIBLE_METRICS: CeoMetricKey[] = [
  'stars',
  'positive',
  'negative',
  'scarring',
  'review_count',
  'momentum',
]

export const DEFAULT_CEO_CONFIG: CeoConfig = {
  citySlugs: [],
  providerSlugs: [],
  visibleMetrics: DEFAULT_VISIBLE_METRICS,
  benchmarkSlug: null,
  dateWindowMonths: 6,
}

export function readCeoConfig(): CeoConfig {
  if (typeof window === 'undefined') return DEFAULT_CEO_CONFIG

  try {
    const raw = window.localStorage.getItem(CEO_CONFIG_KEY)
    if (!raw) return DEFAULT_CEO_CONFIG
    const parsed = JSON.parse(raw) as Partial<CeoConfig>
    return {
      citySlugs: Array.isArray(parsed.citySlugs) ? parsed.citySlugs : [],
      providerSlugs: Array.isArray(parsed.providerSlugs) ? parsed.providerSlugs : [],
      visibleMetrics: Array.isArray(parsed.visibleMetrics) && parsed.visibleMetrics.length
        ? parsed.visibleMetrics.filter((m): m is CeoMetricKey => DEFAULT_VISIBLE_METRICS.includes(m as CeoMetricKey))
        : DEFAULT_VISIBLE_METRICS,
      benchmarkSlug: typeof parsed.benchmarkSlug === 'string' ? parsed.benchmarkSlug : null,
      dateWindowMonths: parsed.dateWindowMonths === 3 || parsed.dateWindowMonths === 12 ? parsed.dateWindowMonths : 6,
    }
  } catch {
    return DEFAULT_CEO_CONFIG
  }
}

export function writeCeoConfig(config: CeoConfig) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(CEO_CONFIG_KEY, JSON.stringify(config))
}
