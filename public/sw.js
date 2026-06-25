// SW v4: NO cachea la app (requiere conexión por Supabase). Limpia cachés viejas
// y deja que el navegador maneje todo normal → siempre se carga la última versión.
self.addEventListener('install', e => {
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

// Sin handler de fetch: el navegador resuelve los pedidos normalmente (sin caché del SW).
