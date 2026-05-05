import type { Review } from './types'
import type { CeoConfig } from './ceo-config'
import { CITIES } from './config'
import { toSlug } from './data'

export interface ProviderSnapshot {
  slug: string
  provider: string
  city: string
  state: string
  citySlug: string
  reviewCount: number
  avgStars: number
  positivePct: number
  negativePct: number
  scarringCount: number
  recentCount: number
  isInkout: boolean
}

export interface QuarterPoint {
  key: string
  label: string
  inkout: number
  benchmark: number
  marketLeader: number
}

function isExecutiveEligible(review: Review) {
  return review.bucket !== 'tatt2away' && review.bucket !== 'review_required'
}

function resolveCitySlug(review: Review): string {
  const city = CITIES.find(
    c => c.label.toLowerCase() === `${review.location_city} ${review.location_state}`.toLowerCase()
  )
  return city?.slug ?? ''
}

function subtractMonths(date: Date, months: number) {
  const next = new Date(date)
  next.setMonth(next.getMonth() - months)
  return next
}

function quarterKey(date: Date) {
  const quarter = Math.floor(date.getMonth() / 3) + 1
  return `${date.getFullYear()}-Q${quarter}`
}

function quarterLabel(key: string) {
  const [year, q] = key.split('-')
  return `${q} ${year}`
}

function getQuarterKeys(windowMonths: number) {
  const now = new Date()
  const start = subtractMonths(now, windowMonths)
  const cursor = new Date(start.getFullYear(), Math.floor(start.getMonth() / 3) * 3, 1)
  const end = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
  const keys: string[] = []

  while (cursor <= end) {
    keys.push(quarterKey(cursor))
    cursor.setMonth(cursor.getMonth() + 3)
  }

  return keys
}

export function buildProviderSnapshots(reviews: Review[], config: CeoConfig): ProviderSnapshot[] {
  const allowedCities = new Set(config.citySlugs)
  const requestedProviders = new Set(config.providerSlugs)

  const filtered = reviews.filter(review => {
    if (!isExecutiveEligible(review)) return false
    const citySlug = resolveCitySlug(review)
    if (allowedCities.size > 0 && !allowedCities.has(citySlug)) return false
    if (requestedProviders.size > 0) {
      const slug = toSlug(review.provider_name, review.location_city, review.location_state)
      if (!requestedProviders.has(slug) && review.brand_name !== 'inkOUT') return false
    }
    return true
  })

  const grouped = new Map<string, Review[]>()
  for (const review of filtered) {
    const slug = toSlug(review.provider_name, review.location_city, review.location_state)
    if (!grouped.has(slug)) grouped.set(slug, [])
    grouped.get(slug)!.push(review)
  }

  const recentCutoff = subtractMonths(new Date(), 6)

  return Array.from(grouped.entries()).map(([slug, group]) => {
    const source = group[0]
    const withText = group.filter(r => r.has_text)
    const textTotal = withText.length || 1
    const positive = withText.filter(r => (r.result_rating || '').toLowerCase() === 'positive').length
    const negative = withText.filter(r => (r.result_rating || '').toLowerCase() === 'negative').length
    const recentCount = group.filter(r => {
      if (!r.review_date_iso) return false
      return new Date(r.review_date_iso) >= recentCutoff
    }).length

    return {
      slug,
      provider: source.provider_name,
      city: source.location_city,
      state: source.location_state,
      citySlug: resolveCitySlug(source),
      reviewCount: group.length,
      avgStars: parseFloat((group.reduce((sum, r) => sum + r.star_rating, 0) / group.length).toFixed(2)),
      positivePct: Math.round((positive / textTotal) * 100),
      negativePct: Math.round((negative / textTotal) * 100),
      scarringCount: group.filter(r => r.scarring_mentioned === 'Yes').length,
      recentCount,
      isInkout: source.brand_name === 'inkOUT' || source.bucket === 'inkout',
    }
  })
}

