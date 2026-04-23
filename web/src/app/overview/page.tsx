'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import OverviewCharts from '@/components/OverviewCharts'
import Topbar from '@/components/Topbar'
import { getAllReviews } from '@/lib/data'
import type { Review } from '@/lib/types'

const PROVIDERS = [
  { rank: 1,  provider: 'inkOUT',                    city: 'Chicago, IL',        method: 'TEPR',     reviews: 7,  stars: 5,   positive: 86, negative: 0,  pain: 43, isInkout: true,  slug: 'inkout-chicago-il' },
  { rank: 2,  provider: 'Removery (South Congress)',  city: 'Austin, TX',         method: 'PicoWay',  reviews: 50, stars: 5,   positive: 78, negative: 0,  pain: 26, isInkout: false, slug: 'removery-south-congress-austin-tx' },
  { rank: 3,  provider: 'MEDermis Laser Clinic',      city: 'Austin, TX',         method: 'Spectra',  reviews: 50, stars: 5,   positive: 92, negative: 0,  pain: 20, isInkout: false, slug: 'medermis-laser-clinic-austin-tx' },
  { rank: 4,  provider: 'Clean Slate Ink',            city: 'Austin, TX',         method: 'Q-Switch', reviews: 22, stars: 5,   positive: 77, negative: 0,  pain: 9,  isInkout: false, slug: 'clean-slate-ink-austin-tx' },
  { rank: 5,  provider: 'Arviv Medical Aesthetics',   city: 'Tampa, FL',          method: 'Other',    reviews: 50, stars: 5,   positive: 60, negative: 0,  pain: 8,  isInkout: false, slug: 'arviv-medical-aesthetics-tampa-fl' },
  { rank: 6,  provider: 'Enfuse Medical Spa',         city: 'Chicago, IL',        method: 'Other',    reviews: 50, stars: 5,   positive: 62, negative: 0,  pain: 14, isInkout: false, slug: 'enfuse-medical-spa-chicago-il' },
  { rank: 7,  provider: 'inkOUT',                    city: 'Houston, TX',         method: 'TEPR',     reviews: 50, stars: 4.9, positive: 76, negative: 2,  pain: 8,  isInkout: true,  slug: 'inkout-houston-tx' },
  { rank: 8,  provider: 'Inklifters (Aesthetica)',    city: 'Pleasant Grove, UT', method: 'Other',    reviews: 50, stars: 4.9, positive: 90, negative: 2,  pain: 14, isInkout: false, slug: 'inklifters-aesthetica-pleasant-grove-ut' },
  { rank: 9,  provider: 'Erasable Med Spa',           city: 'Tampa, FL',          method: 'PicoWay',  reviews: 50, stars: 4.9, positive: 48, negative: 2,  pain: 12, isInkout: false, slug: 'erasable-med-spa-tampa-fl' },
  { rank: 10, provider: 'Removery (Bucktown)',        city: 'Chicago, IL',        method: 'PicoWay',  reviews: 50, stars: 4.9, positive: 82, negative: 0,  pain: 14, isInkout: false, slug: 'removery-bucktown-chicago-il' },
  { rank: 11, provider: 'inkOUT',                    city: 'Tampa, FL',           method: 'TEPR',     reviews: 20, stars: 4.8, positive: 50, negative: 0,  pain: 10, isInkout: true,  slug: 'inkout-tampa-fl' },
  { rank: 12, provider: 'Skintellect',               city: 'Tampa, FL',           method: 'Other',    reviews: 50, stars: 4.8, positive: 52, negative: 4,  pain: 8,  isInkout: false, slug: 'skintellect-tampa-fl' },
  { rank: 13, provider: 'Removery (Lincoln Square)', city: 'Chicago, IL',         method: 'PicoWay',  reviews: 50, stars: 4.8, positive: 82, negative: 2,  pain: 6,  isInkout: false, slug: 'removery-lincoln-square-chicago-il' },
  { rank: 14, provider: 'InkFree, MD',              city: 'Houston, TX',          method: 'PicoWay',  reviews: 50, stars: 4.8, positive: 74, negative: 4,  pain: 14, isInkout: false, slug: 'inkfree-md-houston-tx' },
  { rank: 15, provider: 'Tatt2Away',                city: 'Austin, TX',           method: 'TEPR',     reviews: 15, stars: 4.7, positive: 87, negative: 7,  pain: 27, isInkout: false, slug: 'tatt2away-austin-tx' },
  { rank: 16, provider: 'Kovak Cosmetic Center',    city: 'Chicago, IL',          method: 'Q-Switch', reviews: 50, stars: 4.7, positive: 58, negative: 6,  pain: 2,  isInkout: false, slug: 'kovak-cosmetic-center-chicago-il' },
  { rank: 17, provider: 'DermSurgery Associates',   city: 'Houston, TX',          method: 'Q-Switch', reviews: 50, stars: 4.7, positive: 54, negative: 2,  pain: 6,  isInkout: false, slug: 'dermsurgery-associates-houston-tx' },
  { rank: 18, provider: 'inkOUT',                   city: 'Austin, TX',           method: 'TEPR',     reviews: 30, stars: 4.6, positive: 73, negative: 10, pain: 17, isInkout: true,  slug: 'inkout-austin-tx' },
  { rank: 19, provider: 'Clarity Skin',             city: 'Draper, UT',           method: 'PicoWay',  reviews: 50, stars: 4.6, positive: 40, negative: 6,  pain: 6,  isInkout: false, slug: 'clarity-skin-draper-ut' },
  { rank: 20, provider: 'inkOUT',                   city: 'Draper, UT',           method: 'TEPR',     reviews: 42, stars: 4.3, positive: 64, negative: 17, pain: 24, isInkout: true,  slug: 'inkout-draper-ut' },
  { rank: 21, provider: 'Tatt2Away',                city: 'Chicago, IL',          method: 'TEPR',     reviews: 4,  stars: 4,   positive: 50, negative: 25, pain: 0,  isInkout: false, slug: 'tatt2away-chicago-il' },
  { rank: 22, provider: 'Tatt2Away',                city: 'Draper, UT',           method: 'TEPR',     reviews: 8,  stars: 3,   positive: 50, negative: 50, pain: 25, isInkout: false, slug: 'tatt2away-draper-ut' },
]

