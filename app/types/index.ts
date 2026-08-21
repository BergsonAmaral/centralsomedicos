// =============================================
// TIPOS GLOBAIS — SoMedicos
// =============================================

export type Role = 'admin' | 'medico' | 'atendente'

export interface Profile {
  id: string
  role: Role
  nome: string
  is_superadmin: boolean
  created_at: string
}

export interface Atendente {
  id: string
  user_id: string | null
  nome: string
  unidade_id: string
  ativo: boolean
  created_at: string
  unidades?: Pick<Unidade, 'id' | 'nome'>
}

export interface Medico {
  id: string
  user_id: string | null
  nome: string
  crm: string
  especialidade: string
  foto_url: string | null
  ativo: boolean
  pausado: boolean
  valor_consulta: number | null
  valor_hora: number | null
  meta_atendimentos_hora: number | null
  valor_hora_bonus: number | null
  assinatura_url: string | null
  created_at: string
  // Expediente — usado para calcular horários disponíveis no agendamento público
  dias_atendimento: number[] // 0=domingo .. 6=sábado, igual Date.getDay()
  horario_inicio: string     // "08:00:00"
  horario_fim: string        // "18:00:00"
  duracao_slot_min: number
}

export type UnidadeTipo = 'hospital' | 'ubs' | 'itinerante' | 'rural'

export interface Unidade {
  id: string
  nome: string
  tipo: UnidadeTipo
  cidade: string | null
  ativo: boolean
  created_at: string
}

// A sala pertence à unidade (local físico onde o paciente está), não ao
// médico — o admin roteia o paciente daquela sala para quem estiver livre.
export interface Sala {
  id: string
  slug: string
  nome: string
  unidade_id: string
  ativo: boolean
  created_at: string
  unidades?: Pick<Unidade, 'id' | 'nome' | 'tipo'>
}

export interface Paciente {
  id: string
  nome: string
  cpf: string
  data_nascimento: string | null
  sexo: 'M' | 'F' | 'O' | null
  telefone: string | null
  email: string | null
  sus_cartao: string | null
  unidade_id: string | null
  created_at: string
  unidades?: Pick<Unidade, 'id' | 'nome'>
}

export type AgendamentoStatus =
  | 'agendado'
  | 'checkin'
  | 'aguardando_medico'
  | 'aguardando_paciente'
  | 'em_consulta'
  | 'aguardando_avaliacao'
  | 'concluido'
  | 'faltou'
  | 'cancelado'

export interface SinaisVitais {
  pressao_sistolica?: number | null   // mmHg
  pressao_diastolica?: number | null  // mmHg
  pulso?: number | null               // bpm
  temperatura?: number | null         // °C
  saturacao?: number | null           // % SpO2
  peso?: number | null                // kg
  altura?: number | null              // cm
  glicemia?: number | null            // mg/dL
  gordura_percentual?: number | null  // %
  imc?: number | null                 // kg/m²
}

export interface AnexoTriagem {
  tipo: 'link' | 'arquivo'
  label: string
  url: string
}

export interface Triagem extends SinaisVitais {
  alergia: boolean
  febre: boolean
  urgencia: boolean
  obs: string
  anexos?: AnexoTriagem[]
}

export interface Agendamento {
  id: string
  paciente_id: string
  medico_id: string
  data_consulta: string
  motivo: string | null
  observacoes: string | null
  origem: 'sus' | 'manual' | 'publico'
  status: AgendamentoStatus
  checkin_em: string | null
  chamado_em: string | null
  encerrado_em: string | null
  triagem: Triagem | null
  sala_slug: string | null
  horario: string | null
  created_at: string
  // Relações
  pacientes?: Paciente
  medicos?: Pick<Medico, 'id' | 'nome' | 'especialidade' | 'crm' | 'pausado'>
}

export interface Consulta {
  id: string
  agendamento_id: string | null
  medico_id: string | null
  paciente_id: string | null
  evolucao: string | null
  duracao_minutos: number | null
  avaliacao_nota: number | null
  avaliacao_comentario: string | null
  created_at: string
  // Relações
  pacientes?: Paciente
  medicos?: Medico
  agendamentos?: Agendamento
}

export type DocumentoTipo =
  | 'atestado'
  | 'pedido_exame'
  | 'receita'
  | 'receita_controlada'
  | 'encaminhamento'
  | 'declaracao'

export type DocumentoStatus = 'gerado' | 'enviado_paciente' | 'arquivado'

export interface Documento {
  id: string
  consulta_id: string | null
  medico_id: string | null
  paciente_id: string | null
  tipo: DocumentoTipo
  conteudo: Record<string, unknown>
  pdf_url: string | null
  status: DocumentoStatus
  link_acesso: string | null
  link_expira_em: string | null
  enviado_via: 'whatsapp' | 'email' | 'download' | null
  created_at: string
  // Relações
  pacientes?: Paciente
  medicos?: Medico
  consultas?: Consulta
  agendamentos?: Pick<Agendamento, 'chamado_em' | 'horario'>
}

// =============================================
// TIPOS DE FORMULÁRIOS
// =============================================
export interface AtestadoConteudo {
  dias_afastamento: number
  cid: string
  data: string
  observacoes: string
}

export interface PedidoExameConteudo {
  exames: string[]
  urgente: boolean
  orientacoes: string
}

export interface MedicamentoItem {
  medicamento: string
  dose: string
  posologia: string
  quantidade: string
}

export interface ReceitaConteudo {
  itens: MedicamentoItem[]
}

export interface ReceitaControladaConteudo extends ReceitaConteudo {
  numero_receita: string
  tarja: 'B1' | 'B2' | 'C1' | 'C2' | 'C3' | 'C4' | 'C5'
}

export interface EncaminhamentoConteudo {
  especialidade_destino: string
  motivo: string
  urgente: boolean
}

export interface DeclaracaoConteudo {
  data_consulta: string
  hora_inicio: string
  hora_fim: string
}

// =============================================
// LINHA DO ARQUIVO SUS (importação)
// =============================================
export interface LinhaSus {
  nome: string
  cpf: string
  data_nascimento: string
  telefone?: string
  email?: string
  sus_cartao?: string
  medico_crm: string
  data_consulta: string
  motivo?: string
  observacoes?: string
  // Campo adicionado na validação
  medico_id?: string
}

export interface ErroimportSus {
  linha: number
  motivo: string
}
