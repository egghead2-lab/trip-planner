import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useState } from 'react'
import { AvatarWithFallback } from './Avatar'

const navItems = [
  { to: '/',            label: 'Dashboard',   icon: '🏠' },
  { to: '/trips',       label: 'Trips',        icon: '✈️' },
  { to: '/availability',label: 'Availability', icon: '📅' },
  { to: '/polls',       label: 'Polls',        icon: '🗳️' },
  { to: '/gallery',     label: 'Gallery',      icon: '📸' },
  { to: '/bingo',       label: 'Bingo',        icon: '🎱' },
  { to: '/bets',        label: 'Prop Bets',    icon: '🎲' },
  { to: '/quotes',      label: 'Quotes',       icon: '💬' },
  { to: '/announcements', label: 'News',       icon: '📣' },
]

export default function NavBar() {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <nav className="bg-brand-900 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
        {/* Logo */}
        <Link to="/" className="font-bold text-lg tracking-tight flex items-center gap-2">
          ✈️ <span className="hidden sm:inline">Boys Trip</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {navItems.map(item => (
            <Link
              key={item.to}
              to={item.to}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                location.pathname === item.to
                  ? 'bg-white/20 text-white'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              {item.icon} {item.label}
            </Link>
          ))}
          {profile?.is_admin && (
            <Link
              to="/members"
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                location.pathname === '/members'
                  ? 'bg-white/20 text-white'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              👥 Members
            </Link>
          )}
        </div>

        {/* User + sign out */}
        <div className="hidden md:flex items-center gap-3">
          <Link to="/profile" className="flex items-center gap-2 hover:opacity-80 transition">
            <AvatarWithFallback url={profile?.avatar_url} name={profile?.full_name} size="sm" />
            <span className="text-sm text-white/80">{profile?.full_name?.split(' ')[0]}</span>
          </Link>
          <button
            onClick={signOut}
            className="text-xs text-white/60 hover:text-white transition px-2 py-1 rounded hover:bg-white/10"
          >
            Sign out
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 rounded hover:bg-white/10"
          onClick={() => setMobileOpen(o => !o)}
        >
          <span className="text-lg">{mobileOpen ? '✕' : '☰'}</span>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-brand-900 border-t border-white/10 px-4 pb-4 flex flex-col gap-1">
          {navItems.map(item => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={`px-3 py-2 rounded-md text-sm font-medium transition ${
                location.pathname === item.to
                  ? 'bg-white/20 text-white'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              {item.icon} {item.label}
            </Link>
          ))}
          {profile?.is_admin && (
            <Link to="/members" onClick={() => setMobileOpen(false)} className="px-3 py-2 rounded-md text-sm font-medium text-white/70 hover:text-white hover:bg-white/10">
              👥 Members
            </Link>
          )}
          <button onClick={signOut} className="text-left px-3 py-2 text-sm text-white/60 hover:text-white">
            Sign out
          </button>
        </div>
      )}
    </nav>
  )
}
