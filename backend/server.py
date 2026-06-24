"""
Backend FastAPI para procesar ZIPs de WhatsApp
"""
import os, re, json, zipfile, shutil, base64, tempfile
from pathlib import Path

# Cargar .env manualmente (más robusto en Windows)
_env_file = Path(__file__).parent.parent / '.env'
if _env_file.exists():
    for _line in _env_file.read_text(encoding='utf-8').splitlines():
        _line = _line.strip()
        if _line and not _line.startswith('#') and '=' in _line:
            _k, _v = _line.split('=', 1)
            os.environ[_k.strip()] = _v.strip()
from datetime import datetime
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import anthropic

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

BASE = Path(__file__).parent.parent
DATA_DIR = BASE / "data"
JSON_PATH = DATA_DIR / "alquileres.json"

# Leer carpeta de WhatsApp desde config.json
_config_path = BASE / "config.json"
_config = json.loads(_config_path.read_text(encoding="utf-8")) if _config_path.exists() else {}
MEDIA_DIR = Path(_config.get("whatsapp_carpeta", BASE / "data" / "media"))
MEDIA_DIR.mkdir(parents=True, exist_ok=True)

_api_key = os.environ.get('ANTHROPIC_API_KEY', '')
if not _api_key:
    raise RuntimeError("ANTHROPIC_API_KEY no encontrada. Verificá el archivo .env")
client = anthropic.Anthropic(api_key=_api_key)

# ── Parsear _chat.txt de WhatsApp ─────────────────────────────────────────────

RE_LINEA = re.compile(
    r'^(\d{1,2}/\d{1,2}/\d{2,4}),\s(\d{1,2}:\d{2}(?:\s?[ap]\.?\s?m\.?)?)\s-\s([^:]+?):\s(.+)$',
    re.IGNORECASE
)
RE_LINEA_ALT = re.compile(
    r'^\[(\d{1,2}/\d{1,2}/\d{2,4}),\s(\d{1,2}:\d{2}:\d{2})\]\s([^:]+?):\s(.+)$'
)
RE_ADJUNTO = re.compile(r'<adjunto:\s*(.+?)>|(.+?)\s*\(archivo adjunto\)')


def parsear_chat(texto: str) -> list[dict]:
    mensajes = []
    linea_actual = None

    for linea in texto.splitlines():
        m = RE_LINEA.match(linea) or RE_LINEA_ALT.match(linea)
        if m:
            if linea_actual:
                mensajes.append(linea_actual)
            fecha_str, hora_str, autor, contenido = m.groups()
            try:
                dt = datetime.strptime(f"{fecha_str} {hora_str}".strip(), "%d/%m/%Y %H:%M")
            except Exception:
                try:
                    dt = datetime.strptime(f"{fecha_str} {hora_str}".strip(), "%d/%m/%y %H:%M")
                except Exception:
                    dt = None

            adjunto = RE_ADJUNTO.search(contenido)
            archivo = (adjunto.group(1) or adjunto.group(2)).strip() if adjunto else None

            linea_actual = {
                "fecha": dt.isoformat() if dt else None,
                "fecha_str": f"{fecha_str} {hora_str}",
                "autor": autor.strip(),
                "texto": "" if archivo else contenido.strip(),
                "archivo": archivo,
            }
        elif linea_actual:
            linea_actual["texto"] += "\n" + linea.strip()

    if linea_actual:
        mensajes.append(linea_actual)

    return mensajes


# ── Transcribir audio con Whisper ─────────────────────────────────────────────

def transcribir_audio(ruta: Path) -> str | None:
    try:
        import whisper
        model = whisper.load_model("base")
        # Convertir .opus a .wav con ffmpeg
        wav = ruta.with_suffix(".wav")
        os.system(f'ffmpeg -y -i "{ruta}" "{wav}" -loglevel quiet')
        if wav.exists():
            result = model.transcribe(str(wav))
            wav.unlink(missing_ok=True)
            return result.get("text", "").strip()
    except Exception as e:
        print(f"Error transcribiendo {ruta}: {e}")
    return None


# ── Analizar con Claude ────────────────────────────────────────────────────────

