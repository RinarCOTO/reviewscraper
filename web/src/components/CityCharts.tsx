'use client'

import BarChart from './BarChart'
import type { BusinessSummary } from '@/lib/types'

function shortName(b: string) {
  return b.replace('Tattoo Removal & Fading', '').replace('Tattoo Removal', '')
    .replace('Laser Clinic', '').replace('Medical Aesthetics', 'Med Aesthetics')
    .replace('Med Spa & Hair Restoration', 'Med Spa').replace('Cosmetic Center', 'Cosmetics')
    .replace('(Aesthetica)', '').trim()
}

function starColor(s: number) {
  return s >= 4.8 ? '#22c55e' : s >= 4.5 ? '#3b82f6' : s >= 4 ? '#f59e0b' : '#ef4444'
}

export default function CityCharts({ businesses }: { businesses: BusinessSummary[] }) {
  const labels = businesses.map(b => shortName(b.provider))
  return (
    <div className="grid-2">
      <div className="card">
        <h3>Avg Star Rating</h3>
        <BarChart
          labels={labels}
          datasets={[{
            data: businesses.map(b => b.avg_stars),
            backgroundColor: businesses.map(b => starColor(b.avg_stars)),
            borderRadius: 4,
            borderSkipped: false,
          }]}
          horizontal
          xmax={5}
          suffix=" ★"
        />
      </div>
      <div className="card">
        <h3>Positive vs Negative Results</h3>
        <BarChart
          labels={labels}
          datasets={[
            { label: 'Positive', data: businesses.map(b => b.result_pct.positive), backgroundColor: '#22c55e', borderRadius: 4, borderSkipped: false },
            { label: 'Negative', data: businesses.map(b => b.result_pct.negative), backgroundColor: '#ef4444', borderRadius: 4, borderSkipped: false },
          ]}
          horizontal
          legend
          xmax={100}
          suffix="%"
        />
      </div>
    </div>
  )
}
