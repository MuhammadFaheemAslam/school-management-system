import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function Home() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="home-container">
      <div className="home-card">
        <h1>Welcome, {user?.username}!</h1>
        <div className="user-info">
          <div className="info-row">
            <span className="info-label">Email</span>
            <span>{user?.email}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Role</span>
            <span className={`badge badge-${user?.role?.toLowerCase()}`}>
              {user?.role}
            </span>
          </div>
        </div>
        <button className="btn-logout" onClick={handleLogout}>
          Sign Out
        </button>
      </div>
    </div>
  )
}
