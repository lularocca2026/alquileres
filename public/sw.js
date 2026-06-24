const CACHE = 'alquileres-v3'
const SHELL = ['/', '/index.html', '/icono-192.png', '/icono-512.png']

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return
  const url = new URL(e.request.url)
  // Solo manejar http/https del mismo origen (ignorar chrome-extension://, etc.)
  if (!url.protocol.startsWith('http') || url.origin !== self.location.origin) return
  e.respondWith(
    fetch(e.request)
      .then(r => {
        // Cachear solo respuestas válidas del mismo origen
        if (r && r.ok) {
          const copy = r.clone()
          caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {})
        }
        return r
      })
      .catch(() => caches.match(e.request))
  )
})
