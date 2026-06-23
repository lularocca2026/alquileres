"""
Genera un Excel con todos los archivos de un chat de WhatsApp importado.
Guarda en: C:\\Users\\Pablo\\Dropbox\\WhatsApp Pablo\\[nombre inquilina]\\archivos.xlsx
"""
import os, sys, re, json
from pathlib import Path
from datetime import datetime
import xlsxwriter

# ── Config ──────────────────────────────────────────────────────────────────
BASE      = Path(__file__).parent.parent
_config   = json.loads((BASE / "config.json").read_text(encoding="utf-8")) if (BASE / "config.json").exists() else {}
MEDIA_DIR = Path(_config.get("whatsapp_carpeta", BASE / "data" / "media"))
OLD_MEDIA = BASE / "data" / "media"

# Cargar .env
_env = BASE / ".env"
if _env.exists():
    for _line in _env.read_text(encoding="utf-8").splitlines():
        _line = _line.strip()
        if _line and "=" in _line and not _line.startswith("#"):
            _k, _v = _line.split("=", 1)
            os.environ[_k.strip()] = _v.strip()

# ── Paleta azul / gris ────────────────────────────────────────────────────
NAVY    = "#1E3A5F"   # azul marino oscuro — encabezados
BLUE1   = "#2563EB"   # azul primario — links, botones
BLUE2   = "#3B82F6"   # azul medio
BLUE3   = "#93C5FD"   # azul claro — acentos
WHITE   = "#FFFFFF"
GRAY1   = "#374151"   # gris oscuro — texto secundario
GRAY2   = "#6B7280"   # gris medio
GRAY3   = "#9CA3AF"   # gris claro
BORDER  = "#BFDBFE"   # borde azul claro

# Fondos por tipo — escala de azules y grises
BG_NAVY  = "#EFF6FF"  # azul muy pálido   → fotos
BG_BLUE2 = "#DBEAFE"  # azul pálido       → audios
BG_BLUE3 = "#BFDBFE"  # azul suave        → videos
BG_INDG  = "#E0E7FF"  # índigo pálido     → PDFs
BG_SKY   = "#F0F9FF"  # celeste muy claro → docs
BG_GRAY  = "#F1F5F9"  # gris azulado      → contactos
BG_WHITE = "#FFFFFF"  # blanco            → otros

COLORES_TIPO = {
    "foto":     BG_NAVY,
    "audio":    BG_BLUE2,
    "video":    BG_BLUE3,
    "pdf":      BG_INDG,
    "doc":      BG_SKY,
    "contacto": BG_GRAY,
    "otro":     WHITE,
}

EXTENSIONES = {
    "foto":     {".jpg", ".jpeg", ".png", ".webp", ".gif"},
    "audio":    {".opus", ".mp3", ".m4a", ".ogg", ".aac"},
    "video":    {".mp4", ".mov", ".avi", ".3gp"},
    "pdf":      {".pdf"},
    "doc":      {".docx", ".doc", ".xls", ".xlsx"},
    "contacto": {".vcf"},
}

def tipo_archivo(ext):
    for tipo, exts in EXTENSIONES.items():
        if ext in exts:
            return tipo
    return "otro"

RE_LINEA = re.compile(
    r'^(\d{1,2}/\d{1,2}/\d{2,4}),\s(\d{1,2}:\d{2}(?:\s?[ap]\.?\s?m\.?)?)\s-\s([^:]+?):\s(.+)$',
    re.IGNORECASE
)

def parsear_chat_txt(ruta: Path) -> list[dict]:
    """Lee _chat.txt y devuelve lista de mensajes"""
    try:
        texto = ruta.read_text(encoding="utf-8", errors="replace")
    except Exception:
        try:
            texto = ruta.read_text(encoding="latin-1", errors="replace")
        except Exception:
            return []

    mensajes = []
    linea_actual = None
    for linea in texto.splitlines():
        m = RE_LINEA.match(linea)
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
            linea_actual = {"fecha": dt, "autor": autor.strip(), "texto": contenido.strip()}
        elif linea_actual and linea.strip():
            linea_actual["texto"] += "\n" + linea.strip()
    if linea_actual:
        mensajes.append(linea_actual)
    return mensajes

def fecha_desde_nombre(nombre):
    m = re.search(r"(\d{4})(\d{2})(\d{2})", nombre)
    if m:
        try:
            return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        except Exception:
            pass
    return None

