'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getCityData } from '@/lib/data'
import CityCharts from '@/components/CityCharts'
import type { CityData } from '@/lib/types'

const CITIES = ['austin-tx', 'chicago-il', 'draper-ut', 'houston-tx', 'pleasant-grove-ut', 'tampa-fl']
const CITY_LABELS: Record<string, string> = {
  'austin-tx': 'Austin, TX', 'chicago-il': 'Chicago, IL', 'draper-ut': 'Draper, UT',
  'houston-tx': 'Houston, TX', 'pleasant-grove-ut': 'Pleasant Grove, UT', 'tampa-fl': 'Tampa, FL',
}

function starStr(n: number) {
  return '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n)) + ' ' + n.toFixed(1)
}
function sentBadge(p: number) {
  const cls = p >= 85 ? 'badge-green' : p >= 65 ? 'badge-yellow' : 'badge-red'
  return <span className={`badge ${cls}`}>{p}%</span>
}
function negBadge(p: number) {
  const cls = p === 0 ? 'badge-green' : p <= 10 ? 'badge-yellow' : 'badge-red'
  return <span className={`badge ${cls}`}>{p}%</span>
}
function shortName(b: string) {
  return b.replace('Tattoo Removal & Fading', '').replace('Tattoo Removal', '')
    .replace('Laser Clinic', '').replace('Medical Aesthetics', 'Med Aesthetics')
    .replace('Med Spa & Hair Restoration', 'Med Spa').replace('Cosmetic Center', 'Cosmetics')
    .replace('(Aesthetica)', '').trim()
}
function pctBar(p: number, color: string) {
  return (
    <div className="bar-row">
      <div className="bar-bg"><div className="bar-fill" style={{ width: `${p}%`, background: color }} /></div>
      <span className="bar-label">{p}%</span>
    </div>
  )
}

export default function CityPageClient({ slug }: { slug: string }) {
  const [data, setData] = useState<CityData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCityData(slug).then(d => {
      setData(d)
      setLoading(false)
    })
  }, [slug])

  if (loading) {
    return (
      <>
        <header>
          <div>
            <div className="meta" style={{ marginBottom: 4 }}>ReviewIntel · City Report</div>
            <h1>Loading…</h1>
          </div>
          <nav className="nav">
            {CITIES.map(s => (
              <Link key={s} href={`/city/${s}/`} className={s === slug ? 'active' : ''}>{CITY_LABELS[s]}</Link>
            ))}
            <Link href="/overview/">← Overview</Link>
          </nav>
        </header>
        <div style={{ padding: 40, color: 'var(--muted)', textAlign: 'center' }}>Loading city data…</div>
      </>
    )
  }

  if (!data) {
    return <div style={{ padding: 40, color: 'var(--muted)' }}>City not found.</div>
  }

  const { cityKey, businesses: biz } = data
  const best = biz.reduce((a, b) => a.avg_stars > b.avg_stars ? a : b)
  const worst = biz.reduce((a, b) => a.result_pct.negative > b.result_pct.negative ? a : b)
  const marketAvg = (biz.reduce((s, b) => s + b.avg_stars, 0) / biz.length).toFixed(1)

  return (
    <>
      <header>
        <div>
          <div className="meta" style={{ marginBottom: 4 }}>ReviewIntel · City Report</div>
          <h1><span>{cityKey}</span> — Competitor Analysis</h1>
        </div>
        <nav className="nav">
          {CITIES.map(s => (
            <Link key={s} href={`/city/${s}/`} className={s === slug ? 'active' : ''}>{CITY_LABELS[s]}</Link>
          ))}
          <Link href="/overview/">← Overview</Link>
        </nav>
      </header>

      <div className="container">
        <div className="kpi-row">
          <div className="kpi"><div className="label">Competitors Analyzed</div><div className="value" style={{ fontSize: 20 }}>{biz.length}</div><div className="sub">{cityKey}</div></div>
          <div className="kpi"><div className="label">Market Avg Rating</div><div className="value" style={{ fontSize: 20 }}>{marketAvg}★</div><div className="sub">across all providers</div></div>
          <div className="kpi"><div className="label">Top Rated</div><div className="value" style={{ fontSize: 20 }}>{shortName(best.provider)}</div><div className="sub">{best.avg_stars}★</div></div>
          <div className="kpi"><div className="label">Most Negative</div><div className="value" style={{ fontSize: 20 }}>{shortName(worst.provider)}</div><div className="sub">{worst.result_pct.negative}% negative results</div></div>
        </div>

        <div className="section">
          <h2>Competitor Rankings — {cityKey}</h2>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table>
              <thead>
                <tr>
                  <th>Provider</th><th>Reviews</th><th>Avg Stars</th>
                  <th>Positive Results</th><th>Negative Results</th>
                  <th>Pain Mentions</th><th>Scarring</th><th>Method</th>
                </tr>
              </thead>
              <tbody>
                {biz.map(b => (
                  <tr key={b.slug}>
                    <td style={{ fontWeight: 600, color: '#fff' }}>
                      <Link href={`/competitor/${b.slug}/`} style={{ color: b.isInkout ? '#a78bfa' : '#fff' }}>
                        {b.provider}
                      </Link>
                    </td>
                    <td>{b.total}</td>
                    <td className="stars">{starStr(b.avg_stars)}</td>
                    <td>{sentBadge(b.result_pct.positive)}</td>
                    <td>{negBadge(b.result_pct.negative)}</td>
                    <td>{pctBar(b.pain_pct, '#f59e0b')}</td>
                    <td>{pctBar(b.scarring_pct, '#ef4444')}</td>
                    <td><span className="badge badge-purple">{b.method || '—'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="section">
          <h2>Ratings Comparison</h2>
          <CityCharts businesses={biz} />
        </div>

        <div className="section">
          <h2>Business Cards</h2>
          <div className="grid-3">
            {biz.map(b => (
              <Link key={b.slug} href={`/competitor/${b.slug}/`} className="card" style={{ display: 'block', textDecoration: 'none' }}>
                <div style={{ fontWeight: 700, color: '#fff', fontSize: 15, marginBottom: 4 }}>{shortName(b.provider)}</div>
                <div className="stars" style={{ marginBottom: 10 }}>{starStr(b.avg_stars)} <span style={{ color: 'var(--muted)', fontSize: 12 }}>({b.total} reviews)</span></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: 12 }}>
                  <div><div style={{ color: 'var(--muted)', fontSize: 11, marginBottom: 2 }}>Positive Results</div>{sentBadge(b.result_pct.positive)}</div>
                  <div><div style={{ color: 'var(--muted)', fontSize: 11, marginBottom: 2 }}>Negative Results</div>{negBadge(b.result_pct.negative)}</div>
                  <div><div style={{ color: 'var(--muted)', fontSize: 11, marginBottom: 2 }}>Pain Mentions</div><strong>{b.pain_pct}%</strong></div>
                  <div><div style={{ color: 'var(--muted)', fontSize: 11, marginBottom: 2 }}>Scarring</div><strong>{b.scarring_pct}%</strong></div>
                </div>
                <div style={{ color: 'var(--muted)', fontSize: 11 }}>Method: <span className="badge badge-gray">{b.method || '—'}</span></div>
              </Link>
            ))}
          </div>
        </div>

        <div className="review-footer">
          Source: Google Maps, scraped April 2, 2026. Sample of up to 50 reviews per location.
        </div>
      </div>
    </>
  )
}
