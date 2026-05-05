'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import Topbar from '@/components/Topbar'
import { LoadingBlock } from '@/components/ui'
import { getMomentumReviews } from '@/lib/data'

// ─── Types ─────────────────────────────────────────────────────────────────

type MomentumReview = Awaited<ReturnType<typeof getMomentumReviews>>[number]
type ThreatLevel = 'active' | 'rising' | 'stable' | 'declining'

interface ThreatEntry {
  brand: string
  last6: number
  prior6: number
  total: number
  velocityPct: number | null  // null = no prior-period reviews
  level: ThreatLevel
}

interface InkoutEntry {
  last6: number
  prior6: number
  total: number
}

// ─── Constants ─────────────────────────────────────────────────────────────

const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 30.44 * 6

const LEVEL_CONFIG: Record<ThreatLevel, { label: string; color: string; bg: string; description: string }> = {
  active:   { label: 'Active',    color: 'var(--red)',          bg: 'rgba(239,68,68,.15)',   description: '20+ reviews in last 6 months'           },
  rising:   { label: 'Rising',    color: 'var(--yellow)',       bg: 'rgba(245,158,11,.15)',  description: 'Accelerating review velocity'            },
  stable:   { label: 'Stable',    color: 'var(--muted)',        bg: 'rgba(148,163,184,.10)', description: 'Consistent pace, no significant change'  },
  declining:{ label: 'Declining', color: 'var(--green)',        bg: 'rgba(34,197,94,.12)',   description: 'Review velocity slowing down'            },
}

const LEVEL_ORDER: Record<ThreatLevel, number> = { active: 0, rising: 1, stable: 2, declining: 3 }

// ─── Helpers ───────────────────────────────────────────────────────────────

function brandName(r: MomentumReview): string {
  if (r.bucket === 'inkout') return 'inkOUT'
  return r.brand_name || r.provider_name || 'Unknown'
}

function classifyThreat(last6: number, prior6: number): ThreatLevel {
  if (last6 >= 20) return 'active'
  if (last6 >= 5 && (prior6 === 0 || last6 / prior6 >= 1.5)) return 'rising'
  if (last6 > 0 && prior6 > 0 && prior6 / last6 >= 2) return 'declining'
  if (last6 === 0 && prior6 >= 5) return 'declining'
  return 'stable'
}

function buildThreats(reviews: MomentumReview[]): { threats: ThreatEntry[]; inkout: InkoutEntry } {
  const now = Date.now()
  const cutoff6  = now - SIX_MONTHS_MS
  const cutoff12 = now - SIX_MONTHS_MS * 2

  type Accum = { brand: string; isInkout: boolean; last6: number; prior6: number; total: number }
  const map = new Map<string, Accum>()

  for (const r of reviews) {
    if (!r.review_date_iso) continue
    const brand = brandName(r)
    if (!map.has(brand)) map.set(brand, { brand, isInkout: r.bucket === 'inkout', last6: 0, prior6: 0, total: 0 })
    const entry = map.get(brand)!
    const ts = new Date(r.review_date_iso).getTime()
    entry.total++
    if (ts >= cutoff6)                   entry.last6++
    else if (ts >= cutoff12)             entry.prior6++
  }

  let inkout: InkoutEntry = { last6: 0, prior6: 0, total: 0 }
  const threats: ThreatEntry[] = []

  map.forEach(e => {
    if (e.isInkout) {
      inkout = { last6: e.last6, prior6: e.prior6, total: e.total }
      return
    }
    const level = classifyThreat(e.last6, e.prior6)
    const velocityPct = e.prior6 > 0
      ? Math.round(((e.last6 - e.prior6) / e.prior6) * 100)
      : null
    threats.push({ brand: e.brand, last6: e.last6, prior6: e.prior6, total: e.total, velocityPct, level })
  })

  threats.sort((a, b) => {
    const lvl = LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]
    if (lvl !== 0) return lvl
    return b.last6 - a.last6
  })

  return { threats, inkout }
}

