'use client'

import { useEffect, useState } from 'react'
import { getInkoutReviews } from '@/lib/data'
import Topbar from '@/components/Topbar'
import type { Review } from '@/lib/types'

function stars(n: number) {
  return '★'.repeat(n || 0) + '☆'.repeat(5 - (n || 0))
}

function cityLabel(r: Review) {
  return `${r.location_city}, ${r.location_state}`
}

export default function InkoutReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [cityFilter, setCityFilter] = useState('all')
  const [starFilter, setStarFilter] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    getInkoutReviews().then(data => {
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

  return (
    <div className="hub-main">
      <Topbar
        title="inkOUT Reviews"
        crumbs={[{ label: 'Reviews', href: '/reviews' }, { label: 'inkOUT' }]}
      />

      {loading ? (
        <div style={{ padding: 40, color: 'var(--muted)', textAlign: 'center' }}>Loading reviews…</div>
      ) : (
        <div style={{ padding: '24px 32px' }}>

          {/* Stats bar */}
          <div style={{ display: 'flex', gap: 32, marginBottom: 24, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)' }}>{reviews.length}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Total reviews</div>
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--green)' }}>
                {reviews.length ? (reviews.reduce((s, r) => s + (r.star_rating || 0), 0) / reviews.length).toFixed(1) : '—'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Avg rating</div>
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--blue)' }}>
                {reviews.filter(r => r.star_rating >= 4).length}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>4–5 star</div>
            </div>
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

          {/* Review cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map((r, i) => (
              <div
                key={i}
                style={{
                  background: 'var(--card)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '16px 20px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: 14 }}>{r.reviewer_name}</span>
                    <span style={{ color: 'var(--muted)', fontSize: 12, marginLeft: 8 }}>{cityLabel(r)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ color: '#f59e0b', fontSize: 13 }}>{stars(r.star_rating)}</span>
                    <span style={{ color: 'var(--muted)', fontSize: 11 }}>{r.review_date}</span>
                  </div>
                </div>
                <p style={{ color: 'var(--text)', fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                  {r.review_text}
                </p>
              </div>
            ))}
          </div>

          {filtered.length === 0 && (
            <div style={{ color: 'var(--muted)', textAlign: 'center', padding: 40 }}>No reviews match your filters.</div>
          )}
        </div>
      )}
    </div>
  )
}
