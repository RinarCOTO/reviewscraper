'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getAllReviews } from '@/lib/data'
import AllReviewsBrowser from '@/components/AllReviewsBrowser'
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
    <>
      <header>
        <div>
          <div style={{ color: 'var(--muted)', fontSize: 11, marginBottom: 3 }}>ReviewIntel · Review Browser</div>
          <h1><span>All Reviews</span> — Browse &amp; Copy</h1>
        </div>
        <nav className="nav">
          <Link href="/">← Hub</Link>
          <Link href="/overview/">Overview</Link>
        </nav>
      </header>

      {loading ? (
        <div style={{ padding: 40, color: 'var(--muted)', textAlign: 'center' }}>Loading reviews…</div>
      ) : (
        <AllReviewsBrowser reviews={reviews} />
      )}
    </>
  )
}
