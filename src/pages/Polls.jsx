import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { format, parseISO } from 'date-fns'

export default function Polls() {
  const { profile } = useAuth()
  const [polls, setPolls] = useState([])
  const [votes, setVotes] = useState([])   // all votes by current user
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ question: '', type: 'destination', options: ['', ''], closes_at: '' })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadPolls() }, [])

  async function loadPolls() {
    const [{ data: p }, { data: v }] = await Promise.all([
      supabase.from('polls').select('*, poll_options(*, poll_votes(*)), profiles(full_name)').order('created_at', { ascending: false }),
      supabase.from('poll_votes').select('*').eq('user_id', profile?.id),
    ])
    setPolls(p || [])
    setVotes(v || [])
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const { data: poll } = await supabase.from('polls').insert({
      question: form.question,
      type: form.type,
      created_by: profile.id,
      closes_at: form.closes_at || null,
    }).select().single()

    const opts = form.options.filter(o => o.trim())
    await supabase.from('poll_options').insert(opts.map(label => ({ poll_id: poll.id, label })))
    setForm({ question: '', type: 'destination', options: ['', ''], closes_at: '' })
    setShowForm(false)
    setSaving(false)
    loadPolls()
  }

  async function castVote(pollId, optionId) {
    const existingVote = votes.find(v => {
      const poll = polls.find(p => p.id === pollId)
      return poll?.poll_options?.some(o => o.id === v.option_id)
    })
    if (existingVote) {
      await supabase.from('poll_votes').update({ option_id: optionId }).eq('id', existingVote.id)
    } else {
      await supabase.from('poll_votes').insert({ poll_id: pollId, option_id: optionId, user_id: profile.id })
    }
    loadPolls()
  }

  function myVoteForPoll(poll) {
    for (const opt of poll.poll_options || []) {
      const v = votes.find(v => v.option_id === opt.id)
      if (v) return opt.id
    }
    return null
  }

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">🗳️ Polls</h1>
        <button onClick={() => setShowForm(s => !s)} className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition">
          + New Poll
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
          <h2 className="font-semibold text-gray-800">New Poll</h2>
          <input required placeholder="Question" value={form.question} onChange={e => setForm(f => ({ ...f, question: e.target.value }))} className="input w-full" />
          <div className="flex gap-3">
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="input flex-1">
              <option value="destination">Destination</option>
              <option value="activity">Activity</option>
              <option value="general">General</option>
            </select>
            <input type="date" value={form.closes_at} onChange={e => setForm(f => ({ ...f, closes_at: e.target.value }))} className="input flex-1" placeholder="Close date (optional)" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-500">Options</label>
            {form.options.map((opt, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={opt}
                  onChange={e => setForm(f => ({ ...f, options: f.options.map((o, j) => j === i ? e.target.value : o) }))}
                  placeholder={`Option ${i + 1}`}
                  className="input flex-1"
                />
                {form.options.length > 2 && (
                  <button type="button" onClick={() => setForm(f => ({ ...f, options: f.options.filter((_, j) => j !== i) }))} className="text-red-400 hover:text-red-600 px-2">✕</button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => setForm(f => ({ ...f, options: [...f.options, ''] }))} className="text-xs text-brand-600 hover:underline">+ Add option</button>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-brand-700 transition disabled:opacity-50">{saving ? 'Saving…' : 'Create Poll'}</button>
            <button type="button" onClick={() => setShowForm(false)} className="text-gray-500 px-4 py-2 rounded-lg text-sm hover:bg-gray-100 transition">Cancel</button>
          </div>
        </form>
      )}

      {polls.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">No polls yet.</div>
      ) : polls.map(poll => {
        const totalVotes = poll.poll_options?.reduce((s, o) => s + (o.poll_votes?.length || 0), 0) || 0
        const myVote = myVoteForPoll(poll)
        return (
          <div key={poll.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-medium text-brand-600 uppercase tracking-wide">{poll.type}</span>
                <h3 className="font-bold text-gray-900 mt-0.5">{poll.question}</h3>
              </div>
              <span className="text-xs text-gray-400">{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</span>
            </div>
            <div className="space-y-2">
              {(poll.poll_options || []).map(opt => {
                const count = opt.poll_votes?.length || 0
                const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
                const isMyVote = myVote === opt.id
                return (
                  <button
                    key={opt.id}
                    onClick={() => castVote(poll.id, opt.id)}
                    className={`w-full text-left rounded-lg border px-4 py-2.5 relative overflow-hidden transition ${isMyVote ? 'border-brand-500' : 'border-gray-200 hover:border-brand-300'}`}
                  >
                    <div className="absolute inset-0 bg-brand-100 transition-all" style={{ width: `${pct}%` }} />
                    <div className="relative flex items-center justify-between">
                      <span className={`text-sm font-medium ${isMyVote ? 'text-brand-700' : 'text-gray-700'}`}>
                        {isMyVote && '✓ '}{opt.label}
                      </span>
                      <span className="text-xs text-gray-500">{pct}%</span>
                    </div>
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-gray-400">Created by {poll.profiles?.full_name}{poll.closes_at ? ` · Closes ${format(parseISO(poll.closes_at), 'MMM d')}` : ''}</p>
          </div>
        )
      })}
    </div>
  )
}
