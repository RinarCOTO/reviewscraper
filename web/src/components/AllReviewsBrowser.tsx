'use client'

import { useState } from 'react'
import Link from 'next/link'
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

const PROVIDER_SLUGS: Record<string, string> = {
  'Arviv Medical Aesthetics': 'arviv-medical-aesthetics-tampa-fl',
  'Clarity Skin': 'clarity-skin-draper-ut',
  'Clean Slate Ink': 'clean-slate-ink-austin-tx',
  'DermSurgery Associates': 'dermsurgery-associates-houston-tx',
  'Enfuse Medical Spa': 'enfuse-medical-spa-chicago-il',
  'Erasable Med Spa': 'erasable-med-spa-tampa-fl',
  'InkFree, MD': 'inkfree-md-houston-tx',
  'Inklifters (Aesthetica)': 'inklifters-aesthetica-pleasant-grove-ut',
  'Kovak Cosmetic Center': 'kovak-cosmetic-center-chicago-il',
  'MEDermis Laser Clinic': 'medermis-laser-clinic-austin-tx',
  'Removery (Bucktown)': 'removery-bucktown-chicago-il',
  'Removery (Lincoln Square)': 'removery-lincoln-square-chicago-il',
  'Removery (South Congress)': 'removery-south-congress-austin-tx',
  'Skintellect': 'skintellect-tampa-fl',
  'Tatt2Away': '',
  'inkOUT': '',
}

const CITIES = ['Austin, TX', 'Chicago, IL', 'Draper, UT', 'Houston, TX', 'Pleasant Grove, UT', 'Tampa, FL']
const PROVIDERS = ['Arviv Medical Aesthetics', 'Clarity Skin', 'Clean Slate Ink', 'DermSurgery Associates', 'Enfuse Medical Spa', 'Erasable Med Spa', 'InkFree, MD', 'Inklifters (Aesthetica)', 'Kovak Cosmetic Center', 'MEDermis Laser Clinic', 'Removery (Bucktown)', 'Removery (Lincoln Square)', 'Removery (South Congress)', 'Skintellect', 'Tatt2Away', 'inkOUT']

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
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)

  const cutoff = getDateCutoff(dateRange)

  let filtered = reviews.filter(r => {
    const cityStr = `${r.location_city}, ${r.location_state}`
    // tatt2away-bucket reviews are internal (Review Queue only) — never show in main browser
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

  function copyText(text: string, idx: number) {
    navigator.clipboard.writeText(text || '').then(() => {
      setCopiedIdx(idx)
      setTimeout(() => setCopiedIdx(null), 1500)
    })
  }

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
        {filtered.length === 0 && (
          <div className="empty-state">
            <div className="big">🔍</div>
            <div>No reviews match your filters.</div>
          </div>
        )}
        {filtered.map((r, i) => {
          const cityStr = `${r.location_city}, ${r.location_state}`
          const provSlug = PROVIDER_SLUGS[r.provider_name]
          const inkout = isInkout(r.provider_name)
          return (
            <div key={i} className={`review-card${inkout ? ' inkout' : ''}`}>
              <button className="copy-btn" onClick={() => copyText(r.review_text || '', i)}>
                {copiedIdx === i ? 'Copied!' : 'Copy'}
              </button>
              <div className="review-meta">
                <span className="author">{r.reviewer_name || 'Anonymous'}</span>
                <span className="stars">{stars(r.star_rating)} {r.star_rating}★</span>
                {provSlug
                  ? <Link href={`/competitor/${provSlug}`} className="provider-link">{r.provider_name}</Link>
                  : <span className="provider-link">{r.provider_name}</span>
                }
                <span className="review-city">{cityStr}</span>
                <span className="review-date">{r.review_date_label || r.review_date}</span>
              </div>
              {r.has_text
                ? <div className="review-text">{r.review_text}</div>
                : <div className="review-text empty">Rating only — no written review</div>
              }
              <div className="tags">
                <span className="badge" style={{ background: 'rgba(0,0,0,.3)', border: `1px solid ${resultColor(r.result_rating)}`, color: resultColor(r.result_rating) }}>
                  {r.result_rating || 'unknown'}
                </span>
                {r.location_transition && (
                  <span className="badge badge-transition">Transition-era</span>
                )}
                {r.pain_level !== 'unknown' && r.pain_level && (
                  <span className="badge badge-yellow">Pain: {r.pain_level}/5</span>
                )}
                {r.use_case && r.use_case !== 'unknown' && (
                  <span className="badge badge-purple">{r.use_case}</span>
                )}
                {r.scarring_mentioned === 'Yes' && <span className="badge badge-red">Scarring</span>}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
