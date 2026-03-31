import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { format, parseISO } from 'date-fns'

export default function Trips() {
  const { profile } = useAuth()
  const [trips, setTrips] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', destination: '', start_date: '', end_date: '', description: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchTrips() }, [])

  async function fetchTrips() {
    const { data } = await supabase.from('trips').select('*').order('start_date', { ascending: false })
    setTrips(data || [])
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('trips').insert({ ...form, created_by: profile.id })
    setForm({ title: '', destination: '', start_date: '', end_date: '', description: '' })
    setShowForm(false)
    setSaving(false)
    fetchTrips()
  }

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">✈️ Trips</h1>
        {profile?.is_admin && (
          <button onClick={() => setShowForm(s => !s)} className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition">
            + New Trip
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
          <h2 className="font-semibold text-gray-800">New Trip</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <input required placeholder="Trip title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="input" />
            <input required placeholder="Destination" value={form.destination} onChange={e => setForm(f => ({ ...f, destination: e.target.value }))} className="input" />
            <input required type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="input" />
            <input required type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className="input" />
          </div>
          <textarea placeholder="Description (optional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="input w-full h-20 resize-none" />
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition disabled:opacity-50">
              {saving ? 'Saving…' : 'Create Trip'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition">Cancel</button>
          </div>
        </form>
      )}

      {trips.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
          No trips yet. {profile?.is_admin ? 'Create one above!' : 'Ask an admin to create one.'}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {trips.map(trip => (
            <Link key={trip.id} to={`/trips/${trip.id}`} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition p-5 flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-gray-900">{trip.title}</h3>
                  <p className="text-sm text-brand-600">📍 {trip.destination}</p>
                </div>
                <span className="text-2xl">✈️</span>
              </div>
              <p className="text-xs text-gray-400">
                {format(parseISO(trip.start_date), 'MMM d')} – {format(parseISO(trip.end_date), 'MMM d, yyyy')}
              </p>
              {trip.description && <p className="text-sm text-gray-600 line-clamp-2">{trip.description}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
