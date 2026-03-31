import { useState, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { AvatarWithFallback } from '../components/Avatar'

export default function Profile() {
  const { profile, refreshProfile } = useAuth()
  const [tagline, setTagline] = useState(profile?.tagline || '')
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const fileRef = useRef()

  async function handlePhotoUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)

    // Always use the same path so upsert reliably replaces it
    const path = `${profile.id}/avatar`

    // Remove existing file first to avoid upsert conflicts
    await supabase.storage.from('avatars').remove([path])

    const { error } = await supabase.storage.from('avatars').upload(path, file, { contentType: file.type })
    if (error) { alert('Upload failed: ' + error.message); setUploading(false); return }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    const bustUrl = `${publicUrl}?t=${Date.now()}`
    setAvatarUrl(bustUrl)

    const { error: updateError } = await supabase.from('profiles').update({ avatar_url: bustUrl }).eq('id', profile.id)
    if (updateError) { alert('Failed to save photo: ' + updateError.message); setUploading(false); return }

    await refreshProfile()
    setUploading(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('profiles').update({ tagline: tagline.trim() || null, avatar_url: avatarUrl }).eq('id', profile.id)
    await refreshProfile()
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <AvatarWithFallback url={avatarUrl} name={profile?.full_name} size="xl" />
          <div>
            <button
              type="button"
              onClick={() => fileRef.current.click()}
              disabled={uploading}
              className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition disabled:opacity-50"
            >
              {uploading ? 'Uploading…' : 'Change Photo'}
            </button>
            <p className="text-xs text-gray-400 mt-1">JPG, PNG, GIF up to 5MB</p>
            <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
            <input value={profile?.full_name || ''} disabled className="input w-full bg-gray-50 text-gray-400 cursor-not-allowed" />
            <p className="text-xs text-gray-400 mt-1">Synced from your Google account</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tagline</label>
            <input
              value={tagline}
              onChange={e => setTagline(e.target.value)}
              maxLength={80}
              placeholder="e.g. Always last to bed, always first to complain"
              className="input w-full"
            />
            <p className="text-xs text-gray-400 mt-1">{tagline.length}/80</p>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="bg-brand-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition disabled:opacity-50"
          >
            {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  )
}
