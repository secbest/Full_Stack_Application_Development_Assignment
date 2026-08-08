import { motion } from 'motion/react'
import content from '../data/content.js'

const cardVariants = {
  hidden: { opacity: 0, scale: 0.92, y: 16 },
  visible: { opacity: 1, scale: 1, y: 0 },
}

export default function StakeholderRoles() {
  return (
    <section className="section" id="stakeholders">
      <div className="container">
        <h2 className="section-title">Who It's For</h2>
        <p className="section-subtitle">Four roles, one connected operations loop.</p>
        <div className="grid-4">
          {content.stakeholders.map((person, index) => (
            <motion.div
              key={person.role}
              className="card stakeholder-card"
              variants={cardVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.45, delay: index * 0.1 }}
            >
              <h3>{person.role}</h3>
              <p>{person.responsibility}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
