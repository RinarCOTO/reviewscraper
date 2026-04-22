'use client'

import BarChart from './BarChart'
import DonutChart from './DonutChart'

interface Props {
  ratingDist: number[]
  resultPcts: number[]
  painLevels: number[]
  useCaseMap: Record<string, number>
}

export default function CompetitorCharts({ ratingDist, resultPcts, painLevels, useCaseMap }: Props) {
  return (
    <>
      <div className="grid-2" style={{ marginBottom: 18 }}>
        <div className="card">
          <h3>Rating Distribution</h3>
          <BarChart
            labels={['1★', '2★', '3★', '4★', '5★']}
            datasets={[{
              data: ratingDist,
              backgroundColor: ['#ef4444', '#f97316', '#f59e0b', '#3b82f6', '#22c55e'],
              borderRadius: 4,
              borderSkipped: false,
            }]}
            suffix=" reviews"
          />
        </div>
        <div className="card">
          <h3>Result Rating Breakdown</h3>
          <DonutChart
            labels={['Positive', 'Neutral', 'Mixed', 'Negative', 'Unknown']}
            data={resultPcts}
            colors={['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#374151']}
          />
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>Pain Level Distribution (when mentioned)</h3>
          <BarChart
            labels={['1-Painless', '2-Minimal', '3-Moderate', '4-Intense', '5-Severe']}
            datasets={[{
              data: painLevels,
              backgroundColor: ['#22c55e', '#86efac', '#f59e0b', '#f97316', '#ef4444'],
              borderRadius: 4,
              borderSkipped: false,
            }]}
            suffix=" reviews"
          />
        </div>
        <div className="card">
          <h3>Use Case Breakdown</h3>
          <div style={{ marginTop: 8 }}>
            {Object.entries(useCaseMap).map(([uc, count]) => (
              <div key={uc} className="bar-row" style={{ marginBottom: 10 }}>
                <div style={{ minWidth: 130, color: 'var(--text)', fontSize: 12 }}>{uc}</div>
                <div className="bar-bg">
                  <div className="bar-fill" style={{ width: `${Math.min(count * 10, 100)}%`, background: 'var(--accent)' }} />
                </div>
                <span className="bar-label">{count}</span>
              </div>
            ))}
            {Object.keys(useCaseMap).length === 0 && (
              <div style={{ color: 'var(--muted)', fontSize: 12 }}>No use case data available</div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
