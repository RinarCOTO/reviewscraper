'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getCompetitorReviews, getCityData, SCRAPER_CAP } from '@/lib/data'
import CompetitorCharts from '@/components/CompetitorCharts'
import ReviewList from '@/components/ReviewList'
import Topbar from '@/components/Topbar'
import { getCityForCompetitor } from '@/lib/config'
import type { Review, CityData, BusinessSummary } from '@/lib/types'

function fmtDateRange(earliest: string, latest: string): string {
  const opts = { month: 'short', day: 'numeric' } as const
  const d1 = new Date(earliest)
  const d2 = new Date(latest)
  const s1 = d1.toLocaleDateString('en-US', opts)
  const s2 = d2.toLocaleDateString('en-US', { ...opts, year: 'numeric' })
  return d1.getFullYear() === d2.getFullYear() ? `${s1} – ${s2}` : `${d1.toLocaleDateString('en-US', { ...opts, year: 'numeric' })} – ${s2}`
}

function computeStats(reviews: Review[]) {
  const total = reviews.length
  if (total === 0) return null
  const avgStars = parseFloat((reviews.reduce((s, r) => s + r.star_rating, 0) / total).toFixed(1))
  const withText = reviews.filter(r => r.has_text)
  const textTotal = withText.length || 1
  const resultCounts = { positive: 0, negative: 0, mixed: 0, neutral: 0, unknown: 0 }
  withText.forEach(r => {
    const k = (r.result_rating || 'unknown').toLowerCase() as keyof typeof resultCounts
    if (k in resultCounts) resultCounts[k]++
  })
  const ratingDist = [1, 2, 3, 4, 5].map(s => reviews.filter(r => r.star_rating === s).length)
  const painLevels = [1, 2, 3, 4, 5].map(p => reviews.filter(r => r.pain_level === p).length)
  const sessionsArr = reviews.filter(r => r.sessions_completed !== 'unknown' && r.sessions_completed).map(r => r.sessions_completed as number)
  const avgSessions = sessionsArr.length ? parseFloat((sessionsArr.reduce((a, b) => a + b, 0) / sessionsArr.length).toFixed(1)) : 0
  const useCaseMap: Record<string, number> = {}
  reviews.forEach(r => {
    const uc = r.use_case || 'unknown'
    if (uc !== 'unknown') useCaseMap[uc] = (useCaseMap[uc] || 0) + 1
  })
  const dated = reviews.filter(r => r.review_date_iso).map(r => r.review_date_iso).sort()
  const dateRange = dated.length ? { earliest: dated[0], latest: dated[dated.length - 1] } : null
  return {
    total, avgStars,
    positive: Math.round((resultCounts.positive / textTotal) * 100),
    negative: Math.round((resultCounts.negative / textTotal) * 100),
    ratingDist, painLevels,
    resultPcts: [
      Math.round((resultCounts.positive / textTotal) * 100),
      Math.round((resultCounts.neutral  / textTotal) * 100),
      Math.round((resultCounts.mixed    / textTotal) * 100),
      Math.round((resultCounts.negative / textTotal) * 100),
      Math.round((resultCounts.unknown  / textTotal) * 100),
    ],
    avgSessions, useCaseMap,
    dateRange,
    isCapped: total >= SCRAPER_CAP,
    method: reviews[0]?.method_used || '—',
    provider: reviews[0]?.provider_name || '',
    isInkout: reviews[0]?.brand_name === 'inkOUT',
  }
}

function dotColor(avgStars: number) {
  if (avgStars >= 4.8) return '#22c55e'
  if (avgStars >= 4.5) return '#3b82f6'
  if (avgStars >= 4.0) return '#f59e0b'
  return '#ef4444'
}