PROMPT_ANALISIS = """Sos un asistente que analiza conversaciones de WhatsApp de una propietaria de alquileres llamada Lucre.

Analizá los mensajes y extraé SOLO información nueva (no repetida). Devolvé un JSON con esta estructura exacta:

{{
  "pagos": [
    {{
      "fecha": "ISO date o null",
      "monto": 123456,
      "descripcion": "descripción breve",
      "inquilino_probable": "nombre si se menciona o null",
      "confianza": "alta|media|baja"
    }}
  ],
  "mantenimiento": [
    {{
      "fecha": "ISO date o null",
      "descripcion": "descripción del problema o trabajo",
      "costo": 0,
      "estado": "pendiente|en_progreso|resuelto",
      "confianza": "alta|media|baja"
    }}
  ],
  "observaciones": [
    {{
      "fecha": "ISO date o null",
      "texto": "resumen de 1-2 líneas del tema hablado",
      "tipo": "pago|mantenimiento|contrato|impuesto|servicio|otro"
    }}
  ],
  "inconsistencias": [
    {{
      "descripcion": "descripción de la posible inconsistencia o duplicado",
      "tipo": "posible_duplicado|monto_diferente|fecha_conflicto|otro"
    }}
  ]
}}

Reglas:
- Solo incluí eventos sobre alquileres, pagos, mantenimiento, servicios, impuestos, contratos
- Si algo ya está en los datos existentes con el mismo monto y fecha aproximada → marcalo como inconsistencia posible_duplicado
- Si el monto difiere de lo esperado por contrato → marcalo como inconsistencia monto_diferente
- Ignorá mensajes de saludo, offtopic, memes
- Siempre devolvé JSON válido, sin markdown

DATOS EXISTENTES (para comparar):
{datos_existentes}

CONVERSACIÓN:
{conversacion}
"""


def analizar_con_claude(mensajes: list[dict], datos_existentes: dict) -> dict:
    # Formatear conversación como texto legible
    conv_lines = []
    for m in mensajes:
        linea = f"[{m['fecha_str']}] {m['autor']}: "
        if m.get("archivo"):
            linea += f"[archivo: {m['archivo']}]"
        else:
            linea += m.get("texto", "")
        conv_lines.append(linea)

    conversacion = "\n".join(conv_lines)

    # Simplificar datos existentes para el prompt
    datos_resumen = {
        "contratos": [
            {
                "id": c["IdContrato"],
                "monto": c.get("MontoInicial", 0),
                "ajuste": c.get("TipoAjuste"),
                "activo": c.get("activo"),
            }
            for c in datos_existentes.get("contratos", []) if c.get("IdPropiedad", 0) > 0
        ],
        "pagos_recientes": [
            {
                "fecha": p.get("FechaPago"),
                "monto": p.get("Monto"),
                "contrato": p.get("IdContrato"),
                "obs": p.get("observaciones"),
            }
            for p in sorted(
                datos_existentes.get("pagos", []),
                key=lambda x: x.get("FechaPago") or "",
                reverse=True
            )[:20]
        ],
    }

    prompt = PROMPT_ANALISIS.format(
        datos_existentes=json.dumps(datos_resumen, ensure_ascii=False, indent=2),
        conversacion=conversacion[:15000],  # limitar tokens
    )

    resp = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    )

    texto = resp.content[0].text.strip()
    # Limpiar posible markdown
    texto = re.sub(r'^```json\s*', '', texto)
    texto = re.sub(r'\s*```$', '', texto)

    try:
        return json.loads(texto)
    except json.JSONDecodeError:
        return {"pagos": [], "mantenimiento": [], "observaciones": [], "inconsistencias": []}


# ── Organizar fotos ────────────────────────────────────────────────────────────

EXTENSIONES_IMAGEN = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
EXTENSIONES_AUDIO = {".opus", ".mp3", ".m4a", ".ogg", ".aac"}
EXTENSIONES_VIDEO = {".mp4", ".mov", ".avi", ".3gp"}


