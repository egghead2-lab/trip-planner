import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { format, parseISO } from 'date-fns'

export default function Gallery() {
  const { profile } = useAuth()
  const [trips, setTrips] = useState([])
  const [selectedTrip, setSelectedTrip] = useState('all')
  const [photos, setPhotos] = useState([])
  const [uploading, setUploading] = useState(false)
  const [caption, setCaption] = useState('')
  const [lightbox, setLightbox] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadTrips() }, [])
  useEffect(() => { loadPhotos() }, [selectedTrip])

  async function loadTrips() {
    const { data } = await supabase.from('trips').select('id, title').order('start_date', { ascending: false })
    setTrips(data || [])
    setLoading(false)
  }

  async function loadPhotos() {
    let query = supabase.from('photos').select('*, profiles(full_name), trips(title)').order('created_at', { ascending: false })
    if (selectedTrip !== 'all') query = query.eq('trip_id', selectedTrip)
    const { data } = await query
    setPhotos(data || [])
  }

  async function handleUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${profile.id}/${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage.from('trip-photos').upload(path, file)
    if (uploadError) { alert('Upload failed: ' + uploadError.message); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('trip-photos').getPublicUrl(path)
    await supabase.from('photos').insert({
      trip_id: selectedTrip === 'all' ? null : selectedTrip,
      user_id: profile.id,
      storage_path: publicUrl,
      caption: caption.trim() || null,
    })
    setCaption('')
    setUploading(false)
    loadPhotos()
    e.target.value = ''
  }

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">📸 Gallery</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setSelectedTrip('all')} className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${selectedTrip === 'all' ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
          All Trips
        </button>
        {trips.map(t => (
          <button key={t.id} onClick={() => setSelectedTrip(t.id)} className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${selectedTrip === t.id ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {t.title}
          </button>
        ))}
      </div>

      {/* Upload */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h3 className="font-semibold text-gray-800 text-sm">Upload a Photo</h3>
        <input value={caption} onChange={e => setCaption(e.target.value)} placeholder="Caption (optional)" className="input w-full" />
        <label className={`flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg border-2 border-dashed cursor-pointer transition ${uploading ? 'opacity-50 cursor-not-allowed border-gray-200' : 'border-brand-300 hover:border-brand-500 hover:bg-brand-50'}`}>
          {uploading ? '⏳ Uploading…' : '📁 Choose photo to upload'}
          <input type="file" accept="image/*" onChange={handleUpload} disabled={uploading} className="hidden" />
        </label>
      </div>

      {/* Grid */}
      {photos.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">No photos yet. Be the first to upload!</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {photos.map(photo => (
            <button key={photo.id} onClick={() => setLightbox(photo)} className="group relative aspect-square rounded-xl overflow-hidden bg-gray-100 shadow-sm hover:shadow-md transition">
              <img src={photo.storage_path} alt={photo.caption || ''} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition" />
              {photo.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-2 opacity-0 group-hover:opacity-100 transition truncate">
                  {photo.caption}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <div className="max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <img src={lightbox.storage_path} alt="" className="w-full rounded-xl max-h-[75vh] object-contain" />
            <div className="mt-3 text-white text-sm flex justify-between">
              <div>
                {lightbox.caption && <p className="font-medium">{lightbox.caption}</p>}
                <p className="text-white/60">{lightbox.profiles?.full_name} · {lightbox.trips?.title}</p>
              </div>
              <button onClick={() => setLightbox(null)} className="text-white/60 hover:text-white text-lg">✕</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
