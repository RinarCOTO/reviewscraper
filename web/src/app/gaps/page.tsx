'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import Topbar from '@/components/Topbar'
import { LoadingBlock } from '@/components/ui'
import { getAllReviews } from '@/lib/data'
import type { Review } from '@/lib/types'

// ─── Types ─────────────────────────────────────────────────────────────────

interface CompetitorSlice {
  brand: string
  reviews: number
  avgStars: number
  positivePct: number
}

interface GapCity {
  key: string          // "city|state"
  city: string
  state: string
  totalReviews: number
  competitors: CompetitorSlice[]
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function isInkout(r: Review)     { return r.bucket === 'inkout' }
function isCompetitor(r: Review) {
  return r.bucket !== 'inkout' &&
         r.bucket !== 'tatt2away' &&
         r.bucket !== 'review_required' &&
         r.is_tattoo_removal !== false
}

function avgStars(reviews: Review[]): number {
  if (!reviews.length) return 0
  return parseFloat((reviews.reduce((s, r) => s + r.star_rating, 0) / reviews.length).toFixed(1))
}

function positivePct(reviews: Review[]): number {
  const withText = reviews.filter(r => r.has_text)
  if (!withText.length) return 0
  return Math.round(
    withText.filter(r => (r.result_rating || '').toLowerCase() === 'positive').length / withText.length * 100,
  )
}

function buildGaps(reviews: Review[]): GapCity[] {
  // Find every city that has at least one inkOUT review
  const inkoutCities = new Set<string>()
  reviews.filter(isInkout).forEach(r => {
    inkoutCities.add(`${r.location_city}|${r.location_state}`)
  })

  // Group competitor reviews by city then by brand
  const cityBrandMap = new Map<string, Map<string, Review[]>>()
  reviews.filter(isCompetitor).forEach(r => {
    const cityKey = `${r.location_city}|${r.location_state}`
    if (inkoutCities.has(cityKey)) return  // inkOUT is already there

    if (!cityBrandMap.has(cityKey)) cityBrandMap.set(cityKey, new Map())
    const brandMap = cityBrandMap.get(cityKey)!
    const brand = r.brand_name || r.provider_name
    if (!brandMap.has(brand)) brandMap.set(brand, [])
    brandMap.get(brand)!.push(r)
  })

  // Build gap city objects, sorted by total review count desc
  const gapCities: GapCity[] = []
  cityBrandMap.forEach((brandMap, cityKey) => {
    const [city, state] = cityKey.split('|')
    const competitors: CompetitorSlice[] = []
    brandMap.forEach((revs, brand) => {
      competitors.push({
        brand,
        reviews:     revs.length,
        avgStars:    avgStars(revs),
        positivePct: positivePct(revs),
      })
    })
    competitors.sort((a, b) => b.reviews - a.reviews)
    const totalReviews = competitors.reduce((s, c) => s + c.reviews, 0)
    gapCities.push({ key: cityKey, city, state, totalReviews, competitors })
  })

  gapCities.sort((a, b) => b.totalReviews - a.totalReviews)
  return gapCities
}

function buildHeadline(gaps: GapCity[], inkoutCityCount: number): string {
  if (!gaps.length) return 'inkOUT has coverage in every tracked market. No gaps detected.'
  const totalReviews = gaps.reduce((s, g) => s + g.totalReviews, 0)
  const top = gaps[0]
  return `${gaps.length} markets have competitor review presence with no inkOUT location — ${totalReviews} reviews inkOUT isn't part of.`
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function GapsPage() {
  const [reviews,    setReviews]    = useState<Review[]>([])
  const [loading,    setLoading]    = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    getAllReviews()
      .then(data => { setReviews(data); setLoading(false) })
      .catch(err  => { setFetchError(String(err)); setLoading(false) })
  }, [])

  const gaps = useMemo(() => reviews.length ? buildGaps(reviews) : [], [reviews])

  const inkoutCityCount = useMemo(() => {
    const set = new Set<string>()
    reviews.filter(r => r.bucket === 'inkout').forEach(r => set.add(`${r.location_city}|${r.location_state}`))
    return set.size
  }, [reviews])

  const headline     = useMemo(() => buildHeadline(gaps, inkoutCityCount), [gaps, inkoutCityCount])
  const totalMissed  = gaps.reduce((s, g) => s + g.totalReviews, 0)
  const uniqueBrands = useMemo(() => {
    const set = new Set<string>()
    gaps.forEach(g => g.competitors.forEach(c => set.add(c.brand)))
    return set.size
  }, [gaps])

