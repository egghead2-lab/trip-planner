import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { format, parseISO } from 'date-fns'

export default function PropBets() {
  const { profile } = useAuth()
  const [trips, setTrips] = useState([])
  const [selectedTrip, setSelectedTrip] = useState(null)
  const [bets, setBets] = useState([])
  const [myVotes, setMyVotes] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => { loadTrips() }, [])
  useEffect(() => { if (selectedTrip) loadBets() }, [selectedTrip])

  async function loadTrips() {
    const { data } = await supabase.from('trips').select('id, title').order('start_date', { ascending: false })
    setTrips(data || [])
    if (data?.length) setSelectedTrip(data[0].id)
  }

  async function loadBets() {
    setLoading(true)
    const [{ data: b }, { data: v }] = await Promise.all([
      supabase.from('prop_bets').select('*, profiles(full_name), prop_bet_votes(*), prop_bet_results(*)').eq('trip_id', selectedTrip).order('created_at'),
      supabase.from('prop_bet_votes').select('*').eq('user_id', profile.id),
    ])
    setBets(b || [])
    setMyVotes(v || [])
    setLoading(false)
  }

  async function addBet(e) {
    e.preventDefault()
    if (!description.trim()) return
    setSaving(true)
    await supabase.from('prop_bets').insert({ trip_id: selectedTrip, description: description.trim(), created_by: profile.id })
    setDescription('')
    setShowForm(false)
    setSaving(false)
    loadBets()
  }

  async function vote(betId, prediction) {
    const existing = myVotes.find(v => v.bet_id === betId)
    if (existing) {
      await supabase.from('prop_bet_votes').update({ prediction }).eq('id', existing.id)
    } else {
      await supabase.from('prop_bet_votes').insert({ bet_id: betId, user_id: profile.id, prediction })
    }
    loadBets()
  }

  async function resolve(betId, result) {
    const existing = await supabase.from('prop_bet_results').select('id').eq('bet_id', betId).single()
    if (existing.data) {
      await supabase.from('prop_bet_results').update({ result, resolved_by: profile.id, resolved_at: new Date().toISOString() }).eq('bet_id', betId)
    } else {
      await supabase.from('prop_bet_results').insert({ bet_id: betId, result, resolved_by: profile.id })
    }
    loadBets()
  }

  async function deleteBet(id) {
    await supabase.from('prop_bets').delete().eq('id', id)
    loadBets()
  }

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">🎲 Prop Bets</h1>
        <button onClick={() => setShowForm(s => !s)} className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition">
          + New Bet
        </button>
      </div>
      <p className="text-sm text-gray-500">For bragging rights only. No money involved.</p>

      {/* Trip selector */}
      <div className="flex gap-2 flex-wrap">
        {trips.map(t => (
          <button key={t.id} onClick={() => setSelectedTrip(t.id)} className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${selectedTrip === t.id ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {t.title}
          </button>
        ))}
      </div>

      {showForm && (
        <form onSubmit={addBet} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <h3 className="font-semibold text-gray-800">New Prop Bet</h3>
          <input required value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Dave will fall asleep before 10pm on night 1" className="input w-full" />
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-brand-700 transition disabled:opacity-50">{saving ? 'Saving…' : 'Add Bet'}</button>
            <button type="button" onClick={() => setShowForm(false)} className="text-gray-500 px-4 py-2 rounded-lg text-sm hover:bg-gray-100 transition">Cancel</button>
          </div>
        </form>
      )}

      {bets.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
          No bets yet. Someone's gonna do something dumb — bet on it.
        </div>
      ) : (
        <div className="space-y-3">
          {bets.map(bet => {
            const myVote = myVotes.find(v => v.bet_id === bet.id)
            const yesVotes = bet.prop_bet_votes?.filter(v => v.prediction === true).length || 0
            const noVotes = bet.prop_bet_votes?.filter(v => v.prediction === false).length || 0
            const total = yesVotes + noVotes
            const result = bet.prop_bet_results?.[0]
            const resolved = result !== undefined && result !== null && bet.prop_bet_results?.length > 0

            return (
              <div key={bet.id} className={`bg-white rounded-xl border shadow-sm p-5 space-y-3 ${resolved ? 'border-gray-200 opacity-90' : 'border-gray-200'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900">{bet.description}</p>
                    <p className="text-xs text-gray-400 mt-0.5">by {bet.profiles?.full_name}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {resolved && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${result.result ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {result.result ? '✅ Happened' : '❌ Didn\'t happen'}
                      </span>
                    )}
                    {profile?.is_admin && (
                      <button onClick={() => deleteBet(bet.id)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                    )}
                  </div>
                </div>

                {/* Vote buttons */}
                {!resolved && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => vote(bet.id, true)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${myVote?.prediction === true ? 'bg-green-500 text-white border-green-500' : 'bg-white text-gray-600 border-gray-200 hover:bg-green-50'}`}
                    >
                      ✅ Yes it will ({yesVotes})
                    </button>
                    <button
                      onClick={() => vote(bet.id, false)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${myVote?.prediction === false ? 'bg-red-400 text-white border-red-400' : 'bg-white text-gray-600 border-gray-200 hover:bg-red-50'}`}
                    >
                      ❌ No way ({noVotes})
                    </button>
                  </div>
                )}

                {/* Resolve (admin only) */}
                {profile?.is_admin && !resolved && (
                  <div className="flex gap-2 border-t border-gray-100 pt-3">
                    <span className="text-xs text-gray-400 self-center">Resolve:</span>
                    <button onClick={() => resolve(bet.id, true)} className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-lg hover:bg-green-200 transition">It happened ✅</button>
                    <button onClick={() => resolve(bet.id, false)} className="text-xs bg-red-100 text-red-600 px-3 py-1 rounded-lg hover:bg-red-200 transition">Didn't happen ❌</button>
                  </div>
                )}

                {/* Results breakdown */}
                {resolved && total > 0 && (
                  <div className="text-xs text-gray-400">
                    {yesVotes} yes · {noVotes} no
                    {myVote && <span className="ml-2">· You voted: {myVote.prediction ? 'yes ✅' : 'no ❌'} {myVote.prediction === result.result ? '(correct!)' : '(wrong)'}</span>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
