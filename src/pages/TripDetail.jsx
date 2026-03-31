import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { AvatarWithFallback } from '../components/Avatar'
import { format, parseISO } from 'date-fns'

const TABS = ['Overview', 'RSVP', 'Itinerary', 'Expenses']

export default function TripDetail() {
  const { id } = useParams()
  const { profile } = useAuth()
  const [trip, setTrip] = useState(null)
  const [tab, setTab] = useState('Overview')
  const [rsvps, setRsvps] = useState([])
  const [myRsvp, setMyRsvp] = useState(null)
  const [notes, setNotes] = useState('')
  const [editingNotes, setEditingNotes] = useState(false)
  const [expenses, setExpenses] = useState([])
  const [expenseForm, setExpenseForm] = useState({ label: '', amount: '', participants: [] })
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAll() }, [id])

  async function loadAll() {
    const [{ data: t }, { data: r }, { data: n }, { data: b }] = await Promise.all([
      supabase.from('trips').select('*').eq('id', id).single(),
      supabase.from('trip_rsvp').select('*, profiles(id, full_name, avatar_url)').eq('trip_id', id),
      supabase.from('itinerary_notes').select('*').eq('trip_id', id).single(),
      supabase.from('budget_items').select('*, profiles(id, full_name)').eq('trip_id', id).order('created_at'),
    ])
    setTrip(t)
    setRsvps(r || [])
    setMyRsvp(r?.find(r => r.user_id === profile?.id) || null)
    setNotes(n?.body || '')
    setExpenses(b || [])
    setLoading(false)
  }

  async function setRsvpStatus(status) {
    if (myRsvp) {
      await supabase.from('trip_rsvp').update({ status }).eq('id', myRsvp.id)
    } else {
      await supabase.from('trip_rsvp').insert({ trip_id: id, user_id: profile.id, status })
    }
    loadAll()
  }

  async function saveNotes() {
    const existing = await supabase.from('itinerary_notes').select('id').eq('trip_id', id).single()
    if (existing.data) {
      await supabase.from('itinerary_notes').update({ body: notes, updated_by: profile.id, updated_at: new Date().toISOString() }).eq('trip_id', id)
    } else {
      await supabase.from('itinerary_notes').insert({ trip_id: id, body: notes, updated_by: profile.id })
    }
    setEditingNotes(false)
  }

  async function addExpense(e) {
    e.preventDefault()
    await supabase.from('budget_items').insert({
      trip_id: id,
      label: expenseForm.label,
      amount: parseFloat(expenseForm.amount),
      paid_by: profile.id,
      participants: expenseForm.participants,
    })
    setExpenseForm({ label: '', amount: '', participants: [] })
    setShowExpenseForm(false)
    loadAll()
  }

  async function deleteExpense(itemId) {
    await supabase.from('budget_items').delete().eq('id', itemId)
    loadAll()
  }

  function toggleParticipant(userId) {
    setExpenseForm(f => ({
      ...f,
      participants: f.participants.includes(userId)
        ? f.participants.filter(p => p !== userId)
        : [...f.participants, userId],
    }))
  }

  // Build per-member totals: sum of (amount / participants.length) for each expense they're in
  function getMemberTotals() {
    const totals = {}
    // Init all RSVPed members
    rsvps.forEach(r => { totals[r.user_id] = { name: r.profiles?.full_name, total: 0 } })

    expenses.forEach(exp => {
      const parts = exp.participants || []
      if (parts.length === 0) return
      const share = Number(exp.amount) / parts.length
      parts.forEach(uid => {
        if (!totals[uid]) totals[uid] = { name: uid, total: 0 }
        totals[uid].total += share
      })
    })
    return Object.entries(totals).filter(([, v]) => v.total > 0).sort((a, b) => b[1].total - a[1].total)
  }

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
  if (!trip) return <div className="text-center py-20 text-gray-400">Trip not found.</div>

  const inCount = rsvps.filter(r => r.status === 'in').length
  const outCount = rsvps.filter(r => r.status === 'out').length
  const maybeCount = rsvps.filter(r => r.status === 'maybe').length
  const totalExpenses = expenses.reduce((s, b) => s + Number(b.amount), 0)
  const memberTotals = getMemberTotals()
  const attendees = rsvps.filter(r => r.status === 'in' || r.status === 'maybe')

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-brand-700 to-brand-500 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold">{trip.title}</h1>
        <p className="text-white/80 mt-1">📍 {trip.destination} · {format(parseISO(trip.start_date), 'MMM d')} – {format(parseISO(trip.end_date), 'MMM d, yyyy')}</p>
        {trip.description && <p className="mt-2 text-white/70 text-sm">{trip.description}</p>}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'Overview' && (
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
            <div className="text-3xl font-bold text-green-500">{inCount}</div>
            <div className="text-sm text-gray-500 mt-1">In ✅</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
            <div className="text-3xl font-bold text-yellow-500">{maybeCount}</div>
            <div className="text-sm text-gray-500 mt-1">Maybe 🤔</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
            <div className="text-3xl font-bold text-red-400">{outCount}</div>
            <div className="text-sm text-gray-500 mt-1">Out ❌</div>
          </div>
        </div>
      )}

      {/* RSVP */}
      {tab === 'RSVP' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-3">Your Status</h3>
            <div className="flex gap-2">
              {['in', 'maybe', 'out'].map(s => (
                <button
                  key={s}
                  onClick={() => setRsvpStatus(s)}
                  className={`px-5 py-2 rounded-lg text-sm font-medium transition border ${myRsvp?.status === s
                    ? s === 'in' ? 'bg-green-500 text-white border-green-500'
                    : s === 'maybe' ? 'bg-yellow-400 text-white border-yellow-400'
                    : 'bg-red-400 text-white border-red-400'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                >
                  {s === 'in' ? "✅ I'm In" : s === 'maybe' ? '🤔 Maybe' : "❌ I'm Out"}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-3">Crew Status</h3>
            <div className="space-y-2">
              {rsvps.map(r => (
                <div key={r.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AvatarWithFallback url={r.profiles?.avatar_url} name={r.profiles?.full_name} size="sm" />
                    <span className="text-sm text-gray-700">{r.profiles?.full_name}</span>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${r.status === 'in' ? 'bg-green-100 text-green-700' : r.status === 'maybe' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'}`}>
                    {r.status === 'in' ? '✅ In' : r.status === 'maybe' ? '🤔 Maybe' : '❌ Out'}
                  </span>
                </div>
              ))}
              {rsvps.length === 0 && <p className="text-sm text-gray-400">No RSVPs yet.</p>}
            </div>
          </div>
        </div>
      )}

      {/* Itinerary */}
      {tab === 'Itinerary' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">Itinerary & Notes</h3>
            {!editingNotes && (
              <button onClick={() => setEditingNotes(true)} className="text-xs text-brand-600 hover:underline">Edit</button>
            )}
          </div>
          {editingNotes ? (
            <>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full h-64 input resize-none font-mono text-sm" placeholder="Paste hotel links, flight info, activity ideas..." />
              <div className="flex gap-2">
                <button onClick={saveNotes} className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-brand-700 transition">Save</button>
                <button onClick={() => setEditingNotes(false)} className="text-gray-500 px-4 py-2 rounded-lg text-sm hover:bg-gray-100 transition">Cancel</button>
              </div>
            </>
          ) : (
            <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed">{notes || <span className="text-gray-400">No notes yet. Click Edit to start.</span>}</pre>
          )}
        </div>
      )}

      {/* Expenses */}
      {tab === 'Expenses' && (
        <div className="space-y-4">
          {/* Summary header */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-gray-500">Total tracked: </span>
              <span className="font-bold text-gray-900">${totalExpenses.toFixed(2)}</span>
            </div>
            <button
              onClick={() => setShowExpenseForm(s => !s)}
              className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition"
            >
              + Add Expense
            </button>
          </div>

          {/* Add expense form */}
          {showExpenseForm && (
            <form onSubmit={addExpense} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
              <h3 className="font-semibold text-gray-800">New Expense</h3>

              <div className="grid sm:grid-cols-2 gap-3">
                <input
                  required
                  placeholder="Description (e.g. Airbnb, Dinner)"
                  value={expenseForm.label}
                  onChange={e => setExpenseForm(f => ({ ...f, label: e.target.value }))}
                  className="input"
                />
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Amount ($)"
                  value={expenseForm.amount}
                  onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))}
                  className="input"
                />
              </div>

              {/* Participants */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">
                  Split between ({expenseForm.participants.length} selected
                  {expenseForm.participants.length > 0 && expenseForm.amount
                    ? ` · $${(parseFloat(expenseForm.amount) / expenseForm.participants.length).toFixed(2)} each`
                    : ''})
                </label>
                {attendees.length === 0 ? (
                  <p className="text-xs text-gray-400">No RSVPs yet — add some from the RSVP tab first.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {attendees.map(r => {
                      const selected = expenseForm.participants.includes(r.user_id)
                      return (
                        <button
                          key={r.user_id}
                          type="button"
                          onClick={() => toggleParticipant(r.user_id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition ${
                            selected
                              ? 'bg-brand-600 text-white border-brand-600'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-brand-400'
                          }`}
                        >
                          <AvatarWithFallback url={r.profiles?.avatar_url} name={r.profiles?.full_name} size="sm" />
                          {r.profiles?.full_name?.split(' ')[0]}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition"
                >
                  Add Expense
                </button>
                <button type="button" onClick={() => setShowExpenseForm(false)} className="text-gray-500 px-4 py-2 rounded-lg text-sm hover:bg-gray-100 transition">Cancel</button>
              </div>
            </form>
          )}

          {/* Per-member totals */}
          {memberTotals.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="font-semibold text-gray-800 mb-3">💰 Cost per Member</h3>
              <div className="space-y-2">
                {memberTotals.map(([uid, { name, total }]) => {
                  const rsvp = rsvps.find(r => r.user_id === uid)
                  const pct = totalExpenses > 0 ? (total / totalExpenses) * 100 : 0
                  return (
                    <div key={uid} className="flex items-center gap-3">
                      <AvatarWithFallback url={rsvp?.profiles?.avatar_url} name={name} size="sm" />
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-gray-800">{name?.split(' ')[0]}</span>
                          <span className="font-bold text-gray-900">${total.toFixed(2)}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-brand-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Expense list */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
            {expenses.length === 0 ? (
              <p className="text-sm text-gray-400 p-5">No expenses yet.</p>
            ) : expenses.map(item => {
              const parts = item.participants || []
              const share = parts.length > 0 ? Number(item.amount) / parts.length : null
              return (
                <div key={item.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">{item.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">paid by {item.profiles?.full_name?.split(' ')[0]}</p>
                      {parts.length > 0 && (
                        <p className="text-xs text-gray-400">
                          split {parts.length} ways · ${share.toFixed(2)}/person
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-bold text-gray-900">${Number(item.amount).toFixed(2)}</span>
                      {(profile?.is_admin || item.paid_by === profile?.id) && (
                        <button onClick={() => deleteExpense(item.id)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
