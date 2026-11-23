import { useState } from 'react'
import { SITE } from './siteConfig'
import './home.css'

type Track = 'k12' | 'gk_gs'

type Props = {
  signedIn: boolean
  isAdmin: boolean
  onSignIn: () => void
  onJoin: () => void
  onAccount: () => void
  onAdmin: () => void
  onStudy: (track: Track) => void
}

// Sample questions for the try-it card. Facts checked against standard references.
const SAMPLES = [
  {
    area: 'GK & GS · Indian Polity',
    prompt: 'Which article of the Indian Constitution abolishes untouchability?',
    options: ['Article 14', 'Article 17', 'Article 21', 'Article 32'],
    answer: 1,
    why: 'Article 17 abolishes untouchability and makes its practice in any form an offence.',
  },
  {
    area: 'Class 7 · Science',
    prompt: 'What is the SI unit of electric current?',
    options: ['Volt', 'Watt', 'Ampere', 'Ohm'],
    answer: 2,
    why: 'Current is measured in amperes (A). Volts measure potential difference and ohms measure resistance.',
  },
  {
    area: 'Class 6 · Mathematics',
    prompt: 'What is 15% of 200?',
    options: ['15', '20', '30', '35'],
    answer: 2,
    why: '15% of 200 = 15/100 × 200 = 30.',
  },
]

const STAGES = [
  { name: 'Primary', classes: [1, 2, 3, 4, 5] },
  { name: 'Middle', classes: [6, 7, 8] },
  { name: 'Secondary', classes: [9, 10] },
  { name: 'Senior secondary', classes: [11, 12] },
]
const SUBJECTS = ['Mathematics', 'Science', 'English', 'Social Science', 'Computer Science']
const GK_TOPICS = ['Static GK', 'General Science', 'Indian History', 'Geography', 'Indian Polity', 'Indian Economy', 'Current Affairs', 'Environment']
const EXAMS = ['SSC', 'Railway', 'Banking', 'Teaching', 'Defence']

const FAQ = [
  { q: 'Is SYNAPTYL really free?', a: 'Yes. Every question, explanation and progress feature is free. There is no paid plan.' },
  { q: 'Who is it for?', a: 'School students in Classes 1 to 12, and anyone preparing for competitive exams such as SSC, Railway, Banking, Teaching and Defence.' },
  { q: 'Can children under 18 use it?', a: 'Yes, with a parent or guardian. A parent or guardian creates the account, and learning opens once their permission has been checked. We never use children’s details for advertising.' },
  { q: 'What kinds of questions are there?', a: 'Multiple choice, numerical and written questions. Multiple-choice and numerical answers are checked instantly, with an explanation.' },
  { q: 'Do I need to install anything?', a: 'No. SYNAPTYL works in the browser on any phone, tablet or computer.' },
]

function TryQuestion() {
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const q = SAMPLES[i]
  const answered = picked !== null
  const right = picked === q.answer

  return (
    <div className="hp-try" aria-live="polite">
      <div className="hp-try-head">
        <span>{q.area}</span>
        <span>Try a question</span>
      </div>
      <p className="hp-try-q">{q.prompt}</p>
      <div className="hp-try-options">
        {q.options.map((opt, idx) => {
          const state = !answered ? '' : idx === q.answer ? 'is-right' : idx === picked ? 'is-wrong' : 'is-dim'
          return (
            <button key={opt} type="button" className={`hp-opt ${state}`} disabled={answered} onClick={() => setPicked(idx)}>
              <span className="hp-opt-key">{String.fromCharCode(65 + idx)}</span>
              {opt}
            </button>
          )
        })}
      </div>
      {answered ? (
        <div className={`hp-try-result ${right ? 'is-right' : 'is-wrong'}`}>
          <b>{right ? 'Correct.' : `Not quite. The answer is ${q.options[q.answer]}.`}</b>
          <p>{q.why}</p>
          <button type="button" className="hp-link" onClick={() => { setI((i + 1) % SAMPLES.length); setPicked(null) }}>
            Try another question
          </button>
        </div>
      ) : (
        <p className="hp-try-hint">Pick an answer to see how practice works.</p>
      )}
    </div>
  )
}

