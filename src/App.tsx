const schoolGroups = [
  { title: 'Primary', range: 'Classes 1–5', copy: 'Build strong foundations in core subjects.', icon: '✳' },
  { title: 'Middle school', range: 'Classes 6–8', copy: 'Strengthen concepts and problem-solving skills.', icon: '⌁' },
  { title: 'Secondary', range: 'Classes 9–10', copy: 'Practise concepts and prepare with confidence.', icon: '◇' },
  { title: 'Senior secondary', range: 'Classes 11–12', copy: 'Go deeper with focused subject practice.', icon: '↗' },
]
const schoolSubjects = ['Mathematics', 'Science', 'English', 'Social Science', 'Computer Science']
const gkgsAreas = [
  { title: 'Static GK', copy: 'Facts, places, awards, books, important days and more.' },
  { title: 'General Science', copy: 'Physics, Chemistry and Biology for exam practice.' },
  { title: 'Indian History', copy: 'Ancient, Medieval and Modern Indian History.' },
  { title: 'Geography', copy: 'Indian and World Geography, maps and environment.' },
  { title: 'Indian Polity', copy: 'Constitution, governance, rights and institutions.' },
  { title: 'Indian Economy', copy: 'Economic concepts, policies and key indicators.' },
  { title: 'Current Affairs', copy: 'Important national and international developments.' },
  { title: 'Environment', copy: 'Ecology, biodiversity and environmental awareness.' },
]
const examGroups = ['SSC', 'Railway', 'Teaching', 'Banking', 'Defence', 'Other competitive exams']

export default function App() {
  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#home" aria-label="SYNAPTYL home"><span className="brand-mark">S</span><span>SYNAPTYL</span></a>
        <nav aria-label="Main navigation"><a href="#k12">K–12</a><a href="#gk-gs">GK &amp; GS</a><a href="#how-it-works">How it works</a><a href="#about">About</a></nav>
        <a className="header-link" href="#learning-sections">Start learning <span>↗</span></a>
      </header>

      <section className="hero" id="home">
        <div className="hero-copy">
          <div className="eyebrow"><i /> OPEN LEARNING. ZERO COST.</div>
          <h1>Learn more.<br /><em>Move forward.</em></h1>
          <p className="hero-description">A free place to practise, learn and grow. Choose school learning for Classes 1–12 or GK &amp; GS practice for competitive examinations.</p>
          <div className="hero-actions"><a className="button primary" href="#learning-sections">Explore learning <span>→</span></a><a className="button secondary" href="#how-it-works">How it works</a></div>
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

      <div id="learning-sections">
        <section className="section learning-section k12-section" id="k12">
          <div className="section-heading"><div><div className="eyebrow">01 · SCHOOL LEARNING</div><h2>Learning for<br />every school stage.</h2></div><p>Explore class-wise practice for Classes 1–12. Build understanding, strengthen concepts and develop confidence one question at a time.</p></div>
          <div className="school-grid">{schoolGroups.map((group) => <article className="school-card" key={group.title}><div className="school-card-top"><span>{group.icon}</span><small>{group.range}</small></div><h3>{group.title}</h3><p>{group.copy}</p><a href="#subjects-k12" className="card-link">Explore class level <b>↗</b></a></article>)}</div>
          <div className="subject-band" id="subjects-k12"><div><small>SUBJECTS</small><b>Learn across the curriculum</b></div><div className="topic-tags">{schoolSubjects.map((subject) => <span className="topic-tag" key={subject}>{subject}</span>)}</div></div>
        </section>

        <section className="section learning-section gkgs-section" id="gk-gs">
          <div className="section-heading"><div><div className="eyebrow">02 · COMPETITIVE EXAM PREPARATION</div><h2>GK &amp; GS. <br />One focused place.</h2></div><p>Prepare for competitive examinations with topic-wise General Knowledge and General Studies practice, revision and explanations.</p></div>
          <div className="gkgs-grid">{gkgsAreas.map((area, index) => <article className="gkgs-card" key={area.title}><small>0{index + 1}</small><h3>{area.title}</h3><p>{area.copy}</p><a href="#exam-categories" aria-label={'Explore ' + area.title}>↗</a></article>)}</div>
          <div className="exam-band" id="exam-categories"><div><small>EXAM CATEGORIES</small><b>Practise for your target exam</b></div><div className="topic-tags">{examGroups.map((exam) => <span className="topic-tag" key={exam}>{exam}</span>)}</div></div>
        </section>
      </div>

      <section className="section how-section" id="how-it-works">
        <div className="eyebrow">A SIMPLE WAY TO GET BETTER</div><h2>Learn. Practise. Reflect.</h2>
        <div className="steps">{[['01', 'Choose your section', 'Start with K–12 school learning or GK & GS for competitive exams.'], ['02', 'Try questions', 'Work through questions at your own pace and learn from explanations.'], ['03', 'See your growth', 'Use your practice history to spot strengths and topics to revisit.']].map(([n, title, body]) => <article key={n}><small>{n}</small><h3>{title}</h3><p>{body}</p></article>)}</div>
      </section>

      <section className="closing" id="about"><div><div className="eyebrow light">YOUR NEXT STEP STARTS HERE</div><h2>Make practice part<br />of your progress.</h2></div><a className="button light-button" href="#learning-sections">Start exploring <span>→</span></a></section>
      <footer><a className="brand" href="#home"><span className="brand-mark">S</span><span>SYNAPTYL</span></a><span>Practice. Progress. Master.</span><span>© {new Date().getFullYear()} SYNAPTYL</span></footer>
    </main>
  )
}
