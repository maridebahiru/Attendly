import axios from 'axios';
import { API_BASE_URL } from '../config';

// Create a configured axios client for REST endpoints
const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to include the Bearer token
client.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle unauthorized errors
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear local storage and redirect if unauthorized
      localStorage.removeItem('token');
      localStorage.removeItem('user_role');
      localStorage.removeItem('username');
      window.location.reload(); // Redirects to login since token is now null
    }
    return Promise.reject(error);
  }
);

export default client;
