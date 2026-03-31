import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { format, parseISO } from 'date-fns'

export default function Announcements() {
  const { profile } = useAuth()
  const [posts, setPosts] = useState([])
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('announcements')
      .select('*, profiles(full_name, avatar_url)')
      .order('created_at', { ascending: false })
    setPosts(data || [])
    setLoading(false)
  }

  async function post(e) {
    e.preventDefault()
    if (!body.trim()) return
    setSaving(true)
    await supabase.from('announcements').insert({ body: body.trim(), created_by: profile.id })
    setBody('')
    setSaving(false)
    load()
  }

  async function deletePost(id) {
    await supabase.from('announcements').delete().eq('id', id)
    load()
  }

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">📣 Announcements</h1>

      {profile?.is_admin && (
        <form onSubmit={post} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Post an announcement to the group…"
            className="input w-full h-24 resize-none"
          />
          <button type="submit" disabled={saving || !body.trim()} className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition disabled:opacity-50">
            {saving ? 'Posting…' : 'Post'}
          </button>
        </form>
      )}

      {posts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">No announcements yet.</div>
      ) : (
        <div className="space-y-3">
          {posts.map(p => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  {p.profiles?.avatar_url && <img src={p.profiles.avatar_url} className="w-7 h-7 rounded-full" alt="" />}
                  <div>
                    <span className="text-xs font-semibold text-gray-700">{p.profiles?.full_name}</span>
                    <span className="text-xs text-gray-400 ml-2">{format(parseISO(p.created_at), 'MMM d, yyyy')}</span>
                  </div>
                </div>
                {profile?.is_admin && (
                  <button onClick={() => deletePost(p.id)} className="text-red-400 hover:text-red-600 text-xs shrink-0">Delete</button>
                )}
              </div>
              <p className="mt-2 text-gray-800 text-sm whitespace-pre-wrap">{p.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
