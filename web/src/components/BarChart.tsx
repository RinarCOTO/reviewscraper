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
import { getChartColors } from '@/lib/chart-utils'

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend)

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

    const c = getChartColors()

    chartRef.current = new Chart(ref.current, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        indexAxis: horizontal ? 'y' : 'x',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: !!legend, labels: { color: c.muted } },
          tooltip: {
            callbacks: {
              label: (ctx) => ' ' + ctx.parsed[horizontal ? 'x' : 'y'] + (suffix || ''),
            },
          },
        },
        scales: {
          x: { grid: { color: c.border }, ticks: { color: c.muted }, stacked: !!stacked, max: xmax },
          y: {
            grid: { display: !horizontal, color: c.border },
            ticks: { color: c.text, font: { size: 11 } },
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
