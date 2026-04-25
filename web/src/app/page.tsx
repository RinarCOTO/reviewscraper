'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import Topbar from '@/components/Topbar'
import { KpiBlock } from '@/components/ui'
import { getAllReviews, getLastUpdatedAt, CITY_SLUG_MAP } from '@/lib/data'
import { CITIES } from '@/lib/config'
import type { Review } from '@/lib/types'

const CITY_CONFIG = CITIES.map(c => {
  const loc = CITY_SLUG_MAP[c.slug]
  return { slug: c.slug, name: c.label, city: loc.city, state: loc.state }
})

function positiveColor(pct: number) {
  if (pct >= 70) return 'var(--green)'
  if (pct >= 50) return 'var(--yellow)'
  return 'var(--red)'
}

function computeCityStats(reviews: Review[], city: string, state: string) {
  const cityReviews = reviews.filter(r => r.location_city === city && r.location_state === state)
  const competitors = new Set(cityReviews.map(r => r.provider_name)).size
  const total = cityReviews.length
  const avgStars = total
    ? (cityReviews.reduce((s, r) => s + r.star_rating, 0) / total).toFixed(1)
    : '0.0'
  const withText = cityReviews.filter(r => r.has_text)
  const positive = withText.filter(r => (r.result_rating || '').toLowerCase() === 'positive').length
  const posPct = withText.length ? Math.round((positive / withText.length) * 100) : 0
  return { competitors, total, avgStars, posPct }
}

