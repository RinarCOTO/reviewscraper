'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import OverviewCharts from '@/components/OverviewCharts'
import Topbar from '@/components/Topbar'
import { getAllReviews } from '@/lib/data'
import { CITIES } from '@/lib/config'
import type { Review } from '@/lib/types'

// Build a slug lookup from config so we use clean slugs rather than computing them from provider names
const CONFIG_SLUGS = new Map<string, string>()
const CITY_TO_SLUG: Record<string, string> = {
  'Austin|TX': 'austin-tx', 'Chicago|IL': 'chicago-il', 'Draper|UT': 'draper-ut',
  'Houston|TX': 'houston-tx', 'Pleasant Grove|UT': 'pleasant-grove-ut', 'Tampa|FL': 'tampa-fl',
}
CITIES.forEach(city => {
  city.competitors.forEach(comp => {
    CONFIG_SLUGS.set(`${comp.name.toLowerCase()}|${city.slug}`, comp.slug)
  })
})

type SortKey = 'rank' | 'reviews' | 'stars' | 'positive' | 'negative' | 'pain'

function computeGroupStats(reviews: Review[]) {
  if (!reviews.length) return { total: 0, avgStars: 0, positive: 0, negative: 0 }
  const withText = reviews.filter(r => r.has_text)
  const textTotal = withText.length || 1
  const avgStars = parseFloat((reviews.reduce((s, r) => s + r.star_rating, 0) / reviews.length).toFixed(2))
  const positive = Math.round(withText.filter(r => (r.result_rating || '').toLowerCase() === 'positive').length / textTotal * 100)
  const negative = Math.round(withText.filter(r => (r.result_rating || '').toLowerCase() === 'negative').length / textTotal * 100)
  return { total: reviews.length, avgStars, positive, negative }
}

function sentBadge(p: number) {
  const cls = p >= 85 ? 'badge-green' : p >= 65 ? 'badge-yellow' : 'badge-red'
  return <span className={`badge ${cls}`}>{p}%</span>
}
function negBadge(p: number) {
  const cls = p === 0 ? 'badge-green' : p <= 10 ? 'badge-yellow' : 'badge-red'
  return <span className={`badge ${cls}`}>{p}%</span>
}
function starStr(n: number) {
  return '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n)) + ' ' + n
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
      const total = gr.length
      const avgStars = parseFloat((gr.reduce((s, r) => s + r.star_rating, 0) / total).toFixed(1))
      const withText = gr.filter(r => r.has_text)
      const textTotal = withText.length || 1
      const positive = Math.round(withText.filter(r => (r.result_rating || '').toLowerCase() === 'positive').length / textTotal * 100)
      const negative = Math.round(withText.filter(r => (r.result_rating || '').toLowerCase() === 'negative').length / textTotal * 100)
      const pain = Math.round(gr.filter(r => r.pain_level !== 'unknown' && (r.pain_level as number) > 0).length / total * 100)
      const method = gr[0]?.method_used || '—'
      const isInkout = gr[0]?.brand_name === 'inkOUT'
      const citySlug = CITY_TO_SLUG[`${city}|${state}`] || ''
      const slug = CONFIG_SLUGS.get(`${provider.toLowerCase()}|${citySlug}`)
        || `${provider.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${city.toLowerCase().replace(/\s+/g, '-')}-${state.toLowerCase()}`.replace(/-+/g, '-').replace(/-$/, '')
      return { provider, city: `${city}, ${state}`, method, reviews: total, stars: avgStars, positive, negative, pain, isInkout, slug }
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
      setSortDir(key === 'rank' ? 'asc' : 'desc')
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
          <div className="kpi"><div className="label">Total Reviews</div><div className="value">{v(reviews.length)}</div><div className="sub">across all providers</div></div>
          <div className="kpi"><div className="label">Providers</div><div className="value">{v(providers.length)}</div><div className="sub">across 6 markets</div></div>
          <div className="kpi"><div className="label">inkOUT Positive</div><div className="value" style={{ color: 'var(--green)' }}>{v(`${inkout.positive}%`)}</div><div className="sub">vs competitor {v(`${competitor.positive}%`)}</div></div>
          <div className="kpi"><div className="label">inkOUT Avg Stars</div><div className="value">{v(`${inkout.avgStars}★`)}</div><div className="sub">vs competitor {v(`${competitor.avgStars}★`)}</div></div>
        </div>

        <div className="section">
          <h2>All Providers Ranked <span style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 400 }}>— click any column to sort</span></h2>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
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
                        <Link href={`/competitor/${p.slug}`} style={{ color: p.isInkout ? '#a78bfa' : '#fff' }}>{p.provider}</Link>
                        {p.isInkout && <span className="badge badge-purple" style={{ marginLeft: 6 }}>inkOUT</span>}
                      </td>
                      <td style={{ color: 'var(--muted)' }}>{p.city}</td>
                      <td><span className="badge badge-gray">{p.method}</span></td>
                      <td><Link href={`/competitor/${p.slug}`} style={{ color: 'var(--blue)' }}>{p.reviews}</Link></td>
                      <td className="stars">{starStr(p.stars)}</td>
                      <td>{sentBadge(p.positive)}</td>
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
            <div className="card">
              <h3>inkOUT Avg Stars</h3>
              <div style={{ fontSize: 32, fontWeight: 700, color: '#a78bfa' }}>{v(`${inkout.avgStars}★`)}</div>
              <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>{v(`${inkout.total} reviews · ${inkoutLocations} locations`)}</div>
            </div>
            <div className="card">
              <h3>Competitor Avg Stars</h3>
              <div style={{ fontSize: 32, fontWeight: 700, color: '#fff' }}>{v(`${competitor.avgStars}★`)}</div>
              <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>{v(`${competitor.total} reviews · ${competitorProviders} providers`)}</div>
            </div>
            <div className="card">
              <h3>inkOUT Positive Results</h3>
              <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--green)' }}>{v(`${inkout.positive}%`)}</div>
              <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>vs competitor {v(`${competitor.positive}%`)}</div>
            </div>
            <div className="card">
              <h3>inkOUT Negative Results</h3>
              <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--red)' }}>{v(`${inkout.negative}%`)}</div>
              <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>vs competitor {v(`${competitor.negative}%`)}</div>
            </div>
          </div>
        </div>

        <div className="section">
          <h2>Market Comparison</h2>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>
          ) : (
            <OverviewCharts citySummaries={citySummaries} />
          )}
        </div>

        <div className="review-footer">
          Source: Google Maps. Dates estimated from relative timestamps. Sample of up to 50 reviews per location.
        </div>
      </div>
    </div>
  )
}
