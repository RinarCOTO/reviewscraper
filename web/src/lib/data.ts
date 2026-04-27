import { supabase } from './supabase'
import type { Review, CityData, BusinessSummary, DateRange, ResultRatingBreakdown } from './types'

export const SCRAPER_CAP = 50

export function toSlug(providerName: string, city: string, state: string) {
  const p = providerName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  const c = city.toLowerCase().replace(/\s+/g, '-')
  return `${p}-${c}-${state.toLowerCase()}`
}

export function computeDateRange(reviews: Review[]): DateRange | null {
  const dates = reviews
    .filter(r => r.review_date_iso)
    .map(r => r.review_date_iso)
    .sort()
  if (!dates.length) return null
  return {
    earliest: dates[0],
    latest: dates[dates.length - 1],
    count: reviews.length,
    isCapped: reviews.length >= SCRAPER_CAP,
  }
}

export async function getProviderDateRange(providerSlug: string): Promise<DateRange | null> {
  const reviews = await getCompetitorReviews(providerSlug)
  return computeDateRange(reviews)
}

export function computeRatingBreakdown(reviews: Review[]): ResultRatingBreakdown | null {
  const withText = reviews.filter(r => r.has_text)
  if (!withText.length) return null
  const c = { positive: 0, negative: 0, mixed: 0, neutral: 0, unknown: 0 }
  withText.forEach(r => {
    const k = ((r.result_rating || 'unknown').toLowerCase()) as keyof typeof c
    if (k in c) c[k]++
  })
  return {
    positive: c.positive + c.neutral,
    mixed: c.mixed,
    negative: c.negative,
    unknown: c.unknown,
  }
}

export async function getResultRatingBreakdown(providerSlug: string): Promise<ResultRatingBreakdown | null> {
  const reviews = await getCompetitorReviews(providerSlug)
  return computeRatingBreakdown(reviews)
}

export async function getAllReviews(): Promise<Review[]> {
  const { data, error } = await supabase
    .from('competitor_reviews')
    .select('*')
    .eq('status', 'published')
    .or('result_rating.neq.unknown,use_case.neq.unknown')
    .order('review_date_iso', { ascending: false })

  if (error) throw new Error(`getAllReviews: ${error.message}`)
  return data as Review[]
}

export async function getInkoutReviews(): Promise<Review[]> {
  const { data, error } = await supabase
    .from('competitor_reviews')
    .select('*')
    .eq('status', 'published')
    .eq('bucket', 'inkout')
    .or('result_rating.neq.unknown,use_case.neq.unknown')
    .order('review_date_iso', { ascending: false })

  if (error) throw new Error(`getInkoutReviews: ${error.message}`)
  return data as Review[]
}

export async function getTatt2awayReviews(): Promise<Review[]> {
  const { data, error } = await supabase
    .from('competitor_reviews')
    .select('*')
    .eq('status', 'published')
    .eq('bucket', 'tatt2away')
    .or('result_rating.neq.unknown,use_case.neq.unknown')
    .order('review_date_iso', { ascending: false })

  if (error) throw new Error(`getTatt2awayReviews: ${error.message}`)
  return data as Review[]
}

export async function getReviewQueue(): Promise<Review[]> {
  const { data, error } = await supabase
    .from('competitor_reviews')
    .select('*')
    .eq('bucket', 'review_required')
    .is('reviewed_at', null)
    .order('review_date_iso', { ascending: false })

  if (error) throw new Error(`getReviewQueue: ${error.message}`)
  return data as Review[]
}

export const CITY_SLUG_MAP: Record<string, { city: string; state: string }> = {
  'austin-tx':         { city: 'Austin',         state: 'TX' },
  'chicago-il':        { city: 'Chicago',         state: 'IL' },
  'draper-ut':         { city: 'Draper',          state: 'UT' },
  'houston-tx':        { city: 'Houston',         state: 'TX' },
  'pleasant-grove-ut': { city: 'Pleasant Grove',  state: 'UT' },
  'tampa-fl':          { city: 'Tampa',           state: 'FL' },
}

