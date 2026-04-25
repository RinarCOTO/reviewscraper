'use client'

import BarChart from './BarChart'
import { starColor } from '@/lib/utils'
import { resolveToken, getChartColors } from '@/lib/chart-utils'

interface CitySummary {
  cityKey: string
  avg_stars: number
  positive: number
}

export default function OverviewCharts({ citySummaries }: { citySummaries: CitySummary[] }) {
  if (!citySummaries.length) return null
  const c = getChartColors()
  const labels = citySummaries.map(c => c.cityKey)
  return (
    <div className="grid-2">
      <div className="card">
        <h3>Avg Stars by Market</h3>
        <BarChart
          labels={labels}
          datasets={[{
            data: citySummaries.map(s => s.avg_stars),
            backgroundColor: citySummaries.map(s => resolveToken(starColor(s.avg_stars))),
            borderRadius: 4,
            borderSkipped: false,
          }]}
          horizontal
          xmax={5}
          suffix=" ★"
        />
      </div>
      <div className="card">
        <h3>Positive Results % by Market</h3>
        <BarChart
          labels={labels}
          datasets={[{
            data: citySummaries.map(s => s.positive),
            backgroundColor: citySummaries.map(s =>
              s.positive >= 70 ? c.green : s.positive >= 50 ? c.yellow : c.red
            ),
            borderRadius: 4,
            borderSkipped: false,
          }]}
          horizontal
          xmax={100}
          suffix="%"
        />
      </div>
    </div>
  )
}