  return (
    <div className="hub-main">
      <Topbar
        title="Coverage Gaps"
        crumbs={[{ label: 'Coverage Gaps' }]}
        actions={<Link href="/threats" className="ql">⚠️ Threat Radar</Link>}
      />

      <div className="container ceo-page">
        {loading && <LoadingBlock message="Mapping coverage gaps…" />}

        {!loading && fetchError && (
          <div style={{ padding: 40, color: 'var(--red)', fontFamily: 'monospace', textAlign: 'center' }}>
            {fetchError}
          </div>
        )}

        {!loading && !fetchError && (
          <>
            {/* Hero */}
            <section className="ceo-hero">
              <div>
                <div className="ceo-kicker">Expansion Opportunity</div>
                <h2>{headline}</h2>
                <p>
                  Markets where at least one tracked competitor has published reviews but inkOUT has no
                  confirmed location in the dataset. Each gap represents a market where competitors are
                  already shaping local reputation without inkOUT in the conversation.
                </p>
              </div>
            </section>

            {/* Summary cards */}
            <section className="ceo-summary-row">
              <div className="ceo-summary-card">
                <div className="ceo-summary-label">Gap markets</div>
                <div
                  className="ceo-summary-value"
                  style={{ color: gaps.length > 0 ? 'var(--yellow)' : 'var(--green)' }}
                >
                  {gaps.length}
                </div>
                <p>Markets with competitor reviews and no inkOUT presence.</p>
              </div>
              <div className="ceo-summary-card">
                <div className="ceo-summary-label">Competitor reviews missed</div>
                <div className="ceo-summary-value" style={{ color: 'var(--red)' }}>
                  {totalMissed}
                </div>
                <p>Total published competitor reviews in markets inkOUT doesn't serve.</p>
              </div>
              <div className="ceo-summary-card">
                <div className="ceo-summary-label">Competing brands</div>
                <div className="ceo-summary-value">{uniqueBrands}</div>
                <p>Distinct competitor brands operating in gap markets.</p>
              </div>
              <div className="ceo-summary-card">
                <div className="ceo-summary-label">inkOUT markets</div>
                <div className="ceo-summary-value" style={{ color: 'var(--green)' }}>
                  {inkoutCityCount}
                </div>
                <p>Current inkOUT locations with published reviews in the dataset.</p>
              </div>
            </section>

            {/* Gap city cards */}
            {gaps.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {gaps.map(gap => (
                  <section
                    key={gap.key}
                    className="card"
                    style={{ padding: 0, overflow: 'hidden', borderColor: 'rgba(245,158,11,.2)' }}
                  >
                    {/* City header */}
                    <div style={{
                      padding: '16px 20px',
                      borderBottom: '1px solid var(--border)',
                      background: 'rgba(245,158,11,.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>
                          {gap.city}, {gap.state}
                        </span>
                        <span style={{
                          fontSize: 11, fontWeight: 700,
                          color: 'var(--yellow)', background: 'rgba(245,158,11,.15)',
                          padding: '2px 8px', borderRadius: 9999,
                        }}>
                          No inkOUT
                        </span>
                      </div>
                      <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                        {gap.totalReviews} competitor review{gap.totalReviews !== 1 ? 's' : ''} · {gap.competitors.length} brand{gap.competitors.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Competitor list */}
                    <div style={{ padding: '12px 20px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {gap.competitors.map(c => (
                        <span
                          key={c.brand}
                          style={{
                            fontSize: 12, fontWeight: 600,
                            color: 'var(--text)',
                            background: 'rgba(255,255,255,.06)',
                            padding: '4px 12px', borderRadius: 9999,
                          }}
                        >
                          {c.brand} · {c.reviews} reviews · {c.avgStars}★
                        </span>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <section className="ceo-context-note">
                No gap markets detected. inkOUT has review presence in every city where competitors are tracked.
              </section>
            )}

            <section className="ceo-context-note">
              A gap market is any city where at least one competitor has published reviews and inkOUT has none. A city could appear here if inkOUT operates there but hasn't been scraped yet — confirm before treating a gap as a confirmed missing location.
            </section>
          </>
        )}
      </div>
    </div>
  )
}
