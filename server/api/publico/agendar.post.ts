import { createClient } from '@supabase/supabase-js'

function cpfValido(valor: string): boolean {
  const cpf = (valor ?? '').replace(/\D/g, '')
  if (cpf.length !== 11) return false
  if (/^(\d)\1{10}$/.test(cpf)) return false

  const digitoVerificador = (atePosicao: number): number => {
    let soma = 0
    let peso = atePosicao + 1
    for (let i = 0; i < atePosicao; i++) soma += Number(cpf[i]) * peso--
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }

  return digitoVerificador(9) === Number(cpf[9]) && digitoVerificador(10) === Number(cpf[10])
}

// "08:00:00" -> 480 (minutos desde 00:00)
function horaParaMinutos(h: string): number {
  const [hh, mm] = h.split(':').map(Number) as [number, number]
  return hh * 60 + mm
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const serviceKey = config.supabaseServiceKey
  const supabaseUrl = process.env.NUXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? ''

  if (!serviceKey) {
    throw createError({ statusCode: 500, message: 'Service key não configurada' })
  }

  const body = await readBody(event)
  const {
    medicoId, unidadeId, data, horario,
    nome, cpf, dataNascimento, telefone, email, motivo,
  } = body

  if (!medicoId || !unidadeId || !data || !horario || !nome || !cpf || !dataNascimento) {
    throw createError({ statusCode: 400, message: 'Preencha todos os campos obrigatórios.' })
  }

  const cpfNum = String(cpf).replace(/\D/g, '')
  if (!cpfValido(cpfNum)) {
    throw createError({ statusCode: 400, message: 'CPF inválido — confira os números digitados.' })
  }

  // Não deixa marcar consulta no passado. O servidor roda em UTC (Vercel),
  // então usar toISOString() aqui erra a data perto da virada do dia no
  // horário do Brasil — calcula "hoje" já no fuso de Fortaleza.
  const hojeStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Fortaleza' })
  if (data < hojeStr) {
    throw createError({ statusCode: 400, message: 'Data inválida.' })
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 1. Confere se o médico existe, está ativo e atende nesse dia/horário
  const { data: medico, error: medError } = await admin
    .from('medicos')
    .select('id, ativo, dias_atendimento, horario_inicio, horario_fim')
    .eq('id', medicoId)
    .eq('ativo', true)
    .single()

  if (medError || !medico) {
    throw createError({ statusCode: 404, message: 'Médico não encontrado.' })
  }

  const diaSemana = new Date(`${data}T12:00:00`).getDay()
  if (!medico.dias_atendimento.includes(diaSemana)) {
    throw createError({ statusCode: 400, message: 'O médico não atende nesse dia.' })
  }

  const minHorario = horaParaMinutos(horario)
  if (minHorario < horaParaMinutos(medico.horario_inicio) || minHorario >= horaParaMinutos(medico.horario_fim)) {
    throw createError({ statusCode: 400, message: 'Horário fora do expediente do médico.' })
  }

  // 2. Confere unidade ativa
  const { data: unidade, error: uniError } = await admin
    .from('unidades')
    .select('id')
    .eq('id', unidadeId)
    .eq('ativo', true)
    .single()
  if (uniError || !unidade) {
    throw createError({ statusCode: 404, message: 'Unidade não encontrada.' })
  }

  // 3. Confere se o horário ainda está livre (o índice único no banco é a
  // garantia final contra corrida de dois pacientes marcando ao mesmo tempo)
  const { data: ocupado } = await admin
    .from('agendamentos')
    .select('id')
    .eq('medico_id', medicoId)
    .eq('data_consulta', data)
    .eq('horario', horario)
    .neq('status', 'cancelado')
    .maybeSingle()

  if (ocupado) {
    throw createError({ statusCode: 409, message: 'Esse horário acabou de ser preenchido. Escolha outro.' })
  }

  // 4. Localiza paciente pelo CPF ou cria um novo — mesma regra do cadastro
  // manual: só reaproveita o cadastro existente se o nome também bater,
  // pra não misturar o agendamento com o prontuário de outra pessoa.
  const { data: existente } = await admin
    .from('pacientes')
    .select('id, nome')
    .eq('cpf', cpfNum)
    .maybeSingle()

  let pacienteId: string
  if (existente) {
    if (existente.nome.trim().toLowerCase() !== String(nome).trim().toLowerCase()) {
      throw createError({
        statusCode: 400,
        message: `Este CPF já está cadastrado para "${existente.nome}". Confira o número digitado.`,
      })
    }
    pacienteId = existente.id
  } else {
    const { data: novoPaciente, error: pacError } = await admin
      .from('pacientes')
      .insert({
        nome: String(nome).trim(),
        cpf: cpfNum,
        data_nascimento: dataNascimento,
        telefone: telefone ? String(telefone).replace(/\D/g, '') : null,
        email: email ? String(email).trim() : null,
        unidade_id: unidadeId,
      })
      .select('id')
      .single()
    if (pacError || !novoPaciente) {
      throw createError({ statusCode: 500, message: 'Erro ao cadastrar paciente.' })
    }
    pacienteId = novoPaciente.id
  }

  // 5. Cria o agendamento
  const { data: agendamento, error: agError } = await admin
    .from('agendamentos')
    .insert({
      paciente_id: pacienteId,
      medico_id: medicoId,
      data_consulta: data,
      horario,
      motivo: motivo ? String(motivo).trim() : null,
      observacoes: 'Cadastro feito pelo site',
      origem: 'publico',
      status: 'agendado',
    })
    .select('id')
    .single()

  if (agError || !agendamento) {
    const dup = /idx_agendamentos_slot_unico|duplicate key/i.test(agError?.message ?? '')
    throw createError({
      statusCode: dup ? 409 : 500,
      message: dup ? 'Esse horário acabou de ser preenchido. Escolha outro.' : 'Erro ao criar agendamento.',
    })
  }

  return { ok: true, agendamentoId: agendamento.id }
})
