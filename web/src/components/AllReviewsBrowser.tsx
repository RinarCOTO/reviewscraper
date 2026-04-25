'use client'

import { useState } from 'react'
import type { Review } from '@/lib/types'
import { ReviewCard, EmptyState } from '@/components/ui'
import { CITIES as CITY_CONFIG } from '@/lib/config'
import { CITY_SLUG_MAP } from '@/lib/data'

const PROVIDER_SLUGS: Record<string, string> = Object.fromEntries(
  CITY_CONFIG.flatMap(c => c.competitors.map(comp => [comp.name, comp.slug]))
)

const CITIES = CITY_CONFIG.map(c => {
  const loc = CITY_SLUG_MAP[c.slug]
  return `${loc.city}, ${loc.state}`
})

const PROVIDERS = [...new Set(CITY_CONFIG.flatMap(c => c.competitors.map(comp => comp.name)))]

function getDateCutoff(range: string): string | null {
  if (range === 'all') return null
  const d = new Date()
  if (range === '6mo') d.setMonth(d.getMonth() - 6)
  else if (range === '12mo') d.setFullYear(d.getFullYear() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function AllReviewsBrowser({ reviews }: { reviews: Review[] }) {
  const [city, setCity] = useState('')
  const [provider, setProvider] = useState('')
  const [result, setResult] = useState('')
  const [starsFilter, setStarsFilter] = useState('')
  const [usecase, setUsecase] = useState('')
  const [sort, setSort] = useState('default')
  const [textQ, setTextQ] = useState('')
  const [dateRange, setDateRange] = useState('all')

  const cutoff = getDateCutoff(dateRange)

  let filtered = reviews.filter(r => {
    const cityStr = `${r.location_city}, ${r.location_state}`
    const isInkoutProvider = r.provider_name === 'inkOUT'
    if (isInkoutProvider && r.bucket !== 'inkout') return false
    if (cutoff && r.review_date_estimated && r.review_date_estimated.slice(0, 7) < cutoff) return false
    return (
      (!city || cityStr === city) &&
      (!provider || r.provider_name === provider) &&
      (!result || r.result_rating === result) &&
      (!starsFilter || Math.round(r.star_rating) === parseInt(starsFilter)) &&
      (!usecase || r.use_case === usecase) &&
      (!textQ || (r.review_text || '').toLowerCase().includes(textQ.toLowerCase()) || (r.reviewer_name || '').toLowerCase().includes(textQ.toLowerCase()))
    )
  })

  if (sort === 'stars-desc') filtered = [...filtered].sort((a, b) => b.star_rating - a.star_rating)
  else if (sort === 'stars-asc') filtered = [...filtered].sort((a, b) => a.star_rating - b.star_rating)

  function clearFilters() {
    setCity(''); setProvider(''); setResult(''); setStarsFilter(''); setUsecase(''); setSort('default'); setTextQ(''); setDateRange('all')
  }

  const isInkout = (p: string) => p.toLowerCase().includes('inkout') || p.toLowerCase().includes('ink out')

  return (
    <>
      <div className="filters">
        <select value={city} onChange={e => setCity(e.target.value)}>
          <option value="">All Cities</option>
          {CITIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={provider} onChange={e => setProvider(e.target.value)}>
          <option value="">All Providers</option>
          {PROVIDERS.map(p => <option key={p}>{p}</option>)}
        </select>
        <select value={result} onChange={e => setResult(e.target.value)}>
          <option value="">All Results</option>
          <option value="Positive">Positive</option>
          <option value="Neutral">Neutral</option>
          <option value="Mixed">Mixed</option>
          <option value="Negative">Negative</option>
        </select>
        <select value={starsFilter} onChange={e => setStarsFilter(e.target.value)}>
          <option value="">All Stars</option>
          {[5,4,3,2,1].map(s => <option key={s} value={s}>{s}★</option>)}
        </select>
        <select value={usecase} onChange={e => setUsecase(e.target.value)}>
          <option value="">All Use Cases</option>
          <option value="Complete">Complete Removal</option>
          <option value="Cover-up">Cover-up</option>
          <option value="Microblading">Microblading</option>
          <option value="Color">Color Ink</option>
          <option value="Other">Other</option>
        </select>
        <select value={sort} onChange={e => setSort(e.target.value)}>
          <option value="default">Default order</option>
          <option value="stars-desc">Stars ↓</option>
          <option value="stars-asc">Stars ↑</option>
        </select>
        <select value={dateRange} onChange={e => setDateRange(e.target.value)}>
          <option value="all">All time</option>
          <option value="12mo">Last 12 months</option>
          <option value="6mo">Last 6 months</option>
        </select>
        <input type="text" placeholder="Search text…" value={textQ} onChange={e => setTextQ(e.target.value)} />
        <button className="clear-btn" onClick={clearFilters}>Clear</button>
        <span className="count">{filtered.length} of {reviews.length}</span>
      </div>

      <div className="reviews-main">
        {filtered.length === 0
          ? <EmptyState icon="🔍" message="No reviews match your filters." />
          : filtered.map((r, i) => {
              const provSlug = PROVIDER_SLUGS[r.provider_name]
              const variant = isInkout(r.provider_name) ? 'inkout' : 'default'
              return (
                <ReviewCard
                  key={i}
                  review={r}
                  variant={variant}
                  providerHref={provSlug ? `/competitor/${provSlug}` : undefined}
                  showSourceLink
                />
              )
            })
        }
      </div>
    </>
  )
}
