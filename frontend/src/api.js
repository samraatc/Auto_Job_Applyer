// Thin fetch wrapper that always sends cookies and surfaces 401s as a redirect.
export async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  })
  if (res.status === 401) {
    window.dispatchEvent(new Event('aja:unauthenticated'))
    throw new Error('unauthenticated')
  }
  return res
}

export async function apiJson(path, opts = {}) {
  const res = await api(path, opts)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(body || res.statusText)
  }
  return res.json()
}

export async function apiUpload(path, formData) {
  const res = await fetch(path, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  })
  if (res.status === 401) {
    window.dispatchEvent(new Event('aja:unauthenticated'))
    throw new Error('unauthenticated')
  }
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
