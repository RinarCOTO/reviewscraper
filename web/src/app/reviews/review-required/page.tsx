'use client'

import { useEffect, useState } from 'react'
import { getReviewQueue } from '@/lib/data'
import { supabase } from '@/lib/supabase'
import Topbar from '@/components/Topbar'
import type { Review } from '@/lib/types'

function stars(n: number) {
  return '★'.repeat(n || 0) + '☆'.repeat(5 - (n || 0))
}

type ActionState = 'idle' | 'loading'

export default function ReviewRequiredPage() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actions, setActions] = useState<Record<string, ActionState>>({})

  useEffect(() => {
    getReviewQueue()
      .then(data => {
        setReviews(data)
        setLoading(false)
      })
      .catch(err => {
        setError(String(err))
        setLoading(false)
      })
  }, [])

  async function handleApprove(review: Review) {
    setActions(a => ({ ...a, [review.id]: 'loading' }))
    await supabase
      .from('competitor_reviews')
      .update({ bucket: 'inkout', status: 'published' })
      .eq('id', review.id)
    setReviews(prev => prev.filter(r => r.id !== review.id))
    setActions(a => ({ ...a, [review.id]: 'idle' }))
  }

  async function handleReject(review: Review) {
    setActions(a => ({ ...a, [review.id]: 'loading' }))
    await supabase
      .from('competitor_reviews')
      .update({ status: 'rejected' })
      .eq('id', review.id)
    setReviews(prev => prev.filter(r => r.id !== review.id))
    setActions(a => ({ ...a, [review.id]: 'idle' }))
  }

  const tatt2awayCount = reviews.filter(r => r.bucket === 'tatt2away').length
  const manualCount = reviews.filter(r => r.bucket === 'review_required').length

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
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Total in queue</div>
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#ef4444' }}>{tatt2awayCount}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Tatt2Away filtered</div>
            </div>
            {manualCount > 0 && (
              <div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#f59e0b' }}>{manualCount}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Flagged for review</div>
              </div>
            )}
          </div>

          {reviews.length === 0 && (
            <div style={{ color: 'var(--muted)', textAlign: 'center', padding: 60 }}>
              Queue is empty.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {reviews.map(r => {
              const state = actions[r.id] ?? 'idle'
              const isManual = r.bucket === 'review_required'
              return (
                <div
                  key={r.id}
                  style={{
                    background: 'var(--card)',
                    border: `1px solid ${isManual ? 'rgba(245,158,11,.4)' : 'var(--border)'}`,
                    borderRadius: 8, padding: '16px 20px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: 14 }}>{r.reviewer_name}</span>
                      <span style={{ color: 'var(--muted)', fontSize: 12 }}>
                        {r.provider_name} · {r.location_city}, {r.location_state}
                      </span>
                      <span style={{
                        fontSize: 11, padding: '2px 7px', borderRadius: 4,
                        background: isManual ? 'rgba(245,158,11,.15)' : 'rgba(239,68,68,.1)',
                        color: isManual ? '#f59e0b' : '#ef4444',
                      }}>
                        {isManual ? 'flagged' : 'tatt2away'}
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

                  {(r.stage_1_matched_terms || r.stage_1_bridging_flag || r.stage_2_matched_terms || r.stage_2_reasoning) && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, fontSize: 12 }}>
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
                        <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>{r.stage_2_reasoning}</span>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      disabled={state === 'loading'}
                      onClick={() => handleApprove(r)}
                      style={{
                        background: 'rgba(34,197,94,.15)', color: '#22c55e',
                        border: '1px solid rgba(34,197,94,.3)', borderRadius: 6,
                        padding: '6px 16px', fontSize: 13, cursor: 'pointer',
                        opacity: state === 'loading' ? 0.5 : 1,
                      }}
                    >
                      Approve → publish to inkOUT
                    </button>
                    <button
                      disabled={state === 'loading'}
                      onClick={() => handleReject(r)}
                      style={{
                        background: 'rgba(239,68,68,.1)', color: '#ef4444',
                        border: '1px solid rgba(239,68,68,.25)', borderRadius: 6,
                        padding: '6px 16px', fontSize: 13, cursor: 'pointer',
                        opacity: state === 'loading' ? 0.5 : 1,
                      }}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
