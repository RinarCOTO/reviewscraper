'use client'

import { useEffect, useRef } from 'react'
import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js'

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend)
Chart.defaults.color = '#94a3b8'
Chart.defaults.borderColor = '#2a2d3a'

interface Dataset {
  label?: string
  data: number[]
  backgroundColor: string | string[]
  borderRadius?: number
  borderSkipped?: boolean
}

interface Props {
  labels: string[]
  datasets: Dataset[]
  horizontal?: boolean
  xmax?: number
  suffix?: string
  legend?: boolean
  stacked?: boolean
  height?: number
}

export default function BarChart({ labels, datasets, horizontal, xmax, suffix, legend, stacked, height = 200 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    if (!ref.current) return
    if (chartRef.current) chartRef.current.destroy()

    chartRef.current = new Chart(ref.current, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        indexAxis: horizontal ? 'y' : 'x',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: !!legend },
          tooltip: {
            callbacks: {
              label: (ctx) => ' ' + ctx.parsed[horizontal ? 'x' : 'y'] + (suffix || ''),
            },
          },
        },
        scales: {
          x: { grid: { color: '#2a2d3a' }, ticks: { color: '#94a3b8' }, stacked: !!stacked, max: xmax },
          y: {
            grid: { display: !horizontal, color: '#2a2d3a' },
            ticks: { color: '#e2e8f0', font: { size: 11 } },
            stacked: !!stacked,
          },
        },
      },
    })

    return () => { chartRef.current?.destroy() }
  }, [labels, datasets, horizontal, xmax, suffix, legend, stacked])

  return (
    <div style={{ position: 'relative', height }}>
      <canvas ref={ref} />
    </div>
  )
}
