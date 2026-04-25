'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import OverviewCharts from '@/components/OverviewCharts'
import Topbar from '@/components/Topbar'
import { KpiBlock, LoadingBlock, SentimentBreakdown, StarRating } from '@/components/ui'
import { getAllReviews, SCRAPER_CAP, CITY_SLUG_MAP } from '@/lib/data'
import { CITIES } from '@/lib/config'
import type { Review } from '@/lib/types'

// Build a slug lookup from config so we use clean slugs rather than computing them from provider names
const CONFIG_SLUGS = new Map<string, string>()
const CITY_TO_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(CITY_SLUG_MAP).map(([slug, { city, state }]) => [`${city}|${state}`, slug])
)
CITIES.forEach(city => {
  city.competitors.forEach(comp => {
    CONFIG_SLUGS.set(`${comp.name.toLowerCase()}|${city.slug}`, comp.slug)
  })
})

type SortKey = 'rank' | 'reviews' | 'stars' | 'positive' | 'negative' | 'pain'

const SORT_GOOD_DIR: Record<SortKey, 'asc' | 'desc'> = {
  rank: 'asc', reviews: 'desc', stars: 'desc', positive: 'desc', negative: 'asc', pain: 'asc',
}

function computeGroupStats(reviews: Review[]) {
  if (!reviews.length) return { total: 0, avgStars: 0, positive: 0, negative: 0 }
  const withText = reviews.filter(r => r.has_text)
  const textTotal = withText.length || 1
  const avgStars = parseFloat((reviews.reduce((s, r) => s + r.star_rating, 0) / reviews.length).toFixed(2))
  const positive = Math.round(withText.filter(r => (r.result_rating || '').toLowerCase() === 'positive').length / textTotal * 100)
  const negative = Math.round(withText.filter(r => (r.result_rating || '').toLowerCase() === 'negative').length / textTotal * 100)
  return { total: reviews.length, avgStars, positive, negative }
}

function fmtDateRange(earliest: string, latest: string): string {
  const opts = { month: 'short', day: 'numeric' } as const
  const d1 = new Date(earliest)
  const d2 = new Date(latest)
  const s1 = d1.toLocaleDateString('en-US', opts)
  const s2 = d2.toLocaleDateString('en-US', { ...opts, year: 'numeric' })
  return d1.getFullYear() === d2.getFullYear() ? `${s1} – ${s2}` : `${d1.toLocaleDateString('en-US', { ...opts, year: 'numeric' })} – ${s2}`
}

function sentBadge(p: number) {
  const cls = p >= 85 ? 'badge-green' : p >= 65 ? 'badge-yellow' : 'badge-red'
  return <span className={`badge ${cls}`}>{p}%</span>
}
function negBadge(p: number) {
  const cls = p === 0 ? 'badge-green' : p <= 10 ? 'badge-yellow' : 'badge-red'
  return <span className={`badge ${cls}`}>{p}%</span>
}

