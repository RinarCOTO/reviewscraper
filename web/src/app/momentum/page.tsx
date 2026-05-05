'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Topbar from '@/components/Topbar'
import BarChart from '@/components/BarChart'
import { LoadingBlock } from '@/components/ui'
import { getLastUpdatedAt, getMomentumReviews } from '@/lib/data'
import { readCeoConfig, DEFAULT_CEO_CONFIG, type CeoConfig } from '@/lib/ceo-config'

type MomentumReview = Awaited<ReturnType<typeof getMomentumReviews>>[number]
type WindowKey = '4q' | '8q' | 'all'

interface BrandSeries {
  brand: string
  total: number
  last6: number
  color: string
  quarters: Map<string, number>
}

const BRAND_COLORS = [
  'var(--blue)',
  'var(--orange)',
  'var(--green)',
  'var(--yellow)',
  'var(--purple-brand)',
  'var(--red)',
  'var(--green-light)',
]

const WINDOW_CONFIG: Record<WindowKey, { label: string; quarterCount: number | null }> = {
  '4q': { label: 'Last 4Q', quarterCount: 4 },
  '8q': { label: 'Last 8Q', quarterCount: 8 },
  all: { label: 'All Time', quarterCount: null },
}
const MOMENTUM_BRANDS_KEY = 'momentum_visible_brands'

function brandNameForReview(review: MomentumReview) {
  if (review.bucket === 'inkout') return 'inkOUT'
  return review.brand_name || review.provider_name || 'Unknown'
}

function quarterKey(date: Date) {
  const quarter = Math.floor(date.getMonth() / 3) + 1
  return `${date.getFullYear()}-Q${quarter}`
}

function quarterLabel(key: string) {
  const [year, quarter] = key.split('-')
  return `${quarter} ${year}`
}

function buildQuarterKeys(reviews: MomentumReview[]) {
  const unique = new Set<string>()
  for (const review of reviews) {
    if (!review.review_date_iso) continue
    unique.add(quarterKey(new Date(review.review_date_iso)))
  }
  return Array.from(unique).sort()
}

function buildBrandSeries(reviews: MomentumReview[]) {
  const quarterKeys = buildQuarterKeys(reviews)
  const seriesMap = new Map<string, BrandSeries>()
  const recentCutoff = new Date()
  recentCutoff.setMonth(recentCutoff.getMonth() - 6)

  for (const review of reviews) {
    if (!review.review_date_iso) continue
    const brand = brandNameForReview(review)
    if (!seriesMap.has(brand)) {
      seriesMap.set(brand, {
        brand,
        total: 0,
        last6: 0,
        color: BRAND_COLORS[seriesMap.size % BRAND_COLORS.length],
        quarters: new Map(),
      })
    }
    const entry = seriesMap.get(brand)!
    const key = quarterKey(new Date(review.review_date_iso))
    entry.total += 1
    entry.quarters.set(key, (entry.quarters.get(key) ?? 0) + 1)
    if (new Date(review.review_date_iso) >= recentCutoff) entry.last6 += 1
  }

  const brands = Array.from(seriesMap.values()).sort((a, b) => {
    if (a.brand === 'inkOUT') return -1
    if (b.brand === 'inkOUT') return 1
    return b.last6 - a.last6 || b.total - a.total || a.brand.localeCompare(b.brand)
  })

  return { brands, quarterKeys }
}

function pickDefaultVisibleBrands(brands: BrandSeries[], configured: string[]) {
  if (configured.length) {
    const allowed = new Set(brands.map(b => b.brand))
    const selected = configured.filter(b => allowed.has(b))
    if (selected.length) return selected
  }
  return brands.slice(0, Math.min(6, brands.length)).map(b => b.brand)
}

function filterQuarterKeys(allKeys: string[], window: WindowKey) {
  const count = WINDOW_CONFIG[window].quarterCount
  return count ? allKeys.slice(-count) : allKeys
}

