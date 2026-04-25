'use client'

import { useState } from 'react'
import Link from 'next/link'
import HubSearch from './HubSearch'
import Sidebar from './Sidebar'

interface Crumb {
  label: string
  href?: string
}

interface TopbarProps {
  title: string
  crumbs?: Crumb[]
  actions?: React.ReactNode
}

export default function Topbar({ title, crumbs, actions }: TopbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <button
            className="topbar-hamburger"
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <rect x="2" y="4" width="16" height="2" rx="1" />
              <rect x="2" y="9" width="16" height="2" rx="1" />
              <rect x="2" y="14" width="16" height="2" rx="1" />
            </svg>
          </button>
          {crumbs && crumbs.length > 0 && (
            <nav className="breadcrumbs">
              <Link href="/">Hub</Link>
              {crumbs.map((c, i) => (
                <span key={i}>
                  <span className="crumb-sep">/</span>
                  {c.href
                    ? <Link href={c.href}>{c.label}</Link>
                    : <span className="crumb-cur">{c.label}</span>
                  }
                </span>
              ))}
            </nav>
          )}
          <h1 className="page-title">{title}</h1>
        </div>
        <div className="topbar-right">
          {actions}
          <HubSearch />
        </div>
      </div>

      {mobileOpen && (
        <div className="mobile-backdrop" onClick={() => setMobileOpen(false)} />
      )}
      <div className={`mobile-drawer-sidebar${mobileOpen ? ' open' : ''}`}>
        <Sidebar />
      </div>
    </>
  )
}