def organizar_media(media_dir: Path, nombre_zip: str) -> dict:
    """Devuelve dict con fotos y audios organizados por fecha"""
    fotos = []
    audios = []

    for f in sorted(media_dir.iterdir()):
        ext = f.suffix.lower()
        if ext in EXTENSIONES_IMAGEN:
            # Leer como base64 para enviar al frontend
            b64 = base64.b64encode(f.read_bytes()).decode()
            fotos.append({
                "nombre": f.name,
                "ruta_relativa": f"media/{nombre_zip}/{f.name}",
                "data": f"data:image/{ext.lstrip('.')};base64,{b64}",
                "mime": f"image/{ext.lstrip('.')}",
            })
        elif ext in EXTENSIONES_AUDIO:
            audios.append({
                "nombre": f.name,
                "ruta": str(f),
                "transcripcion": None,
            })
        elif ext in EXTENSIONES_VIDEO:
            fotos.append({
                "nombre": f.name,
                "ruta_relativa": f"media/{nombre_zip}/{f.name}",
                "tipo": "video",
            })

    return {"fotos": fotos, "audios": audios}


# ── Subir archivos a Supabase Storage ─────────────────────────────────────────

import unicodedata, mimetypes
import requests as _requests

def limpiar_clave(s: str) -> str:
    s = s.replace('°', '').replace('º', '')
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode('ascii')
    s = re.sub(r'\s+', ' ', s).strip()
    return s

def subir_a_supabase(directorio: Path, nombre_chat: str) -> dict:
    """Sube todos los archivos del directorio a Supabase Storage. Retorna {nombre: url_publica}"""
    supabase_url = os.environ.get('SUPABASE_URL', '').rstrip('/')
    service_key = os.environ.get('SUPABASE_SERVICE_KEY', '')
    if not supabase_url or not service_key:
        print("[Supabase] Sin credenciales, no se suben archivos")
        return {}

    headers = {
        'apikey': service_key,
        'Authorization': f'Bearer {service_key}',
    }
    carpeta = limpiar_clave(nombre_chat)
    url_map = {}

    for f in sorted(directorio.iterdir()):
        if not f.is_file() or f.suffix.lower() == '.zip':
            continue
        dest = f"{carpeta}/{limpiar_clave(f.name)}"
        mime = mimetypes.guess_type(f.name)[0] or 'application/octet-stream'
        r = _requests.post(
            f"{supabase_url}/storage/v1/object/archivos/{dest}",
            headers={**headers, 'Content-Type': mime, 'x-upsert': 'true'},
            data=f.read_bytes(),
        )
        if r.status_code in (200, 201):
            url_map[f.name] = f"{supabase_url}/storage/v1/object/public/archivos/{dest}"
        else:
            print(f"[Supabase] Error subiendo {f.name}: {r.status_code}")

    print(f"[Supabase] Subidos {len(url_map)} archivos de {nombre_chat}")
    return url_map


# ── Endpoint principal ─────────────────────────────────────────────────────────