def transcribir_opus(ruta: Path) -> str:
    try:
        import whisper
        wav = ruta.with_suffix(".wav")
        os.system(f'ffmpeg -y -i "{ruta}" "{wav}" -loglevel quiet')
        if wav.exists():
            model = whisper.load_model("base")
            result = model.transcribe(str(wav))
            wav.unlink(missing_ok=True)
            return result.get("text", "").strip()
    except Exception as e:
        return f"[Error: {e}]"
    return ""

def procesar_chat(carpeta: Path, transcribir=True) -> list[dict]:
    archivos = []
    for f in sorted(carpeta.iterdir()):
        if not f.is_file() or f.name == "archivos.xlsx":
            continue
        ext = f.suffix.lower()
        tipo = tipo_archivo(ext)
        fecha = fecha_desde_nombre(f.name)

        transcripcion = ""
        if tipo == "audio" and transcribir:
            print(f"  Transcribiendo {f.name}...")
            transcripcion = transcribir_opus(f)

        archivos.append({
            "nombre": f.name,
            "tipo": tipo,
            "extension": ext,
            "fecha": fecha,
            "tamanio_kb": f.stat().st_size // 1024,
            "transcripcion": transcripcion,
            "ruta": f,
        })
    return archivos

def make_url(ruta: Path) -> str:
    """URL de archivo para link en Excel"""
    return "file:///" + str(ruta).replace("\\", "/").replace(" ", "%20")

