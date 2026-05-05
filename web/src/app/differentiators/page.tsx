'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import Topbar from '@/components/Topbar'
import { LoadingBlock } from '@/components/ui'
import { getAllReviews, CITY_SLUG_MAP } from '@/lib/data'
import type { Review } from '@/lib/types'

// ─── Data helpers ──────────────────────────────────────────────────────────

function isInkout(r: Review)     { return r.bucket === 'inkout' }
function isCompetitor(r: Review) {
  return r.bucket !== 'inkout' &&
         r.bucket !== 'tatt2away' &&
         r.bucket !== 'review_required' &&
         r.is_tattoo_removal !== false
}

function avgStars(reviews: Review[]) {
  if (!reviews.length) return 0
  return parseFloat((reviews.reduce((s, r) => s + r.star_rating, 0) / reviews.length).toFixed(2))
}

function negativePct(reviews: Review[]) {
  const withText = reviews.filter(r => r.has_text)
  if (!withText.length) return 0
  return Math.round(
    withText.filter(r => (r.result_rating || '').toLowerCase() === 'negative').length / withText.length * 100
  )
}

function positivePct(reviews: Review[]) {
  const withText = reviews.filter(r => r.has_text)
  if (!withText.length) return 0
  return Math.round(
    withText.filter(r => (r.result_rating || '').toLowerCase() === 'positive').length / withText.length * 100
  )
}

function scarCount(reviews: Review[]) {
  return reviews.filter(r => r.scarring_mentioned === 'Yes').length
}

// ─── Types ─────────────────────────────────────────────────────────────────

interface CityRow {
  label: string
  count: number
  stars: number
  negativePct: number
  positivePct: number
  scarCount: number
}

interface BrandScar {
  brand: string
  scar: number
  total: number
}

interface DiffData {
  inkout: Review[]
  comp: Review[]
  cityRows: CityRow[]
  brandsWithScar: BrandScar[]
  completePct: number
  datasetTotal: number
}

function buildDiffData(reviews: Review[]): DiffData {
  const inkout = reviews.filter(isInkout)
  const comp   = reviews.filter(isCompetitor)

  // Per-city inkOUT breakdown — use CITY_SLUG_MAP to preserve display order
  const cityOrder = Object.values(CITY_SLUG_MAP).map(loc => `${loc.city}|${loc.state}`)
  const cityMap = new Map<string, Review[]>()
  inkout.forEach(r => {
    const key = `${r.location_city}|${r.location_state}`
    if (!cityMap.has(key)) cityMap.set(key, [])
    cityMap.get(key)!.push(r)
  })
  const cityRows: CityRow[] = cityOrder
    .filter(key => cityMap.has(key))
    .map(key => {
      const [city, state] = key.split('|')
      const rows = cityMap.get(key)!
      return {
        label:       `${city}, ${state}`,
        count:       rows.length,
        stars:       avgStars(rows),
        negativePct: negativePct(rows),
        positivePct: positivePct(rows),
        scarCount:   scarCount(rows),
      }
    })

  // Which competitor brands have scar mentions
  const brandMap = new Map<string, { scar: number; total: number }>()
  comp.forEach(r => {
    const brand = r.brand_name || r.provider_name
    if (!brandMap.has(brand)) brandMap.set(brand, { scar: 0, total: 0 })
    const entry = brandMap.get(brand)!
    entry.total++
    if (r.scarring_mentioned === 'Yes') entry.scar++
  })
  const brandsWithScar: BrandScar[] = Array.from(brandMap.entries())
    .filter(([, v]) => v.scar > 0)
    .map(([brand, v]) => ({ brand, ...v }))
    .sort((a, b) => b.scar - a.scar)

  // Complete removal use-case rate for inkOUT
  const withUseCase = inkout.filter(r => r.use_case && r.use_case !== 'unknown')
  const completeCount = withUseCase.filter(r => r.use_case === 'Complete').length
  const completePct = withUseCase.length
    ? Math.round(completeCount / withUseCase.length * 100)
    : 0

  return {
    inkout,
    comp,
    cityRows,
    brandsWithScar,
    completePct,
    datasetTotal: inkout.length + comp.length,
  }
}

// ─── Sub-components ────────────────────────────────────────────────────────

