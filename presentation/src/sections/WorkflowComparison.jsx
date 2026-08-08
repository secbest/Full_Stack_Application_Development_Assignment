import { motion } from 'motion/react'
import content from '../data/content.js'

function WorkflowColumn({ title, steps, direction, pillClass }) {
  return (
    <motion.div
      className="card workflow-column"
      initial={{ opacity: 0, x: direction === 'left' ? -40 : 40 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.6 }}
    >
      <p className={`pill ${pillClass}`}>{title}</p>
      <ol className="workflow-steps">
        {steps.map((step, index) => (
          <li key={step}>
            <span className="workflow-step-number">{index + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </motion.div>
  )
}

export default function WorkflowComparison() {
  const { before, after } = content.workflow

  return (
    <section className="section" id="workflow">
      <div className="container">
        <h2 className="section-title">The Shift</h2>
        <p className="section-subtitle">
          From a manual, paper-based operation to a connected digital loop from intake to Xero.
        </p>
        <div className="grid-2">
          <WorkflowColumn title={before.title} steps={before.steps} direction="left" pillClass="pill-danger" />
          <WorkflowColumn title={after.title} steps={after.steps} direction="right" pillClass="pill-success" />
        </div>
      </div>
    </section>
  )
}
