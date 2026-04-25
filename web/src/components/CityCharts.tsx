'use client'

import BarChart from './BarChart'
import type { BusinessSummary } from '@/lib/types'
import { starColor } from '@/lib/utils'
import { resolveToken, getChartColors } from '@/lib/chart-utils'

function shortName(b: string) {
  return b.replace('Tattoo Removal & Fading', '').replace('Tattoo Removal', '')
    .replace('Laser Clinic', '').replace('Medical Aesthetics', 'Med Aesthetics')
    .replace('Med Spa & Hair Restoration', 'Med Spa').replace('Cosmetic Center', 'Cosmetics')
    .replace('(Aesthetica)', '').trim()
}

export default function CityCharts({ businesses }: { businesses: BusinessSummary[] }) {
  const c = getChartColors()
  const labels = businesses.map(b => shortName(b.provider))
  return (
    <div className="grid-2">
      <div className="card">
        <h3>Avg Star Rating</h3>
        <BarChart
          labels={labels}
          datasets={[{
            data: businesses.map(b => b.avg_stars),
            backgroundColor: businesses.map(b => resolveToken(starColor(b.avg_stars))),
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
            { label: 'Positive', data: businesses.map(b => b.result_pct.positive), backgroundColor: c.green, borderRadius: 4, borderSkipped: false },
            { label: 'Negative', data: businesses.map(b => b.result_pct.negative), backgroundColor: c.red, borderRadius: 4, borderSkipped: false },
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
