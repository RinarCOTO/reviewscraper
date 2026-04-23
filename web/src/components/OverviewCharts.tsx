'use client'

import BarChart from './BarChart'

interface CitySummary {
  cityKey: string
  avg_stars: number
  positive: number
}

function starColor(s: number) {
  return s >= 4.8 ? '#22c55e' : s >= 4.5 ? '#3b82f6' : s >= 4 ? '#f59e0b' : '#ef4444'
}

export default function OverviewCharts({ citySummaries }: { citySummaries: CitySummary[] }) {
  if (!citySummaries.length) return null
  const labels = citySummaries.map(c => c.cityKey)
  return (
    <div className="grid-2">
      <div className="card">
        <h3>Avg Stars by Market</h3>
        <BarChart
          labels={labels}
          datasets={[{
            data: citySummaries.map(c => c.avg_stars),
            backgroundColor: citySummaries.map(c => starColor(c.avg_stars)),
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
            data: citySummaries.map(c => c.positive),
            backgroundColor: citySummaries.map(c => c.positive >= 70 ? '#22c55e' : c.positive >= 50 ? '#f59e0b' : '#ef4444'),
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
