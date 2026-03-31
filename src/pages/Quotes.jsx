import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { format, parseISO } from 'date-fns'

export default function Quotes() {
  const { profile } = useAuth()
  const [trips, setTrips] = useState([])
  const [selectedTrip, setSelectedTrip] = useState('all')
  const [quotes, setQuotes] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ text: '', attributed_to: '', trip_id: '' })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadTrips() }, [])
  useEffect(() => { loadQuotes() }, [selectedTrip])

  async function loadTrips() {
    const { data } = await supabase.from('trips').select('id, title').order('start_date', { ascending: false })
    setTrips(data || [])
    setLoading(false)
  }

  async function loadQuotes() {
    let query = supabase.from('quotes').select('*, profiles(full_name), trips(title)').order('created_at', { ascending: false })
    if (selectedTrip !== 'all') query = query.eq('trip_id', selectedTrip)
    const { data } = await query
    setQuotes(data || [])
  }

  async function addQuote(e) {
    e.preventDefault()
    if (!form.text.trim() || !form.attributed_to.trim()) return
    setSaving(true)
    await supabase.from('quotes').insert({
      text: form.text.trim(),
      attributed_to: form.attributed_to.trim(),
      trip_id: form.trip_id || null,
      added_by: profile.id,
    })
    setForm({ text: '', attributed_to: '', trip_id: '' })
    setShowForm(false)
    setSaving(false)
    loadQuotes()
  }

  async function deleteQuote(id) {
    await supabase.from('quotes').delete().eq('id', id)
    loadQuotes()
  }

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">💬 Memorable Quotes</h1>
        <button onClick={() => setShowForm(s => !s)} className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition">
          + Add Quote
        </button>
      </div>

      {/* Trip filter */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setSelectedTrip('all')} className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${selectedTrip === 'all' ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
          All Trips
        </button>
        {trips.map(t => (
          <button key={t.id} onClick={() => setSelectedTrip(t.id)} className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${selectedTrip === t.id ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {t.title}
          </button>
        ))}
      </div>

      {showForm && (
        <form onSubmit={addQuote} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <h3 className="font-semibold text-gray-800">Add a Quote</h3>
          <textarea required value={form.text} onChange={e => setForm(f => ({ ...f, text: e.target.value }))} placeholder="What was said…" className="input w-full h-20 resize-none" />
          <div className="grid sm:grid-cols-2 gap-3">
            <input required value={form.attributed_to} onChange={e => setForm(f => ({ ...f, attributed_to: e.target.value }))} placeholder="Who said it" className="input" />
            <select value={form.trip_id} onChange={e => setForm(f => ({ ...f, trip_id: e.target.value }))} className="input">
              <option value="">No specific trip</option>
              {trips.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-brand-700 transition disabled:opacity-50">{saving ? 'Saving…' : 'Add Quote'}</button>
            <button type="button" onClick={() => setShowForm(false)} className="text-gray-500 px-4 py-2 rounded-lg text-sm hover:bg-gray-100 transition">Cancel</button>
          </div>
        </form>
      )}

      {quotes.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
          No quotes yet. Someone will say something quotable. They always do.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {quotes.map(q => (
            <div key={q.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col gap-3">
              <blockquote className="text-gray-800 italic text-base leading-relaxed border-l-4 border-brand-500 pl-4">
                "{q.text}"
              </blockquote>
              <div className="flex items-center justify-between mt-auto">
                <div>
                  <p className="font-semibold text-sm text-gray-700">— {q.attributed_to}</p>
                  <p className="text-xs text-gray-400">
                    logged by {q.profiles?.full_name}
                    {q.trips?.title && <> · {q.trips.title}</>}
                    {' · '}{format(parseISO(q.created_at), 'MMM d, yyyy')}
                  </p>
                </div>
                {(profile?.is_admin || q.added_by === profile?.id) && (
                  <button onClick={() => deleteQuote(q.id)} className="text-red-400 hover:text-red-600 text-xs">Delete</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
