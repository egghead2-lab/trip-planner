import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { AvatarWithFallback } from '../components/Avatar'

export default function Members() {
  const { profile } = useAuth()
  const [members, setMembers] = useState([])
  const [inviteToken, setInviteToken] = useState(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: m }, { data: t }] = await Promise.all([
      supabase.from('profiles').select('*').order('full_name'),
      supabase.from('invite_tokens').select('*').eq('active', true).order('created_at', { ascending: false }).limit(1),
    ])
    setMembers(m || [])
    setInviteToken(t?.[0] || null)
    setLoading(false)
  }

  async function generateLink() {
    // Deactivate existing tokens
    await supabase.from('invite_tokens').update({ active: false }).eq('active', true)
    const { data } = await supabase.from('invite_tokens').insert({ created_by: profile.id, active: true }).select().single()
    setInviteToken(data)
  }

  async function deactivateLink() {
    await supabase.from('invite_tokens').update({ active: false }).eq('active', true)
    setInviteToken(null)
  }

  async function toggleAdmin(memberId, current) {
    await supabase.from('profiles').update({ is_admin: !current }).eq('id', memberId)
    load()
  }

  async function removeMember(memberId) {
    if (!confirm('Remove this member? They will lose access.')) return
    await supabase.from('profiles').delete().eq('id', memberId)
    load()
  }

  function copyLink() {
    const url = `${window.location.origin}/invite/${inviteToken.token}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>

  const inviteUrl = inviteToken ? `${window.location.origin}/invite/${inviteToken.token}` : null

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">👥 Members</h1>

      {/* Invite link */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Invite Link</h2>
          <span className="text-xs text-gray-400">Anyone with this link can join</span>
        </div>

        {inviteUrl ? (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                readOnly
                value={inviteUrl}
                className="input flex-1 bg-gray-50 text-gray-600 text-sm font-mono"
              />
              <button
                onClick={copyLink}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${copied ? 'bg-green-500 text-white' : 'bg-brand-600 text-white hover:bg-brand-700'}`}
              >
                {copied ? '✓ Copied!' : 'Copy'}
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={generateLink} className="text-xs text-gray-400 hover:text-gray-600 transition">
                🔄 Generate new link (invalidates current)
              </button>
              <span className="text-gray-200">·</span>
              <button onClick={deactivateLink} className="text-xs text-red-400 hover:text-red-600 transition">
                Deactivate
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <p className="text-sm text-gray-400">No active invite link.</p>
            <button onClick={generateLink} className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition">
              Generate Link
            </button>
          </div>
        )}
      </div>

      {/* Active members */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Active Members ({members.length})</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {members.map(m => (
            <div key={m.id} className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-3">
                <AvatarWithFallback url={m.avatar_url} name={m.full_name} size="md" />
                <div>
                  <p className="text-sm font-medium text-gray-800">{m.full_name}</p>
                  {m.tagline && <p className="text-xs text-gray-400 italic">{m.tagline}</p>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {m.is_admin && <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-medium">Admin</span>}
                {m.id !== profile?.id && (
                  <>
                    <button onClick={() => toggleAdmin(m.id, m.is_admin)} className="text-xs text-gray-400 hover:text-gray-700 transition">
                      {m.is_admin ? 'Remove admin' : 'Make admin'}
                    </button>
                    <button onClick={() => removeMember(m.id)} className="text-xs text-red-400 hover:text-red-600 transition">
                      Remove
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
