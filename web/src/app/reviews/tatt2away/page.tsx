'use client'

import { useEffect, useState } from 'react'
import { getTatt2awayReviews } from '@/lib/data'
import Topbar from '@/components/Topbar'
import type { Review } from '@/lib/types'

function stars(n: number) {
  return '★'.repeat(n || 0) + '☆'.repeat(5 - (n || 0))
}

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
        <div style={{ padding: 40, color: 'var(--muted)', textAlign: 'center' }}>Loading reviews…</div>
      ) : (
        <div style={{ padding: '24px 32px' }}>

          <div style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 8, padding: '12px 16px', marginBottom: 24, fontSize: 13, color: 'var(--muted)' }}>
            These are pre-rebrand Tatt2Away reviews collected before inkOUT took over the listings. They are archived for reference and excluded from current competitor metrics.
          </div>

          {/* Stats bar */}
          <div style={{ display: 'flex', gap: 32, marginBottom: 24, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)' }}>{reviews.length}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Total reviews</div>
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--green)' }}>{avgRating}</div>
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
                    <span style={{ fontSize: 11, marginLeft: 8, padding: '2px 7px', borderRadius: 4, background: 'rgba(239,68,68,.1)', color: '#ef4444' }}>
                      Tatt2Away era
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ color: '#f59e0b', fontSize: 13 }}>{stars(r.star_rating)}</span>
                    <span style={{ color: 'var(--muted)', fontSize: 11 }}>{r.review_date}</span>
                  </div>
                </div>
                {r.review_text ? (
                  <p style={{ color: 'var(--text)', fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                    {r.review_text}
                  </p>
                ) : (
                  <p style={{ color: 'var(--muted)', fontSize: 13, fontStyle: 'italic', margin: 0 }}>
                    Rating only — no written review
                  </p>
                )}
                {r.source_url && (
                  <div style={{ marginTop: 8 }}>
                    <a
                      href={r.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 11, color: 'var(--muted)', textDecoration: 'none', opacity: 0.7 }}
                      title="View original review on Google Maps"
                    >
                      ↗ View on Google
                    </a>
                  </div>
                )}
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
