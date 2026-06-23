-- ╔══════════════════════════════════════════════════════════════╗
-- ║  ESQUEMA SUPABASE — App de Alquileres                          ║
-- ║  Pegar todo esto en: Supabase → SQL Editor → New query → Run   ║
-- ╚══════════════════════════════════════════════════════════════╝

-- 1. Tabla con el estado de la app (la base entera en una fila JSONB)
create table if not exists estado_app (
  id          int primary key default 1,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz default now(),
  constraint  una_sola_fila check (id = 1)
);

-- Fila inicial vacía
insert into estado_app (id, data) values (1, '{}'::jsonb)
on conflict (id) do nothing;

-- 2. Habilitar Realtime (sincronización instantánea entre dispositivos)
alter publication supabase_realtime add table estado_app;

-- 3. Seguridad: solo usuarios logueados pueden leer y escribir
alter table estado_app enable row level security;

create policy "lectura autenticada"
  on estado_app for select
  to authenticated using (true);

create policy "escritura autenticada"
  on estado_app for update
  to authenticated using (true) with check (true);

-- 4. Bucket de Storage para fotos, audios y documentos de WhatsApp
insert into storage.buckets (id, name, public)
values ('archivos', 'archivos', false)
on conflict (id) do nothing;

-- Policies del bucket: usuarios logueados acceden a todo
create policy "archivos lectura"
  on storage.objects for select
  to authenticated using (bucket_id = 'archivos');

create policy "archivos escritura"
  on storage.objects for insert
  to authenticated with check (bucket_id = 'archivos');

create policy "archivos update"
  on storage.objects for update
  to authenticated using (bucket_id = 'archivos');

-- ✓ Listo. Ahora crear el usuario de Lucre en:
--   Authentication → Users → Add user → (email + contraseña)
