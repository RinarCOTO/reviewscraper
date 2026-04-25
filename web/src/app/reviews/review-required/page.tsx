'use client'

import { useEffect, useState, useRef } from 'react'
import { getReviewQueue } from '@/lib/data'
import { supabase } from '@/lib/supabase'
import Topbar from '@/components/Topbar'
import { ReviewCard, KpiBlock, LoadingBlock, EmptyState } from '@/components/ui'
import type { Review } from '@/lib/types'

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
        <LoadingBlock />
      ) : error ? (
        <div style={{ padding: 40, color: 'var(--red)', textAlign: 'center', fontFamily: 'monospace' }}>
          Error: {error}
        </div>
      ) : (
        <div style={{ padding: '24px 32px' }}>

          <div style={{ display: 'flex', gap: 32, marginBottom: 24 }}>
            <KpiBlock label="Flagged for review" value={reviews.length} size="sm" valueStyle={{ color: 'var(--accent)' }} />
          </div>

          {reviews.length === 0 && !toastInfo
            ? <EmptyState icon="✓" message="Queue is empty." hint="All flagged reviews have been processed." />
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {reviews.map(r => (
                  <ReviewCard
                    key={r.id}
                    review={r}
                    variant="review-required"
                    showSourceLink
                    showActions={
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          onClick={() => initiateAction(r, 'approve')}
                          style={{
                            background: 'rgba(34,197,94,.15)', color: 'var(--green)',
                            border: '1px solid rgba(34,197,94,.3)', borderRadius: 6,
                            padding: '6px 16px', fontSize: 13, cursor: 'pointer',
                          }}
                        >
                          Approve → inkOUT
                        </button>
                        <button
                          onClick={() => initiateAction(r, 'move_to_tatt2away')}
                          style={{
                            background: 'rgba(148,163,184,.1)', color: 'var(--muted)',
                            border: '1px solid rgba(148,163,184,.25)', borderRadius: 6,
                            padding: '6px 16px', fontSize: 13, cursor: 'pointer',
                          }}
                        >
                          Archive as Tatt2Away
                        </button>
                        <button
                          onClick={() => initiateAction(r, 'reject')}
                          style={{
                            background: 'rgba(239,68,68,.1)', color: 'var(--red)',
                            border: '1px solid rgba(239,68,68,.25)', borderRadius: 6,
                            padding: '6px 16px', fontSize: 13, cursor: 'pointer',
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    }
                  />
                ))}
              </div>
            )
          }
        </div>
      )}

      {toastInfo && (
        <div aria-live="polite" style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 10,
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
              background: 'rgba(108,99,255,.2)', color: 'var(--purple-brand)',
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
