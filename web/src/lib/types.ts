export interface Review {
  provider_name: string
  location_city: string
  location_state: string
  method_used: string
  review_text: string
  star_rating: number
  review_date: string
  reviewer_name: string
  verified_source: string
  _place_title: string
  pain_level: number | 'unknown'
  scarring_mentioned: string
  sessions_completed: number | 'unknown'
  skin_type: string
  use_case: string
  result_rating: string
  review_date_estimated: string
  review_date_label: string
  review_date_source: string
  has_text: boolean
  text_note: string
  brand_name: string
  multi_location_brand: boolean
  location_transition: boolean
  transition_note: string
}

export interface Provider {
  provider_name: string
  scrape_date: string
  processed_at: string
  aggregate_rating: number
  total_review_count: number
  text_review_count: number
  empty_review_count: number
  location_count: number
  location_breakdown: Array<{
    city: string
    state: string
    slug: string
    review_count: number
    avg_rating: number
    place_title: string
  }>
  reviews: Review[]
}

export interface CompetitorSlug {
  slug: string
  provider: string
  city: string
  state: string
  method: string
  avgStars: number
  totalReviews: number
  positivePct: number
  negativePct: number
  painPct: number
  scarringPct: number
  avgSessions: number
  isInkout: boolean
}

export interface CityData {
  cityKey: string
  slug: string
  businesses: BusinessSummary[]
}

export interface BusinessSummary {
  provider: string
  method: string
  total: number
  avg_stars: number
  result_pct: { positive: number; negative: number; mixed: number; neutral: number; unknown: number }
  pain_pct: number
  scarring_pct: number
  avg_sessions: number
  use_case: Record<string, number>
  slug: string
  isInkout: boolean
}
