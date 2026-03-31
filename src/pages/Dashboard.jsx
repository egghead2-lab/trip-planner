import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { format, parseISO, isPast } from 'date-fns'

export default function Dashboard() {
  const { profile } = useAuth()
  const [nextTrip, setNextTrip] = useState(null)
  const [announcements, setAnnouncements] = useState([])
  const [recentQuotes, setRecentQuotes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: trips }, { data: ann }, { data: quotes }] = await Promise.all([
        supabase.from('trips').select('*').order('start_date', { ascending: true }),
        supabase.from('announcements').select('*, profiles(full_name)').order('created_at', { ascending: false }).limit(3),
        supabase.from('quotes').select('*, profiles(full_name)').order('created_at', { ascending: false }).limit(3),
      ])
      const upcoming = (trips || []).find(t => !isPast(parseISO(t.end_date)))
      setNextTrip(upcoming || null)
      setAnnouncements(ann || [])
      setRecentQuotes(quotes || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="bg-gradient-to-r from-brand-700 to-brand-500 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold">Hey {profile?.full_name?.split(' ')[0]} 👋</h1>
        {nextTrip ? (
          <p className="mt-1 text-white/80">
            Next trip: <span className="font-semibold text-white">{nextTrip.title}</span> —{' '}
            {format(parseISO(nextTrip.start_date), 'MMM d, yyyy')}
          </p>
        ) : (
          <p className="mt-1 text-white/80">No upcoming trips yet. Time to plan one!</p>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { to: '/trips',        icon: '✈️',  label: 'Trips' },
          { to: '/availability', icon: '📅',  label: 'Availability' },
          { to: '/polls',        icon: '🗳️', label: 'Polls' },
          { to: '/bingo',        icon: '🎱',  label: 'Bingo' },
          { to: '/bets',         icon: '🎲',  label: 'Prop Bets' },
          { to: '/quotes',       icon: '💬',  label: 'Quotes' },
          { to: '/gallery',      icon: '📸',  label: 'Gallery' },
          { to: '/announcements',icon: '📣',  label: 'News' },
        ].map(item => (
          <Link
            key={item.to}
            to={item.to}
            className="bg-white rounded-xl p-4 flex flex-col items-center gap-1 shadow-sm hover:shadow-md transition border border-gray-100"
          >
            <span className="text-2xl">{item.icon}</span>
            <span className="text-sm font-medium text-gray-700">{item.label}</span>
          </Link>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Announcements */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800">📣 Latest News</h2>
            <Link to="/announcements" className="text-xs text-brand-600 hover:underline">View all</Link>
          </div>
          {announcements.length === 0 ? (
            <p className="text-sm text-gray-400">No announcements yet.</p>
          ) : (
            <div className="space-y-3">
              {announcements.map(a => (
                <div key={a.id} className="text-sm">
                  <p className="text-gray-800">{a.body}</p>
                  <p className="text-gray-400 text-xs mt-0.5">— {a.profiles?.full_name} · {format(parseISO(a.created_at), 'MMM d')}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent quotes */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800">💬 Recent Quotes</h2>
            <Link to="/quotes" className="text-xs text-brand-600 hover:underline">View all</Link>
          </div>
          {recentQuotes.length === 0 ? (
            <p className="text-sm text-gray-400">No quotes yet. Someone always says something stupid.</p>
          ) : (
            <div className="space-y-3">
              {recentQuotes.map(q => (
                <div key={q.id} className="text-sm border-l-2 border-brand-500 pl-3">
                  <p className="text-gray-800 italic">"{q.text}"</p>
                  <p className="text-gray-400 text-xs mt-0.5">— {q.attributed_to}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
