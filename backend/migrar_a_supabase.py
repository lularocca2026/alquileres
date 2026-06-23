"""
Migra los datos locales a Supabase:
  1. Sube estado.json a la tabla estado_app
  2. Sube fotos/audios/PDFs al bucket de Storage 'archivos'

Requiere en .env:
  SUPABASE_URL=https://xxxxx.supabase.co
  SUPABASE_SERVICE_KEY=service_role_key   (SECRETA — nunca subir a GitHub)

Uso:  python backend/migrar_a_supabase.py
"""
import os, sys, json, mimetypes, re, unicodedata
from pathlib import Path
import requests

def limpiar_clave(s: str) -> str:
    """Sanitiza nombres para rutas válidas de Supabase Storage (sin acentos ni símbolos)"""
    s = s.replace('°', '').replace('º', '')
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode('ascii')
    s = re.sub(r'\s+', ' ', s).strip()
    return s

BASE = Path(__file__).parent.parent
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# ── Cargar .env ──────────────────────────────────────────────────────────────
for envf in [BASE / ".env", BASE / ".env.local"]:
    if envf.exists():
        for line in envf.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

if not SUPABASE_URL or not SERVICE_KEY:
    print("[!] Falta SUPABASE_URL o SUPABASE_SERVICE_KEY en .env")
    sys.exit(1)

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
}

# Carpeta de archivos de WhatsApp (de config.json)
_config = json.loads((BASE / "config.json").read_text(encoding="utf-8")) if (BASE / "config.json").exists() else {}
MEDIA_DIR = Path(_config.get("whatsapp_carpeta", BASE / "data" / "media"))


def subir_estado():
    """Sube estado.json (o lo arma desde alquileres.json) a la tabla estado_app"""
    estado_path = BASE / "data" / "estado.json"
    if estado_path.exists():
        data = json.loads(estado_path.read_text(encoding="utf-8"))
    else:
        # Construir desde el import crudo
        raw = json.loads((BASE / "data" / "alquileres.json").read_text(encoding="utf-8"))
        data = {
            "propiedades": [p for p in raw["propiedades"] if p.get("Ciudad") and p.get("Tipo")],
            "inquilinos": raw["inquilinos"],
            "contratos": [c for c in raw["contratos"] if c.get("IdPropiedad", 0) > 0 and c.get("IdInquilino", 0) > 0],
            "pagos": raw["pagos"],
            "mantenimiento": [m for m in raw["mantenimiento"] if m.get("Descripcion")],
        }

    r = requests.patch(
        f"{SUPABASE_URL}/rest/v1/estado_app?id=eq.1",
        headers={**HEADERS, "Content-Type": "application/json", "Prefer": "return=minimal"},
        json={"data": data},
    )
    if r.status_code in (200, 204):
        print(f"[OK] Estado subido: {len(data['propiedades'])} propiedades, {len(data['pagos'])} pagos")
    else:
        print(f"[!] Error subiendo estado: {r.status_code} {r.text[:200]}")


def subir_archivos():
    """Sube todos los archivos de media al bucket 'archivos'"""
    if not MEDIA_DIR.exists():
        print(f"[i] No hay carpeta de media en {MEDIA_DIR}")
        return

    total, ok = 0, 0
    for chat_dir in MEDIA_DIR.iterdir():
        if not chat_dir.is_dir():
            continue
        for f in chat_dir.iterdir():
            if not f.is_file():
                continue
            total += 1
            # Ruta en el bucket: <carpeta_chat>/<archivo> (sanitizada)
            dest = f"{limpiar_clave(chat_dir.name)}/{limpiar_clave(f.name)}"
            mime = mimetypes.guess_type(f.name)[0] or "application/octet-stream"
            r = requests.post(
                f"{SUPABASE_URL}/storage/v1/object/archivos/{dest}",
                headers={**HEADERS, "Content-Type": mime, "x-upsert": "true"},
                data=f.read_bytes(),
            )
            if r.status_code in (200, 201):
                ok += 1
                if ok % 20 == 0:
                    print(f"  {ok}/{total} archivos subidos...")
            else:
                print(f"  [!] {f.name}: {r.status_code} {r.text[:120]}")
    print(f"[OK] Archivos subidos: {ok}/{total}")


if __name__ == "__main__":
    print(f"Migrando a {SUPABASE_URL}\n")
    subir_estado()
    print()
    subir_archivos()
    print("\nListo.")
