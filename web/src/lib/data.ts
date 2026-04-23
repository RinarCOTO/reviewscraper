import { supabase } from './supabase'
import type { Review, CityData, BusinessSummary } from './types'

export async function getAllReviews(): Promise<Review[]> {
  const { data, error } = await supabase
    .from('competitor_reviews')
    .select('*')
    .eq('status', 'published')
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
    .order('review_date_iso', { ascending: false })

  if (error) throw new Error(`getInkoutReviews: ${error.message}`)
  return data as Review[]
}

export async function getReviewQueue(): Promise<Review[]> {
  const { data, error } = await supabase
    .from('competitor_reviews')
    .select('*')
    .in('bucket', ['tatt2away', 'review_required'])
    .neq('status', 'rejected')
    .order('review_date_iso', { ascending: false })

  if (error) throw new Error(`getReviewQueue: ${error.message}`)
  return data as Review[]
}

export async function getCityData(slug: string): Promise<CityData | null> {
  const cityMap: Record<string, { city: string; state: string }> = {
    'austin-tx':        { city: 'Austin',         state: 'TX' },
    'chicago-il':       { city: 'Chicago',         state: 'IL' },
    'draper-ut':        { city: 'Draper',          state: 'UT' },
    'houston-tx':       { city: 'Houston',         state: 'TX' },
    'pleasant-grove-ut':{ city: 'Pleasant Grove',  state: 'UT' },
    'tampa-fl':         { city: 'Tampa',           state: 'FL' },
  }
  const loc = cityMap[slug]
  if (!loc) return null

  const { data, error } = await supabase
    .from('competitor_reviews')
    .select('*')
    .eq('status', 'published')
    .eq('location_city', loc.city)
    .eq('location_state', loc.state)

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

    // inkOUT stats use only approved inkout-bucket reviews — tatt2away-filtered reviews
    // are excluded so negative outcomes don't pollute inkOUT's own metrics.
    const statReviews = isInkout ? reviews.filter(r => r.bucket === 'inkout') : reviews

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
      ? `${statReviews[0].provider_name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${statReviews[0].location_city.toLowerCase().replace(/\s+/g, '-')}-${statReviews[0].location_state.toLowerCase()}`
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
    .order('review_date_iso', { ascending: false })

  if (isInkout) {
    query = query.eq('bucket', 'inkout')
  }

  const { data, error } = await query
  if (error) throw new Error(`getCompetitorReviews: ${error.message}`)

  const all = data as Review[]
  return all.filter(r => {
    const rSlug = `${r.provider_name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${r.location_city.toLowerCase().replace(/\s+/g, '-')}-${r.location_state.toLowerCase()}`
    return rSlug === slug
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

export const CITY_LABELS: Record<string, string> = {
  'austin-tx':         'Austin TX',
  'chicago-il':        'Chicago IL',
  'draper-ut':         'Draper UT',
  'houston-tx':        'Houston TX',
  'pleasant-grove-ut': 'Pleasant Grove UT',
  'tampa-fl':          'Tampa FL',
}
