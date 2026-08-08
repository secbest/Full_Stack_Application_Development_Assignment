import { motion } from 'motion/react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import content from '../data/content.js'

const BAR_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444']

function ChartTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null
  const point = payload[0].payload
  return (
    <div className="chart-tooltip">
      <p>{point.metric}</p>
      <p className="chart-tooltip-value">{point.rangeLabel}</p>
    </div>
  )
}

export default function SuccessMetrics() {
  const data = content.successMetrics

  return (
    <section className="section" id="success-metrics">
      <div className="container">
        <h2 className="section-title">Success Criteria</h2>
        <p className="section-subtitle">Target outcomes for the proof of concept.</p>

        <motion.div
          className="card chart-card"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6 }}
        >
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data} layout="vertical" margin={{ left: 24, right: 24 }}>
              <XAxis type="number" domain={[0, 100]} stroke="#94a3b8" tickFormatter={(v) => `${v}%`} />
              <YAxis
                type="category"
                dataKey="metric"
                width={260}
                stroke="#94a3b8"
                tick={{ fontSize: 12 }}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Bar dataKey="chartValue" radius={[0, 6, 6, 0]}>
                {data.map((entry, index) => (
                  <Cell key={entry.metric} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <div className="grid-4 metrics-legend">
          {data.map((item, index) => (
            <motion.div
              key={item.metric}
              className="card"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.4, delay: index * 0.08 }}
            >
              <p className="metric-range" style={{ color: BAR_COLORS[index % BAR_COLORS.length] }}>
                {item.rangeLabel}
              </p>
              <p className="metric-label">{item.metric}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
