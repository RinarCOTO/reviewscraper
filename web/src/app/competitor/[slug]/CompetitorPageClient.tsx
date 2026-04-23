'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getCompetitorReviews } from '@/lib/data'
import CompetitorCharts from '@/components/CompetitorCharts'
import ReviewList from '@/components/ReviewList'
import Topbar from '@/components/Topbar'
import { getCityForCompetitor } from '@/lib/config'
import type { Review } from '@/lib/types'

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
  return {
    total, avgStars,
    positive: Math.round((resultCounts.positive / textTotal) * 100),
    negative: Math.round((resultCounts.negative / textTotal) * 100),
    ratingDist, painLevels,
    resultPcts: [
      Math.round((resultCounts.positive / textTotal) * 100),
      Math.round((resultCounts.neutral / textTotal) * 100),
      Math.round((resultCounts.mixed / textTotal) * 100),
      Math.round((resultCounts.negative / textTotal) * 100),
      Math.round((resultCounts.unknown / textTotal) * 100),
    ],
    avgSessions, useCaseMap,
    method: reviews[0]?.method_used || '—',
    provider: reviews[0]?.provider_name || '',
    isInkout: reviews[0]?.brand_name === 'inkOUT',
  }
}

export default function CompetitorPageClient({ slug }: { slug: string }) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCompetitorReviews(slug).then(data => {
      setReviews(data)
      setLoading(false)
    })
  }, [slug])

  const cityConfig = getCityForCompetitor(slug)
  const cityLabel = cityConfig?.label ?? ''
  const citySlugStr = cityConfig?.slug ?? ''

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

  const stats = computeStats(reviews)
  if (!stats) {
    return <div className="hub-main" style={{ padding: 40, color: 'var(--muted)' }}>No reviews found for this competitor.</div>
  }

  // Market rank by avg stars among peers
  const peers = cityConfig?.competitors ?? []
  const marketRank = peers.findIndex(c => c.slug === slug) + 1

  return (
    <div className="hub-main">
      <Topbar
        title={`${stats.provider} — ${cityLabel}`}
        crumbs={[
          { label: cityLabel, href: `/city/${citySlugStr}` },
          { label: stats.provider },
        ]}
      />

      {/* Peer competitor strip */}
      {peers.length > 1 && (
        <div className="peer-strip">
          {peers.map((c, i) => (
            <Link
              key={c.slug}
              href={`/competitor/${c.slug}`}
              className={`peer-card${c.slug === slug ? ' peer-current' : ''}${c.isInkout ? ' peer-inkout' : ''}`}
            >
              <div className="peer-dot" style={{ background: c.dotColor }} />
              <span>#{i + 1} {c.name}</span>
              <span className="peer-stars">{c.stars}</span>
            </Link>
          ))}
        </div>
      )}

      <div className="container">
        <div className="disclosure">
          <strong>Data Disclosure:</strong> Reviews scraped from Google Maps on April 2, 2026 (up to 50 per location).
          Dates verified from SerpAPI timestamps. 79 inkOUT reviews are flagged as transition-era. Reviews without written text are excluded from text analysis.
        </div>

        <div className="kpi-row">
          <div className="kpi">
            <div className="label">Total Reviews</div>
            <div className="value">{stats.total}</div>
            <div className="sub">Google · {cityLabel}</div>
          </div>
          <div className="kpi">
            <div className="label">Avg Rating</div>
            <div className="value">{stats.avgStars}★</div>
            <div className="sub">out of 5</div>
          </div>
          <div className="kpi">
            <div className="label">Positive Results</div>
            <div className="value" style={{ color: 'var(--green)' }}>{stats.positive}%</div>
            <div className="sub">{stats.negative}% negative</div>
          </div>
          <div className="kpi">
            <div className="label">Market Rank</div>
            <div className="value" style={{ fontSize: 20, color: stats.isInkout ? '#a78bfa' : '#fff' }}>
              #{marketRank} <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--muted)' }}>of {peers.length}</span>
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
          <ReviewList reviews={reviews} />
        </div>

        <div className="review-footer">
          Source: Google Maps, scraped April 2, 2026. Sample of up to 50 reviews per location.
        </div>
      </div>
    </div>
  )
}
