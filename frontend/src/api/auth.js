import axios from 'axios'

const api = axios.create({
  baseURL: '/api/auth',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export const register = (data) => api.post('/register/', data)
export const login = (data) => api.post('/login/', data)
export const logout = (refreshToken) => api.post('/logout/', { refresh: refreshToken })
export const getMe = () => api.get('/me/')
