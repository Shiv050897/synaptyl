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

// Hidden way into the private sign-in page: five quick taps on any SYNAPTYL
// logo, or holding a finger on it for two seconds. Nothing is shown to others.
if (!isPrivate) {
  const onLogo = (e: Event) => e.target instanceof Element && e.target.closest('.brand') !== null
  const open = () => window.location.assign(PRIVATE_PATHS[0])
  let taps: number[] = []
  let holdTimer: number | undefined

  document.addEventListener('pointerdown', (e) => {
    if (!onLogo(e)) return
    const now = Date.now()
    taps = [...taps.filter((t) => now - t < 4000), now]
    if (taps.length >= 5) {
      taps = []
      open()
      return
    }
    window.clearTimeout(holdTimer)
    holdTimer = window.setTimeout(open, 2000)
  }, true)

  const cancelHold = () => window.clearTimeout(holdTimer)
  document.addEventListener('pointerup', cancelHold, true)
  document.addEventListener('pointercancel', cancelHold, true)
  document.addEventListener('pointerleave', cancelHold, true)
  // Stop the phone's link preview / context menu from hijacking a long press.
  document.addEventListener('contextmenu', (e) => { if (onLogo(e)) e.preventDefault() }, true)
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