export default function MomentumPage() {
  const [reviews, setReviews] = useState<MomentumReview[]>([])
  const [loading, setLoading] = useState(true)
  const [freshness, setFreshness] = useState<string | null>(null)
  const [config, setConfig] = useState<CeoConfig>(DEFAULT_CEO_CONFIG)
  const [windowKey, setWindowKey] = useState<WindowKey>('4q')
  const [visibleBrands, setVisibleBrands] = useState<string[]>([])

  useEffect(() => {
    const stored = readCeoConfig()
    setConfig(stored)
    Promise.all([getMomentumReviews(), getLastUpdatedAt()]).then(([rows, updated]) => {
      setReviews(rows)
      setFreshness(updated.date)
      setLoading(false)
    })
  }, [])

  const { brands, quarterKeys } = useMemo(() => buildBrandSeries(reviews), [reviews])

  useEffect(() => {
    if (!loading && brands.length) {
      setVisibleBrands(prev => {
        if (prev.length) return prev.filter(b => brands.some(row => row.brand === b))
        const saved = typeof window === 'undefined' ? [] : JSON.parse(window.localStorage.getItem(MOMENTUM_BRANDS_KEY) ?? '[]')
        if (Array.isArray(saved) && saved.length) {
          return saved.filter((b: string) => brands.some(row => row.brand === b))
        }
        return pickDefaultVisibleBrands(brands, config.providerSlugs)
      })
    }
  }, [brands, config.providerSlugs, loading])

  useEffect(() => {
    if (!loading && typeof window !== 'undefined' && visibleBrands.length) {
      window.localStorage.setItem(MOMENTUM_BRANDS_KEY, JSON.stringify(visibleBrands))
    }
  }, [visibleBrands, loading])

  const filteredQuarterKeys = useMemo(() => filterQuarterKeys(quarterKeys, windowKey), [quarterKeys, windowKey])

  const visibleSeries = useMemo(() => {
    const visible = new Set(visibleBrands)
    return brands.filter(brand => visible.has(brand.brand))
  }, [brands, visibleBrands])

  const chartDatasets = useMemo(() => visibleSeries.map(brand => ({
    label: brand.brand,
    data: filteredQuarterKeys.map(key => brand.quarters.get(key) ?? 0),
    backgroundColor: brand.color,
    borderRadius: 8,
    borderSkipped: false,
  })), [filteredQuarterKeys, visibleSeries])

  const last6Brands = useMemo(() => [...brands].sort((a, b) => b.last6 - a.last6 || b.total - a.total).slice(0, 8), [brands])
  const inkout = brands.find(brand => brand.brand === 'inkOUT') ?? null
  const laserAway = brands.find(brand => brand.brand === 'LaserAway') ?? null
  const comparisonBrand = laserAway ?? brands.find(brand => brand.brand !== 'inkOUT') ?? null
  const ratio = inkout && comparisonBrand && inkout.last6 > 0
    ? (comparisonBrand.last6 / inkout.last6)
    : null
  const headline = comparisonBrand && ratio
    ? `${comparisonBrand.brand} is accumulating reviews ${ratio.toFixed(1)}× faster than inkOUT.`
    : 'inkOUT momentum is visible, but competitor review velocity is still setting the pace.'

  function toggleBrand(brand: string) {
    setVisibleBrands(prev => {
      if (prev.includes(brand)) {
        return prev.length === 1 ? prev : prev.filter(b => b !== brand)
      }
      return [...prev, brand]
    })
  }

  return (
    <div className="hub-main">
      <Topbar
        title="Momentum Tracker"
        crumbs={[{ label: 'Momentum Tracker' }]}
        actions={<Link href="/ceo" className="ql">CEO Scorecard</Link>}
      />

      <div className="container ceo-page">
        {loading ? <LoadingBlock message="Analyzing momentum…" /> : (
          <>
            <section className="ceo-hero">
              <div>
                <div className="ceo-kicker">Trend Before Crisis</div>
                <h2>{headline}</h2>
                <p>
                  Review velocity by quarter across the top brands in the published dataset.
                  {freshness ? ` Data refreshed ${new Date(freshness).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.` : ''}
                </p>
              </div>
              <div className="ceo-hero-actions">
                <div className="ceo-window-picker">
                  {(Object.keys(WINDOW_CONFIG) as WindowKey[]).map(key => (
                    <button
                      key={key}
                      className={`ceo-chip${windowKey === key ? ' active' : ''}`}
                      onClick={() => setWindowKey(key)}
                    >
                      {WINDOW_CONFIG[key].label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="ceo-summary-row">
              <div className="ceo-summary-card">
                <div className="ceo-summary-label">inkOUT last 6 months</div>
                <div className="ceo-summary-value">{inkout?.last6 ?? 0}</div>
                <p>Recent reviews across the current published inkOUT footprint.</p>
              </div>
              <div className="ceo-summary-card">
                <div className="ceo-summary-label">LaserAway last 6 months</div>
                <div className="ceo-summary-value">{laserAway?.last6 ?? 0}</div>
                <p>The core velocity gap the roadmap called out.</p>
              </div>
              <div className="ceo-summary-card">
                <div className="ceo-summary-label">Visible brands</div>
                <div className="ceo-summary-value">{visibleSeries.length}</div>
                <p>{filteredQuarterKeys.length} quarters currently shown in the grouped comparison.</p>
              </div>
            </section>

            <section className="card ceo-chart-card">
              <h3>Last 6 Months by Brand</h3>
              <BarChart
                labels={last6Brands.map(brand => brand.brand)}
                datasets={[{
                  label: 'Last 6 months',
                  data: last6Brands.map(brand => brand.last6),
                  backgroundColor: last6Brands.map(brand => brand.color),
                  borderRadius: 8,
                  borderSkipped: false,
                }]}
                horizontal
                height={320}
              />
            </section>

            <section className="ceo-context-note">
              <strong>Why velocity matters:</strong> review accumulation changes how dominant a brand looks in Google Maps over time. Even when ratings stay strong, a widening volume gap can change click-through and local trust faster than star averages do.
            </section>
          </>
        )}
      </div>
    </div>
  )
}
