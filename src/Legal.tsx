import { useEffect, type ReactNode } from 'react'
import { SITE } from './siteConfig'
import './home.css'

export type LegalPageName = 'privacy' | 'terms' | 'contact'

const TITLES: Record<LegalPageName, string> = {
  privacy: 'Privacy policy',
  terms: 'Terms of use',
  contact: 'Contact us',
}

const mail = <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>

function Privacy() {
  return (
    <>
      <p>
        This policy explains what personal data {SITE.name} collects when you use {SITE.url.replace('https://', '')}, why we
        collect it, and the choices you have. We follow India&rsquo;s Digital Personal Data Protection Act, 2023.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><b>Account details:</b> name, email address, password (stored only in encrypted form by our sign-in provider), mobile number, and whether the learner is 18 or older.</li>
        <li><b>For learners under 18:</b> the parent or guardian&rsquo;s name, email address and mobile number, their confirmation of permission, and a record of how that permission was checked.</li>
        <li><b>Learning activity:</b> the practice sessions you start, the answers you submit, your results, and questions you bookmark.</li>
        <li><b>Optional updates (adults only):</b> whether you agreed to receive product and learning updates, the channels you chose, and when.</li>
        <li><b>Technical data:</b> basic information your browser sends when loading pages, such as IP address and device type, which our hosting and security providers use to deliver the site and prevent abuse.</li>
      </ul>

      <h2>Why we use it</h2>
      <ul>
        <li>To create and secure your account and let you sign in.</li>
        <li>To show practice questions, check answers and show your progress.</li>
        <li>To verify a parent or guardian&rsquo;s permission before an under-18 learner can use learning features.</li>
        <li>To send account and safety messages, such as password resets.</li>
        <li>To send optional updates, only to adults who chose to receive them.</li>
      </ul>
      <p>We do not sell personal data. We do not show advertising, and we never use children&rsquo;s data for advertising, tracking or profiling.</p>

      <h2>Children</h2>
      <p>
        Learners under 18 can only use {SITE.name} through an account created by a parent or legal guardian. Learning
        features stay locked until we have checked that permission. Guardian contact details are used only for account and
        safety communication. A parent or guardian can ask us to see, correct or delete their child&rsquo;s data at any time.
      </p>

      <h2>Who processes your data</h2>
      <p>We use trusted service providers to run the site. They process data only on our instructions:</p>
      <ul>
        <li><b>Supabase</b>: database and sign-in. Data is stored on servers in Japan (Tokyo region).</li>
        <li><b>Cloudflare</b>: website hosting, delivery and security.</li>
        <li><b>Google Fonts</b>: the typefaces on our pages are loaded from Google, which receives your IP address when fonts load.</li>
      </ul>

      <h2>How long we keep it</h2>
      <p>
        We keep your account and learning data while your account is active. If you ask us to delete your account, we delete
        your personal data within 30 days, except where the law requires us to keep a record (for example, consent records).
      </p>

      <h2>Your rights</h2>
      <p>You can ask us to:</p>
      <ul>
        <li>tell you what personal data we hold about you and how it is used;</li>
        <li>correct or update your data;</li>
        <li>delete your data and account;</li>
        <li>withdraw consent, including for optional updates (you can also do this in your account at any time);</li>
        <li>name someone to exercise these rights for you in case of death or incapacity.</li>
      </ul>
      <p>Email {mail} with your request. We reply within 30 days.</p>

      <h2>Complaints</h2>
      <p>
        If you have a concern about how we handle your data, contact us first at {mail} and we will try to resolve it. If you
        are not satisfied, you can complain to the Data Protection Board of India.
      </p>

      <h2>Changes to this policy</h2>
      <p>If we change this policy, we will update the date below and, for important changes, tell you when you next sign in.</p>
    </>
  )
}

