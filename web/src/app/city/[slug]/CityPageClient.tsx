'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getCityData, getLastUpdatedAt } from '@/lib/data'
import CityCharts from '@/components/CityCharts'
import Topbar from '@/components/Topbar'
import { KpiBlock, LoadingBlock, StarRating, SentimentBreakdown } from '@/components/ui'
import { CITIES as ALL_CITIES } from '@/lib/config'
import type { CityData } from '@/lib/types'

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

const CityNav = ({ slug }: { slug: string }) => (
  <nav className="nav">
    {ALL_CITIES.map(c => (
      <Link key={c.slug} href={`/city/${c.slug}/`} className={c.slug === slug ? 'active' : ''}>{c.label}</Link>
    ))}
  </nav>
)

export default function CityPageClient({ slug }: { slug: string }) {
  const [data, setData] = useState<CityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getCityData(slug), getLastUpdatedAt()]).then(([d, freshness]) => {
      setData(d)
      setLastUpdated(freshness.date)
      setLoading(false)
    })
  }, [slug])

  if (loading) {
    return (
      <div className="hub-main">
        <Topbar
          title="City Report"
          crumbs={[{ label: 'Loading…' }]}
          actions={<CityNav slug={slug} />}
        />
        <LoadingBlock message="Loading city data…" />
      </div>
    )
  }

  if (!data) {
    return <div className="hub-main" style={{ padding: 40, color: 'var(--muted)' }}>City not found.</div>
  }

  const { cityKey, businesses: biz } = data
  const sorted = [...biz].sort((a, b) => b.avg_stars - a.avg_stars)
  const best = sorted[0]
  const worst = biz.reduce((a, b) => a.result_pct.negative > b.result_pct.negative ? a : b)
  const marketAvg = (biz.reduce((s, b) => s + b.avg_stars, 0) / biz.length).toFixed(1)
  const inkoutEntry = biz.find(b => b.isInkout)
  const inkoutRank = inkoutEntry ? sorted.indexOf(inkoutEntry) + 1 : null

  return (
    <div className="hub-main">
      <Topbar
        title={`${cityKey} — Competitor Analysis`}
        crumbs={[{ label: cityKey }]}
        actions={<CityNav slug={slug} />}
      />

      <div className="container">
        <div className="kpi-row">
          <KpiBlock label="Competitors Analyzed" value={biz.length} sub={cityKey} />
          <KpiBlock label="Market Avg Rating" value={`${marketAvg}★`} sub="across all providers" />
          <KpiBlock label="Top Rated" value={shortName(best.provider)} sub={`${best.avg_stars}★`} />
          {inkoutEntry
            ? <KpiBlock label="inkOUT Position" value={<>#{inkoutRank} <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--muted)' }}>of {biz.length}</span></>} sub={`${inkoutEntry.avg_stars}★ · ${inkoutEntry.result_pct.positive}% positive`} valueStyle={{ color: 'var(--purple-brand)' }} />
            : <KpiBlock label="Most Negative" value={shortName(worst.provider)} sub={`${worst.result_pct.negative}% negative results`} />
          }
        </div>

        <div className="section">
          <h2>Competitor Rankings — {cityKey}</h2>
          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Provider</th>
                  <th>Reviews</th>
                  <th>Avg Stars</th>
                  <th>Positive Results</th>
                  <th>Negative Results</th>
                  <th>Pain Mentions</th>
                  <th>Scarring</th>
                  <th>Method</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((b, i) => (
                  <tr key={b.slug} className={b.isInkout ? 'inkout-row' : ''}>
                    <td style={{ color: 'var(--muted)', fontWeight: 600 }}>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>
                      <Link href={`/competitor/${b.slug}/`} style={{ color: b.isInkout ? 'var(--purple-brand)' : '#fff' }}>
                        {b.provider}
                      </Link>
                      {b.isInkout && <span className="badge badge-purple" style={{ marginLeft: 6 }}>inkOUT</span>}
                    </td>
                    <td>
                      {b.total}
                      {b.dateRange?.isCapped && <span style={{ color: 'var(--muted)', fontSize: 10, marginLeft: 3 }}>(cap)</span>}
                    </td>
                    <td className="stars">
                      <StarRating value={b.avg_stars} showValue />
                      {b.dateRange && <div style={{ color: 'var(--muted)', fontSize: 10, fontWeight: 400, marginTop: 2 }}>{fmtDateRange(b.dateRange.earliest, b.dateRange.latest)}</div>}
                    </td>
                    <td>{sentBadge(b.result_pct.positive)}</td>
                    <td>{negBadge(b.result_pct.negative)}</td>
                    <td>{pctBar(b.pain_pct, 'var(--yellow)')}</td>
                    <td>{pctBar(b.scarring_pct, 'var(--red)')}</td>
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
            {sorted.map((b, i) => (
              <Link key={b.slug} href={`/competitor/${b.slug}/`} className={`card biz-card${b.isInkout ? ' biz-card-inkout' : ''}`} style={{ display: 'block', textDecoration: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={{ fontWeight: 700, color: b.isInkout ? 'var(--purple-brand)' : '#fff', fontSize: 15 }}>{shortName(b.provider)}</div>
                  <span style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 600 }}>#{i + 1}</span>
                </div>
                <div className="stars" style={{ marginBottom: 2 }}><StarRating value={b.avg_stars} showValue /></div>
                <div style={{ color: 'var(--muted)', fontSize: 11, marginBottom: 10 }}>
                  {b.total} reviews{b.dateRange?.isCapped ? ' (most recent)' : ''}
                  {b.dateRange && ` · ${fmtDateRange(b.dateRange.earliest, b.dateRange.latest)}`}
                </div>
                {b.ratingBreakdown && (
                  <div style={{ marginBottom: 10 }}>
                    <SentimentBreakdown positive={b.ratingBreakdown.positive} mixed={b.ratingBreakdown.mixed} negative={b.ratingBreakdown.negative} />
                  </div>
                )}
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
          Source: Google Maps{lastUpdated ? `, scraped ${new Date(lastUpdated).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}` : ''}. Sample of up to 50 reviews per location.
        </div>
      </div>
    </div>
  )
}
