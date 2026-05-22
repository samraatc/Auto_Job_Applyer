import axios from 'axios'
// ── API Client with JWT + error normalisation ──────────────────────
const BASE = import.meta.env.VITE_API_URL || ''


/**
 * Core fetch wrapper. Sends cookies, normalises 401 into a global event.
 */
export async function api(path, opts = {}) {
  const url = `${BASE}${path}`
  const requestOpts = {
    ...opts,
    withCredentials: true,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  }

  const token = localStorage.getItem('aja_token')
  if (token) {
    requestOpts.headers['Authorization'] = `Bearer ${token}`
  }

  if (requestOpts.body !== undefined) {
    requestOpts.data = requestOpts.body
    delete requestOpts.body
  }

  try {
    const res = await axios(url, requestOpts)
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent('aja:unauthenticated'))
      throw new Error('unauthenticated')
    }
    return res
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      if (error.response.status === 401) {
        window.dispatchEvent(new CustomEvent('aja:unauthenticated'))
        throw new Error('unauthenticated')
      }
      const responseData = error.response.data
      const message = responseData?.detail || responseData?.message || error.response.statusText || `HTTP ${error.response.status}`
      throw new Error(message)
    }
    throw error
  }
}

/**
 * JSON shorthand — throws a descriptive Error on non-2xx responses.
 */
export async function apiJson(path, opts = {}) {
  const res = await api(path, opts)
  return res.data
}

/**
 * Multipart / file upload — no Content-Type header (browser sets it with boundary).
 */
export async function apiUpload(path, formData) {
  const url = `${BASE}${path}`
  const headers = {}
  const token = localStorage.getItem('aja_token')
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  const res = await fetch(url, {
    method: 'POST',
    body: formData,
    credentials: 'include',
    headers,
  })
  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent('aja:unauthenticated'))
    throw new Error('unauthenticated')
  }
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText)
    throw new Error(msg || `HTTP ${res.status}`)
  }
  return res.json()
}

/**
 * Helper: DELETE request returning JSON.
 */
export async function apiDelete(path) {
  return apiJson(path, { method: 'DELETE' })
}

/**
 * Helper: PATCH request.
 */
export async function apiPatch(path, body) {
  return apiJson(path, { method: 'PATCH', body: JSON.stringify(body) })
}

/**
 * Helper: PUT request.
 */
export async function apiPut(path, body) {
  return apiJson(path, { method: 'PUT', body: JSON.stringify(body) })
}

/**
 * WebSocket URL builder — swaps http(s) for ws(s).
 */
export function wsUrl(path) {
  const base = (BASE || window.location.origin).replace(/^http/, 'ws')
  return `${base}${path}`
}