export default function HubPage() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<{ date: string | null; nullCount: number } | null>(null)

  useEffect(() => {
    Promise.all([getAllReviews(), getLastUpdatedAt()]).then(([data, freshness]) => {
      setReviews(data)
      setLastUpdated(freshness)
      setLoading(false)
    })
  }, [])

  const totalReviews = reviews.length
  const totalCompetitors = new Set(reviews.map(r => r.provider_name)).size
  const inkoutReviews = reviews.filter(r => r.bucket === 'inkout')
  const inkoutLocations = new Set(inkoutReviews.map(r => r.location_city + '|' + r.location_state)).size
  const cities = CITY_CONFIG.map(c => ({ ...c, ...computeCityStats(reviews, c.city, c.state) }))

  // Dynamically compute biggest non-inkOUT threat by positive%
  const biggestThreat = useMemo<{ name: string; pct: number; city: string; state: string } | null>(() => {
    if (!reviews.length) return null
    const groups = new Map<string, { reviews: Review[]; city: string; state: string }>()
    reviews.filter(r => r.brand_name !== 'inkOUT').forEach(r => {
      const key = r.provider_name
      if (!groups.has(key)) groups.set(key, { reviews: [], city: r.location_city, state: r.location_state })
      groups.get(key)!.reviews.push(r)
    })
    let best: { name: string; pct: number; city: string; state: string } | null = null
    groups.forEach(({ reviews: gr, city, state }, name) => {
      const withText = gr.filter(r => r.has_text)
      if (!withText.length) return
      const pct = Math.round(withText.filter(r => (r.result_rating || '').toLowerCase() === 'positive').length / withText.length * 100)
      if (!best || pct > best.pct) best = { name, pct, city, state }
    })
    return best
  }, [reviews])

  // Dynamically compute inkOUT weak spot by lowest avg stars
  const inkoutWeakSpot = useMemo<{ city: string; state: string; stars: number } | null>(() => {
    if (!inkoutReviews.length) return null
    const groups = new Map<string, Review[]>()
    inkoutReviews.forEach(r => {
      const key = `${r.location_city}|${r.location_state}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(r)
    })
    let worst: { city: string; state: string; stars: number } | null = null
    groups.forEach((gr, key) => {
      const avg = parseFloat((gr.reduce((s, r) => s + r.star_rating, 0) / gr.length).toFixed(1))
      if (!worst || avg < worst.stars) {
        const [city, state] = key.split('|')
        worst = { city, state, stars: avg }
      }
    })
    return worst
  }, [inkoutReviews])

  return (
    <div className="hub-main">
      <Topbar
        title="Intelligence Hub"
        actions={<Link href="/overview" className="ql">📊 Full Overview</Link>}
      />

      <div className="hub-content">
        <div className="hero">
          <KpiBlock label="Total Reviews" value={totalReviews} sub="Google reviews" loading={loading} />
          <KpiBlock label="Competitors Tracked" value={totalCompetitors} sub="across 6 markets" loading={loading} />
          <KpiBlock
            label="Biggest Threat"
            value={biggestThreat?.name ?? '—'}
            sub={biggestThreat ? `${biggestThreat.pct}% positive · ${biggestThreat.city}, ${biggestThreat.state}` : undefined}
            loading={loading}
          />
          <KpiBlock
            label="inkOUT Weak Spot"
            value={inkoutWeakSpot ? `${inkoutWeakSpot.city}, ${inkoutWeakSpot.state}` : '—'}
            sub={inkoutWeakSpot ? `${inkoutWeakSpot.stars}★ avg rating` : undefined}
            loading={loading}
          />
        </div>

        {!loading && lastUpdated && (
          <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 11, marginBottom: 8, marginTop: -8 }}>
            {lastUpdated.date
              ? <>Data last updated: <strong style={{ color: 'var(--text)' }}>{new Date(lastUpdated.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong></>
              : 'Data freshness unknown'
            }
            {lastUpdated.nullCount > 0 && (
              <span style={{ marginLeft: 8, color: 'var(--yellow)' }}>· {lastUpdated.nullCount} reviews without analysis date</span>
            )}
          </div>
        )}

        <div className="section-title">Special Views</div>
        <div className="special-grid">
          <Link href="/overview" className="special-card">
            <div className="icon-wrap" style={{ background: 'rgba(108,99,255,.15)' }}>📊</div>
            <div>
              <div className="sc-label">Overview</div>
              <div className="sc-title">Full Competitive Dashboard</div>
              <div className="sc-sub">All businesses, all metrics, all cities</div>
            </div>
          </Link>
          <Link href="/reviews" className="special-card">
            <div className="icon-wrap" style={{ background: 'rgba(34,197,94,.12)' }}>💬</div>
            <div>
              <div className="sc-label">Browse</div>
              <div className="sc-title">All Reviews</div>
              <div className="sc-sub">Filter, search, and copy review text</div>
            </div>
          </Link>
          <Link href="/reviews/inkout" className="special-card" style={{ borderColor: 'rgba(167,139,250,.3)' }}>
            <div className="icon-wrap" style={{ background: 'rgba(167,139,250,.15)' }}>🎯</div>
            <div>
              <div className="sc-label">Target</div>
              <div className="sc-title">inkOUT / Rejuvatek</div>
              <div className="sc-sub">
                {loading ? '…' : `${inkoutLocations} locations · ${inkoutReviews.length} reviews analyzed`}
              </div>
            </div>
          </Link>
          <Link href="/methodology" className="special-card">
            <div className="icon-wrap" style={{ background: 'rgba(148,163,184,.1)' }}>📋</div>
            <div>
              <div className="sc-label">Reference</div>
              <div className="sc-title">How to Read This Dashboard</div>
              <div className="sc-sub">Data sources, bucket definitions, methodology</div>
            </div>
          </Link>
        </div>

        <div className="section-title">Markets</div>
        <div className="city-grid">
          {cities.map(c => (
            <Link key={c.slug} href={`/city/${c.slug}/`} className="city-card">
              <div className="city-label">Market</div>
              <div className="city-name">{c.name}</div>
              <div className="city-stats">
                <div className="city-stat"><span className="k">Competitors</span><span className="v">{loading ? '…' : c.competitors}</span></div>
                <div className="city-stat"><span className="k">Reviews</span><span className="v">{loading ? '…' : c.total}</span></div>
                <div className="city-stat"><span className="k">Avg Stars</span><span className="v stars">{loading ? '…' : `${c.avgStars}★`}</span></div>
                <div className="city-stat"><span className="k">Positive</span><span className="v" style={{ color: positiveColor(c.posPct) }}>{loading ? '…' : `${c.posPct}%`}</span></div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
