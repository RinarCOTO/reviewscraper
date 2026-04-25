'use client'

import Link from 'next/link'
import Topbar from '@/components/Topbar'
import { StarRating, EmptyState, LoadingBlock, SentimentBreakdown, KpiBlock, ReviewCard } from '@/components/ui'
import type { Review } from '@/lib/types'

// Minimal stub reviews for demo — no Supabase needed
const STUB_REVIEW: Review = {
  id: 'demo-1',
  provider_name: 'inkOUT Chicago',
  location_city: 'Chicago',
  location_state: 'IL',
  method_used: 'laser',
  review_text: 'Incredible results after 4 sessions — the team was professional, the space was clean, and the pain was totally manageable. Highly recommend for anyone serious about removal.',
  star_rating: 5,
  review_date: '2024-11',
  review_date_iso: '2024-11-01',
  reviewer_name: 'Jordan M.',
  verified_source: 'google',
  _place_title: 'inkOUT Chicago',
  pain_level: 2,
  scarring_mentioned: 'Positive',
  sessions_completed: 4,
  skin_type: 'Type II',
  use_case: 'Complete',
  result_rating: 'Positive',
  review_date_estimated: '2024-11',
  review_date_label: 'Nov 2024',
  review_date_source: 'estimated',
  has_text: true,
  text_note: '',
  brand_name: 'inkOUT',
  multi_location_brand: true,
  location_transition: false,
  transition_note: '',
  bucket: 'inkout',
  is_tattoo_removal: true,
  status: 'published',
  stage_1_hit: true,
  stage_1_matched_terms: 'tattoo removal',
  stage_1_bridging_flag: false,
  stage_2_flagged: false,
  stage_2_matched_terms: null,
  stage_2_classification: 'Positive',
  stage_2_confidence: 0.94,
  stage_2_reasoning: 'Reviewer describes complete successful removal outcome.',
  routing_reason: 'brand_name:inkOUT',
  relevance_reason: null,
  last_analyzed_at: '2024-11-15T12:00:00Z',
  reviewed_at: null,
  reviewed_decision: null,
  source_url: null,
}

const STUB_NEGATIVE: Review = {
  ...STUB_REVIEW,
  id: 'demo-2',
  reviewer_name: 'Alex T.',
  review_text: 'Had some scarring after my third session. They were responsive when I raised concerns but the outcome was not what I expected.',
  star_rating: 2,
  result_rating: 'Negative',
  scarring_mentioned: 'Yes',
  pain_level: 4,
  stage_2_confidence: 0.81,
  stage_2_reasoning: 'Reviewer describes scarring and dissatisfaction.',
  bucket: 'review_required',
  status: 'pending',
}

const STUB_RATING_ONLY: Review = {
  ...STUB_REVIEW,
  id: 'demo-3',
  reviewer_name: 'Sam K.',
  review_text: '',
  has_text: false,
  star_rating: 4,
  result_rating: 'unknown',
  review_date_label: 'Oct 2024',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="section">
      <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 600, marginBottom: 'var(--space-4)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.07em' }}>
        {title}
      </h2>
      {children}
    </div>
  )
}

