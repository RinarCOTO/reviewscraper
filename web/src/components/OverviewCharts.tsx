'use client'

import BarChart from './BarChart'

const CITY_SUMMARIES = [
  { cityKey: 'Austin, TX', avg_stars: 4.9, positive: 82 },
  { cityKey: 'Pleasant Grove, UT', avg_stars: 4.9, positive: 90 },
  { cityKey: 'Tampa, FL', avg_stars: 4.9, positive: 53 },
  { cityKey: 'Chicago, IL', avg_stars: 4.8, positive: 71 },
  { cityKey: 'Houston, TX', avg_stars: 4.8, positive: 68 },
  { cityKey: 'Draper, UT', avg_stars: 4.4, positive: 51 },
]

function starColor(s: number) {
  return s >= 4.8 ? '#22c55e' : s >= 4.5 ? '#3b82f6' : s >= 4 ? '#f59e0b' : '#ef4444'
}

export default function OverviewCharts() {
  const labels = CITY_SUMMARIES.map(c => c.cityKey)
  return (
    <div className="grid-2">
      <div className="card">
        <h3>Avg Stars by Market</h3>
        <BarChart
          labels={labels}
          datasets={[{
            data: CITY_SUMMARIES.map(c => c.avg_stars),
            backgroundColor: CITY_SUMMARIES.map(c => starColor(c.avg_stars)),
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
            data: CITY_SUMMARIES.map(c => c.positive),
            backgroundColor: CITY_SUMMARIES.map(c => c.positive >= 70 ? '#22c55e' : c.positive >= 50 ? '#f59e0b' : '#ef4444'),
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
