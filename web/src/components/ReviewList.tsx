'use client'

import { useState } from 'react'
import type { Review } from '@/lib/types'
import { ReviewCard, EmptyState } from '@/components/ui'

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
        {filtered.length === 0
          ? <EmptyState message="No reviews match your filters." />
          : filtered.map((r, i) => <ReviewCard key={i} review={r} showSourceLink />)
        }
      </div>
    </>
  )
}