export default function CompetitorPageClient({ slug }: { slug: string }) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [cityData, setCityData] = useState<CityData | null>(null)
  const [loading, setLoading] = useState(true)

  const cityConfig = getCityForCompetitor(slug)
  const cityLabel = cityConfig?.label ?? ''
  const citySlugStr = cityConfig?.slug ?? ''

  useEffect(() => {
    Promise.all([
      getCompetitorReviews(slug),
      citySlugStr ? getCityData(citySlugStr) : Promise.resolve(null),
    ]).then(([rev, city]) => {
      setReviews(rev)
      setCityData(city)
      setLoading(false)
    })
  }, [slug, citySlugStr])

  if (loading) {
    return (
      <div className="hub-main">
        <Topbar
          title="Competitor Deep-Dive"
          crumbs={cityConfig
            ? [{ label: cityConfig.label, href: `/city/${cityConfig.slug}` }, { label: 'Loading…' }]
            : [{ label: 'Loading…' }]
          }
        />
        <div style={{ padding: 40, color: 'var(--muted)', textAlign: 'center' }}>Loading competitor data…</div>
      </div>
    )
  }

  // Exclude confirmed off-topic reviews from metrics; show all in the list
  const removalReviews = reviews.filter(r => r.is_tattoo_removal !== false)
  const stats = computeStats(removalReviews)
  if (!stats) {
    return <div className="hub-main" style={{ padding: 40, color: 'var(--muted)' }}>No reviews found for this competitor.</div>
  }

  // Live peer rankings from city data (sorted by avg_stars desc)
  const peers: BusinessSummary[] = cityData
    ? [...cityData.businesses].sort((a, b) => b.avg_stars - a.avg_stars)
    : []
  const marketRank = peers.findIndex(b => b.slug === slug) + 1 || null

  return (
    <div className="hub-main">
      <Topbar
        title={`${stats.provider} — ${cityLabel}`}
        crumbs={[
          { label: cityLabel, href: `/city/${citySlugStr}` },
          { label: stats.provider },
        ]}
      />

      {/* Peer strip — live stars and rank from Supabase */}
      {peers.length > 1 && (
        <div className="peer-strip">
          {peers.map((b, i) => (
            <Link
              key={b.slug}
              href={`/competitor/${b.slug}`}
              className={`peer-card${b.slug === slug ? ' peer-current' : ''}${b.isInkout ? ' peer-inkout' : ''}`}
            >
              <div className="peer-dot" style={{ background: dotColor(b.avg_stars) }} />
              <span>#{i + 1} {b.provider}</span>
              <span className="peer-stars">{b.avg_stars}★</span>
            </Link>
          ))}
        </div>
      )}

      <div className="container">
        <div className="disclosure">
          <strong>Data Disclosure:</strong> Reviews scraped from Google Maps on April 2, 2026 (up to 50 per location).
          Dates verified from SerpAPI timestamps. Reviews without written text are excluded from text analysis.
        </div>

        <div className="kpi-row">
          <div className="kpi">
            <div className="label">Total Reviews</div>
            <div className="value">{stats.total}{stats.isCapped && <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--muted)', marginLeft: 4 }}>(most recent)</span>}</div>
            <div className="sub">
              {stats.dateRange
                ? fmtDateRange(stats.dateRange.earliest, stats.dateRange.latest)
                : `Google · ${cityLabel}`}
            </div>
          </div>
          <div className="kpi">
            <div className="label">Avg Rating</div>
            <div className="value">{stats.avgStars}★</div>
            <div className="sub">out of 5 · Google · {cityLabel}</div>
          </div>
          <div className="kpi">
            <div className="label">Positive Results</div>
            <div className="value" style={{ color: 'var(--green)' }}>{stats.positive}%</div>
            <div className="sub">{stats.negative}% negative</div>
          </div>
          <div className="kpi">
            <div className="label">Market Rank</div>
            <div className="value" style={{ fontSize: 20, color: stats.isInkout ? '#a78bfa' : '#fff' }}>
              {marketRank ? `#${marketRank}` : '—'}
              {peers.length > 0 && (
                <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--muted)' }}> of {peers.length}</span>
              )}
            </div>
            <div className="sub">{stats.method} · {stats.avgSessions} avg sessions</div>
          </div>
        </div>

        <div className="section">
          <h2>Performance Overview</h2>
          <CompetitorCharts
            ratingDist={stats.ratingDist}
            resultPcts={stats.resultPcts}
            painLevels={stats.painLevels}
            useCaseMap={stats.useCaseMap}
          />
        </div>

        <div className="section">
          <h2>All Reviews <span style={{ color: 'var(--muted)', fontSize: 13, fontWeight: 400 }}>({stats.total})</span></h2>
          <ReviewList reviews={removalReviews} />
        </div>

        <div className="review-footer">
          Source: Google Maps, scraped April 2, 2026. Sample of up to 50 reviews per location.
        </div>
      </div>
    </div>
  )
}
