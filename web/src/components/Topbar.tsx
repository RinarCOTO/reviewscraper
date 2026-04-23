'use client'

import Link from 'next/link'
import HubSearch from './HubSearch'

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
  return (
    <div className="topbar">
      <div className="topbar-left">
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
        <div className="page-title">{title}</div>
      </div>
      <div className="topbar-right">
        {actions}
        <HubSearch />
      </div>
    </div>
  )
}
