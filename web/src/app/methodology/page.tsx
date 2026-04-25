'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Topbar from '@/components/Topbar'
import { getBucketCounts, type BucketCounts } from '@/lib/data'

export default function MethodologyPage() {
  const [counts, setCounts] = useState<BucketCounts | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getBucketCounts().then(c => {
      setCounts(c)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const n = (x: number | undefined) => loading ? '…' : (x ?? '?').toLocaleString()

  return (
    <div className="hub-main">
      <Topbar
        title="How to Read This Dashboard"
        crumbs={[{ label: 'Methodology' }]}
      />

      <div className="container" style={{ maxWidth: 860 }}>
        <div className="disclosure" style={{ marginBottom: 32 }}>
          <strong>Draft for review.</strong> This page explains what data is in this dashboard, how it was collected,
          and what it does not include. Intended for attorneys, investors, and leadership who need to evaluate
          the data's reliability before acting on it.
        </div>

        {/* ── Section 1: How reviews are collected ── */}
        <div className="section">
          <h2>How reviews are collected</h2>
          <div className="card" style={{ lineHeight: 1.85 }}>
            <p style={{ marginBottom: 12 }}>
              Reviews are pulled directly from <strong>Google Business Profile</strong> listings using the SerpAPI
              service, which reads the same review data visible to anyone searching on Google Maps. No reviews
              are created, edited, or filtered at the collection stage — what you see here is exactly what appears
              on Google.
            </p>
            <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
              <li style={{ marginBottom: 6 }}>
                <strong>Source:</strong> Google Business Profile (Google Maps reviews)
              </li>
              <li style={{ marginBottom: 6 }}>
                <strong>Frequency:</strong> Biweekly — data is refreshed on the 1st and 15th of each month
              </li>
              <li style={{ marginBottom: 6 }}>
                <strong>Scope:</strong> Up to 50 reviews per provider location, sorted by most recent first.
                A provider with 300 reviews on Google will only have their 50 most recent reviews in this dataset.
              </li>
              <li style={{ marginBottom: 6 }}>
                <strong>Date range limitation:</strong> Because only the 50 most recent reviews are collected,
                this dataset does not represent a provider's complete review history. A long-established competitor
                may have a different historical average than what appears here. Pages showing an aggregate rating
                indicate when the sample is at the 50-review cap.
              </li>
            </ul>
            <p style={{ color: 'var(--muted)', fontSize: 12 }}>
              The current dataset contains <strong style={{ color: 'var(--text)' }}>{n(counts?.total)}</strong> published
              reviews across all providers and markets.
            </p>
          </div>
        </div>

        {/* ── Section 2: How reviews are categorized ── */}
        <div className="section">
          <h2>How reviews are categorized</h2>
          <div className="card" style={{ lineHeight: 1.85 }}>
            <p style={{ marginBottom: 16 }}>
              Every review is automatically assigned to one of four buckets based on the provider name,
              the review content, and whether it mentions tattoo removal specifically.
              Each routing decision is recorded with a <code style={{ background: '#1e293b', padding: '1px 6px', borderRadius: 4, fontSize: 12 }}>routing_reason</code> field
              in the database for auditability.
            </p>
            <div style={{ display: 'grid', gap: 12 }}>
              <BucketCard
                name="inkout"
                color="#a78bfa"
                count={n(counts?.inkout)}
                label="inkOUT (current brand)"
                description="Reviews for inkOUT locations from the current operating period. These are used for inkOUT performance metrics throughout the dashboard."
              />
              <BucketCard
                name="tatt2away"
                color="#f59e0b"
                count={n(counts?.tatt2away)}
                label="Tatt2Away (archived)"
                description="Reviews from the pre-rebrand period — either explicitly naming Tatt2Away or describing outcomes (such as scarring or severe pain) associated with that era. These are archived separately and do not appear on inkOUT performance pages."
              />
              <BucketCard
                name="competitor"
                color="#3b82f6"
                count={n(counts?.competitor)}
                label="Competitor"
                description="Reviews of other tattoo removal providers across inkOUT's six markets. Only reviews where the service is confirmed to be tattoo removal are included in metrics — off-topic reviews (e.g., for unrelated cosmetic procedures at the same location) are excluded."
              />
              <BucketCard
                name="review_required"
                color="#94a3b8"
                count={n(counts?.review_required)}
                label="Pending editorial review"
                description="Reviews flagged by the automated system for manual review before publication. These do not appear in any public-facing metrics until a reviewer approves or rejects them."
              />
            </div>
          </div>
        </div>

        {/* ── Section 3: How ratings are calculated ── */}
        <div className="section">
          <h2>How ratings are calculated</h2>
          <div className="card" style={{ lineHeight: 1.85 }}>
            <ul style={{ paddingLeft: 20 }}>
              <li style={{ marginBottom: 8 }}>
                <strong>Star averages</strong> are computed across reviews in the displayed bucket only.
                inkOUT pages use only inkout-bucket reviews; competitor pages use only competitor reviews
                for that location.
              </li>
              <li style={{ marginBottom: 8 }}>
                <strong>Off-topic reviews are excluded.</strong> Some providers also offer services unrelated
                to tattoo removal (lip filler, hair removal, etc.). Reviews confirmed to be about those
                services are excluded from all metrics via the <code style={{ background: '#1e293b', padding: '1px 6px', borderRadius: 4, fontSize: 12 }}>is_tattoo_removal</code> field.
              </li>
              <li style={{ marginBottom: 8 }}>
                <strong>Text-only analysis.</strong> Some Google reviews consist only of a star rating with
                no written text. These reviews count toward star averages but are excluded from result
                classification (positive / mixed / negative) since there is no text to analyze.
              </li>
              <li style={{ marginBottom: 8 }}>
                <strong>Result ratings</strong> (positive, mixed, negative) are assigned by AI analysis
                of the review text, focused on whether the reviewer describes a successful tattoo removal
                outcome. "Positive" includes reviews rated Positive or Neutral by the model. "Mixed" means
                the reviewer describes both positive and negative aspects. "Negative" means the outcome
                described was poor or the reviewer was dissatisfied.
              </li>
              <li style={{ marginBottom: 8 }}>
                <strong>Mixed ratings count as mixed</strong> — they are not folded into positive or negative
                for any calculation. A provider with a 4.8-star average and several mixed results is surfacing
                real nuance that a raw star average would hide.
              </li>
            </ul>
          </div>
        </div>

        {/* ── Section 4: What this dashboard does NOT include ── */}
        <div className="section">
          <h2>What this dashboard does not include</h2>
          <div className="card" style={{ lineHeight: 1.85 }}>
            <ul style={{ paddingLeft: 20 }}>
              <li style={{ marginBottom: 8 }}>
                Reviews older than the 50 most recent per provider. A competitor's older reviews —
                positive or negative — are not represented in this dataset.
              </li>
              <li style={{ marginBottom: 8 }}>
                Reviews from other platforms (Yelp, Healthgrades, RealSelf, etc.). This dataset is
                Google-only.
              </li>
              <li style={{ marginBottom: 8 }}>
                Reviews marked as off-topic (confirmed non-tattoo-removal procedures at the same location).
              </li>
              <li style={{ marginBottom: 8 }}>
                Reviews in the tatt2away archive on any inkOUT page. The Tatt2Away-era reviews are
                accessible separately via the{' '}
                <Link href="/reviews/tatt2away" style={{ color: '#f59e0b' }}>Tatt2Away Archive</Link>
                {' '}and are intentionally not mixed into current inkOUT performance numbers.
              </li>
              <li style={{ marginBottom: 8 }}>
                Reviews pending editorial review (review_required bucket). These are not published
                to any dashboard view until manually approved.
              </li>
            </ul>
          </div>
        </div>

        {/* ── Section 5: Audit trail ── */}
        <div className="section">
          <h2>Audit trail and data availability</h2>
          <div className="card" style={{ lineHeight: 1.85 }}>
            <ul style={{ paddingLeft: 20 }}>
              <li style={{ marginBottom: 8 }}>
                Every routing decision is logged with a <strong>routing_reason</strong> field — a plain-language
                explanation of why a review was placed in its bucket (e.g., "brand_name:inkOUT", "tatt2away_explicit",
                "non_removal_keyword").
              </li>
              <li style={{ marginBottom: 8 }}>
                Every review has a <strong>last_analyzed_at</strong> timestamp recording when it was last
                processed by the AI analysis pipeline.
              </li>
              <li style={{ marginBottom: 8 }}>
                Reviews link back to their Google source for verification where available.
              </li>
              <li style={{ marginBottom: 8 }}>
                The full underlying dataset — including routing reasons, AI analysis fields, and raw review
                text — is available on request for legal or internal review.
              </li>
            </ul>
          </div>
        </div>

        <div className="review-footer">
          ReviewIntel · Internal competitive intelligence dashboard ·{' '}
          <Link href="/" style={{ color: 'var(--muted)' }}>Hub</Link>
        </div>
      </div>
    </div>
  )
}

function BucketCard({
  name, color, count, label, description,
}: {
  name: string; color: string; count: string; label: string; description: string
}) {
  return (
    <div style={{
      background: 'var(--bg)', border: '1px solid var(--border)', borderLeft: `3px solid ${color}`,
      borderRadius: 8, padding: '14px 16px', display: 'flex', gap: 16, alignItems: 'flex-start',
    }}>
      <div style={{ minWidth: 52, textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color }}>{count}</div>
        <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 2 }}>reviews</div>
      </div>
      <div>
        <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
          <code style={{ background: '#1e293b', padding: '1px 6px', borderRadius: 4, fontSize: 12, color }}>{name}</code>
          {' '}<span style={{ fontSize: 13 }}>{label}</span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7 }}>{description}</div>
      </div>
    </div>
  )
}
