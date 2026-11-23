import { useState } from 'react'
import { supabase } from './lib/supabase'

type Track = 'k12' | 'gk_gs'
type SchoolClass = { id: string; class_number: number; display_name: string }
type Subject = { id: string; name: string; track: Track; school_class_id: string | null }
type Topic = { id: string; subject_id: string; name: string; slug: string; display_order: number }

function slugify(name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'topic'
  return `${base}-${Math.random().toString(36).slice(2, 6)}`
}

/** Admin screen to add, rename and remove topics (chapters) under each subject. */
export default function AdminTopics({
  classes, subjects, topics, onChanged,
}: {
  classes: SchoolClass[]
  subjects: Subject[]
  topics: Topic[]
  onChanged: () => Promise<void>
}) {
  const [track, setTrack] = useState<Track>('k12')
  const [classId, setClassId] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [newName, setNewName] = useState('')
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const visibleSubjects = subjects.filter((s) => s.track === track && (track === 'gk_gs' || s.school_class_id === classId))
  const gkSubject = track === 'gk_gs' ? visibleSubjects[0]?.id ?? '' : ''
  const activeSubject = track === 'gk_gs' ? gkSubject : subjectId
  const list = topics.filter((t) => t.subject_id === activeSubject).sort((a, b) => a.display_order - b.display_order)

  async function run(action: () => Promise<{ error: { message: string; code?: string } | null }>, ok: string) {
    if (!supabase) return
    setBusy(true)
    setMessage(null)
    const { error } = await action()
    if (error) {
      const inUse = error.code === '23503' || /foreign key/i.test(error.message)
      setMessage({ ok: false, text: inUse ? 'This topic still has questions. Move or archive them first.' : error.message })
    } else {
      setMessage({ ok: true, text: ok })
      await onChanged()
    }
    setBusy(false)
  }

  const add = () => {
    const name = newName.trim()
    if (!name || !activeSubject) return
    const order = Math.max(0, ...list.map((t) => t.display_order)) + 1
    void run(async () => {
      const res = await supabase!.from('topics').insert({ subject_id: activeSubject, name, slug: slugify(name), display_order: order })
      if (!res.error) setNewName('')
      return res
    }, `Added "${name}".`)
  }

  return (
    <div className="admin-content">
      <div className="table-toolbar">
        <div>
          <h2>Topics and chapters</h2>
          <p>Questions are grouped by topic. Add chapters for each subject so learners can practise them one by one.</p>
        </div>
      </div>

      <div className="admin-panel">
        <div className="editor-fields">
          <label>Learning track
            <select value={track} onChange={(e) => { setTrack(e.target.value as Track); setSubjectId(''); setMessage(null) }}>
              <option value="k12">K–12 school learning</option>
              <option value="gk_gs">GK &amp; GS competitive exams</option>
            </select>
          </label>
          {track === 'k12' && (
            <>
              <label>Class
                <select value={classId} onChange={(e) => { setClassId(e.target.value); setSubjectId('') }}>
                  <option value="">Select class</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.display_name}</option>)}
                </select>
              </label>
              <label>Subject
                <select value={subjectId} disabled={!classId} onChange={(e) => setSubjectId(e.target.value)}>
                  <option value="">Select subject</option>
                  {visibleSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
            </>
          )}
        </div>
      </div>

      {activeSubject && (
        <div className="admin-panel">
          <div className="panel-heading"><div><h3>{list.length} topic{list.length === 1 ? '' : 's'}</h3></div></div>
          <div className="topic-admin-list">
            {list.map((t) => {
              const value = edits[t.id] ?? t.name
              return (
                <div className="topic-admin-row" key={t.id}>
                  <input value={value} aria-label="Topic name" onChange={(e) => setEdits({ ...edits, [t.id]: e.target.value })} />
                  <button type="button" className="button secondary" disabled={busy || !value.trim() || value.trim() === t.name}
                    onClick={() => void run(async () => supabase!.from('topics').update({ name: value.trim() }).eq('id', t.id), 'Topic renamed.')}>
                    Rename
                  </button>
                  <button type="button" className="danger-link" disabled={busy}
                    onClick={() => window.confirm(`Delete the topic "${t.name}"?`) &&
                      void run(async () => supabase!.from('topics').delete().eq('id', t.id), 'Topic deleted.')}>
                    Delete
                  </button>
                </div>
              )
            })}
            {list.length === 0 && <p className="panel-footnote">No topics yet. Add the first one below.</p>}
          </div>
          <div className="topic-admin-row topic-admin-add">
            <input value={newName} placeholder="New topic or chapter name, e.g. Fractions" maxLength={80}
              onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }} />
            <button type="button" className="button primary" disabled={busy || !newName.trim()} onClick={add}>Add topic</button>
          </div>
          {message && <div className={message.ok ? 'auth-alert success' : 'auth-alert error'}>{message.text}</div>}
        </div>
      )}
    </div>
  )
}
