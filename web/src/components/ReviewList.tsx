'use client'

import { useState } from 'react'
import type { Review } from '@/lib/types'

function resultColor(r: string) {
  if (r === 'Positive') return 'var(--green)'
  if (r === 'Negative') return 'var(--red)'
  if (r === 'Mixed') return 'var(--yellow)'
  if (r === 'Neutral') return 'var(--blue)'
  return '#374151'
}

function stars(n: number) {
  return '★'.repeat(n || 0) + '☆'.repeat(5 - (n || 0))
}

function shortDate(d: string) {
  return d ? d.replace(/^~/, '').split(' (')[0] : ''
}

function getDateCutoff(range: string): string | null {
  if (range === 'all') return null
  const d = new Date()
  if (range === '6mo') d.setMonth(d.getMonth() - 6)
  else if (range === '12mo') d.setFullYear(d.getFullYear() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function ReviewList({ reviews }: { reviews: Review[] }) {
  const [filterResult, setFilterResult] = useState('')
  const [filterStars, setFilterStars] = useState('')
  const [filterUsecase, setFilterUsecase] = useState('')
  const [filterTransition, setFilterTransition] = useState('')
  const [filterText, setFilterText] = useState('')
  const [filterSearch, setFilterSearch] = useState('')
  const [dateRange, setDateRange] = useState('all')
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)

  const cutoff = getDateCutoff(dateRange)

  const filtered = reviews.filter(r => {
    if (cutoff && r.review_date_estimated) {
      if (r.review_date_estimated.slice(0, 7) < cutoff) return false
    }
    return (
      (!filterResult || r.result_rating === filterResult) &&
      (!filterStars || Math.round(r.star_rating) === parseInt(filterStars)) &&
      (!filterUsecase || r.use_case === filterUsecase) &&
      (!filterTransition || (filterTransition === 'current' ? !r.location_transition : r.location_transition)) &&
      (!filterText || (filterText === 'text' ? r.has_text : !r.has_text)) &&
      (!filterSearch || (r.review_text || '').toLowerCase().includes(filterSearch.toLowerCase()) ||
        (r.reviewer_name || '').toLowerCase().includes(filterSearch.toLowerCase()))
    )
  })

  const hasActiveFilters = filterResult || filterStars || filterUsecase || filterTransition || filterText || filterSearch || dateRange !== 'all'

  function clearAll() {
    setFilterResult(''); setFilterStars(''); setFilterUsecase('')
    setFilterTransition(''); setFilterText(''); setFilterSearch(''); setDateRange('all')
  }

  function copyText(text: string, idx: number) {
    navigator.clipboard.writeText(text || '').then(() => {
      setCopiedIdx(idx)
      setTimeout(() => setCopiedIdx(null), 1500)
    })
  }

  return (
    <>
      <div className="filter-bar">
        <label>Filter:</label>
        <select value={filterResult} onChange={e => setFilterResult(e.target.value)}>
          <option value="">All Results</option>
          <option value="Positive">Positive</option>
          <option value="Neutral">Neutral</option>
          <option value="Mixed">Mixed</option>
          <option value="Negative">Negative</option>
        </select>
        <select value={filterStars} onChange={e => setFilterStars(e.target.value)}>
          <option value="">All Stars</option>
          <option value="5">5★</option>
          <option value="4">4★</option>
          <option value="3">3★</option>
          <option value="2">2★</option>
          <option value="1">1★</option>
        </select>
        <select value={filterUsecase} onChange={e => setFilterUsecase(e.target.value)}>
          <option value="">All Use Cases</option>
          <option value="Complete">Complete Removal</option>
          <option value="Cover-up">Cover-up</option>
          <option value="Microblading">Microblading</option>
          <option value="Color">Color Ink</option>
        </select>
        <select value={filterTransition} onChange={e => setFilterTransition(e.target.value)}>
          <option value="">All Reviews</option>
          <option value="current">Current-era only</option>
          <option value="transition">Transition-era only</option>
        </select>
        <select value={filterText} onChange={e => setFilterText(e.target.value)}>
          <option value="">All</option>
          <option value="text">With text only</option>
          <option value="notext">Rating only</option>
        </select>
        <select value={dateRange} onChange={e => setDateRange(e.target.value)}>
          <option value="all">All time</option>
          <option value="12mo">Last 12 months</option>
          <option value="6mo">Last 6 months</option>
        </select>
        <input
          type="text"
          placeholder="Search text…"
          value={filterSearch}
          onChange={e => setFilterSearch(e.target.value)}
          style={{
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 7, padding: '6px 10px', color: 'var(--text)',
            fontSize: 12, outline: 'none', width: 160,
          }}
        />
        {hasActiveFilters && (
          <button className="clear-btn" onClick={clearAll}>Clear</button>
        )}
        <span className="review-count">{filtered.length} of {reviews.length}</span>
      </div>

      <div>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
            No reviews match your filters.
          </div>
        )}
        {filtered.map((r, i) => (
          <div key={i} className="review-card">
            <button className="copy-btn" onClick={() => copyText(r.review_text || '', i)}>
              {copiedIdx === i ? 'Copied!' : 'Copy'}
            </button>
            <div className="top">
              <span className="author">{r.reviewer_name || 'Anonymous'}</span>
              <span className="date">{shortDate(r.review_date_estimated || r.review_date)}</span>
            </div>
            <div className="stars" style={{ marginBottom: 8 }}>{stars(r.star_rating)} {r.star_rating || '?'}★</div>
            {!r.has_text
              ? <div style={{ color: '#64748b', fontSize: 12, fontStyle: 'italic', marginBottom: 8 }}>Rating only — no written review</div>
              : <div className="text">{r.review_text}</div>
            }
            <div className="tags">
              {r.result_rating && r.result_rating !== 'unknown' && (
                <span className="badge" style={{ background: 'rgba(0,0,0,.3)', border: `1px solid ${resultColor(r.result_rating)}`, color: resultColor(r.result_rating) }}>
                  {r.result_rating}
                </span>
              )}
              {r.location_transition && (
                <span className="badge badge-transition" title="Left on a listing that previously operated as Tatt2Away">Transition-era</span>
              )}
              {r.pain_level !== 'unknown' && r.pain_level && (
                <span className="badge badge-yellow">Pain: {r.pain_level}/5</span>
              )}
              {r.sessions_completed !== 'unknown' && r.sessions_completed && (
                <span className="badge badge-blue">{r.sessions_completed} sessions</span>
              )}
              {r.use_case && r.use_case !== 'unknown' && (
                <span className="badge badge-purple">{r.use_case}</span>
              )}
              {r.scarring_mentioned === 'Yes' && <span className="badge badge-red">Scarring</span>}
              {r.scarring_mentioned === 'Positive' && <span className="badge badge-green">Healed well</span>}
              {r.is_tattoo_removal === false && <span className="badge badge-gray" title="Not a tattoo removal review — excluded from metrics">Other service</span>}
              {r.source_url && (
                <a
                  href={r.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="badge badge-gray"
                  style={{ textDecoration: 'none', opacity: 0.7 }}
                  title="View original review on Google Maps"
                >
                  ↗ Google
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
