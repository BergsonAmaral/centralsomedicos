import { createClient } from '@supabase/supabase-js'
import { serverSupabaseClient } from '#supabase/server'

// Gera (ou reaproveita) uma sala Daily.co por agendamento, e devolve um
// token de acesso. O médico sempre recebe um token de "owner" (anfitrião
// de verdade, controlado pelo servidor) — diferente do Jitsi público, aqui
// não depende de quem clica primeiro pra virar moderador.
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const apiKey = config.dailyApiKey
  const domain = config.dailyDomain
  if (!apiKey || !domain) {
    throw createError({ statusCode: 500, message: 'Daily.co não configurado (DAILY_API_KEY / DAILY_DOMAIN)' })
  }

  const body = await readBody<{ agendamentoId?: string; nomeExibicao?: string }>(event)
  const agendamentoId = body?.agendamentoId
  if (!agendamentoId) throw createError({ statusCode: 400, message: 'agendamentoId obrigatório' })

  const supabaseUrl = process.env.SUPABASE_URL!
  const serviceKey = config.supabaseServiceKey
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: agendamento, error: agErr } = await admin
    .from('agendamentos')
    .select('id, medico_id, status')
    .eq('id', agendamentoId)
    .single()
  if (agErr || !agendamento) throw createError({ statusCode: 404, message: 'Agendamento não encontrado' })

  const statusPermitidos = ['aguardando_medico', 'aguardando_paciente', 'em_consulta']
  if (!statusPermitidos.includes(agendamento.status)) {
    throw createError({ statusCode: 400, message: 'Esta consulta não está ativa no momento.' })
  }

  // Nome de sala determinístico a partir do agendamento — mesma consulta,
  // mesma sala, sem precisar guardar nada extra no banco.
  const roomName = `somedicos-${agendamentoId.replace(/-/g, '').slice(0, 30)}`
  const dailyHeaders = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }

  // Cria a sala se ainda não existir (idempotente — 400 "already exists" é ignorado)
  const criarResp = await fetch('https://api.daily.co/v1/rooms', {
    method: 'POST',
    headers: dailyHeaders,
    body: JSON.stringify({
      name: roomName,
      privacy: 'private',
      properties: {
        enable_prejoin_ui: false,
        enable_chat: true,
        enable_screenshare: true,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 6, // expira em 6h — limpeza automática
        eject_at_room_exp: true,
      },
    }),
  })
  if (!criarResp.ok) {
    const erroTexto = await criarResp.text()
    if (!erroTexto.includes('already exists')) {
      throw createError({ statusCode: 500, message: 'Erro ao criar sala de vídeo: ' + erroTexto })
    }
  }

  // Descobre se quem está pedindo o token é o médico desta consulta —
  // se sim, vira anfitrião (owner). Paciente (sem sessão, tela pública da
  // sala) sempre entra como participante comum.
  let isOwner = false
  let nomeExibicao = body?.nomeExibicao?.trim() || 'Participante'
  try {
    const callerClient = await serverSupabaseClient(event)
    const { data: { user } } = await callerClient.auth.getUser()
    if (user) {
      const { data: medico } = await admin.from('medicos').select('id, nome').eq('user_id', user.id).single()
      if (medico && medico.id === agendamento.medico_id) {
        isOwner = true
        nomeExibicao = medico.nome
      }
    }
  } catch {
    // sem sessão (paciente na tela pública da sala) — segue como participante
  }

  const tokenResp = await fetch('https://api.daily.co/v1/meeting-tokens', {
    method: 'POST',
    headers: dailyHeaders,
    body: JSON.stringify({
      properties: {
        room_name: roomName,
        is_owner: isOwner,
        user_name: nomeExibicao,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 4,
      },
    }),
  })
  if (!tokenResp.ok) {
    throw createError({ statusCode: 500, message: 'Erro ao gerar token de acesso à sala' })
  }
  const tokenData = await tokenResp.json()

  return {
    url: `https://${domain}.daily.co/${roomName}`,
    token: tokenData.token as string,
    isOwner,
  }
})
