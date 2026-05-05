'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Topbar from '@/components/Topbar'
import { LoadingBlock } from '@/components/ui'
import { CITIES } from '@/lib/config'
import { getAllReviews, getLastUpdatedAt } from '@/lib/data'
import type { Review } from '@/lib/types'
import { DEFAULT_CEO_CONFIG, readCeoConfig, writeCeoConfig, type CeoConfig, type CeoMetricKey } from '@/lib/ceo-config'
import { buildHeadline, buildProviderSnapshots, pickBenchmark } from '@/lib/ceo-data'

const METRIC_LABELS: Record<CeoMetricKey, string> = {
  stars: 'Avg stars',
  positive: 'Positive rate',
  negative: 'Negative rate',
  scarring: 'Scar mentions',
  review_count: 'Review count',
  momentum: '6-month momentum',
}

function toneForDelta(metric: CeoMetricKey, delta: number) {
  if (metric === 'negative' || metric === 'scarring') {
    if (delta < 0) return 'win'
    if (delta > 0) return 'lose'
    return 'neutral'
  }
  if (delta > 0) return 'win'
  if (delta < 0) return 'lose'
  return 'neutral'
}

function metricValue(metric: CeoMetricKey, row: ReturnType<typeof buildProviderSnapshots>[number]) {
  switch (metric) {
    case 'stars': return row.avgStars
    case 'positive': return row.positivePct
    case 'negative': return row.negativePct
    case 'scarring': return row.scarringCount
    case 'review_count': return row.reviewCount
    case 'momentum': return row.recentCount
  }
}

function formatMetric(metric: CeoMetricKey, value: number) {
  switch (metric) {
    case 'stars': return `${value.toFixed(2)}★`
    case 'positive':
    case 'negative': return `${Math.round(value)}%`
    case 'scarring': return String(value)
    case 'review_count':
    case 'momentum': return String(value)
  }
}

function formatDelta(metric: CeoMetricKey, delta: number) {
  const prefix = delta > 0 ? '+' : ''
  switch (metric) {
    case 'stars': return `${prefix}${delta.toFixed(2)}★`
    case 'positive':
    case 'negative': return `${prefix}${Math.round(delta)} pts`
    default: return `${prefix}${Math.round(delta)}`
  }
}

export default function CeoPage() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [freshness, setFreshness] = useState<string | null>(null)
  const [config, setConfig] = useState<CeoConfig>(DEFAULT_CEO_CONFIG)

  useEffect(() => {
    setConfig(readCeoConfig())
    Promise.all([getAllReviews(), getLastUpdatedAt()]).then(([rows, updated]) => {
      setReviews(rows)
      setFreshness(updated.date)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!loading) writeCeoConfig(config)
  }, [config, loading])

  const snapshots = useMemo(() => buildProviderSnapshots(reviews, config), [reviews, config])
  const inkout = useMemo(
    () => snapshots.filter(s => s.isInkout).sort((a, b) => b.reviewCount - a.reviewCount)[0] ?? null,
    [snapshots]
  )
  const benchmark = useMemo(() => pickBenchmark(snapshots, config.benchmarkSlug), [snapshots, config.benchmarkSlug])

  const providerOptions = useMemo(
    () => snapshots.filter(s => !s.isInkout).sort((a, b) => a.provider.localeCompare(b.provider)),
    [snapshots]
  )

  const visibleMetrics = config.visibleMetrics.length ? config.visibleMetrics : DEFAULT_CEO_CONFIG.visibleMetrics
  const headline = buildHeadline(inkout, benchmark)

  return (
    <div className="hub-main">
      <Topbar
        title="CEO Scorecard"
        crumbs={[{ label: 'CEO Scorecard' }]}
        actions={<Link href="/momentum" className="ql">Momentum Tracker</Link>}
      />

      <div className="container ceo-page">
        {loading ? <LoadingBlock message="Building CEO scorecard…" /> : (
          <>
            <section className="ceo-hero">
              <div>
                <div className="ceo-kicker">Executive Readout</div>
                <h2>{headline}</h2>
                <p>
                  A one-screen comparison of inkOUT against the selected benchmark and market scope.
                  {freshness ? ` Data refreshed ${new Date(freshness).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.` : ''}
                </p>
              </div>
              <div className="ceo-hero-actions">
                <Link href="/overview" className="ceo-secondary-link">Open analyst overview</Link>
              </div>
            </section>

            <section className="ceo-score-grid">
              {inkout && benchmark && visibleMetrics.map(metric => {
                const inkoutValue = metricValue(metric, inkout)
                const benchmarkValue = metricValue(metric, benchmark)
                const delta = inkoutValue - benchmarkValue
                const tone = toneForDelta(metric, delta)

                return (
                  <article key={metric} className={`ceo-score-card tone-${tone}`}>
                    <div className="ceo-score-header">
                      <span className="ceo-score-label">{METRIC_LABELS[metric]}</span>
                      <span className={`ceo-verdict verdict-${tone}`}>{tone}</span>
                    </div>
                    <div className="ceo-score-value">{formatMetric(metric, inkoutValue)}</div>
                    <div className="ceo-score-sub">
                      vs {benchmark.provider}: {formatMetric(metric, benchmarkValue)}
                    </div>
                    <div className="ceo-score-delta">{formatDelta(metric, delta)}</div>
                  </article>
                )
              })}
            </section>

            {inkout && benchmark && (
              <section className="ceo-summary-row">
                <div className="ceo-summary-card">
                  <div className="ceo-summary-label">inkOUT profile</div>
                  <div className="ceo-summary-value">{inkout.avgStars.toFixed(2)}★</div>
                  <p>{inkout.reviewCount} reviews, {inkout.recentCount} in the last 6 months, {inkout.scarringCount} scar mentions.</p>
                </div>
                <div className="ceo-summary-card">
                  <div className="ceo-summary-label">Benchmark profile</div>
                  <div className="ceo-summary-value">{benchmark.avgStars.toFixed(2)}★</div>
                  <p>{benchmark.provider} has {benchmark.reviewCount} reviews and {benchmark.recentCount} in the last 6 months.</p>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
