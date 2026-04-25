'use client'

import { useEffect, useState } from 'react'
import { getTatt2awayReviews } from '@/lib/data'
import Topbar from '@/components/Topbar'
import { ReviewCard, KpiBlock, LoadingBlock, EmptyState } from '@/components/ui'
import type { Review } from '@/lib/types'

function cityLabel(r: Review) {
  return `${r.location_city}, ${r.location_state}`
}

export default function Tatt2awayReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [cityFilter, setCityFilter] = useState('all')
  const [starFilter, setStarFilter] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    getTatt2awayReviews().then(data => {
      setReviews(data)
      setLoading(false)
    })
  }, [])

  const cities = Array.from(new Set(reviews.map(cityLabel))).sort()

  const filtered = reviews.filter(r => {
    if (cityFilter !== 'all' && cityLabel(r) !== cityFilter) return false
    if (starFilter !== 'all' && String(r.star_rating) !== starFilter) return false
    if (search && !r.review_text?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + (r.star_rating || 0), 0) / reviews.length).toFixed(1)
    : '—'

  return (
    <div className="hub-main">
      <Topbar
        title="Tatt2Away Reviews"
        crumbs={[{ label: 'Reviews', href: '/reviews' }, { label: 'Tatt2Away' }]}
      />

      {loading ? (
        <LoadingBlock message="Loading reviews…" />
      ) : (
        <div style={{ padding: '24px 32px' }}>

          <div style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 8, padding: '12px 16px', marginBottom: 24, fontSize: 13, color: 'var(--muted)' }}>
            These are pre-rebrand Tatt2Away reviews collected before inkOUT took over the listings. They are archived for reference and excluded from current competitor metrics.
          </div>

          {/* Stats bar */}
          <div style={{ display: 'flex', gap: 32, marginBottom: 24, flexWrap: 'wrap' }}>
            <KpiBlock label="Total reviews" value={reviews.length} size="sm" valueStyle={{ color: 'var(--accent)' }} />
            <KpiBlock label="Avg rating" value={`${avgRating}★`} size="sm" valueStyle={{ color: 'var(--green)' }} />
            <KpiBlock label="4–5 star" value={reviews.filter(r => r.star_rating >= 4).length} size="sm" valueStyle={{ color: 'var(--blue)' }} />
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <input
              placeholder="Search review text…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                background: 'var(--card)', border: '1px solid var(--border)',
                color: 'var(--text)', padding: '8px 12px', borderRadius: 6,
                fontSize: 13, minWidth: 220,
              }}
            />
            <select
              value={cityFilter}
              onChange={e => setCityFilter(e.target.value)}
              style={{
                background: 'var(--card)', border: '1px solid var(--border)',
                color: 'var(--text)', padding: '8px 12px', borderRadius: 6, fontSize: 13,
              }}
            >
              <option value="all">All cities</option>
              {cities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              value={starFilter}
              onChange={e => setStarFilter(e.target.value)}
              style={{
                background: 'var(--card)', border: '1px solid var(--border)',
                color: 'var(--text)', padding: '8px 12px', borderRadius: 6, fontSize: 13,
              }}
            >
              <option value="all">All ratings</option>
              {[5, 4, 3, 2, 1].map(n => <option key={n} value={String(n)}>{n} star</option>)}
            </select>
          </div>

          <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 16 }}>
            Showing {filtered.length} of {reviews.length} reviews
          </div>

          {filtered.length === 0
            ? <EmptyState message="No reviews match your filters." />
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {filtered.map((r, i) => (
                  <ReviewCard key={i} review={r} variant="tatt2away" showSourceLink />
                ))}
              </div>
          }
        </div>
      )}
    </div>
  )
}
