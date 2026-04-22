'use client'

import { useState } from 'react'
import Link from 'next/link'

const CITIES: { label: string; slug: string; count: number; competitors: { name: string; slug: string; stars: string; isInkout?: boolean; dotColor: string }[] }[] = [
  {
    label: 'Chicago IL', slug: 'chicago-il', count: 5,
    competitors: [
      { name: 'inkOUT', slug: 'inkout-chicago-il', stars: '5★', isInkout: true, dotColor: '#22c55e' },
      { name: 'Enfuse Medical Spa', slug: 'enfuse-medical-spa-chicago-il', stars: '5★', dotColor: '#22c55e' },
      { name: 'Removery (Bucktown)', slug: 'removery-bucktown-chicago-il', stars: '4.9★', dotColor: '#22c55e' },
      { name: 'Removery (Lincoln Square)', slug: 'removery-lincoln-square-chicago-il', stars: '4.8★', dotColor: '#22c55e' },
      { name: 'Kovak Cosmetic Center', slug: 'kovak-cosmetic-center-chicago-il', stars: '4.7★', dotColor: '#3b82f6' },
      { name: 'Tatt2Away', slug: 'tatt2away-chicago-il', stars: '4★', dotColor: '#f59e0b' },
    ],
  },
  {
    label: 'Austin TX', slug: 'austin-tx', count: 4,
    competitors: [
      { name: 'Removery (South Congress)', slug: 'removery-south-congress-austin-tx', stars: '5★', dotColor: '#22c55e' },
      { name: 'MEDermis Laser Clinic', slug: 'medermis-laser-clinic-austin-tx', stars: '5★', dotColor: '#22c55e' },
      { name: 'Clean Slate Ink', slug: 'clean-slate-ink-austin-tx', stars: '5★', dotColor: '#22c55e' },
      { name: 'Tatt2Away', slug: 'tatt2away-austin-tx', stars: '4.7★', dotColor: '#3b82f6' },
      { name: 'inkOUT', slug: 'inkout-austin-tx', stars: '4.6★', isInkout: true, dotColor: '#3b82f6' },
    ],
  },
  {
    label: 'Tampa FL', slug: 'tampa-fl', count: 4,
    competitors: [
      { name: 'Arviv Medical Aesthetics', slug: 'arviv-medical-aesthetics-tampa-fl', stars: '5★', dotColor: '#22c55e' },
      { name: 'Erasable Med Spa', slug: 'erasable-med-spa-tampa-fl', stars: '4.9★', dotColor: '#22c55e' },
      { name: 'inkOUT', slug: 'inkout-tampa-fl', stars: '4.8★', isInkout: true, dotColor: '#22c55e' },
      { name: 'Skintellect', slug: 'skintellect-tampa-fl', stars: '4.8★', dotColor: '#22c55e' },
    ],
  },
  {
    label: 'Houston TX', slug: 'houston-tx', count: 3,
    competitors: [
      { name: 'inkOUT', slug: 'inkout-houston-tx', stars: '4.9★', isInkout: true, dotColor: '#22c55e' },
      { name: 'InkFree, MD', slug: 'inkfree-md-houston-tx', stars: '4.8★', dotColor: '#22c55e' },
      { name: 'DermSurgery Associates', slug: 'dermsurgery-associates-houston-tx', stars: '4.7★', dotColor: '#3b82f6' },
    ],
  },
  {
    label: 'Pleasant Grove UT', slug: 'pleasant-grove-ut', count: 1,
    competitors: [
      { name: 'Inklifters (Aesthetica)', slug: 'inklifters-aesthetica-pleasant-grove-ut', stars: '4.9★', dotColor: '#22c55e' },
    ],
  },
  {
    label: 'Draper UT', slug: 'draper-ut', count: 2,
    competitors: [
      { name: 'Clarity Skin', slug: 'clarity-skin-draper-ut', stars: '4.6★', dotColor: '#3b82f6' },
      { name: 'inkOUT', slug: 'inkout-draper-ut', stars: '4.3★', isInkout: true, dotColor: '#f59e0b' },
      { name: 'Tatt2Away', slug: 'tatt2away-draper-ut', stars: '3★', dotColor: '#ef4444' },
    ],
  },
]

export default function Sidebar({ totalReviews }: { totalReviews?: number }) {
  const [openCities, setOpenCities] = useState<Set<string>>(new Set())

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
        <Link href="/" className="nav-item">
          <div className="icon" style={{ background: 'rgba(108,99,255,.2)' }}>🏠</div>
          <span className="label">Hub Dashboard</span>
        </Link>
        <Link href="/reviews" className="nav-item">
          <div className="icon" style={{ background: 'rgba(34,197,94,.12)' }}>💬</div>
          <span className="label">All Reviews</span>
          <span className="badge">{totalReviews ?? '…'}</span>
        </Link>
        <Link href="/overview" className="nav-item">
          <div className="icon" style={{ background: 'rgba(59,130,246,.15)' }}>📊</div>
          <span className="label">Full Overview</span>
        </Link>
      </div>

      <hr className="sidebar-divider" />

      <div className="sidebar-section">
        <div className="sidebar-section-label">By City</div>
        {CITIES.map(c => (
          <Link key={c.slug} href={`/city/${c.slug}`} className="nav-item">
            <div className="icon" style={{ background: 'rgba(34,197,94,.12)' }}>📍</div>
            <span className="label">{c.label}</span>
            <span className="badge">{c.count}</span>
          </Link>
        ))}
      </div>

      <hr className="sidebar-divider" />

      <div className="sidebar-section">
        <div className="sidebar-section-label">By Competitor</div>
        {CITIES.map(city => (
          <div key={city.slug} className="city-group">
            <div
              className={`city-header ${openCities.has(city.slug) ? 'open' : ''}`}
              onClick={() => toggleCity(city.slug)}
            >
              <span className="city-name">{city.label}</span>
              <span className="chevron">▶</span>
            </div>
            <div className={`city-competitors ${openCities.has(city.slug) ? 'open' : ''}`}>
              {city.competitors.map(c => (
                <Link
                  key={c.slug}
                  href={`/competitor/${c.slug}`}
                  className={`comp-item${c.isInkout ? ' inkout' : ''}`}
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
