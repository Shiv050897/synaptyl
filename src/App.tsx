const tracks = [
  { icon: '✳', number: '01', title: 'School learning', body: 'Build strong foundations, one topic and one question at a time.', detail: 'Classes 1–12', href: '#subjects' },
  { icon: '⌁', number: '02', title: 'Competitive exams', body: 'Prepare with focused practice for the exams you are working towards.', detail: 'SSC · Railway · Teaching · Banking · Defence', href: '#competitive-exams' },
  { icon: '◷', number: '03', title: 'Daily practice', body: 'Create a steady learning rhythm with daily goals and revision.', detail: 'Practice at your pace', href: '#how-it-works' },
]
const subjects = ['Mathematics', 'Science', 'English', 'Social Studies', 'Reasoning', 'General Awareness']
const exams = ['SSC', 'Railway', 'Teaching', 'Banking', 'Defence', 'Other exams']

export default function App() {
  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#home" aria-label="SYNAPTYL home"><span className="brand-mark">S</span><span>SYNAPTYL</span></a>
        <nav aria-label="Main navigation"><a href="#learning-paths">Explore</a><a href="#subjects">Subjects</a><a href="#how-it-works">How it works</a><a href="#about">About</a></nav>
        <a className="header-link" href="#learning-paths">Get started <span>↗</span></a>
      </header>

      <section className="hero" id="home">
        <div className="hero-copy">
          <div className="eyebrow"><i /> OPEN LEARNING. ZERO COST.</div>
          <h1>Small steps.<br /><em>Stronger</em> every day.</h1>
          <p className="hero-description">A calmer, smarter place to practise, learn and see your progress — whether you are in school or preparing for your next big exam.</p>
          <div className="hero-actions"><a className="button primary" href="#learning-paths">Explore free practice <span>→</span></a><a className="button secondary" href="#how-it-works">See how it works</a></div>
          <div className="hero-note"><b>✓</b> Free for every learner. No premium walls.</div>
        </div>
        <div className="hero-art" aria-label="Illustration of a learning progress dashboard">
          <div className="orbit orbit-a" /><div className="orbit orbit-b" />
          <div className="dashboard">
            <div className="dash-top"><small>YOUR LEARNING SPACE</small><i /></div>
            <h2>Progress, not pressure.</h2>
            <div className="progress-label"><span>Today’s practice</span><b>Keep going</b></div>
            <div className="progress"><span /></div>
            <div className="tiles">
              <div className="tile lavender"><strong>✳</strong><small>LEARN</small><b>Understand</b></div>
              <div className="tile mint"><strong>↗</strong><small>PRACTISE</small><b>Strengthen</b></div>
              <div className="tile peach"><strong>◎</strong><small>REVIEW</small><b>Remember</b></div>
              <div className="tile blue"><strong>✦</strong><small>GROW</small><b>Improve</b></div>
            </div>
            <div className="dash-foot">✦ <span>Every question is a chance to grow.</span></div>
          </div>
          <div className="float-note left-note">✦ &nbsp; One question at a time</div>
          <div className="float-note right-note">↗ &nbsp; Your pace. Your progress.</div>
        </div>
      </section>

      <section className="promise-strip">
        <div><b>01</b> Learn with clarity</div><div><b>02</b> Practise with purpose</div><div><b>03</b> Track your progress</div><div><b>04</b> Always free to use</div>
      </section>

      <section className="section" id="learning-paths">
        <div className="section-heading"><div><div className="eyebrow">FIND YOUR PATH</div><h2>One place to keep<br />moving forward.</h2></div><p>Choose where you are today. SYNAPTYL helps you build the knowledge and confidence to take your next step.</p></div>
        <div className="track-grid">{tracks.map((track) => <a className="track-card" href={track.href} key={track.number}><div className="track-top"><span>{track.icon}</span><small>{track.number}</small></div><h3>{track.title}</h3><p>{track.body}</p><div className="track-bottom"><small>{track.detail}</small><b>↗</b></div></a>)}</div>
      </section>

      <section className="section subjects-section" id="subjects">
        <div className="subjects-copy"><div className="eyebrow">LEARNING, MADE ACCESSIBLE</div><h2>Build confidence<br />in every subject.</h2><p>From classroom fundamentals to competitive-exam practice, explore a growing question library designed to make learning active.</p><a className="text-link" href="#learning-paths">Explore learning paths&nbsp; →</a></div>
        <div className="subject-panel"><div className="subject-list">{subjects.map((subject, i) => <div className="subject-row" key={subject}><small>0{i + 1}</small><b>{subject}</b><span>↗</span></div>)}</div><div className="exam-tracks" id="competitive-exams"><small>COMPETITIVE EXAM CATEGORIES</small><div>{exams.map((exam) => <span key={exam}>{exam}</span>)}</div></div></div>
      </section>

      <section className="section how-section" id="how-it-works">
        <div className="eyebrow">A SIMPLE WAY TO GET BETTER</div><h2>Learn. Practise. Reflect.</h2>
        <div className="steps">{[['01', 'Choose a topic', 'Start with a subject, chapter or exam area that matters to you.'], ['02', 'Try questions', 'Work through questions at your own pace and learn from explanations.'], ['03', 'See your growth', 'Use your practice history to spot strengths and topics to revisit.']].map(([n, title, body]) => <article key={n}><small>{n}</small><h3>{title}</h3><p>{body}</p></article>)}</div>
      </section>

      <section className="closing" id="about"><div><div className="eyebrow light">YOUR NEXT STEP STARTS HERE</div><h2>Make practice part<br />of your progress.</h2></div><a className="button light-button" href="#learning-paths">Start exploring <span>→</span></a></section>
      <footer><a className="brand" href="#home"><span className="brand-mark">S</span><span>SYNAPTYL</span></a><span>Practice. Progress. Master.</span><span>© {new Date().getFullYear()} SYNAPTYL</span></footer>
    </main>
  )
}
