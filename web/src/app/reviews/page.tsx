'use client'

import { useEffect, useState } from 'react'
import { getAllReviews } from '@/lib/data'
import AllReviewsBrowser from '@/components/AllReviewsBrowser'
import Topbar from '@/components/Topbar'
import type { Review } from '@/lib/types'

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAllReviews().then(data => {
      setReviews(data)
      setLoading(false)
    })
  }, [])

  return (
    <div className="hub-main">
      <Topbar
        title="All Reviews — Browse & Copy"
        crumbs={[{ label: 'Reviews' }]}
      />

      {loading ? (
        <div style={{ padding: 40, color: 'var(--muted)', textAlign: 'center' }}>Loading reviews…</div>
      ) : (
        <AllReviewsBrowser reviews={reviews} />
      )}
    </div>
  )
}
