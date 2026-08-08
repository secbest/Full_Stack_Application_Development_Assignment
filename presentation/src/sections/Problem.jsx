import { motion } from 'motion/react'
import content from '../data/content.js'

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
}

function ProblemCard({ label, children, delay }) {
  return (
    <motion.div
      className="card"
      variants={cardVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, delay }}
    >
      <p className="pill pill-danger">{label}</p>
      <div className="problem-card-body">{children}</div>
    </motion.div>
  )
}

export default function Problem() {
  const { title, who, what, barriers, cause, emotion, outcome } = content.problem

  return (
    <section className="section" id="problem">
      <div className="container">
        <h2 className="section-title">The Problem</h2>
        <p className="section-subtitle">{title}</p>

        <div className="grid-2">
          <ProblemCard label="Who" delay={0}>
            <p>{who}</p>
          </ProblemCard>
          <ProblemCard label="What" delay={0.05}>
            <p>{what}</p>
          </ProblemCard>
          <ProblemCard label="Barriers" delay={0.1}>
            <ul className="bullet-list">
              {barriers.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </ProblemCard>
          <ProblemCard label="Root Cause" delay={0.15}>
            <ul className="bullet-list">
              {cause.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </ProblemCard>
          <ProblemCard label="Emotion" delay={0.2}>
            <p>{emotion}</p>
          </ProblemCard>
          <ProblemCard label="Outcome" delay={0.25}>
            <ul className="bullet-list">
              {outcome.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </ProblemCard>
        </div>
      </div>
    </section>
  )
}
