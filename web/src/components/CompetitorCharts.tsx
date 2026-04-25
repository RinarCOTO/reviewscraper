'use client'

import BarChart from './BarChart'
import DonutChart from './DonutChart'
import { getChartColors } from '@/lib/chart-utils'

interface Props {
  ratingDist: number[]
  resultPcts: number[]
  painLevels: number[]
  useCaseMap: Record<string, number>
}

export default function CompetitorCharts({ ratingDist, resultPcts, painLevels, useCaseMap }: Props) {
  const c = getChartColors()
  return (
    <>
      <div className="grid-2" style={{ marginBottom: 18 }}>
        <div className="card">
          <h3>Rating Distribution</h3>
          <BarChart
            labels={['1★', '2★', '3★', '4★', '5★']}
            datasets={[{
              data: ratingDist,
              backgroundColor: [c.red, c.orange, c.yellow, c.blue, c.green],
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
            colors={[c.green, c.blue, c.yellow, c.red, c.grayDim]}
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
              backgroundColor: [c.green, c.greenLight, c.yellow, c.orange, c.red],
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
