'use client'

import { useState, ReactNode } from 'react'
import Link from 'next/link'
import type { Review } from '@/lib/types'
import StarRating from './StarRating'

function resultColor(r: string) {
  if (r === 'Positive') return 'var(--green)'
  if (r === 'Negative') return 'var(--red)'
  if (r === 'Mixed') return 'var(--yellow)'
  if (r === 'Neutral') return 'var(--blue)'
  return 'var(--gray-dim)'
}

function displayDate(r: Review): string {
  const d = r.review_date_label || r.review_date_estimated || r.review_date || ''
  return d.replace(/^~/, '').split(' (')[0]
}

function confidenceStyle(conf: number): { background: string; color: string } {
  if (conf >= 0.8) return { background: 'rgba(34,197,94,.15)', color: 'var(--green)' }
  if (conf >= 0.6) return { background: 'rgba(245,158,11,.15)', color: 'var(--yellow)' }
  return { background: 'rgba(239,68,68,.15)', color: 'var(--red)' }
}

const VARIANT_PILL: Record<string, { label: string; color: string }> = {
  inkout:            { label: 'inkOUT',    color: 'var(--purple-brand)' },
  tatt2away:         { label: 'Tatt2Away', color: 'var(--yellow)' },
  'review-required': { label: 'Pending',   color: 'var(--muted)' },
}

interface ReviewCardProps {
  review: Review
  variant?: 'default' | 'inkout' | 'tatt2away' | 'review-required'
  providerHref?: string
  showSourceLink?: boolean
  showActions?: ReactNode
  showCopyButton?: boolean
}

export default function ReviewCard({
  review: r,
  variant = 'default',
  providerHref,
  showSourceLink = false,
  showActions,
  showCopyButton = true,
}: ReviewCardProps) {
  const [hoverCopy, setHoverCopy] = useState(false)
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(r.review_text || '').then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const pill = variant !== 'default' ? VARIANT_PILL[variant] : null
  const cardClass = `review-card${variant === 'inkout' ? ' inkout' : ''}`
  const cardStyle = variant === 'review-required'
    ? { border: '1px solid rgba(245,158,11,.4)' }
    : undefined

  return (
    <div className={cardClass} style={cardStyle}>
      {/* Header row: name + meta | stars + date + copy */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-4)', marginBottom: 'var(--space-2)' }}>
        <div>
          <span className="author" style={{ marginRight: 'var(--space-2)' }}>
            {r.reviewer_name || 'Anonymous'}
          </span>
          {r.provider_name && (
            providerHref
              ? <Link href={providerHref} className="provider-link">{r.provider_name}</Link>
              : <span style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)' }}>{r.provider_name}</span>
          )}
          {r.location_city && (
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)' }}>
              {' · '}{r.location_city}{r.location_state ? `, ${r.location_state}` : ''}
            </span>
          )}
          {pill && (
            <span style={{
              marginLeft: 'var(--space-2)',
              fontSize: 'var(--text-xs)',
              color: pill.color,
              border: `1px solid ${pill.color}`,
              borderRadius: 'var(--radius-pill)',
              padding: '1px 7px',
              verticalAlign: 'middle',
            }}>
              {pill.label}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexShrink: 0 }}>
          <StarRating value={r.star_rating || 0} size="sm" />
          <span className="date">{displayDate(r)}</span>
          {showCopyButton && r.has_text && (
            <button
              className="copy-btn"
              aria-label="Copy review text"
              onClick={handleCopy}
              onMouseEnter={() => setHoverCopy(true)}
              onMouseLeave={() => setHoverCopy(false)}
              onFocus={() => setHoverCopy(true)}
              onBlur={() => setHoverCopy(false)}
              style={{ opacity: hoverCopy ? 1 : 0.55 }}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          )}
        </div>
      </div>

      {/* Review body */}
      {!r.has_text
        ? <div style={{ color: 'var(--gray-mid)', fontSize: 'var(--text-sm)', fontStyle: 'italic', marginBottom: 'var(--space-2)' }}>Rating only — no written review</div>
        : <div className="text">{r.review_text}</div>
      }

      {/* Tags */}
      <div className="tags">
        {r.result_rating && r.result_rating !== 'unknown' && (
          <span className="badge" style={{ background: 'rgba(0,0,0,.3)', border: `1px solid ${resultColor(r.result_rating)}`, color: resultColor(r.result_rating) }}>
            {r.result_rating}
          </span>
        )}
        {r.location_transition && (
          <span className="badge badge-transition" title="Left on a listing previously operating as Tatt2Away">Transition-era</span>
        )}
        {r.pain_level !== 'unknown' && r.pain_level && (
          <span className="badge badge-yellow">Pain: {r.pain_level}/5</span>
        )}
        {r.sessions_completed !== 'unknown' && r.sessions_completed && (
          <span className="badge badge-blue">{r.sessions_completed} sessions</span>
        )}
        {r.use_case && r.use_case !== 'unknown' && (
          <span className="badge badge-purple">{r.use_case}</span>
        )}
        {r.scarring_mentioned === 'Yes' && <span className="badge badge-red">Scarring</span>}
        {r.scarring_mentioned === 'Positive' && <span className="badge badge-green">Healed well</span>}
        {r.is_tattoo_removal === false && (
          <span className="badge badge-gray" title="Not a tattoo removal review — excluded from metrics">Other service</span>
        )}
        {showSourceLink && r.source_url && (
          <a href={r.source_url} target="_blank" rel="noopener noreferrer"
            className="badge badge-gray" style={{ textDecoration: 'none', opacity: 0.7 }}
            title="View original on Google Maps">
            ↗ Google
          </a>
        )}
      </div>

      {/* Evidence chips — review-required variant only */}
      {variant === 'review-required' && (
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginTop: 'var(--space-3)', fontSize: 'var(--text-xs)', alignItems: 'center' }}>
          {r.routing_reason && (
            <span style={{ background: 'rgba(108,99,255,.12)', color: 'var(--purple-brand)', padding: '2px 8px', borderRadius: 'var(--radius-sm)', fontFamily: 'monospace' }}>
              {r.routing_reason}
            </span>
          )}
          {r.stage_1_matched_terms && (
            <span style={{ background: 'rgba(239,68,68,.12)', color: 'var(--red)', padding: '2px 8px', borderRadius: 'var(--radius-sm)' }}>
              name: {r.stage_1_matched_terms}
            </span>
          )}
          {r.stage_1_bridging_flag && (
            <span style={{ background: 'rgba(245,158,11,.15)', color: 'var(--yellow)', padding: '2px 8px', borderRadius: 'var(--radius-sm)' }}>
              bridging language
            </span>
          )}
          {r.stage_2_matched_terms && (
            <span style={{ background: 'rgba(239,68,68,.12)', color: 'var(--red)', padding: '2px 8px', borderRadius: 'var(--radius-sm)' }}>
              keywords: {r.stage_2_matched_terms}
            </span>
          )}
          {r.stage_2_reasoning && (
            <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>
              {r.stage_2_reasoning}
              {r.stage_2_confidence != null && (
                <span style={{
                  marginLeft: 6,
                  fontStyle: 'normal',
                  padding: '1px 6px',
                  borderRadius: 'var(--radius-sm)',
                  ...confidenceStyle(r.stage_2_confidence),
                }}>
                  {Math.round(r.stage_2_confidence * 100)}% conf
                </span>
              )}
            </span>
          )}
        </div>
      )}

      {/* Actions slot */}
      {showActions && (
        <div style={{ marginTop: 'var(--space-3)' }}>
          {showActions}
        </div>
      )}
    </div>
  )
}
