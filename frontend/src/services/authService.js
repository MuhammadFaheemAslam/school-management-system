import api from './api';

export const login = async (username, password) => {
  const response = await api.post('/auth/login/', { username, password });
  const { access, refresh, user, first_login } = response.data;

  localStorage.setItem('access_token', access);
  localStorage.setItem('refresh_token', refresh);
  localStorage.setItem('user', JSON.stringify(user));

  return { user, first_login };
};

export const logout = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
};

export const changePassword = async (newPassword, confirmPassword) => {
  const response = await api.post('/auth/change-password/', {
    new_password: newPassword,
    confirm_password: confirmPassword,
  });
  return response.data;
};

export const getMe = async () => {
  const response = await api.get('/auth/me/');
  return response.data;
};

export const createUser = async (userData) => {
  const response = await api.post('/auth/users/create/', userData);
  return response.data;
};

export const getStoredUser = () => {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
};

export const isAuthenticated = () => {
  return !!localStorage.getItem('access_token');
};
