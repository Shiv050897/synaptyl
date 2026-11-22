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
