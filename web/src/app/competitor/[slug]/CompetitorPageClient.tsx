'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getCompetitorReviews } from '@/lib/data'
import CompetitorCharts from '@/components/CompetitorCharts'
import ReviewList from '@/components/ReviewList'
import type { Review } from '@/lib/types'

function slugToCity(slug: string): string {
  if (slug.endsWith('-chicago-il')) return 'Chicago, IL'
  if (slug.endsWith('-austin-tx')) return 'Austin, TX'
  if (slug.endsWith('-houston-tx')) return 'Houston, TX'
  if (slug.endsWith('-draper-ut')) return 'Draper, UT'
  if (slug.endsWith('-tampa-fl')) return 'Tampa, FL'
  if (slug.endsWith('-pleasant-grove-ut')) return 'Pleasant Grove, UT'
  return ''
}
function citySlug(competitorSlug: string): string {
  if (competitorSlug.endsWith('-chicago-il')) return 'chicago-il'
  if (competitorSlug.endsWith('-austin-tx')) return 'austin-tx'
  if (competitorSlug.endsWith('-houston-tx')) return 'houston-tx'
  if (competitorSlug.endsWith('-draper-ut')) return 'draper-ut'
  if (competitorSlug.endsWith('-tampa-fl')) return 'tampa-fl'
  if (competitorSlug.endsWith('-pleasant-grove-ut')) return 'pleasant-grove-ut'
  return ''
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

  const city = slugToCity(slug)
  const cityLink = citySlug(slug)

  if (loading) {
    return (
      <>
        <header>
          <div>
            <div className="meta" style={{ marginBottom: 4 }}>ReviewIntel · Competitor Deep-Dive</div>
            <h1>Loading…</h1>
          </div>
          <nav className="nav">
            {cityLink && <Link href={`/city/${cityLink}/`}>← {city}</Link>}
            <Link href="/overview/">← Overview</Link>
          </nav>
        </header>
        <div style={{ padding: 40, color: 'var(--muted)', textAlign: 'center' }}>Loading competitor data…</div>
      </>
    )
  }

  const stats = computeStats(reviews)
  if (!stats) return <div style={{ padding: 40, color: 'var(--muted)' }}>No reviews found for this competitor.</div>

  return (
    <>
      <header>
        <div>
          <div className="meta" style={{ marginBottom: 4 }}>ReviewIntel · Competitor Deep-Dive</div>
          <h1><span>{stats.provider}</span> — {city}</h1>
        </div>
        <nav className="nav">
          {cityLink && <Link href={`/city/${cityLink}/`}>← {city}</Link>}
          <Link href="/overview/">← Overview</Link>
        </nav>
      </header>

      <div className="container">
        <div className="disclosure">
          <strong>Data Disclosure:</strong> Reviews scraped from Google Maps on April 2, 2026 (up to 50 per location).
          Dates verified from SerpAPI timestamps. 79 inkOUT reviews are flagged as transition-era. Reviews without written text are excluded from text analysis.
        </div>

        <div className="kpi-row">
          <div className="kpi"><div className="label">Total Reviews</div><div className="value">{stats.total}</div><div className="sub">Google · {city}</div></div>
          <div className="kpi"><div className="label">Avg Rating</div><div className="value">{stats.avgStars}★</div><div className="sub">out of 5</div></div>
          <div className="kpi"><div className="label">Positive Results</div><div className="value" style={{ color: 'var(--green)' }}>{stats.positive}%</div><div className="sub">{stats.negative}% negative</div></div>
          <div className="kpi"><div className="label">Method</div><div className="value" style={{ fontSize: 18 }}>{stats.method}</div><div className="sub">{stats.avgSessions} avg sessions</div></div>
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
    </>
  )
}
