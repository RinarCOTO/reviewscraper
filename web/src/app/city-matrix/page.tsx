'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import Topbar from '@/components/Topbar'
import { LoadingBlock } from '@/components/ui'
import { getCityData, CITY_SLUGS } from '@/lib/data'
import type { CityData, BusinessSummary } from '@/lib/types'

// ─── Metric definitions ────────────────────────────────────────────────────

type Metric = 'stars' | 'positive' | 'negative' | 'scarring'

const METRICS: { key: Metric; label: string; higherIsBetter: boolean }[] = [
  { key: 'stars',    label: 'Stars',     higherIsBetter: true  },
  { key: 'positive', label: 'Positive%', higherIsBetter: true  },
  { key: 'negative', label: 'Negative%', higherIsBetter: false },
  { key: 'scarring', label: 'Scar hits', higherIsBetter: false },
]

function metricValue(b: BusinessSummary, metric: Metric): number {
  switch (metric) {
    case 'stars':    return b.avg_stars
    case 'positive': return b.result_pct.positive
    case 'negative': return b.result_pct.negative
    case 'scarring': return b.scarring_pct
  }
}

function formatValue(b: BusinessSummary, metric: Metric): string {
  switch (metric) {
    case 'stars':    return `${b.avg_stars.toFixed(1)}★`
    case 'positive': return `${b.result_pct.positive}%`
    case 'negative': return `${b.result_pct.negative}%`
    case 'scarring': return `${b.scarring_pct}%`
  }
}

// Rank inkOUT against all businesses in the city for a given metric.
// Uses reference equality so ties don't affect the result.
function getRank(businesses: BusinessSummary[], inkout: BusinessSummary, metric: Metric): number {
  const { higherIsBetter } = METRICS.find(m => m.key === metric)!
  const sorted = [...businesses].sort((a, b) =>
    higherIsBetter
      ? metricValue(b, metric) - metricValue(a, metric)
      : metricValue(a, metric) - metricValue(b, metric)
  )
  return sorted.findIndex(b => b === inkout) + 1
}

// ─── Rank styling ──────────────────────────────────────────────────────────

function rankStyle(rank: number): { bg: string; color: string; badge: string } {
  if (rank === 1) return { bg: 'rgba(34,197,94,.13)',  color: 'var(--green)',  badge: '#1' }
  if (rank === 2) return { bg: 'rgba(245,158,11,.12)', color: 'var(--yellow)', badge: '#2' }
  return           { bg: 'rgba(239,68,68,.10)',  color: 'var(--red)',   badge: `#${rank}` }
}

// ─── Per-city result shape ─────────────────────────────────────────────────

interface CityResult {
  slug: string
  label: string           // comes from CityData.cityKey, e.g. "Austin, TX"
  inkout: BusinessSummary
  competitorCount: number
  ranks: Record<Metric, number>
}

function buildCityResult(data: CityData): CityResult | null {
  const inkout = data.businesses.find(b => b.isInkout)
  if (!inkout) return null

  const ranks = {} as Record<Metric, number>
  METRICS.forEach(m => { ranks[m.key] = getRank(data.businesses, inkout, m.key) })

  return {
    slug: data.slug,
    label: data.cityKey,
    inkout,
    competitorCount: data.businesses.filter(b => !b.isInkout).length,
    ranks,
  }
}

// ─── Headline logic ────────────────────────────────────────────────────────

