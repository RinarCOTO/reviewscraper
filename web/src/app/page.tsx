'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import HubSearch from '@/components/HubSearch'
import { getAllReviews } from '@/lib/data'
import type { Review } from '@/lib/types'

const CITY_CONFIG = [
  { slug: 'austin-tx',         name: 'Austin TX',         city: 'Austin',         state: 'TX' },
  { slug: 'chicago-il',        name: 'Chicago IL',         city: 'Chicago',        state: 'IL' },
  { slug: 'draper-ut',         name: 'Draper UT',          city: 'Draper',         state: 'UT' },
  { slug: 'houston-tx',        name: 'Houston TX',         city: 'Houston',        state: 'TX' },
  { slug: 'pleasant-grove-ut', name: 'Pleasant Grove UT',  city: 'Pleasant Grove', state: 'UT' },
  { slug: 'tampa-fl',          name: 'Tampa FL',           city: 'Tampa',          state: 'FL' },
]

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

  useEffect(() => {
    getAllReviews().then(data => {
      setReviews(data)
      setLoading(false)
    })
  }, [])

  const totalReviews = reviews.length
  const totalCompetitors = new Set(reviews.map(r => r.provider_name)).size
  const inkoutReviews = reviews.filter(r => r.brand_name === 'inkOUT')
  const inkoutLocations = new Set(inkoutReviews.map(r => r.location_city + '|' + r.location_state)).size
  const cities = CITY_CONFIG.map(c => ({ ...c, ...computeCityStats(reviews, c.city, c.state) }))

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar totalReviews={loading ? undefined : totalReviews} />

      <div className="hub-main">
        <div className="topbar">
          <div className="page-title">Intelligence Hub</div>
          <div className="quick-links">
            <Link href="/overview" className="ql">📊 Full Overview</Link>
          </div>
          <HubSearch />
        </div>

        <div className="hub-content">
          <div className="hero">
            <div className="hero-card">
              <div className="label">Total Reviews</div>
              <div className="value">{loading ? '…' : totalReviews}</div>
              <div className="sub">Google reviews</div>
            </div>
            <div className="hero-card">
              <div className="label">Competitors Tracked</div>
              <div className="value">{loading ? '…' : totalCompetitors}</div>
              <div className="sub">across 6 markets</div>
            </div>
            <div className="hero-card">
              <div className="label">Biggest Threat</div>
              <div className="value" style={{ fontSize: 18 }}>MEDermis Laser Clinic</div>
              <div className="sub">91% positive · Austin TX</div>
            </div>
            <div className="hero-card">
              <div className="label">Inkout Weak Spot</div>
              <div className="value" style={{ fontSize: 18 }}>Draper UT</div>
              <div className="sub">4.1★ · inkout Draper UT</div>
            </div>
          </div>

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
            <div className="special-card" style={{ borderColor: 'rgba(167,139,250,.3)' }}>
              <div className="icon-wrap" style={{ background: 'rgba(167,139,250,.15)' }}>🎯</div>
              <div>
                <div className="sc-label">Target</div>
                <div className="sc-title">Inkout / Rejuvatek</div>
                <div className="sc-sub">
                  {loading ? '…' : `${inkoutLocations} locations · ${inkoutReviews.length} reviews analyzed`}
                </div>
              </div>
            </div>
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
    </div>
  )
}
