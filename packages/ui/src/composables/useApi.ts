import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios'

const isVisitor = () => {
  if (typeof window === 'undefined') return true
  return !localStorage.getItem('agenthive:auth-token')
}

export function useApi(): AxiosInstance {
  const baseURL = typeof window !== 'undefined'
    ? (window as any).__AGENTHIVE_API_URL__ || '/api'
    : '/api'

  const instance = axios.create({
    baseURL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  })

  instance.interceptors.request.use((config) => {
    if (!isVisitor() && typeof window !== 'undefined') {
      const token = localStorage.getItem('agenthive:auth-token')
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`
      }
    }
    return config
  })

  instance.interceptors.response.use(
    (res) => res,
    (err) => {
      if (err.response?.status === 401) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('agenthive:auth-token')
        }
      }
      return Promise.reject(err)
    }
  )

  return instance
}
