import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

type SubjectRow = { track: 'k12' | 'gk_gs'; class_number: number | null; subject: string; attempted: number; correct: number; graded: number }
type Progress = { sessions: number; attempted: number; correct: number; graded: number; last_practised_at: string | null; subjects: SubjectRow[] }

const pct = (correct: number, graded: number) => (graded ? Math.round((correct / graded) * 100) : null)

/** The learner's own practice totals, shown in their learning space. */
export default function ProgressPanel() {
  const [data, setData] = useState<Progress | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!supabase) return
    void supabase.rpc('my_progress').then(({ data: d, error }) => {
      if (error) setFailed(true)
      else setData(d as Progress)
    })
  }, [])

  if (failed) return null
  if (!data) return <div className="progress-panel"><p className="progress-empty">Loading your progress…</p></div>

  const accuracy = pct(data.correct, data.graded)
  return (
    <section className="progress-panel" aria-label="Your progress">
      <h3>Your progress</h3>
      {data.attempted === 0 ? (
        <p className="progress-empty">You haven&rsquo;t answered any questions yet. Pick a learning area above to start.</p>
      ) : (
        <>
          <div className="progress-stats">
            <div><strong>{data.attempted}</strong><span>questions answered</span></div>
            <div><strong>{data.correct}</strong><span>correct</span></div>
            <div><strong>{accuracy === null ? '–' : `${accuracy}%`}</strong><span>accuracy</span></div>
          </div>
          <ul className="progress-subjects">
            {data.subjects.map((s) => {
              const p = pct(s.correct, s.graded)
              return (
                <li key={`${s.track}-${s.class_number}-${s.subject}`}>
                  <div className="progress-subject-name">
                    <b>{s.subject}</b>
                    <small>{s.track === 'k12' ? `Class ${s.class_number}` : 'GK & GS'} · {s.attempted} answered</small>
                  </div>
                  <div className="progress-bar" aria-label={p === null ? 'Not graded' : `${p}% correct`}>
                    <span style={{ width: `${p ?? 0}%` }} />
                  </div>
                  <span className="progress-pct">{p === null ? '–' : `${p}%`}</span>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}
