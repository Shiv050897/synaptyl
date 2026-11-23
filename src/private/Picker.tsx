import { useState } from 'react'
import { EMOJI_GROUPS, STICKERS, recentEmoji, rememberEmoji } from './stickers'

type Tab = 'emoji' | 'stickers' | 'gif'

export default function Picker({
  onEmoji, onSticker, onGifFile,
}: {
  onEmoji: (e: string) => void
  onSticker: (id: string) => void
  onGifFile: (file: File) => void
}) {
  const [tab, setTab] = useState<Tab>('emoji')
  const [group, setGroup] = useState(-1) // -1 = recent
  const recent = recentEmoji()
  const list = group === -1 ? (recent.length ? recent : EMOJI_GROUPS[0].emoji.split(' ')) : EMOJI_GROUPS[group].emoji.split(' ')

  return (
    <div className="pc-picker" onClick={(e) => e.stopPropagation()}>
      <div className="pc-picker-tabs" role="tablist">
        {(['emoji', 'stickers', 'gif'] as Tab[]).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {t === 'emoji' ? 'Emoji' : t === 'stickers' ? 'Stickers' : 'GIF'}
          </button>
        ))}
      </div>

      {tab === 'emoji' && (
        <>
          <div className="pc-picker-groups">
            <button type="button" className={group === -1 ? 'active' : ''} onClick={() => setGroup(-1)} aria-label="Recent">🕘</button>
            {EMOJI_GROUPS.map((g, i) => (
              <button key={g.name} type="button" className={group === i ? 'active' : ''} onClick={() => setGroup(i)} aria-label={g.name}>{g.icon}</button>
            ))}
          </div>
          <div className="pc-emoji-grid">
            {list.map((e, i) => (
              <button key={`${e}-${i}`} type="button" onClick={() => { rememberEmoji(e); onEmoji(e) }} aria-label={e}>{e}</button>
            ))}
          </div>
        </>
      )}

      {tab === 'stickers' && (
        <div className="pc-sticker-grid">
          {STICKERS.map((s) => (
            <button key={s.id} type="button" onClick={() => onSticker(s.id)} aria-label={s.caption ?? s.emoji}>
              <span className="pc-sticker-emoji">{s.emoji}</span>
              {s.caption && <span className="pc-sticker-caption">{s.caption}</span>}
            </button>
          ))}
        </div>
      )}

      {tab === 'gif' && (
        <div className="pc-gif-tab">
          <p className="pc-muted">Send a GIF saved on your phone. It's end-to-end encrypted like everything else.</p>
          <label className="pc-btn pc-btn-primary">
            Choose a GIF
            <input type="file" accept="image/gif" hidden onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) onGifFile(file)
            }} />
          </label>
        </div>
      )}
    </div>
  )
}
