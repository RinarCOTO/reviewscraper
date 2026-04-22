'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'

const SEARCH_DATA = [
  { label: 'inkOUT — Chicago, IL', sub: 'Competitor · TEPR', href: '/competitor/inkout-chicago-il' },
  { label: 'inkOUT — Austin, TX', sub: 'Competitor · TEPR', href: '/competitor/inkout-austin-tx' },
  { label: 'inkOUT — Houston, TX', sub: 'Competitor · TEPR', href: '/competitor/inkout-houston-tx' },
  { label: 'inkOUT — Draper, UT', sub: 'Competitor · TEPR', href: '/competitor/inkout-draper-ut' },
  { label: 'inkOUT — Tampa, FL', sub: 'Competitor · TEPR', href: '/competitor/inkout-tampa-fl' },
  { label: 'MEDermis Laser Clinic — Austin, TX', sub: 'Competitor · Spectra', href: '/competitor/medermis-laser-clinic-austin-tx' },
  { label: 'Removery (South Congress) — Austin, TX', sub: 'Competitor · PicoWay', href: '/competitor/removery-south-congress-austin-tx' },
  { label: 'Removery (Bucktown) — Chicago, IL', sub: 'Competitor · PicoWay', href: '/competitor/removery-bucktown-chicago-il' },
  { label: 'Removery (Lincoln Square) — Chicago, IL', sub: 'Competitor · PicoWay', href: '/competitor/removery-lincoln-square-chicago-il' },
  { label: 'Enfuse Medical Spa — Chicago, IL', sub: 'Competitor', href: '/competitor/enfuse-medical-spa-chicago-il' },
  { label: 'Kovak Cosmetic Center — Chicago, IL', sub: 'Competitor · Q-Switch', href: '/competitor/kovak-cosmetic-center-chicago-il' },
  { label: 'Tatt2Away — Chicago, IL', sub: 'Competitor · TEPR', href: '/competitor/tatt2away-chicago-il' },
  { label: 'Clean Slate Ink — Austin, TX', sub: 'Competitor · Q-Switch', href: '/competitor/clean-slate-ink-austin-tx' },
  { label: 'Tatt2Away — Austin, TX', sub: 'Competitor · TEPR', href: '/competitor/tatt2away-austin-tx' },
  { label: 'Arviv Medical Aesthetics — Tampa, FL', sub: 'Competitor', href: '/competitor/arviv-medical-aesthetics-tampa-fl' },
  { label: 'Erasable Med Spa — Tampa, FL', sub: 'Competitor · PicoWay', href: '/competitor/erasable-med-spa-tampa-fl' },
  { label: 'Skintellect — Tampa, FL', sub: 'Competitor', href: '/competitor/skintellect-tampa-fl' },
  { label: 'InkFree, MD — Houston, TX', sub: 'Competitor · PicoWay', href: '/competitor/inkfree-md-houston-tx' },
  { label: 'DermSurgery Associates — Houston, TX', sub: 'Competitor · Q-Switch', href: '/competitor/dermsurgery-associates-houston-tx' },
  { label: 'Inklifters (Aesthetica) — Pleasant Grove, UT', sub: 'Competitor', href: '/competitor/inklifters-aesthetica-pleasant-grove-ut' },
  { label: 'Clarity Skin — Draper, UT', sub: 'Competitor · PicoWay', href: '/competitor/clarity-skin-draper-ut' },
  { label: 'Tatt2Away — Draper, UT', sub: 'Competitor · TEPR', href: '/competitor/tatt2away-draper-ut' },
  { label: 'Austin TX', sub: 'City Market', href: '/city/austin-tx' },
  { label: 'Chicago IL', sub: 'City Market', href: '/city/chicago-il' },
  { label: 'Draper UT', sub: 'City Market', href: '/city/draper-ut' },
  { label: 'Houston TX', sub: 'City Market', href: '/city/houston-tx' },
  { label: 'Pleasant Grove UT', sub: 'City Market', href: '/city/pleasant-grove-ut' },
  { label: 'Tampa FL', sub: 'City Market', href: '/city/tampa-fl' },
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