export default function OverviewPage() {
  const [sortKey, setSortKey] = useState<SortKey>('rank')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAllReviews().then(data => {
      setReviews(data)
      setLoading(false)
    })
  }, [])

  // Compute per-provider-location summaries from live reviews
  const providers = useMemo(() => {
    if (!reviews.length) return []
    const map = new Map<string, Review[]>()
    reviews.forEach(r => {
      const key = `${r.provider_name}||${r.location_city}||${r.location_state}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    })
    const summaries = Array.from(map.entries()).map(([key, gr]) => {
      const [provider, city, state] = key.split('||')
      // Exclude confirmed off-topic reviews (other services) from all metrics
      const relevant = gr.filter(r => r.is_tattoo_removal !== false)
      const total = relevant.length || gr.length
      const statGr = relevant.length ? relevant : gr
      const avgStars = parseFloat((statGr.reduce((s, r) => s + r.star_rating, 0) / total).toFixed(1))
      const withText = statGr.filter(r => r.has_text)
      const textTotal = withText.length || 1
      const positive = Math.round(withText.filter(r => (r.result_rating || '').toLowerCase() === 'positive').length / textTotal * 100)
      const negative = Math.round(withText.filter(r => (r.result_rating || '').toLowerCase() === 'negative').length / textTotal * 100)
      const pain = Math.round(statGr.filter(r => r.pain_level !== 'unknown' && (r.pain_level as number) > 0).length / total * 100)
      const method = gr[0]?.method_used || '—'
      const isInkout = gr[0]?.brand_name === 'inkOUT'
      const citySlug = CITY_TO_SLUG[`${city}|${state}`] || ''
      const slug = CONFIG_SLUGS.get(`${provider.toLowerCase()}|${citySlug}`)
        || `${provider.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${city.toLowerCase().replace(/\s+/g, '-')}-${state.toLowerCase()}`.replace(/-+/g, '-').replace(/-$/, '')
      const datedArr = statGr.filter(r => r.review_date_iso).map(r => r.review_date_iso).sort()
      const dateRange = datedArr.length ? { earliest: datedArr[0], latest: datedArr[datedArr.length - 1], count: total, isCapped: total >= SCRAPER_CAP } : null
      const textRows = statGr.filter(r => r.has_text)
      const rc = { positive: 0, negative: 0, mixed: 0, neutral: 0, unknown: 0 }
      textRows.forEach(r => { const k = ((r.result_rating || 'unknown').toLowerCase()) as keyof typeof rc; if (k in rc) rc[k]++ })
      const ratingBreakdown = textRows.length ? { positive: rc.positive + rc.neutral, mixed: rc.mixed, negative: rc.negative } : null
      return { provider, city: `${city}, ${state}`, method, reviews: total, stars: avgStars, positive, negative, pain, isInkout, slug, dateRange, ratingBreakdown }
    })
    summaries.sort((a, b) => b.stars - a.stars || b.positive - a.positive)
    return summaries.map((s, i) => ({ ...s, rank: i + 1 }))
  }, [reviews])

  const inkoutReviews = useMemo(() => reviews.filter(r => r.bucket === 'inkout'), [reviews])
  const competitorReviews = useMemo(() => reviews.filter(r => r.brand_name !== 'inkOUT'), [reviews])
  const inkout = useMemo(() => computeGroupStats(inkoutReviews), [inkoutReviews])
  const competitor = useMemo(() => computeGroupStats(competitorReviews), [competitorReviews])
  const inkoutLocations = useMemo(() => new Set(inkoutReviews.map(r => `${r.location_city}|${r.location_state}`)).size, [inkoutReviews])
  const competitorProviders = useMemo(() => new Set(competitorReviews.map(r => r.provider_name)).size, [competitorReviews])
  const transitionCount = useMemo(() => reviews.filter(r => r.location_transition).length, [reviews])
  const noTextCount = useMemo(() => reviews.filter(r => !r.has_text).length, [reviews])

  // City-level summaries for charts
  const citySummaries = useMemo(() => {
    if (!reviews.length) return []
    const map = new Map<string, Review[]>()
    reviews.forEach(r => {
      const key = `${r.location_city}, ${r.location_state}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    })
    return Array.from(map.entries()).map(([cityKey, gr]) => {
      const avg_stars = parseFloat((gr.reduce((s, r) => s + r.star_rating, 0) / gr.length).toFixed(1))
      const withText = gr.filter(r => r.has_text)
      const textTotal = withText.length || 1
      const positive = Math.round(withText.filter(r => (r.result_rating || '').toLowerCase() === 'positive').length / textTotal * 100)
      return { cityKey, avg_stars, positive }
    }).sort((a, b) => b.avg_stars - a.avg_stars)
  }, [reviews])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(SORT_GOOD_DIR[key])
    }
  }

  const sorted = [...providers].sort((a, b) => {
    const va = a[sortKey] as number
    const vb = b[sortKey] as number
    return sortDir === 'asc' ? va - vb : vb - va
  })

  function SortTh({ k, children }: { k: SortKey; children: React.ReactNode }) {
    const active = sortKey === k
    return (
      <th className="sort-th" onClick={() => toggleSort(k)} style={{ color: active ? 'var(--text)' : undefined }}>
        {children}
        <span className={active ? 'sort-icon' : 'sort-icon-inactive'}>{active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span>
      </th>
    )
  }

  const v = (x: number | string) => loading ? '…' : String(x)

  return (
    <div className="hub-main">
      <Topbar title="All Markets — Overview" crumbs={[{ label: 'Overview' }]} />

      <div className="container">
        <div className="disclosure">
          <strong>Data Disclosure:</strong> This dataset contains <strong>{v(reviews.length)} reviews</strong> scraped from Google Maps (up to 50 per location, most recent first).
          All dates are <strong>estimated</strong> from relative timestamps and carry month-level accuracy only.
          {!loading && transitionCount > 0 && <> <strong>{transitionCount} inkOUT reviews</strong> are flagged as transition-era (previously operated as Tatt2Away).</>}
          {!loading && noTextCount > 0 && <> <strong>{noTextCount} reviews</strong> contain no written text and are excluded from text analysis.</>}
          {' '}Compare at location level for fair multi-location brand analysis.
        </div>

        <div className="kpi-row">
          <KpiBlock label="Total Reviews" value={reviews.length} sub="across all providers" loading={loading} />
          <KpiBlock label="Providers" value={providers.length} sub="across 6 markets" loading={loading} />
          <KpiBlock label="inkOUT Positive" value={`${inkout.positive}%`} sub={`vs competitor ${competitor.positive}%`} loading={loading} valueStyle={{ color: 'var(--green)' }} />
          <KpiBlock label="inkOUT Avg Stars" value={`${inkout.avgStars}★`} sub={`vs competitor ${competitor.avgStars}★`} loading={loading} />
        </div>

        <div className="section">
          <h2>All Providers Ranked <span style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 400 }}>— click any column to sort</span></h2>
          {loading ? (
            <LoadingBlock />
          ) : (
            <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <SortTh k="rank">#</SortTh>
                    <th>Provider</th>
                    <th>City</th>
                    <th>Method</th>
                    <SortTh k="reviews">Reviews</SortTh>
                    <SortTh k="stars">Avg Stars</SortTh>
                    <SortTh k="positive">Positive</SortTh>
                    <SortTh k="negative">Negative</SortTh>
                    <SortTh k="pain">Pain %</SortTh>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(p => (
                    <tr key={p.slug} className={p.isInkout ? 'inkout-row' : ''}>
                      <td style={{ color: 'var(--muted)' }}>{p.rank}</td>
                      <td style={{ fontWeight: 600 }}>
                        <Link href={`/competitor/${p.slug}`} style={{ color: p.isInkout ? 'var(--purple-brand)' : '#fff' }}>{p.provider}</Link>
                        {p.isInkout && <span className="badge badge-purple" style={{ marginLeft: 6 }}>inkOUT</span>}
                      </td>
                      <td style={{ color: 'var(--muted)' }}>{p.city}</td>
                      <td><span className="badge badge-gray">{p.method}</span></td>
                      <td>
                        <Link href={`/competitor/${p.slug}`} style={{ color: 'var(--blue)' }}>{p.reviews}</Link>
                        {p.dateRange?.isCapped && <span style={{ color: 'var(--muted)', fontSize: 10, marginLeft: 3 }}>(cap)</span>}
                      </td>
                      <td className="stars">
                        <StarRating value={p.stars} showValue />
                        {p.dateRange && <div style={{ color: 'var(--muted)', fontSize: 10, fontWeight: 400, marginTop: 2 }}>{fmtDateRange(p.dateRange.earliest, p.dateRange.latest)}</div>}
                      </td>
                      <td>
                        {sentBadge(p.positive)}
                        {p.ratingBreakdown && <div style={{ marginTop: 4 }}><SentimentBreakdown positive={p.ratingBreakdown.positive} mixed={p.ratingBreakdown.mixed} negative={p.ratingBreakdown.negative} /></div>}
                      </td>
                      <td>{negBadge(p.negative)}</td>
                      <td>{p.pain}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="section">
          <h2>inkOUT vs Competitors</h2>
          <div className="grid-4">
            <KpiBlock size="lg" label="inkOUT Avg Stars" value={`${inkout.avgStars}★`} sub={`${inkout.total} reviews · ${inkoutLocations} locations`} loading={loading} valueStyle={{ color: 'var(--purple-brand)' }} />
            <KpiBlock size="lg" label="Competitor Avg Stars" value={`${competitor.avgStars}★`} sub={`${competitor.total} reviews · ${competitorProviders} providers`} loading={loading} />
            <KpiBlock size="lg" label="inkOUT Positive Results" value={`${inkout.positive}%`} sub={`vs competitor ${competitor.positive}%`} loading={loading} valueStyle={{ color: 'var(--green)' }} />
            <KpiBlock size="lg" label="inkOUT Negative Results" value={`${inkout.negative}%`} sub={`vs competitor ${competitor.negative}%`} loading={loading} valueStyle={{ color: 'var(--red)' }} />
          </div>
        </div>

        <div className="section">
          <h2>Market Comparison</h2>
          {loading ? <LoadingBlock /> : <OverviewCharts citySummaries={citySummaries} />}
        </div>

        <div className="review-footer">
          Source: Google Maps. Dates estimated from relative timestamps. Sample of up to 50 reviews per location.
        </div>
      </div>
    </div>
  )
}