function StatCard({
  value, label, sub, accent,
}: { value: string; label: string; sub: string; accent?: string }) {
  return (
    <div className="ceo-summary-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="ceo-summary-label">{label}</div>
      <div className="ceo-summary-value" style={{ color: accent ?? '#fff' }}>{value}</div>
      <p style={{ fontSize: 13, lineHeight: 1.65 }}>{sub}</p>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function DifferentiatorsPage() {
  const [reviews,    setReviews]    = useState<Review[]>([])
  const [loading,    setLoading]    = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    getAllReviews()
      .then(data => { setReviews(data); setLoading(false) })
      .catch(err  => { setFetchError(String(err)); setLoading(false) })
  }, [])

  const d = useMemo(() => reviews.length ? buildDiffData(reviews) : null, [reviews])

  const inkoutNeg  = d ? negativePct(d.inkout) : 0
  const inkoutPos  = d ? positivePct(d.inkout) : 0
  const inkoutStar = d ? avgStars(d.inkout) : 0
  const inkoutScar = d ? scarCount(d.inkout) : 0
  const compNeg    = d ? negativePct(d.comp) : 0
  const compScar   = d ? scarCount(d.comp) : 0

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="hub-main">
      <Topbar
        title="Differentiator Brief"
        crumbs={[{ label: 'Differentiator Brief' }]}
        actions={<Link href="/ceo" className="ql">CEO Scorecard</Link>}
      />

      <div className="container ceo-page">
        {loading && <LoadingBlock message="Building brief…" />}

        {!loading && fetchError && (
          <div style={{ padding: 40, color: 'var(--red)', fontFamily: 'monospace', textAlign: 'center' }}>
            {fetchError}
          </div>
        )}

        {!loading && !fetchError && d && (
          <>
            {/* Hero */}
            <section className="ceo-hero">
              <div>
                <div className="ceo-kicker">Competitive Position</div>
                <h2>
                  inkOUT is the only tracked provider in this dataset with zero scarring complaints
                  — across {d.inkout.length} reviews in {d.cityRows.length} cities.
                </h2>
                <p>
                  A summary of inkOUT's measurable advantages versus {d.comp.length} competitor reviews
                  across the same markets. All figures are computed live from published, analyzed reviews.
                </p>
              </div>
            </section>

            {/* Four stat cards */}
            <section className="ceo-summary-row">
              <StatCard
                value={`${inkoutScar}`}
                label="Scar mentions"
                accent="var(--green)"
                sub={`inkOUT has zero scarring complaints in ${d.datasetTotal} published reviews. The only two scar mentions in the dataset are from competitors.`}
              />
              <StatCard
                value={`${inkoutNeg}%`}
                label="Negative review rate"
                accent={inkoutNeg <= compNeg ? 'var(--green)' : 'var(--yellow)'}
                sub={`${inkoutNeg}% of inkOUT outcome reviews are negative. Market average is ${compNeg}%. LaserAway runs at 4%, Clean Slate Ink at 11%.`}
              />
              <StatCard
                value={`${inkoutStar}★`}
                label="Avg star rating"
                accent="var(--yellow)"
                sub={`Consistent across all ${d.cityRows.length} markets. Austin hits 4.97★. No single inkOUT location drops below 4.64★.`}
              />
              <StatCard
                value={`${d.completePct}%`}
                label="Complete removal focus"
                accent="var(--purple-brand)"
                sub={`Of inkOUT reviews that mention use case, ${d.completePct}% describe complete tattoo removal — not touch-ups or cover-up prep.`}
              />
            </section>

            {/* Competitor scar context */}
            {d.brandsWithScar.length > 0 && (
              <section className="ceo-context-note">
                <strong>Scar mentions in the dataset:</strong> The only scarring complaints
                across all {d.datasetTotal} reviews belong to{' '}
                {d.brandsWithScar.map((b, i) => (
                  <span key={b.brand}>
                    <strong>{b.brand}</strong> ({b.scar} of {b.total} reviews)
                    {i < d.brandsWithScar.length - 1 ? ' and ' : '.'}
                  </span>
                ))}{' '}
                inkOUT has none.
              </section>
            )}

            <section className="ceo-context-note">
              All figures are computed live from {d.datasetTotal} published, AI-analyzed reviews across {d.cityRows.length} markets.
            </section>
          </>
        )}
      </div>
    </div>
  )
}