export function pickBenchmark(snapshots: ProviderSnapshot[], benchmarkSlug: string | null): ProviderSnapshot | null {
  if (!snapshots.length) return null
  if (benchmarkSlug) {
    const explicit = snapshots.find(s => s.slug === benchmarkSlug)
    if (explicit) return explicit
  }
  return snapshots
    .filter(s => !s.isInkout)
    .sort((a, b) => b.recentCount - a.recentCount || b.reviewCount - a.reviewCount)[0] ?? null
}

export function buildMomentumSeries(reviews: Review[], config: CeoConfig, benchmark: ProviderSnapshot | null): QuarterPoint[] {
  const keys = getQuarterKeys(config.dateWindowMonths)
  const allowedCities = new Set(config.citySlugs)
  const start = subtractMonths(new Date(), config.dateWindowMonths)

  const counts = new Map<string, { inkout: number; benchmark: number; marketLeader: number }>()
  keys.forEach(key => counts.set(key, { inkout: 0, benchmark: 0, marketLeader: 0 }))

  const benchmarkSlug = benchmark?.slug ?? null
  const benchmarkCity = benchmark?.citySlug ?? null
  const perProviderQuarter = new Map<string, Map<string, number>>()

  for (const review of reviews) {
    if (!isExecutiveEligible(review)) continue
    if (!review.review_date_iso) continue
    const date = new Date(review.review_date_iso)
    if (date < start) continue

    const citySlug = resolveCitySlug(review)
    if (allowedCities.size > 0 && !allowedCities.has(citySlug)) continue

    const key = quarterKey(date)
    if (!counts.has(key)) continue
    const slug = toSlug(review.provider_name, review.location_city, review.location_state)

    if (review.bucket === 'inkout' || review.brand_name === 'inkOUT') {
      counts.get(key)!.inkout += 1
    }

    if (benchmarkSlug && slug === benchmarkSlug) {
      counts.get(key)!.benchmark += 1
    }

    if (benchmarkCity && citySlug === benchmarkCity && slug !== benchmarkSlug && review.brand_name !== 'inkOUT') {
      if (!perProviderQuarter.has(key)) perProviderQuarter.set(key, new Map())
      const bucket = perProviderQuarter.get(key)!
      bucket.set(slug, (bucket.get(slug) ?? 0) + 1)
    }
  }

  for (const key of keys) {
    const providerCounts = Array.from(perProviderQuarter.get(key)?.values() ?? [])
    counts.get(key)!.marketLeader = providerCounts.length ? Math.max(...providerCounts) : 0
  }

  return keys.map(key => ({
    key,
    label: quarterLabel(key),
    ...counts.get(key)!,
  }))
}

export function buildHeadline(inkout: ProviderSnapshot | null, benchmark: ProviderSnapshot | null): string {
  if (!inkout) return 'inkOUT data is not available for the selected CEO view.'
  if (!benchmark) {
    return inkOUTScarHeadline(inkout)
  }

  if (inkout.scarringCount === 0 && benchmark.scarringCount > 0) {
    return `inkOUT is the only side of this comparison with zero scarring mentions, while ${benchmark.provider} has ${benchmark.scarringCount}.`
  }

  const velocityGap = benchmark.recentCount - inkout.recentCount
  if (velocityGap >= 10) {
    return `${benchmark.provider} is outpacing inkOUT on recent review velocity by ${velocityGap} reviews over the last 6 months.`
  }

  if (inkout.negativePct < benchmark.negativePct) {
    return `inkOUT is winning on downside risk, with a lower negative-review rate than ${benchmark.provider}.`
  }

  return inkOUTScarHeadline(inkout)
}

function inkOUTScarHeadline(inkout: ProviderSnapshot) {
  if (inkout.scarringCount === 0) {
    return 'inkOUT remains the cleanest risk story in the dataset, with zero scarring mentions in the selected view.'
  }
  return `inkOUT has ${inkout.scarringCount} scarring mentions in the selected view and needs closer review.`
}
