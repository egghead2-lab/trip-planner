import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white rounded-xl p-8 shadow text-center max-w-sm">
          <div className="text-4xl mb-4">🚫</div>
          <h2 className="text-xl font-bold text-gray-800">Access Denied</h2>
          <p className="text-gray-500 mt-2 text-sm">Your email hasn't been added to the guest list yet. Ask the trip admin.</p>
        </div>
      </div>
    )
  }

  if (adminOnly && !profile.is_admin) {
    return <Navigate to="/" replace />
  }

  return children
}
