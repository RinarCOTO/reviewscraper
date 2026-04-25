'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { CITIES } from '@/lib/config'
import { toSlug } from '@/lib/data'
import { StarRating } from '@/components/ui'

export default function Sidebar() {
  const pathname = usePathname()
  const [openCities, setOpenCities] = useState<Set<string>>(new Set())
  const [totalReviews, setTotalReviews] = useState<number | undefined>()
  const [pendingCount, setPendingCount] = useState<number | undefined>()
  const [liveStars, setLiveStars] = useState<Map<string, number>>(new Map())

  // Derive active city from current route
  const activeCitySlug = useMemo(() => {
    if (pathname.startsWith('/city/')) return pathname.split('/')[2]
    if (pathname.startsWith('/competitor/')) {
      const compSlug = pathname.split('/')[2]
      return CITIES.find(c => c.competitors.some(comp => comp.slug === compSlug))?.slug ?? null
    }
    return null
  }, [pathname])

  // Auto-expand active city group
  useEffect(() => {
    if (activeCitySlug) {
      setOpenCities(prev => {
        const next = new Set(Array.from(prev))
        next.add(activeCitySlug)
        return next
      })
    }
  }, [activeCitySlug])

  useEffect(() => {
    supabase
      .from('competitor_reviews')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published')
      .then(({ count }) => setTotalReviews(count ?? undefined))

    supabase
      .from('competitor_reviews')
      .select('*', { count: 'exact', head: true })
      .eq('bucket', 'review_required')
      .is('reviewed_at', null)
      .then(({ count }) => setPendingCount(count ?? undefined))

    // Fetch live avg stars per competitor slug (excludes tatt2away pre-rebrand reviews)
    supabase
      .from('competitor_reviews')
      .select('star_rating, provider_name, location_city, location_state')
      .eq('status', 'published')
      .neq('bucket', 'tatt2away')
      .then(({ data }) => {
        if (!data) return
        const sums = new Map<string, { sum: number; count: number }>()
        for (const r of data as { star_rating: number; provider_name: string; location_city: string; location_state: string }[]) {
          const slug = toSlug(r.provider_name, r.location_city, r.location_state)
          const entry = sums.get(slug) ?? { sum: 0, count: 0 }
          entry.sum += r.star_rating
          entry.count++
          sums.set(slug, entry)
        }
        const map = new Map<string, number>()
        sums.forEach(({ sum, count }, slug) => map.set(slug, parseFloat((sum / count).toFixed(1))))
        setLiveStars(map)
      })
  }, [])

  function toggleCity(slug: string) {
    setOpenCities(prev => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="brand">Review<span>Intel</span></div>
        <div className="sub">Competitive Intelligence Hub</div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-label">Overview</div>
        <Link href="/" className={`nav-item${pathname === '/' ? ' active' : ''}`}>
          <div className="icon" style={{ background: 'rgba(108,99,255,.2)' }}>🏠</div>
          <span className="label">Hub Dashboard</span>
        </Link>
        <Link href="/reviews" className={`nav-item${pathname === '/reviews' ? ' active' : ''}`}>
          <div className="icon" style={{ background: 'rgba(34,197,94,.12)' }}>💬</div>
          <span className="label">All Reviews</span>
          <span className="badge">{totalReviews ?? '…'}</span>
        </Link>
        <Link href="/reviews/review-required" className={`nav-item${pathname.startsWith('/reviews/review-required') ? ' active' : ''}`}>
          <div className="icon" style={{ background: 'rgba(245,158,11,.15)' }}>⚠</div>
          <span className="label">Review Queue</span>
          {(pendingCount ?? 0) > 0 && (
            <span className="badge" style={{ background: 'var(--yellow)', color: '#000' }}>{pendingCount}</span>
          )}
        </Link>
        <Link href="/reviews/tatt2away" className={`nav-item${pathname.startsWith('/reviews/tatt2away') ? ' active' : ''}`}>
          <div className="icon" style={{ background: 'rgba(239,68,68,.1)' }}>🗂</div>
          <span className="label">Tatt2Away Archive</span>
        </Link>
        <Link href="/overview" className={`nav-item${pathname.startsWith('/overview') ? ' active' : ''}`}>
          <div className="icon" style={{ background: 'rgba(59,130,246,.15)' }}>📊</div>
          <span className="label">Full Overview</span>
        </Link>
      </div>

      <hr className="sidebar-divider" />

      <div className="sidebar-section">
        <div className="sidebar-section-label">By City</div>
        {CITIES.map(c => (
          <Link
            key={c.slug}
            href={`/city/${c.slug}`}
            className={`nav-item${activeCitySlug === c.slug ? ' active' : ''}`}
          >
            <div className="icon" style={{ background: 'rgba(34,197,94,.12)' }}>📍</div>
            <span className="label">{c.label}</span>
            <span className="badge">{c.competitors.length}</span>
          </Link>
        ))}
      </div>

      <hr className="sidebar-divider" />

      <div className="sidebar-section">
        <Link href="/methodology" className={`nav-item${pathname.startsWith('/methodology') ? ' active' : ''}`}>
          <div className="icon" style={{ background: 'rgba(148,163,184,.1)' }}>📋</div>
          <span className="label">Methodology</span>
        </Link>
      </div>

      <hr className="sidebar-divider" />

      <div className="sidebar-section">
        <div className="sidebar-section-label">By Competitor</div>
        {CITIES.map(city => (
          <div key={city.slug} className="city-group">
            <button
              className={`city-header${openCities.has(city.slug) ? ' open' : ''}`}
              aria-expanded={openCities.has(city.slug)}
              onClick={() => toggleCity(city.slug)}
              style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
            >
              <span className="city-name">{city.label}</span>
              <span className="chevron">▶</span>
            </button>
            <div className={`city-competitors${openCities.has(city.slug) ? ' open' : ''}`}>
              {city.competitors.map(c => (
                <Link
                  key={c.slug}
                  href={`/competitor/${c.slug}`}
                  className={`comp-item${c.isInkout ? ' inkout' : ''}${pathname === `/competitor/${c.slug}` || pathname === `/competitor/${c.slug}/` ? ' comp-active' : ''}`}
                >
                  <div className="dot" style={{ background: c.dotColor }} />
                  <span className="comp-name">{c.name}</span>
                  <span className="comp-stars">
                    {liveStars.has(c.slug)
                      ? <StarRating value={liveStars.get(c.slug)!} showValue size="sm" />
                      : c.stars}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}