export async function getCityData(slug: string): Promise<CityData | null> {
  const loc = CITY_SLUG_MAP[slug]
  if (!loc) return null

  const { data, error } = await supabase
    .from('competitor_reviews')
    .select('*')
    .eq('status', 'published')
    .eq('location_city', loc.city)
    .eq('location_state', loc.state)
    .or('result_rating.neq.unknown,use_case.neq.unknown')

  if (error) throw new Error(`getCityData: ${error.message}`)
  const cityReviews = data as Review[]

  const providerMap = new Map<string, Review[]>()
  cityReviews.forEach(r => {
    const key = `${r.provider_name}|${r.location_city}|${r.location_state}`
    if (!providerMap.has(key)) providerMap.set(key, [])
    providerMap.get(key)!.push(r)
  })

  const businesses: BusinessSummary[] = []
  providerMap.forEach((reviews, key) => {
    const [provider] = key.split('|')
    const isInkout = provider.toLowerCase().includes('inkout') || provider.toLowerCase().includes('ink out')

    // inkOUT: only approved inkout-bucket reviews (excludes tatt2away-era negatives)
    // Competitors: exclude off-topic reviews (other services like lip filler, hair removal)
    const statReviews = isInkout
      ? reviews.filter(r => r.bucket === 'inkout')
      : reviews.filter(r => r.is_tattoo_removal !== false)

    const total = statReviews.length
    if (total === 0) return
    const avgStars = parseFloat((statReviews.reduce((s, r) => s + r.star_rating, 0) / total).toFixed(1))
    const withText = statReviews.filter(r => r.has_text)
    const resultCounts = { positive: 0, negative: 0, mixed: 0, neutral: 0, unknown: 0 }
    withText.forEach(r => {
      const k = (r.result_rating || 'unknown').toLowerCase() as keyof typeof resultCounts
      if (k in resultCounts) resultCounts[k]++
    })
    const textTotal = withText.length || 1
    const painCount = statReviews.filter(r => r.pain_level !== 'unknown' && r.pain_level > 0).length
    const scarCount = statReviews.filter(r => r.scarring_mentioned === 'Yes').length
    const sessionsArr = statReviews.filter(r => r.sessions_completed !== 'unknown').map(r => r.sessions_completed as number)
    const avgSessions = sessionsArr.length ? parseFloat((sessionsArr.reduce((a, b) => a + b, 0) / sessionsArr.length).toFixed(1)) : 0
    const useCaseMap: Record<string, number> = {}
    statReviews.forEach(r => {
      const uc = r.use_case || 'unknown'
      useCaseMap[uc] = (useCaseMap[uc] || 0) + 1
    })
    const method = statReviews[0]?.method_used || '—'
    const providerSlug = statReviews[0]
      ? toSlug(statReviews[0].provider_name, statReviews[0].location_city, statReviews[0].location_state)
      : ''

    businesses.push({
      provider,
      method,
      total,
      avg_stars: avgStars,
      result_pct: {
        positive: Math.round((resultCounts.positive / textTotal) * 100),
        negative: Math.round((resultCounts.negative / textTotal) * 100),
        mixed:    Math.round((resultCounts.mixed    / textTotal) * 100),
        neutral:  Math.round((resultCounts.neutral  / textTotal) * 100),
        unknown:  Math.round((resultCounts.unknown  / textTotal) * 100),
      },
      pain_pct:     Math.round((painCount   / total) * 100),
      scarring_pct: Math.round((scarCount   / total) * 100),
      avg_sessions: avgSessions,
      use_case: useCaseMap,
      slug: providerSlug,
      isInkout,
      dateRange: computeDateRange(statReviews),
      ratingBreakdown: computeRatingBreakdown(statReviews),
    })
  })

  businesses.sort((a, b) => b.avg_stars - a.avg_stars)

  const cityKey = `${loc.city}, ${loc.state}`
  return { cityKey, slug, businesses }
}

