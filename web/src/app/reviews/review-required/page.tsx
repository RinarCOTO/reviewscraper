'use client'

import { useEffect, useState, useRef } from 'react'
import { getReviewQueue } from '@/lib/data'
import { supabase } from '@/lib/supabase'
import Topbar from '@/components/Topbar'
import type { Review } from '@/lib/types'

function stars(n: number) {
  return '★'.repeat(n || 0) + '☆'.repeat(5 - (n || 0))
}

type Action = 'approve' | 'reject' | 'move_to_tatt2away'

type PendingUndo = {
  review: Review
  action: Action
  timerId: ReturnType<typeof setTimeout>
}

async function executeAction(review: Review, action: Action) {
  const now = new Date().toISOString()
  if (action === 'approve') {
    await supabase
      .from('competitor_reviews')
      .update({ bucket: 'inkout', status: 'published', reviewed_at: now, reviewed_decision: 'approved' })
      .eq('id', review.id)
  } else if (action === 'reject') {
    await supabase
      .from('competitor_reviews')
      .update({ reviewed_at: now, reviewed_decision: 'rejected' })
      .eq('id', review.id)
  } else {
    await supabase
      .from('competitor_reviews')
      .update({ bucket: 'tatt2away', reviewed_at: now, reviewed_decision: 'moved_to_tatt2away' })
      .eq('id', review.id)
  }
}