function buildHeadline(threats: ThreatEntry[], inkout: InkoutEntry): string {
  const active = threats.filter(t => t.level === 'active')
  if (!active.length) return 'No competitor is currently outpacing inkOUT on review velocity.'

  const top = active[0]
  if (inkout.last6 > 0) {
    const ratio = (top.last6 / inkout.last6).toFixed(1)
    return `${top.brand} is collecting reviews ${ratio}× faster than inkOUT right now.`
  }
  return `${top.brand} collected ${top.last6} reviews in the last 6 months — the leading velocity threat.`
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function ThreatsPage() {
  const [reviews,    setReviews]    = useState<MomentumReview[]>([])
  const [loading,    setLoading]    = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    getMomentumReviews()
      .then(data => { setReviews(data); setLoading(false) })
      .catch(err  => { setFetchError(String(err)); setLoading(false) })
  }, [])

  const { threats, inkout } = useMemo(
    () => reviews.length ? buildThreats(reviews) : { threats: [], inkout: { last6: 0, prior6: 0, total: 0 } },
    [reviews],
  )

  const headline  = useMemo(() => buildHeadline(threats, inkout), [threats, inkout])
  const active    = threats.filter(t => t.level === 'active')
  const rising    = threats.filter(t => t.level === 'rising')
  const declining = threats.filter(t => t.level === 'declining')

  return (
    <div className="hub-main">
      <Topbar
        title="Threat Radar"
        crumbs={[{ label: 'Threat Radar' }]}
        actions={<Link href="/momentum" className="ql">📈 Momentum Tracker</Link>}
      />

      <div className="container ceo-page">
        {loading && <LoadingBlock message="Scanning competitor velocity…" />}

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
                <div className="ceo-kicker">Competitive Velocity</div>
                <h2>{headline}</h2>
                <p>
                  Review accumulation velocity for every tracked competitor brand, ranked by recent pace.
                  Last 6 months compared to the prior 6 months.
                  inkOUT collected {inkout.last6} reviews in the same window
                  {inkout.prior6 > 0 ? ` (prior 6 months: ${inkout.prior6})` : ''}.
                </p>
              </div>
            </section>

            {/* Summary cards */}
            <section className="ceo-summary-row">
              <div className="ceo-summary-card">
                <div className="ceo-summary-label">Active threats</div>
                <div
                  className="ceo-summary-value"
                  style={{ color: active.length > 0 ? 'var(--red)' : 'var(--green)' }}
                >
                  {active.length}
                </div>
                <p>Competitors collecting 20+ reviews in the last 6 months.</p>
              </div>
              <div className="ceo-summary-card">
                <div className="ceo-summary-label">Rising threats</div>
                <div
                  className="ceo-summary-value"
                  style={{ color: rising.length > 0 ? 'var(--yellow)' : 'var(--green)' }}
                >
                  {rising.length}
                </div>
                <p>Competitors with accelerating review velocity (1.5× or more growth).</p>
              </div>
              <div className="ceo-summary-card">
                <div className="ceo-summary-label">Declining</div>
                <div className="ceo-summary-value" style={{ color: 'var(--green)' }}>
                  {declining.length}
                </div>
                <p>Competitors whose review pace is slowing. Less competitive pressure.</p>
              </div>
              <div className="ceo-summary-card">
                <div className="ceo-summary-label">inkOUT last 6mo</div>
                <div className="ceo-summary-value">{inkout.last6}</div>
                <p>inkOUT's own review pace. Prior 6 months: {inkout.prior6}. Total tracked: {inkout.total}.</p>
              </div>
            </section>

            {/* Threat cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {threats.map(t => {
                const cfg = LEVEL_CONFIG[t.level]
                const pct = t.velocityPct
                const trendText = pct === null
                  ? 'newly tracked'
                  : pct > 0 ? `up ${pct}% from prior period` : pct < 0 ? `down ${Math.abs(pct)}% from prior period` : 'flat vs prior period'
                return (
                  <div
                    key={t.brand}
                    className="card"
                    style={{
                      padding: '18px 24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 16,
                      borderColor: t.level === 'active' ? 'rgba(239,68,68,.3)' : t.level === 'rising' ? 'rgba(245,158,11,.2)' : undefined,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700,
                        color: cfg.color, background: cfg.bg,
                        padding: '3px 10px', borderRadius: 9999,
                        flexShrink: 0,
                        minWidth: 68, textAlign: 'center',
                      }}>
                        {cfg.label}
                      </span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{t.brand}</span>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: t.last6 >= 20 ? 'var(--red)' : t.last6 >= 5 ? 'var(--yellow)' : 'var(--text)', lineHeight: 1 }}>
                        {t.last6}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                        reviews last 6mo · {trendText}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* inkOUT comparison row */}
            <section className="ceo-context-note">
              <strong>inkOUT benchmark.</strong>{' '}
              {inkout.last6} reviews last 6 months, {inkout.prior6} in the prior period.
              {inkout.prior6 > 0 && inkout.last6 > inkout.prior6 && (
                <> inkOUT velocity is growing (+{Math.round(((inkout.last6 - inkout.prior6) / inkout.prior6) * 100)}%), but the gap with active threats is still widening in absolute terms.</>
              )}
              {inkout.prior6 > 0 && inkout.last6 <= inkout.prior6 && (
                <> inkOUT velocity is flat or declining in the same window the active threats are accelerating.</>
              )}
              {inkout.prior6 === 0 && (
                <> No prior-period inkOUT reviews in the dataset window.</>
              )}
            </section>

            <section className="ceo-context-note">
              Active = 20+ reviews in the last 6 months. Rising = growing velocity. Declining = slowing. Compared against the prior 6-month window.
            </section>
          </>
        )}
      </div>
    </div>
  )
}