export default function Home({ signedIn, isAdmin, onSignIn, onJoin, onAccount, onAdmin, onStudy }: Props) {
  const start = signedIn ? onAccount : onJoin

  return (
    <div className="hp">
      <header className="hp-header">
        <a className="brand hp-brand" href="#top" aria-label="SYNAPTYL home">
          <span className="hp-mark">S</span>SYNAPTYL
        </a>
        <nav className="hp-nav" aria-label="Main">
          <a href="#school">School</a>
          <a href="#exams">Competitive exams</a>
          <a href="#faq">Questions</a>
        </nav>
        <div className="hp-header-actions">
          {signedIn ? (
            <>
              {isAdmin && <button type="button" className="hp-btn hp-btn-quiet" onClick={onAdmin}>Admin</button>}
              <button type="button" className="hp-btn hp-btn-dark" onClick={onAccount}>My learning</button>
            </>
          ) : (
            <>
              <button type="button" className="hp-btn hp-btn-quiet" onClick={onSignIn}>Sign in</button>
              <button type="button" className="hp-btn hp-btn-dark" onClick={onJoin}>Join free</button>
            </>
          )}
        </div>
      </header>

      <main id="top">
        <section className="hp-hero">
          <div className="hp-hero-copy">
            <h1>Practise every day. Get better every week.</h1>
            <p className="hp-lede">
              Free practice questions with instant answers and clear explanations, for Classes 1–12 and for
              SSC, Railway, Banking and other competitive exams.
            </p>
            <div className="hp-hero-actions">
              <button type="button" className="hp-btn hp-btn-primary hp-btn-lg" onClick={start}>
                {signedIn ? 'Continue practising' : 'Start practising free'}
              </button>
              {!signedIn && <button type="button" className="hp-btn hp-btn-outline hp-btn-lg" onClick={onSignIn}>I have an account</button>}
            </div>
            <ul className="hp-facts">
              <li>Free for everyone</li>
              <li>Works on any phone</li>
              <li>Safe for children</li>
            </ul>
          </div>
          <TryQuestion />
        </section>

        <section className="hp-tracks">
          <article className="hp-track hp-track-school" id="school">
            <h2>School learning</h2>
            <p>Class-wise practice to build understanding and confidence, one question at a time.</p>
            <div className="hp-stages">
              {STAGES.map((s) => (
                <div key={s.name} className="hp-stage">
                  <span className="hp-stage-name">{s.name}</span>
                  <div className="hp-chips">
                    {s.classes.map((c) => (
                      <button key={c} type="button" className="hp-chip hp-chip-class" onClick={() => onStudy('k12')} aria-label={`Practise Class ${c}`}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="hp-subjects">{SUBJECTS.join(', ')}</p>
            <button type="button" className="hp-btn hp-btn-primary" onClick={() => onStudy('k12')}>Practise school subjects</button>
          </article>

          <article className="hp-track hp-track-exams" id="exams">
            <h2>Competitive exams</h2>
            <p>Topic-wise General Knowledge and General Studies, with explanations you can revise from.</p>
            <div className="hp-chips hp-chips-topics">
              {GK_TOPICS.map((t) => (
                <button key={t} type="button" className="hp-chip" onClick={() => onStudy('gk_gs')}>{t}</button>
              ))}
            </div>
            <p className="hp-subjects">Useful for {EXAMS.join(', ')} and more.</p>
            <button type="button" className="hp-btn hp-btn-light" onClick={() => onStudy('gk_gs')}>Practise GK &amp; GS</button>
          </article>
        </section>

        <section className="hp-section hp-benefits">
          <h2>Everything you need to practise well</h2>
          <ul className="hp-benefit-list">
            <li><b>Instant answers</b><span>See straight away whether you were right, with the correct answer marked.</span></li>
            <li><b>Explanations</b><span>Every answer comes with a short explanation, so you learn from mistakes.</span></li>
            <li><b>Your progress</b><span>See how many questions you have tried and how accurate you are, subject by subject.</span></li>
            <li><b>Save questions</b><span>Bookmark tricky questions and come back to them before exams.</span></li>
            <li><b>Built for phones</b><span>Large, clear buttons and text that work well on any phone.</span></li>
            <li><b>Safe for children</b><span>Under-18 accounts need a parent or guardian, and their details are never used for ads.</span></li>
          </ul>
        </section>

        <section className="hp-section hp-steps-wrap">
          <h2>How it works</h2>
          <ol className="hp-steps">
            <li><b>Create a free account</b><span>Takes a minute. Parents sign up for learners under 18.</span></li>
            <li><b>Choose what to practise</b><span>Pick your class and subject, or a GK &amp; GS topic.</span></li>
            <li><b>Answer and learn</b><span>Check each answer, read the explanation and track your progress.</span></li>
          </ol>
        </section>

        <section className="hp-section hp-faq" id="faq">
          <h2>Common questions</h2>
          <div className="hp-faq-list">
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="hp-closing">
          <h2>Ten questions a day is a good start.</h2>
          <button type="button" className="hp-btn hp-btn-light hp-btn-lg" onClick={start}>
            {signedIn ? 'Continue practising' : 'Create your free account'}
          </button>
        </section>
      </main>

      <div className="hp-footer" role="contentinfo">
        <a className="brand hp-brand" href="#top"><span className="hp-mark">S</span>SYNAPTYL</a>
        <nav aria-label="Footer">
          <a href="/privacy">Privacy policy</a>
          <a href="/terms">Terms of use</a>
          <a href="/contact">Contact</a>
        </nav>
        <small>© {new Date().getFullYear()} {SITE.name}. Practice. Progress. Master.</small>
      </div>
    </div>
  )
}
