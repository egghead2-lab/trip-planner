import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { format, parseISO, isPast } from 'date-fns'

// Shuffle array using Fisher-Yates
function shuffleSeeded(arr, seed) {
  const a = [...arr]
  let s = seed
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    const j = Math.abs(s) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Create a deterministic seed from user id string
function seedFromId(id) {
  return id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
}

export default function Bingo() {
  const { profile } = useAuth()
  const [trips, setTrips] = useState([])
  const [selectedTrip, setSelectedTrip] = useState(null)
  const [items, setItems] = useState([])       // bingo_items pool
  const [marks, setMarks] = useState([])       // my marked square indices
  const [card, setCard] = useState(null)       // 25-item array
  const [newItem, setNewItem] = useState('')
  const [addingItem, setAddingItem] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => { loadTrips() }, [])
  useEffect(() => { if (selectedTrip) loadBingo() }, [selectedTrip])

  async function loadTrips() {
    const { data } = await supabase.from('trips').select('id, title, start_date').order('start_date', { ascending: false })
    setTrips(data || [])
    if (data?.length) setSelectedTrip(data[0].id)
  }

  async function loadBingo() {
    setLoading(true)
    const [{ data: poolItems }, { data: cardData }, { data: markData }] = await Promise.all([
      supabase.from('bingo_items').select('*, profiles(full_name)').eq('trip_id', selectedTrip).order('created_at'),
      supabase.from('bingo_cards').select('*').eq('trip_id', selectedTrip).eq('user_id', profile.id).single(),
      supabase.from('bingo_marks').select('*').eq('user_id', profile.id),
    ])
    setItems(poolItems || [])
    if (cardData) {
      setCard(cardData.squares)
      setMarks((markData || []).filter(m => m.card_id === cardData.id).map(m => m.square_index))
    } else {
      setCard(null)
      setMarks([])
    }
    setLoading(false)
  }

  async function generateCard() {
    if (items.length < 24) {
      alert(`Need at least 24 items to generate a card. You have ${items.length}.`)
      return
    }
    const pool = items.map(i => i.text)
    const seed = seedFromId(profile.id + selectedTrip)
    const shuffled = shuffleSeeded(pool, seed)
    const squares = [...shuffled.slice(0, 12), 'FREE', ...shuffled.slice(12, 24)]

    const { data: newCard } = await supabase.from('bingo_cards')
      .insert({ trip_id: selectedTrip, user_id: profile.id, squares })
      .select().single()
    setCard(newCard.squares)
    setMarks([])
  }

  async function toggleMark(idx) {
    const { data: cardData } = await supabase.from('bingo_cards').select('id').eq('trip_id', selectedTrip).eq('user_id', profile.id).single()
    if (!cardData) return
    const cardId = cardData.id
    const isMarked = marks.includes(idx)
    if (isMarked) {
      await supabase.from('bingo_marks').delete().eq('card_id', cardId).eq('square_index', idx).eq('user_id', profile.id)
      setMarks(m => m.filter(i => i !== idx))
    } else {
      await supabase.from('bingo_marks').insert({ card_id: cardId, square_index: idx, user_id: profile.id })
      setMarks(m => [...m, idx])
    }
  }

  async function addItem(e) {
    e.preventDefault()
    if (!newItem.trim()) return
    setAddingItem(true)
    await supabase.from('bingo_items').insert({ trip_id: selectedTrip, text: newItem.trim(), added_by: profile.id })
    setNewItem('')
    setAddingItem(false)
    loadBingo()
  }

  async function removeItem(id) {
    await supabase.from('bingo_items').delete().eq('id', id)
    loadBingo()
  }

  function checkBingo() {
    if (!card) return false
    const rows = [[0,1,2,3,4],[5,6,7,8,9],[10,11,12,13,14],[15,16,17,18,19],[20,21,22,23,24]]
    const cols = [[0,5,10,15,20],[1,6,11,16,21],[2,7,12,17,22],[3,8,13,18,23],[4,9,14,19,24]]
    const diags = [[0,6,12,18,24],[4,8,12,16,20]]
    return [...rows,...cols,...diags].some(line => line.every(i => i === 12 || marks.includes(i)))
  }

  const hasBingo = checkBingo()
  const trip = trips.find(t => t.id === selectedTrip)
  const tripStarted = trip ? isPast(parseISO(trip.start_date)) : false
  const canAddItems = !tripStarted

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">🎱 Trip Bingo</h1>

      {/* Trip selector */}
      <div className="flex gap-2 flex-wrap">
        {trips.map(t => (
          <button key={t.id} onClick={() => setSelectedTrip(t.id)} className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${selectedTrip === t.id ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {t.title}
          </button>
        ))}
      </div>

      {selectedTrip && (
        <div className="grid lg:grid-cols-5 gap-6">
          {/* Left: item pool + add */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">Item Pool ({items.length})</h3>
                {canAddItems ? (
                  <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Open for additions</span>
                ) : (
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Locked (trip started)</span>
                )}
              </div>
              {canAddItems && (
                <form onSubmit={addItem} className="flex gap-2">
                  <input value={newItem} onChange={e => setNewItem(e.target.value)} placeholder="Add a bingo item…" className="input flex-1 text-sm" />
                  <button type="submit" disabled={addingItem} className="bg-brand-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-brand-700 transition">Add</button>
                </form>
              )}
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {items.map(item => (
                  <div key={item.id} className="flex items-center justify-between py-1">
                    <span className="text-sm text-gray-700">{item.text}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{item.profiles?.full_name?.split(' ')[0]}</span>
                      {(profile?.is_admin || item.added_by === profile?.id) && canAddItems && (
                        <button onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                      )}
                    </div>
                  </div>
                ))}
                {items.length === 0 && <p className="text-sm text-gray-400">No items yet. Add some!</p>}
              </div>
            </div>

            {!card && items.length >= 24 && (
              <button onClick={generateCard} className="w-full bg-brand-600 text-white py-3 rounded-xl font-medium hover:bg-brand-700 transition">
                🎲 Generate My Card
              </button>
            )}
            {!card && items.length < 24 && (
              <p className="text-sm text-gray-400 text-center">Need {24 - items.length} more item{24 - items.length !== 1 ? 's' : ''} to generate cards.</p>
            )}
          </div>

          {/* Right: bingo card */}
          <div className="lg:col-span-3">
            {card ? (
              <div className="space-y-3">
                {hasBingo && (
                  <div className="bg-yellow-400 text-yellow-900 font-bold text-center py-3 rounded-xl text-lg animate-bounce">
                    🎉 BINGO! You got it!
                  </div>
                )}
                <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
                  <div className="grid grid-cols-5 gap-1.5">
                    {['B','I','N','G','O'].map(l => (
                      <div key={l} className="bg-brand-600 text-white text-center font-bold text-sm py-1.5 rounded">{l}</div>
                    ))}
                    {card.map((text, idx) => {
                      const isFree = text === 'FREE'
                      const isMarked = marks.includes(idx) || isFree
                      return (
                        <button
                          key={idx}
                          onClick={() => !isFree && toggleMark(idx)}
                          className={`aspect-square flex items-center justify-center text-center text-xs p-1 rounded leading-tight transition font-medium ${
                            isFree
                              ? 'bg-brand-500 text-white cursor-default'
                              : isMarked
                              ? 'bg-green-400 text-white'
                              : 'bg-gray-50 text-gray-700 hover:bg-brand-50 border border-gray-200'
                          }`}
                        >
                          {isFree ? '⭐ FREE' : text}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <p className="text-xs text-gray-400 text-center">Click squares to mark them. Your card is unique to you.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400 h-full flex items-center justify-center">
                {items.length >= 24 ? 'Generate your card when ready!' : 'Add more items to unlock bingo cards.'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
