import { useCallback, useEffect, useState } from 'react'
import { chatClient, go, LOGIN_PATH, type WhoAmI } from './client'
import LoginPage from './LoginPage'
import AdminPage from './AdminPage'
import ChatHome from './ChatHome'
import './private.css'

type Status = 'checking' | 'signed-out' | 'signed-in'

function currentPath() {
  return window.location.pathname.replace(/\/+$/, '') || '/'
}

export default function PrivateRoot() {
  const [path, setPath] = useState(currentPath)
  const [status, setStatus] = useState<Status>('checking')
  const [me, setMe] = useState<WhoAmI | null>(null)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const onPop = () => setPath(currentPath())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Keep crawlers away and avoid caching private pages in shared history UIs.
  useEffect(() => {
    document.title = 'Sign in'
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)

    // Make the private area installable as its own full-screen app.
    const added: HTMLElement[] = [meta]
    const add = (tag: 'link' | 'meta', attrs: Record<string, string>) => {
      const el = document.createElement(tag)
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
      document.head.appendChild(el)
      added.push(el)
    }
    add('link', { rel: 'manifest', href: '/pc/manifest.webmanifest' })
    add('link', { rel: 'apple-touch-icon', href: '/pc/apple-touch-icon.png' })
    add('meta', { name: 'mobile-web-app-capable', content: 'yes' })
    add('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' })
    add('meta', { name: 'apple-mobile-web-app-title', content: 'Chat' })
    const theme = document.querySelector('meta[name="theme-color"]')
    const oldTheme = theme?.getAttribute('content') ?? null
    theme?.setAttribute('content', '#00a884')
    return () => {
      added.forEach((el) => el.remove())
      if (theme && oldTheme) theme.setAttribute('content', oldTheme)
    }
  }, [])

  const signOut = useCallback(async (message = '') => {
    setNotice(message)
    setMe(null)
    setStatus('signed-out')
    await chatClient?.auth.signOut({ scope: 'local' })
    go(LOGIN_PATH, true)
  }, [])

  /** Confirms the session is still allowed by asking the database who we are. */
  const verify = useCallback(async () => {
    if (!chatClient) return
    const { data: sessionData } = await chatClient.auth.getSession()
    if (!sessionData.session) {
      setMe(null)
      setStatus('signed-out')
      return
    }
    const { data, error } = await chatClient.rpc('chat_whoami')
    if (error || !data) {
      await signOut('Your session has ended or access is currently disabled.')
      return
    }
    setMe(data as WhoAmI)
    setStatus('signed-in')
  }, [signOut])

  useEffect(() => {
    if (!chatClient) return
    void verify()
    const { data: { subscription } } = chatClient.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setMe(null)
        setStatus('signed-out')
      }
    })
    // Re-check regularly so a forced logout or lock takes effect quickly.
    const timer = window.setInterval(() => void verify(), 60_000)
    return () => {
      subscription.unsubscribe()
      window.clearInterval(timer)
    }
  }, [verify])

  // Route guards.
  useEffect(() => {
    if (status === 'signed-out' && path !== LOGIN_PATH) go(LOGIN_PATH, true)
    if (status === 'signed-in' && me) {
      const home = me.role === 'admin' ? '/admin' : '/chat'
      if (path !== home) go(home, true)
    }
  }, [status, me, path])

  if (!chatClient) {
    return <div className="pc pc-center"><p className="pc-muted">Not available.</p></div>
  }
  if (status === 'checking') {
    return <div className="pc pc-center"><div className="pc-spinner" aria-label="Loading" /></div>
  }
  if (status === 'signed-out' || !me) {
    return (
      <LoginPage
        notice={notice}
        onSignedIn={async () => {
          setNotice('')
          setStatus('checking')
          await verify()
        }}
      />
    )
  }
  if (me.role === 'admin') return <AdminPage me={me} onSignOut={() => signOut()} />
  return <ChatHome me={me} onSignOut={() => signOut()} />
}
