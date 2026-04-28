import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import type { LinhaSus, ErroimportSus } from '~/types'

export const useImportSus = () => {
  const supabase = useSupabaseClient()
  const preview = ref<LinhaSus[]>([])
  const validos = ref<LinhaSus[]>([])
  const erros = ref<ErroimportSus[]>([])
  const importando = ref(false)

  const OBRIGATORIOS: (keyof LinhaSus)[] = [
    'nome',
    'cpf',
    'data_nascimento',
    'medico_crm',
    'data_consulta',
  ]

  async function parsear(file: File) {
    const ext = file.name.split('.').pop()?.toLowerCase()
    let linhas: LinhaSus[] = []

    if (ext === 'csv') {
      const texto = await file.text()
      linhas = Papa.parse<LinhaSus>(texto, {
        header: true,
        skipEmptyLines: true,
      }).data
    } else {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf)
      linhas = XLSX.utils.sheet_to_json<LinhaSus>(wb.Sheets[wb.SheetNames[0]])
    }

    preview.value = linhas.slice(0, 10)
    await validar(linhas)
  }

  async function validar(linhas: LinhaSus[]) {
    const { data: medicosDb } = await supabase.from('medicos').select('crm, id')
    const crmMap = Object.fromEntries(
      (medicosDb ?? []).map((m: { crm: string; id: string }) => [m.crm, m.id])
    )

    erros.value = []
    validos.value = []

    linhas.forEach((linha, i) => {
      const problemas: string[] = []

      OBRIGATORIOS.forEach((campo) => {
        if (!linha[campo]) problemas.push(`'${campo}' obrigatório`)
      })

      if (linha.cpf) {
        const cpfDigits = String(linha.cpf).replace(/\D/g, '')
        if (!/^\d{11}$/.test(cpfDigits)) problemas.push('CPF inválido')
      }

      if (linha.medico_crm && !crmMap[linha.medico_crm]) {
        problemas.push(`CRM ${linha.medico_crm} não cadastrado`)
      }

      if (problemas.length) {
        erros.value.push({ linha: i + 2, motivo: problemas.join(', ') })
      } else {
        validos.value.push({ ...linha, medico_id: crmMap[linha.medico_crm] })
      }
    })
  }

  async function importar(): Promise<{ importados: number; erros: number }> {
    importando.value = true
    try {
      const user = useSupabaseUser()

      // 1. Upsert pacientes — nunca sobrescrever dados existentes
      const pacs = validos.value.map((l) => ({
        nome: l.nome,
        cpf: String(l.cpf).replace(/\D/g, ''),
        data_nascimento: l.data_nascimento || null,
        telefone: l.telefone ?? null,
        email: l.email ?? null,
        sus_cartao: l.sus_cartao ?? null,
      }))

      await supabase
        .from('pacientes')
        .upsert(pacs, { onConflict: 'cpf', ignoreDuplicates: true })

      // 2. Buscar IDs dos pacientes
      const cpfs = pacs.map((p) => p.cpf)
      const { data: pDb } = await supabase
        .from('pacientes')
        .select('id, cpf')
        .in('cpf', cpfs)

      const cpfId = Object.fromEntries(
        (pDb ?? []).map((p: { cpf: string; id: string }) => [p.cpf, p.id])
      )

      // 3. Inserir agendamentos (ignorar duplicados)
      const ags = validos.value
        .map((l) => ({
          paciente_id: cpfId[String(l.cpf).replace(/\D/g, '')],
          medico_id: l.medico_id,
          data_consulta: l.data_consulta,
          motivo: l.motivo ?? null,
          observacoes: l.observacoes ?? null,
          origem: 'sus' as const,
          status: 'agendado' as const,
        }))
        .filter((a) => a.paciente_id && a.medico_id)

      const { error: agErr } = await supabase.from('agendamentos').insert(ags)

      // 4. Log de importação
      await supabase.from('importacoes_sus').insert({
        admin_id: user.value?.id,
        arquivo_nome: 'importacao',
        total_linhas: validos.value.length + erros.value.length,
        importados: ags.length,
        erros: erros.value.length,
        erros_detalhe: erros.value,
      })

      return { importados: ags.length, erros: erros.value.length }
    } finally {
      importando.value = false
    }
  }

  function reset() {
    preview.value = []
    validos.value = []
    erros.value = []
  }

  return { preview, validos, erros, importando, parsear, importar, reset }
}