export async function getCompetitorReviews(slug: string): Promise<Review[]> {
  const isInkout = slug.startsWith('inkout-')

  let query = supabase
    .from('competitor_reviews')
    .select('*')
    .eq('status', 'published')
    .or('result_rating.neq.unknown,use_case.neq.unknown')
    .order('review_date_iso', { ascending: false })

  if (isInkout) {
    query = query.eq('bucket', 'inkout')
  }

  const { data, error } = await query
  if (error) throw new Error(`getCompetitorReviews: ${error.message}`)

  const all = data as Review[]
  return all.filter(r => {
    if (!isInkout && r.is_tattoo_removal === false) return false
    return toSlug(r.provider_name, r.location_city, r.location_state) === slug
  })
}

export const COMPETITOR_SLUGS = [
  'arviv-medical-aesthetics-tampa-fl',
  'clarity-skin-draper-ut',
  'clean-slate-ink-austin-tx',
  'dermsurgery-associates-houston-tx',
  'enfuse-medical-spa-chicago-il',
  'erasable-med-spa-tampa-fl',
  'inkfree-md-houston-tx',
  'inklifters-aesthetica-pleasant-grove-ut',
  'inkout-austin-tx',
  'inkout-chicago-il',
  'inkout-draper-ut',
  'inkout-houston-tx',
  'inkout-tampa-fl',
  'kovak-cosmetic-center-chicago-il',
  'medermis-laser-clinic-austin-tx',
  'removery-bucktown-chicago-il',
  'removery-lincoln-square-chicago-il',
  'removery-south-congress-austin-tx',
  'skintellect-tampa-fl',
  'tatt2away-austin-tx',
  'tatt2away-chicago-il',
  'tatt2away-draper-ut',
]

export const CITY_SLUGS = [
  'austin-tx',
  'chicago-il',
  'draper-ut',
  'houston-tx',
  'pleasant-grove-ut',
  'tampa-fl',
]

export async function getLastUpdatedAt(): Promise<{ date: string | null; nullCount: number }> {
  const { data, error } = await supabase
    .from('competitor_reviews')
    .select('last_analyzed_at')
    .eq('status', 'published')

  if (error) throw new Error(`getLastUpdatedAt: ${error.message}`)

  let latest: string | null = null
  let nullCount = 0
  for (const row of data as { last_analyzed_at: string | null }[]) {
    if (!row.last_analyzed_at) { nullCount++; continue }
    if (!latest || row.last_analyzed_at > latest) latest = row.last_analyzed_at
  }
  return { date: latest, nullCount }
}

export interface BucketCounts {
  inkout: number
  tatt2away: number
  review_required: number
  competitor: number
  total: number
}

export async function getBucketCounts(): Promise<BucketCounts> {
  const [publishedRes, queueRes] = await Promise.all([
    supabase
      .from('competitor_reviews')
      .select('bucket')
      .eq('status', 'published'),
    supabase
      .from('competitor_reviews')
      .select('id', { count: 'exact', head: true })
      .eq('bucket', 'review_required')
      .is('reviewed_at', null),
  ])
  if (publishedRes.error) throw new Error(`getBucketCounts: ${publishedRes.error.message}`)

  const rows = publishedRes.data as { bucket: string | null }[]
  const counts = { inkout: 0, tatt2away: 0, competitor: 0 }
  rows.forEach(r => {
    if (r.bucket === 'inkout') counts.inkout++
    else if (r.bucket === 'tatt2away') counts.tatt2away++
    else counts.competitor++
  })
  return {
    ...counts,
    review_required: queueRes.count ?? 0,
    total: rows.length,
  }
}

export const CITY_LABELS: Record<string, string> = {
  'austin-tx':         'Austin TX',
  'chicago-il':        'Chicago IL',
  'draper-ut':         'Draper UT',
  'houston-tx':        'Houston TX',
  'pleasant-grove-ut': 'Pleasant Grove UT',
  'tampa-fl':          'Tampa FL',
}
