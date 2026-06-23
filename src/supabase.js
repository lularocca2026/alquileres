import { createClient } from '@supabase/supabase-js'

// Las credenciales vienen de variables de entorno (.env.local en dev, Vercel en prod)
const url = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key'

export const configurado =
  !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY

if (!configurado) {
  console.warn('⚠ Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en .env.local')
}

export const supabase = createClient(url, key)
