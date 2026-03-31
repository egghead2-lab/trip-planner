import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { format, parseISO, addDays } from 'date-fns'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function generateSlots(startDow, tripDays, windowStart, windowEnd) {
  const slots = []
  let date = new Date(windowStart + 'T12:00:00')
  const end = new Date(windowEnd + 'T12:00:00')
  // Advance to first occurrence of startDow
  while (date.getDay() !== startDow) date = addDays(date, 1)
  while (true) {
    const slotEnd = addDays(date, tripDays - 1)
    if (slotEnd > end) break
    slots.push({
      start: format(date, 'yyyy-MM-dd'),
      end: format(slotEnd, 'yyyy-MM-dd'),
      label: `${format(date, 'MMM d')} – ${format(slotEnd, 'MMM d')}`,
    })
    date = addDays(date, 7)
  }
  return slots
}

export default function Availability() {
  const { profile } = useAuth()
  const [polls, setPolls] = useState([])
  const [members, setMembers] = useState([])
  const [myVotes, setMyVotes] = useState({})     // pollId → Set of slot_start strings
  const [myOptOuts, setMyOptOuts] = useState({}) // pollId → bool
  const [allVotes, setAllVotes] = useState([])   // all avail_slot_votes rows
  const [allOptOuts, setAllOptOuts] = useState([]) // all avail_opt_outs rows
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', start_dow: '5', trip_days: '4', window_start: '', window_end: '' })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [pollsRes, { data: m }, { data: sv }, { data: oo }] = await Promise.all([
      supabase.from('avail_polls').select('*, profiles!created_by(full_name)').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, full_name'),
      supabase.from('avail_slot_votes').select('*'),
      supabase.from('avail_opt_outs').select('*'),
    ])
    if (pollsRes.error) console.error('avail_polls load error:', pollsRes.error)
    const p = pollsRes.data
    setPolls(p || [])
    setMembers(m || [])
    setAllVotes(sv || [])
    setAllOptOuts(oo || [])

    // Build my votes map (normalize dates to yyyy-MM-dd)
    const votes = {}
    ;(sv || []).filter(v => v.user_id === profile?.id).forEach(v => {
      if (!votes[v.poll_id]) votes[v.poll_id] = new Set()
      votes[v.poll_id].add(normDate(v.slot_start))
    })
    setMyVotes(votes)

    const optOuts = {}
    ;(oo || []).filter(o => o.user_id === profile?.id).forEach(o => { optOuts[o.poll_id] = true })
    setMyOptOuts(optOuts)

    setLoading(false)
  }

  async function createPoll(e) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('avail_polls').insert({
      title: form.title,
      trip_days: parseInt(form.trip_days),
      start_dow: parseInt(form.start_dow),
      window_start: form.window_start,
      window_end: form.window_end,
      created_by: profile.id,
    })
    if (error) {
      alert('Failed to create poll: ' + error.message)
      setSaving(false)
      return
    }
    setForm({ title: '', start_dow: '5', trip_days: '4', window_start: '', window_end: '' })
    setShowForm(false)
    setSaving(false)
    loadAll()
  }

  async function toggleSlot(pollId, slotStart) {
    // Optimistic update
    const prevVotes = { ...myVotes }
    const prevAll = [...allVotes]
    const has = myVotes[pollId]?.has(slotStart)

    setMyVotes(v => {
      const next = { ...v, [pollId]: new Set(v[pollId] || []) }
      has ? next[pollId].delete(slotStart) : next[pollId].add(slotStart)
      return next
    })
    if (has) {
      setAllVotes(v => v.filter(x => !(x.poll_id === pollId && x.user_id === profile.id && x.slot_start === slotStart)))
    } else {
      setAllVotes(v => [...v, { poll_id: pollId, user_id: profile.id, slot_start: slotStart }])
    }

    // Clear opt-out if voting on a slot
    if (myOptOuts[pollId]) {
      await supabase.from('avail_opt_outs').delete().eq('poll_id', pollId).eq('user_id', profile.id)
      setMyOptOuts(o => { const n = { ...o }; delete n[pollId]; return n })
      setAllOptOuts(o => o.filter(x => !(x.poll_id === pollId && x.user_id === profile.id)))
    }

    let error
    if (has) {
      ;({ error } = await supabase.from('avail_slot_votes').delete().eq('poll_id', pollId).eq('user_id', profile.id).eq('slot_start', slotStart))
    } else {
      ;({ error } = await supabase.from('avail_slot_votes').insert({ poll_id: pollId, user_id: profile.id, slot_start: slotStart }))
    }

    if (error) {
      alert('Failed to save: ' + error.message)
      setMyVotes(prevVotes)
      setAllVotes(prevAll)
    }
  }

  async function toggleOptOut(pollId) {
    const isOut = !!myOptOuts[pollId]

    if (isOut) {
      await supabase.from('avail_opt_outs').delete().eq('poll_id', pollId).eq('user_id', profile.id)
      setMyOptOuts(o => { const n = { ...o }; delete n[pollId]; return n })
      setAllOptOuts(o => o.filter(x => !(x.poll_id === pollId && x.user_id === profile.id)))
    } else {
      // Clear my slot votes first
      await supabase.from('avail_slot_votes').delete().eq('poll_id', pollId).eq('user_id', profile.id)
      const { error } = await supabase.from('avail_opt_outs').insert({ poll_id: pollId, user_id: profile.id })
      if (error) { alert('Failed to save: ' + error.message); return }
      setMyVotes(v => { const n = { ...v }; delete n[pollId]; return n })
      setAllVotes(v => v.filter(x => !(x.poll_id === pollId && x.user_id === profile.id)))
      setMyOptOuts(o => ({ ...o, [pollId]: true }))
      setAllOptOuts(o => [...o, { poll_id: pollId, user_id: profile.id }])
    }
  }

  async function deletePoll(pollId) {
    await supabase.from('avail_polls').delete().eq('id', pollId)
    loadAll()
  }

  // Normalize date strings to yyyy-MM-dd for safe comparison
  function normDate(d) { return d ? String(d).substring(0, 10) : '' }

  function getName(userId) {
    return members.find(m => m.id === userId)?.full_name?.split(' ')[0] || '?'
  }

  function getSlotStats(pollId, slotStart) {
    const availableVotes = allVotes.filter(v => v.poll_id === pollId && normDate(v.slot_start) === slotStart)
    const optedOutList = allOptOuts.filter(o => o.poll_id === pollId)
    const respondedIds = new Set([
      ...allVotes.filter(v => v.poll_id === pollId).map(v => v.user_id),
      ...allOptOuts.filter(o => o.poll_id === pollId).map(o => o.user_id),
    ])
    const notResponded = members.filter(m => !respondedIds.has(m.id))
    return {
      available: availableVotes.length,
      availableNames: availableVotes.map(v => getName(v.user_id)),
      optedOut: optedOutList.length,
      optedOutNames: optedOutList.map(o => getName(o.user_id)),
      outstanding: notResponded.length,
      outstandingNames: notResponded.map(m => m.full_name?.split(' ')[0] || '?'),
    }
  }

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">📅 Availability</h1>
        <button onClick={() => setShowForm(s => !s)} className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition">
          + New Poll
        </button>
      </div>

      {/* Create poll form */}
      {showForm && (
        <form onSubmit={createPoll} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
          <h3 className="font-semibold text-gray-800">New Availability Poll</h3>

          <input
            required
            placeholder="Poll title (e.g. Summer Trip 2025)"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            className="input w-full"
          />

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Trip starts on</label>
              <select required value={form.start_dow} onChange={e => setForm(f => ({ ...f, start_dow: e.target.value }))} className="input w-full">
                {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Trip length (days)</label>
              <input
                required type="number" min="1" max="14"
                value={form.trip_days}
                onChange={e => setForm(f => ({ ...f, trip_days: e.target.value }))}
                className="input w-full"
              />
            </div>
          </div>
          {form.start_dow && form.trip_days && (
            <p className="text-xs text-brand-600">
              {form.trip_days}-day trip · starts every {DAYS[parseInt(form.start_dow)]} · ends every {DAYS[(parseInt(form.start_dow) + parseInt(form.trip_days) - 1) % 7]}
            </p>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Availability window — search within this range</label>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Earliest possible start</label>
                <input required type="date" value={form.window_start} onChange={e => setForm(f => ({ ...f, window_start: e.target.value }))} className="input w-full" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Latest possible end</label>
                <input required type="date" value={form.window_end} onChange={e => setForm(f => ({ ...f, window_end: e.target.value }))} className="input w-full" />
              </div>
            </div>
          </div>

          {/* Preview slots */}
          {form.start_dow !== '' && form.trip_days && form.window_start && form.window_end && (() => {
            const slots = generateSlots(parseInt(form.start_dow), parseInt(form.trip_days), form.window_start, form.window_end)
            if (!slots.length) return <p className="text-xs text-red-400">No slots fit in that window.</p>
            return (
              <div className="bg-brand-50 rounded-lg p-3">
                <p className="text-xs font-medium text-brand-700 mb-2">{slots.length} possible slots:</p>
                <div className="flex flex-wrap gap-1.5">
                  {slots.map(s => (
                    <span key={s.start} className="text-xs bg-white border border-brand-200 text-brand-700 px-2 py-0.5 rounded-full">{s.label}</span>
                  ))}
                </div>
              </div>
            )
          })()}

          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition disabled:opacity-50">
              {saving ? 'Creating…' : 'Create Poll'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="text-gray-500 px-4 py-2 rounded-lg text-sm hover:bg-gray-100 transition">Cancel</button>
          </div>
        </form>
      )}

      {/* Polls */}
      {polls.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">No availability polls yet. Create one to get started.</div>
      ) : polls.map(poll => {
        const slots = generateSlots(poll.start_dow, poll.trip_days, poll.window_start, poll.window_end)
        const mySlots = myVotes[poll.id] || new Set()
        const isOptedOut = !!myOptOuts[poll.id]
        const hasResponded = mySlots.size > 0 || isOptedOut

        // Sort slots by available count descending
        const slotsWithStats = slots.map(slot => ({ ...slot, ...getSlotStats(poll.id, slot.start) }))
        slotsWithStats.sort((a, b) => b.available - a.available)

        return (
          <div key={poll.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Poll header */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between">
              <div>
                <h3 className="font-bold text-gray-900">{poll.title}</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {poll.trip_days}-day trips · every {DAYS[poll.start_dow]} ·{' '}
                  {format(parseISO(poll.window_start), 'MMM d')} – {format(parseISO(poll.window_end), 'MMM d, yyyy')} ·{' '}
                  created by {poll.profiles?.full_name?.split(' ')[0]}
                </p>
              </div>
              {profile?.is_admin && (
                <button onClick={() => deletePoll(poll.id)} className="text-red-400 hover:text-red-600 text-xs ml-4 shrink-0">Delete</button>
              )}
            </div>

            {/* My response */}
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-3">
              <span className="text-xs font-medium text-gray-500">Your response:</span>
              {!hasResponded && <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full">⏳ Not responded yet</span>}
              {mySlots.size > 0 && <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">✅ {mySlots.size} slot{mySlots.size !== 1 ? 's' : ''} selected</span>}
              <button
                onClick={() => toggleOptOut(poll.id)}
                className={`text-xs px-3 py-1 rounded-full border transition ml-auto ${isOptedOut ? 'bg-red-500 text-white border-red-500' : 'bg-white text-gray-500 border-gray-200 hover:border-red-400 hover:text-red-500'}`}
              >
                {isOptedOut ? "❌ Can't make any of these" : "Can't make any of these"}
              </button>
            </div>

            {/* Slots */}
            <div className="divide-y divide-gray-50">
              {slotsWithStats.map(slot => {
                const isSelected = mySlots.has(slot.start)
                const total = members.length
                const pct = total > 0 ? (slot.available / total) * 100 : 0

                return (
                  <div key={slot.start} className={`px-5 py-3 transition ${isOptedOut ? 'opacity-40' : ''} ${isSelected ? 'bg-green-50' : ''}`}>
                    <button
                      onClick={() => !isOptedOut && toggleSlot(poll.id, slot.start)}
                      disabled={isOptedOut}
                      className={`w-full flex items-center gap-4 text-left ${isOptedOut ? 'cursor-not-allowed' : ''}`}
                    >
                      {/* Checkbox */}
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition ${isSelected ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
                        {isSelected && <span className="text-white text-xs">✓</span>}
                      </div>

                      {/* Date */}
                      <div className="w-36 shrink-0">
                        <p className={`text-sm font-medium ${isSelected ? 'text-green-700' : 'text-gray-800'}`}>{slot.label}</p>
                        <p className="text-xs text-gray-400">{DAYS[poll.start_dow]} – {DAYS[(poll.start_dow + poll.trip_days - 1) % 7]}</p>
                      </div>

                      {/* Progress bar */}
                      <div className="flex-1">
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-400 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      {/* Counts */}
                      <div className="flex items-center gap-3 text-xs shrink-0">
                        <span className="text-green-600 font-semibold">✅ {slot.available}</span>
                        <span className="text-red-400">❌ {slot.optedOut}</span>
                        <span className="text-gray-400">⏳ {slot.outstanding}</span>
                      </div>
                    </button>

                    {/* Names breakdown */}
                    {(slot.available > 0 || slot.optedOut > 0) && (
                      <div className="ml-9 mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                        {slot.availableNames.length > 0 && (
                          <span className="text-green-600">
                            ✅ {slot.availableNames.join(', ')}
                          </span>
                        )}
                        {slot.optedOutNames.length > 0 && (
                          <span className="text-red-400">
                            ❌ {slot.optedOutNames.join(', ')}
                          </span>
                        )}
                        {slot.outstandingNames.length > 0 && (
                          <span className="text-gray-400">
                            ⏳ {slot.outstandingNames.join(', ')}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