type SortKey = 'rank' | 'reviews' | 'stars' | 'positive' | 'negative' | 'pain'

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

function computeGroupStats(reviews: Review[]) {
  const withText = reviews.filter(r => r.has_text)
  const textTotal = withText.length || 1
  const avgStars = reviews.length
    ? parseFloat((reviews.reduce((s, r) => s + r.star_rating, 0) / reviews.length).toFixed(2))
    : 0
  const positive = Math.round(withText.filter(r => (r.result_rating || '').toLowerCase() === 'positive').length / textTotal * 100)
  const negative = Math.round(withText.filter(r => (r.result_rating || '').toLowerCase() === 'negative').length / textTotal * 100)
  return { total: reviews.length, avgStars, positive, negative }
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

  const inkoutReviews = useMemo(() => reviews.filter(r => r.brand_name === 'inkOUT'), [reviews])
  const competitorReviews = useMemo(() => reviews.filter(r => r.brand_name !== 'inkOUT'), [reviews])

  const inkout = useMemo(() => computeGroupStats(inkoutReviews), [inkoutReviews])
  const competitor = useMemo(() => computeGroupStats(competitorReviews), [competitorReviews])

  const inkoutLocations = useMemo(
    () => new Set(inkoutReviews.map(r => `${r.location_city}|${r.location_state}`)).size,
    [inkoutReviews]
  )
  const competitorProviders = useMemo(
    () => new Set(competitorReviews.map(r => r.provider_name)).size,
    [competitorReviews]
  )

  const v = (n: number | string) => loading ? '…' : String(n)

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'rank' ? 'asc' : 'desc')
    }
  }

  const sorted = [...PROVIDERS].sort((a, b) => {
    const va = a[sortKey]
    const vb = b[sortKey]
    return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number)
  })

  function SortTh({ k, children }: { k: SortKey; children: React.ReactNode }) {
    const active = sortKey === k
    return (
      <th
        className="sort-th"
        onClick={() => toggleSort(k)}
        style={{ color: active ? 'var(--text)' : undefined }}
      >
        {children}
        <span className={active ? 'sort-icon' : 'sort-icon-inactive'}>
          {active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
        </span>
      </th>
    )
  }

  return (
    <div className="hub-main">
      <Topbar title="All Markets — Overview" crumbs={[{ label: 'Overview' }]} />

      <div className="container">
        <div className="disclosure">
          <strong>Data Disclosure:</strong> This dataset contains <strong>848 reviews</strong> scraped from Google Maps on <strong>April 2, 2026</strong> (up to 50 per location, most recent first).
          All dates are <strong>estimated</strong> from relative timestamps (e.g. &quot;8 months ago&quot;) and carry month-level accuracy only, not verified calendar dates.
          <strong>79 inkOUT reviews</strong> are flagged as transition-era: they were left on listings that previously operated as Tatt2Away.
          <strong>110 reviews</strong> contain no written text (rating only) and are excluded from text analysis.
          Removery operates 3 locations in this dataset (150 total reviews). inkOUT operates 5 locations (149 total reviews). Compare at location level for fair analysis.
        </div>

        <div className="kpi-row">
          <div className="kpi"><div className="label">Total Reviews</div><div className="value">{v(reviews.length)}</div><div className="sub">across all providers</div></div>
          <div className="kpi"><div className="label">Providers</div><div className="value">{v(competitorProviders + (inkoutLocations > 0 ? 1 : 0))}</div><div className="sub">across 6 markets</div></div>
          <div className="kpi"><div className="label">inkOUT Positive</div><div className="value" style={{ color: 'var(--green)' }}>{v(`${inkout.positive}%`)}</div><div className="sub">vs competitor {v(`${competitor.positive}%`)}</div></div>
          <div className="kpi"><div className="label">inkOUT Avg Stars</div><div className="value">{v(`${inkout.avgStars}★`)}</div><div className="sub">vs competitor {v(`${competitor.avgStars}★`)}</div></div>
        </div>

        <div className="section">
          <h2>All Providers Ranked <span style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 400 }}>— click any column to sort</span></h2>
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
                      <Link href={`/competitor/${p.slug}`} style={{ color: p.isInkout ? '#a78bfa' : '#fff' }}>
                        {p.provider}
                      </Link>
                      {p.isInkout && <span className="badge badge-purple" style={{ marginLeft: 6 }}>inkOUT</span>}
                    </td>
                    <td style={{ color: 'var(--muted)' }}>{p.city}</td>
                    <td><span className="badge badge-gray">{p.method}</span></td>
                    <td>
                      <Link href={`/competitor/${p.slug}`} style={{ color: 'var(--blue)' }}>{p.reviews}</Link>
                    </td>
                    <td className="stars">{starStr(p.stars)}</td>
                    <td>{sentBadge(p.positive)}</td>
                    <td>{negBadge(p.negative)}</td>
                    <td>{p.pain}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
          <OverviewCharts />
        </div>

        <div className="review-footer">
          Source: Google Maps, scraped April 2, 2026. Dates estimated from relative timestamps. Sample of up to 50 reviews per location. Not a complete review history.
        </div>
      </div>
    </div>
  )
}
