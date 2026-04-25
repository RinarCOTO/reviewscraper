'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { CITIES } from '@/lib/config'

// Format "Chicago IL" → "Chicago, IL"
function fmtLabel(label: string) {
  return label.replace(/\s([A-Z]{2})$/, ', $1')
}

const SEARCH_DATA = [
  ...CITIES.flatMap(city =>
    city.competitors.map(c => ({
      label: `${c.name} — ${fmtLabel(city.label)}`,
      sub: c.isInkout ? 'inkOUT · Competitor' : 'Competitor',
      href: `/competitor/${c.slug}`,
    }))
  ),
  ...CITIES.map(city => ({
    label: city.label,
    sub: 'City Market',
    href: `/city/${city.slug}`,
  })),
]

export default function HubSearch() {
  const [query, setQuery] = useState('')
  const [show, setShow] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const results = query.length > 1
    ? SEARCH_DATA.filter(d => d.label.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : []

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setShow(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="search-wrap" ref={wrapRef}>
      <span className="search-icon">🔍</span>
      <input
        type="text"
        placeholder="Search competitor or city…"
        aria-label="Search competitor or city"
        autoComplete="off"
        value={query}
        onChange={e => { setQuery(e.target.value); setShow(true) }}
        onFocus={() => setShow(true)}
      />
      {show && results.length > 0 && (
        <div id="search-results" style={{ display: 'block' }}>
          {results.map(r => (
            <Link key={r.href} href={r.href} onClick={() => setShow(false)}>
              {r.label}
              <div className="sr-sub">{r.sub}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
