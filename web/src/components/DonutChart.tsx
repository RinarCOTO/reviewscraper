'use client'

import { useEffect, useRef } from 'react'
import {
  Chart,
  DoughnutController,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { getChartColors } from '@/lib/chart-utils'

Chart.register(DoughnutController, ArcElement, Tooltip, Legend)

interface Props {
  labels: string[]
  data: number[]
  colors: string[]
  height?: number
}

export default function DonutChart({ labels, data, colors, height = 200 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    if (!ref.current) return
    if (chartRef.current) chartRef.current.destroy()

    const c = getChartColors()

    chartRef.current = new Chart(ref.current, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data, backgroundColor: colors, borderWidth: 0 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: { color: c.muted, boxWidth: 12, padding: 12 },
          },
        },
      },
    })

    return () => { chartRef.current?.destroy() }
  }, [labels, data, colors])

  return (
    <div style={{ position: 'relative', height }}>
      <canvas ref={ref} />
    </div>
  )
}