export default function ComponentDemoPage() {
  return (
    <div className="hub-main">
      <Topbar
        title="Component Library"
        crumbs={[{ label: 'Dev', href: '/dev' }, { label: 'Components' }]}
      />

      <div className="container" style={{ maxWidth: 900 }}>
        <div className="disclosure" style={{ marginBottom: 32 }}>
          Internal component reference — not linked from production navigation.
        </div>

        {/* ── StarRating ── */}
        <Section title="StarRating">
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'center', flexWrap: 'wrap' }}>
              <div><div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginBottom: 4 }}>size=sm</div><StarRating value={4.2} size="sm" showValue /></div>
              <div><div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginBottom: 4 }}>size=md (default)</div><StarRating value={4.7} size="md" showValue /></div>
              <div><div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginBottom: 4 }}>size=lg</div><StarRating value={5} size="lg" showValue /></div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'center', flexWrap: 'wrap' }}>
              <div><div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginBottom: 4 }}>5.0 green</div><StarRating value={5} showValue /></div>
              <div><div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginBottom: 4 }}>4.6 blue</div><StarRating value={4.6} showValue /></div>
              <div><div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginBottom: 4 }}>4.1 yellow</div><StarRating value={4.1} showValue /></div>
              <div><div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginBottom: 4 }}>3.2 red</div><StarRating value={3.2} showValue /></div>
              <div><div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginBottom: 4 }}>no value</div><StarRating value={4.3} /></div>
            </div>
          </div>
        </Section>

        {/* ── SentimentBreakdown ── */}
        <Section title="SentimentBreakdown">
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginBottom: 6 }}>format=inline (default)</div>
              <SentimentBreakdown positive={38} mixed={6} negative={4} format="inline" />
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginBottom: 6 }}>format=bar</div>
              <div style={{ maxWidth: 320 }}>
                <SentimentBreakdown positive={38} mixed={6} negative={4} format="bar" />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginBottom: 6 }}>format=bar (skewed negative)</div>
              <div style={{ maxWidth: 320 }}>
                <SentimentBreakdown positive={4} mixed={8} negative={28} format="bar" />
              </div>
            </div>
          </div>
        </Section>

        {/* ── EmptyState ── */}
        <Section title="EmptyState">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div className="card"><EmptyState message="No reviews found." /></div>
            <div className="card"><EmptyState icon="🔍" message="No results." hint="Try removing filters." /></div>
          </div>
        </Section>

        {/* ── LoadingBlock ── */}
        <Section title="LoadingBlock">
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginBottom: 6 }}>block (default)</div>
              <LoadingBlock />
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginBottom: 6 }}>inline</div>
              <span>Total reviews: </span><LoadingBlock inline message="…" />
            </div>
          </div>
        </Section>

        {/* ── KpiBlock ── */}
        <Section title="KpiBlock">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginBottom: 6 }}>size=sm — stats bar usage</div>
              <div style={{ display: 'flex', gap: 'var(--space-8)', flexWrap: 'wrap' }}>
                <KpiBlock label="Reviews" value="48" size="sm" />
                <KpiBlock label="Avg Stars" value="4.8★" size="sm" />
                <KpiBlock label="Positive" value="92%" size="sm" />
                <KpiBlock label="Loading" value="" loading size="sm" />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginBottom: 6 }}>size=md — kpi card</div>
              <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                <KpiBlock label="Reviews" value="48" size="md" />
                <KpiBlock label="Avg Stars" value="4.8★" size="md" sub="Last 50 reviews" />
                <KpiBlock label="Positive" value="92%" size="md" loading />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginBottom: 6 }}>size=lg — card with heading</div>
              <div style={{ maxWidth: 280 }}>
                <KpiBlock label="Overall Rating" value="4.8★" size="lg" sub="Across 48 reviews" />
              </div>
            </div>
          </div>
        </Section>

        {/* ── ReviewCard ── */}
        <Section title="ReviewCard">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginBottom: 6 }}>variant=inkout, showSourceLink=false</div>
              <ReviewCard review={STUB_REVIEW} variant="inkout" />
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginBottom: 6 }}>variant=tatt2away</div>
              <ReviewCard review={{ ...STUB_REVIEW, id: 'demo-t', reviewer_name: 'Casey R.', bucket: 'tatt2away', result_rating: 'Mixed' }} variant="tatt2away" />
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginBottom: 6 }}>variant=review-required — shows evidence chips</div>
              <ReviewCard review={STUB_NEGATIVE} variant="review-required" />
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginBottom: 6 }}>rating-only (no text)</div>
              <ReviewCard review={STUB_RATING_ONLY} />
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginBottom: 6 }}>showActions slot</div>
              <ReviewCard
                review={STUB_NEGATIVE}
                variant="review-required"
                showActions={
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button className="btn-approve">Approve</button>
                    <button className="btn-reject">Reject</button>
                  </div>
                }
              />
            </div>
          </div>
        </Section>

        <div className="review-footer">
          ReviewIntel · Dev ·{' '}
          <Link href="/" style={{ color: 'var(--muted)' }}>Hub</Link>
          {' · '}
          <Link href="/methodology" style={{ color: 'var(--muted)' }}>Methodology</Link>
        </div>
      </div>
    </div>
  )
}
