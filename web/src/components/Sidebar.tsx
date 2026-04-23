'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { CITIES } from '@/lib/config'

export default function Sidebar() {
  const pathname = usePathname()
  const [openCities, setOpenCities] = useState<Set<string>>(new Set())
  const [totalReviews, setTotalReviews] = useState<number | undefined>()
  const [pendingCount, setPendingCount] = useState<number | undefined>()

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
      .in('bucket', ['tatt2away', 'review_required'])
      .neq('status', 'rejected')
      .then(({ count }) => setPendingCount(count ?? undefined))
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
            <span className="badge" style={{ background: '#f59e0b', color: '#000' }}>{pendingCount}</span>
          )}
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
        <div className="sidebar-section-label">By Competitor</div>
        {CITIES.map(city => (
          <div key={city.slug} className="city-group">
            <div
              className={`city-header${openCities.has(city.slug) ? ' open' : ''}`}
              onClick={() => toggleCity(city.slug)}
            >
              <span className="city-name">{city.label}</span>
              <span className="chevron">▶</span>
            </div>
            <div className={`city-competitors${openCities.has(city.slug) ? ' open' : ''}`}>
              {city.competitors.map(c => (
                <Link
                  key={c.slug}
                  href={`/competitor/${c.slug}`}
                  className={`comp-item${c.isInkout ? ' inkout' : ''}${pathname === `/competitor/${c.slug}` ? ' comp-active' : ''}`}
                >
                  <div className="dot" style={{ background: c.dotColor }} />
                  <span className="comp-name">{c.name}</span>
                  <span className="comp-stars">{c.stars}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}
