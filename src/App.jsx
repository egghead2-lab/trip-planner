import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Trips from './pages/Trips'
import TripDetail from './pages/TripDetail'
import Availability from './pages/Availability'
import Polls from './pages/Polls'
import Gallery from './pages/Gallery'
import Announcements from './pages/Announcements'
import Members from './pages/Members'
import Bingo from './pages/Bingo'
import PropBets from './pages/PropBets'
import Quotes from './pages/Quotes'
import Profile from './pages/Profile'
import Invite from './pages/Invite'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/invite/:token" element={<Invite />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="trips" element={<Trips />} />
            <Route path="trips/:id" element={<TripDetail />} />
            <Route path="availability" element={<Availability />} />
            <Route path="polls" element={<Polls />} />
            <Route path="gallery" element={<Gallery />} />
            <Route path="announcements" element={<Announcements />} />
            <Route path="bingo" element={<Bingo />} />
            <Route path="bets" element={<PropBets />} />
            <Route path="quotes" element={<Quotes />} />
            <Route path="profile" element={<Profile />} />
            <Route path="members" element={<ProtectedRoute adminOnly><Members /></ProtectedRoute>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