@app.post("/api/procesar-zip")
async def procesar_zip(archivo: UploadFile = File(...)):
    """Procesa un ZIP de WhatsApp y devuelve el análisis"""

    # 1. Extraer ZIP en carpeta TEMP (fuera de Dropbox para evitar bloqueos)
    nombre_zip = Path(archivo.filename).stem
    tmp_base = Path(tempfile.gettempdir()) / "alquileres_zips"
    destino_tmp = tmp_base / nombre_zip
    shutil.rmtree(destino_tmp, ignore_errors=True)
    destino_tmp.mkdir(parents=True, exist_ok=True)

    contenido = await archivo.read()
    zip_tmp = destino_tmp / "chat.zip"
    zip_tmp.write_bytes(contenido)

    with zipfile.ZipFile(zip_tmp) as zf:
        zf.extractall(destino_tmp)
    zip_tmp.unlink()

    # Copiar media Y el chat.txt a Dropbox
    destino = MEDIA_DIR / nombre_zip
    destino.mkdir(parents=True, exist_ok=True)
    for f in destino_tmp.rglob("*"):
        if f.is_file() and f.suffix.lower() != '.zip':
            nombre_destino = "_chat.txt" if f.suffix.lower() == ".txt" else f.name
            shutil.copy2(f, destino / nombre_destino)

    destino_lectura = destino_tmp

    # 2. Buscar _chat.txt
    chat_txt = None
    for f in destino_lectura.rglob("*.txt"):
        if "chat" in f.name.lower() or f.name.startswith("_"):
            chat_txt = f
            break
    if not chat_txt:
        txts = list(destino_lectura.rglob("*.txt"))
        chat_txt = txts[0] if txts else None

    mensajes = []
    if chat_txt:
        try:
            texto = chat_txt.read_text(encoding="utf-8", errors="replace")
        except Exception:
            texto = chat_txt.read_text(encoding="latin-1", errors="replace")
        mensajes = parsear_chat(texto)

    # 3. Organizar media
    media = organizar_media(destino_lectura, nombre_zip)

    # 4. Transcribir audios
    transcripciones = []
    for audio_info in media["audios"]:
        ruta = Path(audio_info["ruta"])
        transcripcion = transcribir_audio(ruta)
        if transcripcion:
            transcripciones.append({"nombre": audio_info["nombre"], "texto": transcripcion})
            mensajes.append({
                "fecha": None, "fecha_str": "audio", "autor": "audio",
                "texto": f"[Audio transcripto]: {transcripcion}",
                "archivo": audio_info["nombre"],
            })

    # 5. Subir archivos a Supabase Storage y obtener URLs
    url_map = subir_a_supabase(destino_lectura, nombre_zip)

    # 6. Guardar resumen del chat en Supabase Storage como JSON
    if url_map:
        # Reemplazar referencias de archivos en mensajes con URLs de Supabase
        mensajes_con_urls = []
        for m in mensajes:
            msg = dict(m)
            if msg.get("archivo") and msg["archivo"] in url_map:
                msg["url"] = url_map[msg["archivo"]]
            mensajes_con_urls.append(msg)

        resumen = {
            "nombre_chat": nombre_zip,
            "total_mensajes": len(mensajes),
            "url_map": url_map,
            "mensajes": mensajes_con_urls,
        }
        resumen_bytes = json.dumps(resumen, ensure_ascii=False, indent=2).encode("utf-8")
        supabase_url = os.environ.get('SUPABASE_URL', '').rstrip('/')
        service_key = os.environ.get('SUPABASE_SERVICE_KEY', '')
        carpeta_clean = limpiar_clave(nombre_zip)
        dest_resumen = f"{carpeta_clean}/_resumen.json"
        _requests.post(
            f"{supabase_url}/storage/v1/object/archivos/{dest_resumen}",
            headers={
                'apikey': service_key,
                'Authorization': f'Bearer {service_key}',
                'Content-Type': 'application/json',
                'x-upsert': 'true',
            },
            data=resumen_bytes,
        )
        print(f"[Supabase] Resumen guardado: {dest_resumen}")

    # 7. Cargar datos existentes y analizar con Claude
    datos_existentes = {}
    if JSON_PATH.exists():
        datos_existentes = json.loads(JSON_PATH.read_text(encoding="utf-8"))

    analisis = {"pagos": [], "mantenimiento": [], "observaciones": [], "inconsistencias": []}
    if mensajes:
        analisis = analizar_con_claude(mensajes, datos_existentes)
        print(f"[Claude] {len(analisis.get('pagos',[]))} pagos, "
              f"{len(analisis.get('mantenimiento',[]))} mant, "
              f"{len(analisis.get('observaciones',[]))} obs")

    return {
        "ok": True,
        "nombre_zip": nombre_zip,
        "total_mensajes": len(mensajes),
        "analisis": analisis,
        "fotos": media["fotos"],
        "transcripciones": transcripciones,
        "tiene_audios": len(media["audios"]) > 0,
        "tiene_fotos": len(media["fotos"]) > 0,
        "archivos_subidos": len(url_map),
    }