def generar_excel(nombre_chat: str, archivos: list[dict], carpeta: Path) -> Path:
    salida = carpeta / "archivos.xlsx"

    import tempfile
    tmp = Path(tempfile.gettempdir()) / "archivos_tmp.xlsx"

    wb = xlsxwriter.Workbook(str(tmp))

    # ── Helper de formato ──────────────────────────────────────────────────
    def F(bold=False, sz=10, color=None, bg=None, align="left", valign="vcenter",
          wrap=False, num=None, italic=False, border=True, underline=False):
        props = {"font_size": sz, "valign": valign, "align": align}
        if bold:      props["bold"] = True
        if italic:    props["italic"] = True
        if underline: props["underline"] = True
        if color:     props["font_color"] = color
        if bg:        props["bg_color"] = bg
        if wrap:      props["text_wrap"] = True
        if num:       props["num_format"] = num
        if border:    props.update({"border": 1, "border_color": BORDER})
        return wb.add_format(props)

    # ── Formatos predefinidos ──────────────────────────────────────────────
    F_TITLE  = F(bold=True, sz=14, color=WHITE,  bg=NAVY,   border=False)
    F_SUB    = F(sz=10,           color=GRAY3,   bg="#E8F0FE", border=False)
    F_HDR    = F(bold=True, sz=10, color=WHITE,  bg=NAVY,   align="center")
    F_TOTAL  = F(bold=True, sz=11, color=WHITE,  bg=BLUE1,  align="center")
    F_LINK   = F(sz=11, color=BLUE1, underline=True, align="center")

    # Formatos por tipo (fondos en escala de azules)
    FMT = {}
    for tipo, bg in COLORES_TIPO.items():
        texto_col = NAVY if bg != BG_BLUE3 else NAVY   # texto siempre oscuro
        tipo_col  = BLUE1
        FMT[tipo] = {
            "num":    F(bold=True, sz=10, color=GRAY2,  bg=bg, align="center"),
            "fecha":  F(sz=10,           color=GRAY1,  bg=bg, align="center", num="DD/MM/YYYY"),
            "tipo":   F(bold=True, sz=9,  color=BLUE1,  bg=bg, align="center"),
            "nombre": F(sz=10,           color=NAVY,   bg=bg),
            "kb":     F(sz=10,           color=GRAY2,  bg=bg, align="center"),
            "trans":  F(sz=9,            color=GRAY1,  bg=bg, wrap=True, valign="top"),
            "link":   F(sz=11,           color=BLUE1,  bg=bg, underline=True, align="center"),
        }

    # ── Hoja principal ─────────────────────────────────────────────────────
    ws = wb.add_worksheet("Archivos")
    ws.set_zoom(90)
    ws.freeze_panes(5, 0)

    # Anchos de columna: #, Fecha, Tipo, Nombre, KB, Transcripcion/Nota, Abrir
    ws.set_column(0, 0, 5)   # #
    ws.set_column(1, 1, 13)  # Fecha
    ws.set_column(2, 2, 11)  # Tipo
    ws.set_column(3, 3, 48)  # Nombre
    ws.set_column(4, 4, 10)  # KB
    ws.set_column(5, 5, 72)  # Transcripción
    ws.set_column(6, 6, 8)   # Link

    # Fila 0: Título
    ws.set_row(0, 32)
    ws.merge_range("A1:G1", f"Archivos — {nombre_chat}", F_TITLE)

    # Fila 1: Subtítulo con conteo por tipo
    tipos_count = {}
    for a in archivos:
        tipos_count[a["tipo"]] = tipos_count.get(a["tipo"], 0) + 1
    resumen = "   |   ".join([f"{t.upper()}: {c}" for t, c in sorted(tipos_count.items())])
    ws.set_row(1, 18)
    ws.merge_range("A2:G2", f"Generado: {datetime.now().strftime('%d/%m/%Y %H:%M')}   —   Total: {len(archivos)} archivos   —   {resumen}", F_SUB)

    # Fila 2: espaciador con franja azul claro
    ws.set_row(2, 5)
    ws.merge_range("A3:G3", "", F(bg=BLUE3, border=False))

    # Fila 3: encabezados
    ws.set_row(3, 24)
    for col, header in enumerate(["#", "Fecha", "Tipo", "Nombre del archivo", "KB", "Transcripción / Nota", "Ver"]):
        ws.write(3, col, header, F_HDR)

    # Filas de datos
    row = 4
    for idx, a in enumerate(archivos, 1):
        tipo = a["tipo"]
        fmt = FMT.get(tipo, FMT["otro"])
        url = make_url(a["ruta"])

        # Altura según transcripción
        if a.get("transcripcion"):
            alto = max(35, min(150, len(a["transcripcion"]) // 3))
        else:
            alto = 20
        ws.set_row(row, alto)

        ws.write(row, 0, idx,                  fmt["num"])
        if a["fecha"]:
            ws.write(row, 1, a["fecha"],        fmt["fecha"])
        else:
            ws.write(row, 1, "",                fmt["fecha"])
        ws.write(row, 2, tipo.upper(),          fmt["tipo"])
        ws.write(row, 3, a["nombre"],           fmt["nombre"])
        ws.write(row, 4, a["tamanio_kb"],       fmt["kb"])
        ws.write(row, 5, a.get("transcripcion",""), fmt["trans"])

        # Link "Abrir"
        try:
            ws.write_url(row, 6, url, fmt["link"], "Abrir")
        except Exception:
            ws.write(row, 6, "—", fmt["link"])

        row += 1

    # Fila total
    ws.set_row(row, 22)
    ws.merge_range(row, 0, row, 2, f"Total: {len(archivos)} archivos", F_TOTAL)
    ws.write(row, 3, "", F_TOTAL)
    ws.write(row, 4, sum(a["tamanio_kb"] for a in archivos), F_TOTAL)
    ws.write(row, 5, "", F_TOTAL)
    ws.write(row, 6, "", F_TOTAL)

    # ── Hoja resumen por fecha ─────────────────────────────────────────────
    ws2 = wb.add_worksheet("Por fecha")
    ws2.set_zoom(90)
    ws2.set_column(0, 0, 13)
    ws2.set_column(1, 1, 12)
    ws2.set_column(2, 2, 55)
    ws2.set_column(3, 3, 8)
    ws2.set_row(0, 28)
    ws2.merge_range("A1:D1", f"Archivos por fecha — {nombre_chat}", F_TITLE)
    ws2.set_row(1, 22)
    for c, h in enumerate(["Fecha", "Tipo", "Archivos", "Ver"]):
        ws2.write(1, c, h, F_HDR)

    por_fecha = {}
    for a in archivos:
        if a["fecha"]:
            key = (a["fecha"], a["tipo"])
            por_fecha.setdefault(key, []).append(a)

    r2 = 2
    for (fecha, tipo), items in sorted(por_fecha.items()):
        fmt = FMT.get(tipo, FMT["otro"])
        nombres = ", ".join(a["nombre"] for a in items[:4])
        if len(items) > 4:
            nombres += f" ... +{len(items)-4}"
        ws2.set_row(r2, 20)
        ws2.write(r2, 0, fecha,         fmt["fecha"])
        ws2.write(r2, 1, tipo.upper(),  fmt["tipo"])
        ws2.write(r2, 2, nombres,       fmt["nombre"])
        # Link al primer archivo del grupo
        try:
            ws2.write_url(r2, 3, make_url(items[0]["ruta"]), fmt["link"], "Ver")
        except Exception:
            ws2.write(r2, 3, "—", fmt["link"])
        r2 += 1

    # ── Hoja mensajes del chat ─────────────────────────────────────────────
    chat_txt = carpeta / "_chat.txt"
    if chat_txt.exists():
        mensajes = parsear_chat_txt(chat_txt)
        if mensajes:
            ws3 = wb.add_worksheet("Mensajes")
            ws3.set_zoom(90)
            ws3.freeze_panes(2, 0)
            ws3.set_column(0, 0, 13)   # Fecha
            ws3.set_column(1, 1, 13)   # Hora
            ws3.set_column(2, 2, 22)   # Autor
            ws3.set_column(3, 3, 80)   # Texto

            # Título
            ws3.set_row(0, 26)
            ws3.merge_range("A1:D1", f"Mensajes — {nombre_chat}", F_TITLE)

            # Encabezados
            ws3.set_row(1, 22)
            for c, h in enumerate(["Fecha", "Hora", "Autor", "Mensaje"]):
                ws3.write(1, c, h, F_HDR)

            # Alternancia azul / blanco
            BG_A = "#EFF6FF"
            BG_B = "#FFFFFF"
            F_DATE_A = F(sz=10, color=GRAY2, bg=BG_A, align="center", num="DD/MM/YYYY")
            F_DATE_B = F(sz=10, color=GRAY2, bg=BG_B, align="center", num="DD/MM/YYYY")
            F_HORA_A = F(sz=10, color=GRAY2, bg=BG_A, align="center", num="HH:MM")
            F_HORA_B = F(sz=10, color=GRAY2, bg=BG_B, align="center", num="HH:MM")
            F_AUT_A  = F(bold=True, sz=10, color=NAVY, bg=BG_A)
            F_AUT_B  = F(bold=True, sz=10, color=NAVY, bg=BG_B)
            F_MSG_A  = F(sz=10, color=GRAY1, bg=BG_A, wrap=True, valign="top")
            F_MSG_B  = F(sz=10, color=GRAY1, bg=BG_B, wrap=True, valign="top")

            for i, msg in enumerate(mensajes):
                r = i + 2
                bg_a = i % 2 == 0
                f_d = F_DATE_A if bg_a else F_DATE_B
                f_h = F_HORA_A if bg_a else F_HORA_B
                f_a = F_AUT_A  if bg_a else F_AUT_B
                f_m = F_MSG_A  if bg_a else F_MSG_B

                texto = msg.get("texto", "")
                lineas = texto.count("\n") + 1
                alto = max(18, min(120, lineas * 16))
                ws3.set_row(r, alto)

                if msg.get("fecha"):
                    ws3.write(r, 0, msg["fecha"], f_d)
                    ws3.write(r, 1, msg["fecha"], f_h)
                else:
                    ws3.write(r, 0, "", f_d)
                    ws3.write(r, 1, "", f_h)
                ws3.write(r, 2, msg.get("autor", ""), f_a)
                ws3.write(r, 3, texto, f_m)

            print(f"  {len(mensajes)} mensajes exportados a hoja 'Mensajes'")
    else:
        print("  [!] _chat.txt no encontrado — reimportar el ZIP para incluir mensajes")

    wb.close()
    import shutil
    shutil.copy2(str(tmp), str(salida))
    tmp.unlink(missing_ok=True)
    print(f"Excel guardado: {salida}")
    return salida


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    # Buscar carpeta: primero en WhatsApp Pablo, luego en data/media vieja
    def buscar_carpeta(nombre):
        for base in [MEDIA_DIR, OLD_MEDIA]:
            if not base.exists():
                continue
            c = base / nombre
            if c.exists():
                return c
            matches = [d for d in base.iterdir() if d.is_dir() and nombre.lower() in d.name.lower()]
            if matches:
                return matches[0]
        return None

    if len(sys.argv) > 1:
        nombre = " ".join(sys.argv[1:])
        carpeta = buscar_carpeta(nombre)
        if not carpeta:
            print(f"Carpeta no encontrada: {nombre}")
            sys.exit(1)
        print(f"Usando: {carpeta}")
        chats = [carpeta]
    else:
        chats = []
        for base in [MEDIA_DIR, OLD_MEDIA]:
            if base.exists():
                chats += [d for d in base.iterdir() if d.is_dir()]

    for carpeta in chats:
        print(f"\nProcesando: {carpeta.name}")
        archivos = procesar_chat(carpeta, transcribir=True)
        print(f"  {len(archivos)} archivos encontrados")
        generar_excel(carpeta.name, archivos, carpeta)


if __name__ == "__main__":
    main()
