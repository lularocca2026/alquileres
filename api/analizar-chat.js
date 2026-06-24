import Anthropic from '@anthropic-ai/sdk'

const PROMPT = `Sos un asistente que analiza conversaciones de WhatsApp de una propietaria de alquileres llamada Lucre.

Analizá los mensajes y extraé SOLO información nueva (no repetida). Devolvé un JSON con esta estructura exacta:

{
  "pagos": [
    { "fecha": "ISO date o null", "monto": 123456, "descripcion": "descripción breve", "inquilino_probable": "nombre o null", "confianza": "alta|media|baja" }
  ],
  "mantenimiento": [
    { "fecha": "ISO date o null", "descripcion": "descripción del problema", "costo": 0, "estado": "pendiente|en_progreso|resuelto", "confianza": "alta|media|baja" }
  ],
  "observaciones": [
    { "fecha": "ISO date o null", "texto": "resumen de 1-2 líneas", "tipo": "pago|mantenimiento|contrato|impuesto|servicio|otro" }
  ],
  "inconsistencias": [
    { "descripcion": "descripción", "tipo": "posible_duplicado|monto_diferente|fecha_conflicto|otro" }
  ]
}

Reglas:
- Solo incluí eventos sobre alquileres, pagos, mantenimiento, servicios, impuestos, contratos
- Ignorá mensajes de saludo, offtopic, memes
- Siempre devolvé JSON válido, sin markdown

DATOS EXISTENTES:
{DATOS}

CONVERSACIÓN:
{CONV}`

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return res.status(200).end()
  }

  if (req.method !== 'POST') return res.status(405).end()

  const { conversacion, datos_existentes } = req.body
  if (!conversacion) return res.status(400).json({ error: 'Falta conversacion' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada' })

  try {
    const client = new Anthropic({ apiKey })
    const prompt = PROMPT
      .replace('{DATOS}', JSON.stringify(datos_existentes || {}, null, 2).slice(0, 3000))
      .replace('{CONV}', conversacion.slice(0, 15000))

    const resp = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    })

    let texto = resp.content[0].text.trim()
      .replace(/^```json\s*/i, '').replace(/\s*```$/i, '')

    const analisis = JSON.parse(texto)
    res.status(200).json({ ok: true, analisis })
  } catch (e) {
    console.error('Error analizar-chat:', e.message)
    res.status(200).json({
      ok: false,
      analisis: { pagos: [], mantenimiento: [], observaciones: [], inconsistencias: [] },
    })
  }
}