function buildHeadline(results: CityResult[], wins: Record<Metric, number>): string {
  const total = results.length
  if (!total) return 'No city data available for the current dataset.'

  // Prioritise the metrics the CEO cares most about in order
  if (wins.negative === total)
    return `inkOUT has the lowest negative review rate in every market — ${total} of ${total} cities.`
  if (wins.stars === total)
    return `inkOUT leads on star rating across all ${total} tracked markets.`
  if (wins.negative >= total - 1)
    return `inkOUT ranks #1 on negative rate in ${wins.negative} of ${total} markets.`
  if (wins.stars >= total - 1)
    return `inkOUT leads on star rating in ${wins.stars} of ${total} markets.`

  // Fall back to whichever metric has the most wins
  const best = METRICS.reduce((a, m) => wins[m.key] > wins[a.key] ? m : a)
  return `inkOUT ranks #1 on ${best.label.toLowerCase()} in ${wins[best.key]} of ${total} markets.`
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function CityMatrixPage() {
  const [cityData,  setCityData]  = useState<(CityData | null)[]>([])
  const [loading,   setLoading]   = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all(CITY_SLUGS.map(slug => getCityData(slug)))
      .then(results => { setCityData(results); setLoading(false) })
      .catch(err   => { setFetchError(String(err)); setLoading(false) })
  }, [])

  const results = useMemo(() =>
    cityData.flatMap(data => {
      if (!data) return []
      const result = buildCityResult(data)
      return result ? [result] : []
    }),
  [cityData])

  const wins = useMemo(() => {
    const counts = {} as Record<Metric, number>
    METRICS.forEach(m => { counts[m.key] = results.filter(r => r.ranks[m.key] === 1).length })
    return counts
  }, [results])

  const headline = useMemo(() => buildHeadline(results, wins), [results, wins])

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="hub-main">
      <Topbar
        title="City Win / Loss Map"
        crumbs={[{ label: 'City Win / Loss Map' }]}
        actions={<Link href="/ceo" className="ql">CEO Scorecard</Link>}
      />

      <div className="container ceo-page">
        {loading && <LoadingBlock message="Loading city data…" />}

        {!loading && fetchError && (
          <div style={{ padding: 40, color: 'var(--red)', fontFamily: 'monospace', textAlign: 'center' }}>
            {fetchError}
          </div>
        )}

        {!loading && !fetchError && (
          <>
            {/* Hero */}
            <section className="ceo-hero">
              <div>
                <div className="ceo-kicker">Market Position</div>
                <h2>{headline}</h2>
                <p>
                  Each cell shows inkOUT's rank among all tracked providers in that city.
                  Stars and positive% reward higher values. Negative% and scar hits reward lower.
                </p>
              </div>
            </section>

            {/* Win summary: how many cities inkOUT ranks #1 per metric */}
            <section className="ceo-summary-row">
              {METRICS.map(m => {
                const w = wins[m.key]
                const total = results.length
                const color = w === total ? 'var(--green)' : w >= total - 1 ? 'var(--yellow)' : '#fff'
                return (
                  <div key={m.key} className="ceo-summary-card">
                    <div className="ceo-summary-label">{m.label}</div>
                    <div className="ceo-summary-value" style={{ color }}>{w}/{total}</div>
                    <p>cities where inkOUT ranks #1</p>
                  </div>
                )
              })}
            </section>

            {/* Matrix */}
            <section className="card" style={{ padding: 0, overflow: 'hidden' }}>

              {/* Header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '180px repeat(4, 1fr)',
                borderBottom: '1px solid var(--border)',
                background: 'rgba(255,255,255,.02)',
              }}>
                <div style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.07em' }}>
                  Market
                </div>
                {METRICS.map(m => (
                  <div key={m.key} style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.07em', textAlign: 'center' }}>
                    {m.label}
                  </div>
                ))}
              </div>

              {/* City rows */}
              {results.map((city, i) => (
                <div
                  key={city.slug}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '180px repeat(4, 1fr)',
                    borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  {/* City name + competitor count */}
                  <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 3, justifyContent: 'center' }}>
                    <Link
                      href={`/city/${city.slug}/`}
                      style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}
                    >
                      {city.label}
                    </Link>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                      vs {city.competitorCount} competitor{city.competitorCount !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Metric cells */}
                  {METRICS.map(m => {
                    const rank = city.ranks[m.key]
                    const { bg, color, badge } = rankStyle(rank)
                    return (
                      <div
                        key={m.key}
                        style={{
                          padding: '16px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          background: bg,
                          borderLeft: '1px solid var(--border)',
                        }}
                      >
                        <span style={{
                          fontSize: 11, fontWeight: 700, color,
                          background: `${color}22`,
                          padding: '2px 8px',
                          borderRadius: 9999,
                        }}>
                          {badge}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
                          {formatValue(city.inkout, m.key)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              ))}
            </section>

            {/* Legend */}
            <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
              {[
                { color: 'var(--green)',  text: '#1 — leads market'   },
                { color: 'var(--yellow)', text: '#2 — close second'   },
                { color: 'var(--red)',    text: '#3+ — behind field'  },
              ].map(({ color, text }) => (
                <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
                  {text}
                </div>
              ))}
            </div>

            <section className="ceo-context-note">
              Each cell ranks inkOUT against all tracked competitors in that city. Green = #1, yellow = #2, red = #3 or lower. Cities without an inkOUT location are omitted.
            </section>
          </>
        )}
      </div>
    </div>
  )
}