@app.get("/api/chats")
def listar_chats():
    """Lista todas las carpetas de chats importados"""
    if not MEDIA_DIR.exists():
        return {"chats": []}
    chats = []
    for d in sorted(MEDIA_DIR.iterdir()):
        if d.is_dir():
            archivos = list(d.iterdir())
            tipos = {}
            for f in archivos:
                ext = f.suffix.lower()
                if ext in {".jpg",".jpeg",".png",".webp"}: tipos["fotos"] = tipos.get("fotos",0)+1
                elif ext in {".opus",".mp3",".m4a"}: tipos["audios"] = tipos.get("audios",0)+1
                elif ext == ".pdf": tipos["pdfs"] = tipos.get("pdfs",0)+1
                elif ext in {".mp4",".mov"}: tipos["videos"] = tipos.get("videos",0)+1
            chats.append({
                "nombre": d.name,
                "total": len(archivos),
                "tipos": tipos,
                "excel_existe": (d / "archivos.xlsx").exists(),
            })
    return {"chats": chats}


@app.post("/api/generar-excel/{nombre_chat:path}")
async def generar_excel_chat(nombre_chat: str):
    """Genera el Excel para un chat específico"""
    import subprocess, sys
    script = Path(__file__).parent / "generar_archivo.py"
    result = subprocess.run(
        [sys.executable, str(script), nombre_chat],
        capture_output=True, text=True, cwd=str(BASE)
    )
    if result.returncode != 0:
        return {"ok": False, "error": result.stderr[-500:]}

    excel_path = MEDIA_DIR / nombre_chat / "archivos.xlsx"
    return {
        "ok": True,
        "archivo": str(excel_path),
        "mensaje": result.stdout[-300:],
    }


@app.post("/api/abrir-carpeta/{nombre_chat:path}")
def abrir_carpeta(nombre_chat: str):
    """Abre la carpeta del chat en el Explorador de Windows"""
    import subprocess
    carpeta = MEDIA_DIR / nombre_chat
    if carpeta.exists():
        subprocess.Popen(f'explorer "{carpeta}"')
        return {"ok": True}
    return {"ok": False, "error": "Carpeta no encontrada"}

@app.post("/api/abrir-excel/{nombre_chat:path}")
def abrir_excel(nombre_chat: str):
    """Abre el Excel del chat"""
    import subprocess
    excel = MEDIA_DIR / nombre_chat / "archivos.xlsx"
    if excel.exists():
        os.startfile(str(excel))
        return {"ok": True}
    return {"ok": False, "error": "Excel no encontrado"}

@app.get("/api/config")
def get_config():
    return {"whatsapp_carpeta": str(MEDIA_DIR)}

# ── Estado compartido (base de datos viva, sincronizada entre dispositivos) ─────
ESTADO_PATH = DATA_DIR / "estado.json"

def _version_estado() -> float:
    """Versión = timestamp de última modificación del archivo"""
    try:
        return ESTADO_PATH.stat().st_mtime
    except FileNotFoundError:
        return 0.0

@app.get("/api/data")
def get_data():
    """Devuelve el estado vivo + su versión. data=null si nunca se guardó."""
    if ESTADO_PATH.exists():
        try:
            data = json.loads(ESTADO_PATH.read_text(encoding="utf-8"))
        except Exception:
            data = None
    else:
        data = None
    return {"data": data, "version": _version_estado()}

@app.get("/api/data-version")
def get_data_version():
    """Solo la versión — para polling liviano desde los dispositivos."""
    return {"version": _version_estado()}

@app.post("/api/data")
async def save_data(payload: dict):
    """Guarda el estado completo. Escribe en temp y copia (evita bloqueos Dropbox)."""
    estado = payload.get("data", payload)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    # Escribir atómico vía temp
    tmp = Path(tempfile.gettempdir()) / "estado_tmp.json"
    tmp.write_text(json.dumps(estado, ensure_ascii=False, indent=2), encoding="utf-8")
    shutil.copy2(str(tmp), str(ESTADO_PATH))
    tmp.unlink(missing_ok=True)
    return {"ok": True, "version": _version_estado()}

@app.get("/api/health")
def health():
    return {"ok": True}


# ── Servir media estática ──────────────────────────────────────────────────────
if MEDIA_DIR.exists():
    app.mount("/media", StaticFiles(directory=str(MEDIA_DIR)), name="media")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