export default function ReviewRequiredPage() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pendingRef = useRef<PendingUndo | null>(null)
  const [toastInfo, setToastInfo] = useState<{ action: Action; name: string } | null>(null)

  useEffect(() => {
    getReviewQueue()
      .then(data => { setReviews(data); setLoading(false) })
      .catch(err => { setError(String(err)); setLoading(false) })
  }, [])

  function initiateAction(review: Review, action: Action) {
    // If another action is still pending, commit it immediately before starting the new one
    if (pendingRef.current) {
      clearTimeout(pendingRef.current.timerId)
      executeAction(pendingRef.current.review, pendingRef.current.action)
      pendingRef.current = null
    }

    setReviews(prev => prev.filter(r => r.id !== review.id))

    const timerId = setTimeout(async () => {
      await executeAction(review, action)
      pendingRef.current = null
      setToastInfo(null)
    }, 4000)

    pendingRef.current = { review, action, timerId }
    setToastInfo({ action, name: review.reviewer_name })
  }

  function handleUndo() {
    if (!pendingRef.current) return
    clearTimeout(pendingRef.current.timerId)
    setReviews(prev => [pendingRef.current!.review, ...prev])
    pendingRef.current = null
    setToastInfo(null)
  }

  return (
    <div className="hub-main">
      <Topbar
        title="Review Queue"
        crumbs={[{ label: 'Reviews', href: '/reviews' }, { label: 'Review Queue' }]}
      />

      {loading ? (
        <div style={{ padding: 40, color: 'var(--muted)', textAlign: 'center' }}>Loading…</div>
      ) : error ? (
        <div style={{ padding: 40, color: '#ef4444', textAlign: 'center', fontFamily: 'monospace' }}>
          Error: {error}
        </div>
      ) : (
        <div style={{ padding: '24px 32px' }}>

          <div style={{ display: 'flex', gap: 32, marginBottom: 24, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)' }}>{reviews.length}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Flagged for review</div>
            </div>
          </div>

          {reviews.length === 0 && !toastInfo && (
            <div style={{ color: 'var(--muted)', textAlign: 'center', padding: 60 }}>
              Queue is empty.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {reviews.map(r => (
              <div
                key={r.id}
                style={{
                  background: 'var(--card)',
                  border: '1px solid rgba(245,158,11,.4)',
                  borderRadius: 8, padding: '16px 20px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: 14 }}>{r.reviewer_name}</span>
                    <span style={{ color: 'var(--muted)', fontSize: 12 }}>
                      {r.provider_name} · {r.location_city}, {r.location_state}
                    </span>
                    <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: 'rgba(245,158,11,.15)', color: '#f59e0b' }}>
                      flagged
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ color: '#f59e0b', fontSize: 13 }}>{stars(r.star_rating)}</span>
                    <span style={{ color: 'var(--muted)', fontSize: 11 }}>{r.review_date}</span>
                  </div>
                </div>

                {r.review_text && (
                  <p style={{ color: 'var(--text)', fontSize: 13, lineHeight: 1.6, margin: '0 0 12px' }}>
                    {r.review_text}
                  </p>
                )}

                {(r.routing_reason || r.stage_1_matched_terms || r.stage_1_bridging_flag || r.stage_2_matched_terms || r.stage_2_reasoning) && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, fontSize: 12, alignItems: 'center' }}>
                    {r.routing_reason && (
                      <span style={{ background: 'rgba(108,99,255,.12)', color: '#a78bfa', padding: '2px 8px', borderRadius: 4, fontFamily: 'monospace' }}>
                        {r.routing_reason}
                      </span>
                    )}
                    {r.stage_1_matched_terms && (
                      <span style={{ background: 'rgba(239,68,68,.12)', color: '#ef4444', padding: '2px 8px', borderRadius: 4 }}>
                        name: {r.stage_1_matched_terms}
                      </span>
                    )}
                    {r.stage_1_bridging_flag && (
                      <span style={{ background: 'rgba(245,158,11,.15)', color: '#f59e0b', padding: '2px 8px', borderRadius: 4 }}>
                        bridging language
                      </span>
                    )}
                    {r.stage_2_matched_terms && (
                      <span style={{ background: 'rgba(239,68,68,.12)', color: '#ef4444', padding: '2px 8px', borderRadius: 4 }}>
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
                            borderRadius: 4,
                            fontSize: 11,
                            background: r.stage_2_confidence >= 0.8
                              ? 'rgba(239,68,68,.15)'
                              : r.stage_2_confidence >= 0.6
                                ? 'rgba(245,158,11,.15)'
                                : 'rgba(148,163,184,.1)',
                            color: r.stage_2_confidence >= 0.8
                              ? '#ef4444'
                              : r.stage_2_confidence >= 0.6
                                ? '#f59e0b'
                                : 'var(--muted)',
                          }}>
                            {Math.round(r.stage_2_confidence * 100)}% conf
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                )}

                {r.source_url && (
                  <div style={{ marginBottom: 8 }}>
                    <a
                      href={r.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 11, color: 'var(--muted)', textDecoration: 'none', opacity: 0.7 }}
                      title="View original review on Google Maps"
                    >
                      ↗ View on Google
                    </a>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => initiateAction(r, 'approve')}
                    style={{
                      background: 'rgba(34,197,94,.15)', color: '#22c55e',
                      border: '1px solid rgba(34,197,94,.3)', borderRadius: 6,
                      padding: '6px 16px', fontSize: 13, cursor: 'pointer',
                    }}
                  >
                    Approve → inkOUT
                  </button>
                  <button
                    onClick={() => initiateAction(r, 'move_to_tatt2away')}
                    style={{
                      background: 'rgba(148,163,184,.1)', color: '#94a3b8',
                      border: '1px solid rgba(148,163,184,.25)', borderRadius: 6,
                      padding: '6px 16px', fontSize: 13, cursor: 'pointer',
                    }}
                  >
                    Archive as Tatt2Away
                  </button>
                  <button
                    onClick={() => initiateAction(r, 'reject')}
                    style={{
                      background: 'rgba(239,68,68,.1)', color: '#ef4444',
                      border: '1px solid rgba(239,68,68,.25)', borderRadius: 6,
                      padding: '6px 16px', fontSize: 13, cursor: 'pointer',
                    }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {toastInfo && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: '#1e293b', border: '1px solid var(--border)', borderRadius: 10,
          padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 16,
          boxShadow: '0 8px 32px rgba(0,0,0,.5)', zIndex: 1000, whiteSpace: 'nowrap',
        }}>
          <span style={{ fontSize: 13, color: 'var(--text)' }}>
            {toastInfo.action === 'approve'
              ? '✓ Approved'
              : toastInfo.action === 'move_to_tatt2away'
                ? '⬡ Archived as Tatt2Away'
                : '✕ Rejected'}{' '}
            <span style={{ color: 'var(--muted)' }}>{toastInfo.name}</span>
            {' '}— committing in 4s
          </span>
          <button
            onClick={handleUndo}
            style={{
              background: 'rgba(108,99,255,.2)', color: '#a78bfa',
              border: '1px solid rgba(108,99,255,.4)', borderRadius: 6,
              padding: '4px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 600,
            }}
          >
            Undo
          </button>
        </div>
      )}
    </div>
  )
}
