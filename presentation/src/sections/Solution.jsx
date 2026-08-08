import { motion } from 'motion/react'
import content from '../data/content.js'

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
}

export default function Solution() {
  return (
    <section className="section" id="solution">
      <div className="container">
        <h2 className="section-title">The Solution</h2>
        <p className="section-subtitle">Four capabilities that close the loop.</p>
        <div className="grid-2">
          {content.solution.map((item, index) => (
            <motion.div
              key={item.capability}
              className="card"
              variants={cardVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <p className="pill pill-accent">{item.capability}</p>
              <p className="solution-impact">{item.impact}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
