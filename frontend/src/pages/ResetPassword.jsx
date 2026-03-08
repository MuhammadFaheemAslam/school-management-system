import { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { resetPassword } from '../api/auth'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const uid = searchParams.get('uid')
  const token = searchParams.get('token')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      await resetPassword({ uid, token, password })
      navigate('/login')
    } catch (err) {
      const data = err.response?.data
      if (data?.error) {
        setError(Array.isArray(data.error) ? data.error.join(' ') : data.error)
      } else {
        setError('Something went wrong. The link may have expired.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (!uid || !token) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h1 className="auth-title">School Management</h1>
          <p className="error-msg">Invalid or missing reset link.</p>
          <p className="auth-link" style={{ marginTop: '1rem' }}>
            <Link to="/forgot-password">Request a new one</Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">School Management</h1>
        <h2 className="auth-subtitle">Set a new password</h2>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="field">
            <label htmlFor="password">New Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError('') }}
              placeholder="Enter new password"
            />
          </div>

          <div className="field">
            <label htmlFor="confirm">Confirm Password</label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              required
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); setError('') }}
              placeholder="Repeat new password"
            />
          </div>

          {error && <p className="error-msg">{error}</p>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>

        <p className="auth-link">
          <Link to="/login">Back to Sign in</Link>
        </p>
      </div>
    </div>
  )
}