function Terms() {
  return (
    <>
      <p>
        These terms apply when you use {SITE.name}. By creating an account or using the site, you agree to them. If you do not
        agree, please do not use the site.
      </p>

      <h2>The service</h2>
      <p>
        {SITE.name} is a free practice platform for school learners and people preparing for competitive exams. We may add,
        change or remove features and content at any time.
      </p>

      <h2>Accounts</h2>
      <ul>
        <li>You must give accurate information when you sign up and keep your password private.</li>
        <li>Learners under 18 may only use {SITE.name} through an account created by a parent or legal guardian, who is responsible for the learner&rsquo;s use of the site.</li>
        <li>You are responsible for activity on your account. Tell us straight away at {mail} if you think someone else has used it.</li>
      </ul>

      <h2>Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>try to access other people&rsquo;s accounts or data, or parts of the site you are not allowed to use;</li>
        <li>interfere with the site&rsquo;s security or operation, or overload it with automated requests;</li>
        <li>copy, scrape or republish our questions and explanations in bulk without permission;</li>
        <li>use the site for anything unlawful or harmful.</li>
      </ul>

      <h2>Content and accuracy</h2>
      <p>
        We work to keep questions and explanations accurate, but mistakes can happen and exam syllabuses change. Practice on
        {' '}{SITE.name} is a study aid and does not guarantee any exam result. If you find an error, please tell us at {mail}.
      </p>
      <p>The questions, explanations, design and software on the site belong to {SITE.name} or its licensors.</p>

      <h2>Suspension and closure</h2>
      <p>
        We may suspend or close accounts that break these terms. You can stop using the site and ask us to delete your account
        at any time.
      </p>

      <h2>Liability</h2>
      <p>
        The site is provided free of charge and &ldquo;as is&rdquo;. To the extent the law allows, we are not liable for indirect
        losses or for any loss caused by the site being unavailable or by errors in content.
      </p>

      <h2>Governing law</h2>
      <p>These terms are governed by the laws of India.</p>

      <h2>Changes</h2>
      <p>We may update these terms. We will change the date below and, for important changes, tell you when you next sign in.</p>
    </>
  )
}

function Contact() {
  return (
    <>
      <p>We are happy to help with questions about your account, practice content, or your data.</p>
      <div className="hp-contact-card">
        <span>Email</span>
        <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>
        <small>We usually reply within 2 working days.</small>
      </div>
      <h2>What to include</h2>
      <ul>
        <li>The email address on your account (never your password).</li>
        <li>For a question error: the subject, topic and the question text.</li>
        <li>For parents or guardians: the learner&rsquo;s name as shown on the account.</li>
      </ul>
      <h2>Data requests and complaints</h2>
      <p>
        To see, correct or delete your data, or to raise a privacy concern, email us with the subject
        &ldquo;Data request&rdquo;. We reply within 30 days. See our <a href="/privacy">privacy policy</a> for details.
      </p>
    </>
  )
}

export default function Legal({ page }: { page: LegalPageName }) {
  useEffect(() => {
    document.title = `${TITLES[page]} | ${SITE.name}`
    window.scrollTo(0, 0)
  }, [page])

  const body: Record<LegalPageName, ReactNode> = { privacy: <Privacy />, terms: <Terms />, contact: <Contact /> }

  return (
    <div className="hp">
      <header className="hp-header">
        <a className="brand hp-brand" href="/" aria-label="SYNAPTYL home"><span className="hp-mark">S</span>SYNAPTYL</a>
        <div className="hp-header-actions">
          <a className="hp-btn hp-btn-quiet" href="/">Home</a>
        </div>
      </header>
      <main className="hp-legal">
        <h1>{TITLES[page]}</h1>
        {page !== 'contact' && <p className="hp-legal-date">Last updated: {SITE.updated}</p>}
        {body[page]}
      </main>
      <div className="hp-footer" role="contentinfo">
        <nav aria-label="Footer">
          <a href="/privacy">Privacy policy</a>
          <a href="/terms">Terms of use</a>
          <a href="/contact">Contact</a>
        </nav>
        <small>© {new Date().getFullYear()} {SITE.name}</small>
      </div>
    </div>
  )
}
