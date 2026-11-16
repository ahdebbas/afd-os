const API_BASE = String(import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

export const apiUrl = path => `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`
