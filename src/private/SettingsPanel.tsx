import type { ReactNode } from 'react'
import { ACCENTS, TEXT_SCALES, WALLPAPERS, textSizeLabel, type ChatTheme, type ThemeMode } from './theme'

type Props = {
  username: string
  peerName: string
  myPhoto: string | null
  photoBusy: boolean
  canEditPhoto: boolean
  theme: ChatTheme
  safety: string
  onTheme: (t: ChatTheme) => void
  onPhoto: (file: File) => void
  onRemovePhoto: () => void
  onClose: () => void
  onSignOut: () => void
  backup: ReactNode
}

const MODES: { id: ThemeMode; name: string }[] = [
  { id: 'auto', name: 'Auto' },
  { id: 'light', name: 'Light' },
  { id: 'dark', name: 'Dark' },
]

export default function SettingsPanel(p: Props) {
  return (
    <div className="pc-modal" role="dialog" aria-modal="true" aria-label="Settings" onClick={p.onClose}>
      <div className="pc-card pc-settings" onClick={(e) => e.stopPropagation()}>
        <div className="pc-row">
          <h1>Settings</h1>
          <button className="pc-icon-btn" type="button" aria-label="Close" onClick={p.onClose}>✕</button>
        </div>

        <section className="pc-settings-section">
          <h2>Profile photo</h2>
          <div className="pc-profile">
            <div className="pc-avatar pc-avatar-lg">
              {p.myPhoto ? <img src={p.myPhoto} alt="" /> : p.username.slice(0, 1).toUpperCase()}
            </div>
            <div className="pc-profile-actions">
              <label className={`pc-btn ${p.canEditPhoto && !p.photoBusy ? '' : 'pc-disabled'}`}>
                {p.photoBusy ? 'Saving…' : p.myPhoto ? 'Change photo' : 'Add photo'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  disabled={!p.canEditPhoto || p.photoBusy}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (file) p.onPhoto(file)
                  }}
                />
              </label>
              {p.myPhoto && (
                <button className="pc-btn pc-btn-danger" type="button" disabled={p.photoBusy} onClick={p.onRemovePhoto}>Remove</button>
              )}
            </div>
          </div>
          <p className="pc-muted">
            {p.canEditPhoto
              ? `Encrypted: only you and ${p.peerName} can see it.`
              : `Available once ${p.peerName} has opened the chat.`}
          </p>
        </section>

        <section className="pc-settings-section">
          <h2>Message backup</h2>
          {p.backup}
        </section>

        <section className="pc-settings-section">
          <h2>Theme</h2>
          <div className="pc-segmented" role="radiogroup" aria-label="Light or dark">
            {MODES.map((m) => (
              <button key={m.id} type="button" role="radio" aria-checked={p.theme.mode === m.id}
                className={p.theme.mode === m.id ? 'active' : ''} onClick={() => p.onTheme({ ...p.theme, mode: m.id })}>
                {m.name}
              </button>
            ))}
          </div>
          <p className="pc-settings-label">Text size</p>
          <div className="pc-textsize">
            <button type="button" className="pc-btn" aria-label="Smaller text"
              disabled={p.theme.textScale <= TEXT_SCALES[0]}
              onClick={() => p.onTheme({ ...p.theme, textScale: TEXT_SCALES[Math.max(0, TEXT_SCALES.indexOf(p.theme.textScale) - 1)] })}>
              <span style={{ fontSize: 14 }}>A</span>−
            </button>
            <div className="pc-textsize-preview" style={{ fontSize: `${17 * p.theme.textScale}px` }}>
              Hello! 👋
              <small>{textSizeLabel(p.theme.textScale)}</small>
            </div>
            <button type="button" className="pc-btn" aria-label="Larger text"
              disabled={p.theme.textScale >= TEXT_SCALES[TEXT_SCALES.length - 1]}
              onClick={() => p.onTheme({ ...p.theme, textScale: TEXT_SCALES[Math.min(TEXT_SCALES.length - 1, TEXT_SCALES.indexOf(p.theme.textScale) + 1)] })}>
              <span style={{ fontSize: 20 }}>A</span>+
            </button>
          </div>
          <p className="pc-settings-label">Colour</p>
          <div className="pc-swatches" role="radiogroup" aria-label="Accent colour">
            {ACCENTS.map((a) => (
              <button key={a.value} type="button" role="radio" aria-checked={p.theme.accent === a.value} aria-label={a.name}
                className={`pc-swatch ${p.theme.accent === a.value ? 'active' : ''}`} style={{ background: a.value }}
                onClick={() => p.onTheme({ ...p.theme, accent: a.value })} />
            ))}
          </div>
          <p className="pc-settings-label">Wallpaper</p>
          <div className="pc-wallpapers" role="radiogroup" aria-label="Wallpaper">
            {WALLPAPERS.map((w) => (
              <button key={w.id} type="button" role="radio" aria-checked={p.theme.wallpaper === w.id}
                className={`pc-wallpaper-tile ${p.theme.wallpaper === w.id ? 'active' : ''}`} data-wallpaper={w.id}
                onClick={() => p.onTheme({ ...p.theme, wallpaper: w.id })}>
                <span>{w.name}</span>
              </button>
            ))}
          </div>
          <p className="pc-muted">Saved on this device only.</p>
        </section>

        <section className="pc-settings-section">
          <h2>Encryption</h2>
          <p className="pc-muted">
            Compare this safety number with {p.peerName}'s screen, in person or on a call. If both match, nobody has
            swapped your encryption keys.
          </p>
          <p className="pc-safety">{p.safety || 'Available once both of you have opened the chat.'}</p>
        </section>

        <button className="pc-btn pc-btn-danger" type="button" onClick={p.onSignOut}>Sign out</button>
      </div>
    </div>
  )
}
