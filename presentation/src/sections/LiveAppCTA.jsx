import { motion } from 'motion/react'
import content from '../data/content.js'

export default function LiveAppCTA() {
  const { url, buttonLabel } = content.liveApp

  return (
    <section className="section" id="live-app">
      <div className="container live-app-inner">
        <h2 className="section-title">See It Live</h2>
        <p className="section-subtitle">The platform, running end to end.</p>

        <motion.div
          className="browser-chrome"
          initial={{ opacity: 0, scale: 0.94, y: 24 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.7 }}
        >
          <div className="browser-chrome-bar">
            <span className="browser-dot" style={{ background: '#ef4444' }} />
            <span className="browser-dot" style={{ background: 'var(--warning)' }} />
            <span className="browser-dot" style={{ background: '#22c55e' }} />
            <span className="browser-address">{url}</span>
          </div>
          <iframe
            className="browser-chrome-frame"
            src={url}
            title="EFAR live application preview"
            loading="lazy"
          />
        </motion.div>

        <motion.a
          className="launch-button"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {buttonLabel} →
        </motion.a>
      </div>
    </section>
  )
}
