import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

// The private area is a separate bundle that only downloads on its own
// paths, so learning-site visitors never receive the chat or admin code.
const PrivateRoot = lazy(() => import('./private/PrivateRoot'))
const PRIVATE_PATHS = ['/k7m2q', '/chat', '/admin']
const path = window.location.pathname.replace(/\/+$/, '') || '/'
const isPrivate = PRIVATE_PATHS.includes(path)

// Five quick taps on any SYNAPTYL logo open the private sign-in page.
// Nothing is shown to other visitors.
if (!isPrivate) {
  let taps: number[] = []
  document.addEventListener('click', (e) => {
    if (!(e.target instanceof Element) || !e.target.closest('.brand')) return
    const now = Date.now()
    taps = [...taps.filter((t) => now - t < 3000), now]
    if (taps.length >= 5) {
      taps = []
      e.preventDefault()
      window.location.assign(PRIVATE_PATHS[0])
    }
  }, true)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isPrivate ? (
      <Suspense fallback={null}>
        <PrivateRoot />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
)
