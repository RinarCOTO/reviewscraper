'use client'

import { useEffect, useRef } from 'react'
import {
  Chart,
  DoughnutController,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'

Chart.register(DoughnutController, ArcElement, Tooltip, Legend)
Chart.defaults.color = '#94a3b8'
Chart.defaults.borderColor = '#2a2d3a'

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
            labels: { color: '#94a3b8', boxWidth: 12, padding: 12 },
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
