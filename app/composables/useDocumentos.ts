import type { Medico, Paciente, DocumentoTipo } from '~/types'

interface GerarPDFOptions {
  medico: Medico & { crm: string }
  paciente: Paciente
  titulo: string
  corpo: unknown[]
  tipo: DocumentoTipo
  consultaId: string
}

export const useDocumentos = () => {
  const supabase = useSupabaseClient()

  // Formata CPF
  function formatarCPF(cpf: string): string {
    const d = cpf.replace(/\D/g, '')
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }

  // Calcula idade
  function calcularIdade(dataNasc: string | null): number | null {
    if (!dataNasc) return null
    const hoje = new Date()
    const nasc = new Date(dataNasc)
    let idade = hoje.getFullYear() - nasc.getFullYear()
    const m = hoje.getMonth() - nasc.getMonth()
    if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--
    return idade
  }

  async function gerarEFazerUpload(options: GerarPDFOptions): Promise<string | null> {
    if (!import.meta.client) return null

    const { default: pdfMake } = await import('pdfmake/build/pdfmake')
    const { default: vfsFonts } = await import('pdfmake/build/vfs_fonts')
    pdfMake.vfs = vfsFonts.vfs

    const { medico, paciente, titulo, corpo, tipo, consultaId } = options

    // Converte imagem de URL para base64 para embutir no PDF
    async function urlParaBase64(url: string): Promise<string | null> {
      try {
        const res = await fetch(url)
        const blob = await res.blob()
        return await new Promise((resolve) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.onerror = () => resolve(null)
          reader.readAsDataURL(blob)
        })
      } catch {
        return null
      }
    }

    // Logo no cabeçalho de todo documento gerado
    const logoBase64 = await urlParaBase64(`${window.location.origin}/logo.png`)

    // Bloco de assinatura no rodapé
    const assinaturaBase64 = (medico as any).assinatura_url
      ? await urlParaBase64((medico as any).assinatura_url)
      : null

    const cidadeData = `${new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}`

    const blocoAssinatura: unknown[] = [
      '\n\n',
      { text: cidadeData, alignment: 'right', fontSize: 10, color: '#475569' },
      '\n',
      ...(assinaturaBase64
        ? [
            {
              image: assinaturaBase64,
              width: 160,
              alignment: 'center',
              margin: [0, 0, 0, 2],
            } as unknown,
          ]
        : [
            {
              canvas: [{ type: 'line', x1: 140, y1: 0, x2: 375, y2: 0, lineWidth: 0.7, lineColor: '#94a3b8' }],
              margin: [0, 24, 0, 2],
            } as unknown,
          ]),
      {
        text: `Dr(a). ${medico.nome}`,
        bold: true,
        alignment: 'center',
        fontSize: 11,
      },
      {
        text: `CRM: ${medico.crm} — ${medico.especialidade}`,
        alignment: 'center',
        fontSize: 10,
        color: '#475569',
      },
    ]

    const docDef = {
      content: [
        ...(logoBase64
          ? [{ image: logoBase64, width: 120, margin: [0, 0, 0, 6] } as unknown]
          : []),
        { text: 'Central SóMedicos', style: 'clinica' },
        {
          text: `Dr(a). ${medico.nome} | CRM: ${medico.crm} | ${medico.especialidade}`,
          style: 'medico',
        },
        {
          canvas: [
            {
              type: 'line',
              x1: 0,
              y1: 0,
              x2: 515,
              y2: 0,
              lineWidth: 1,
              lineColor: '#2563eb',
            },
          ],
        },
        '\n',
        { text: `Paciente: ${paciente.nome}`, bold: true },
        {
          text: `CPF: ${formatarCPF(paciente.cpf)} | Cartão SUS: ${paciente.sus_cartao ?? '—'}`,
        },
        {
          text: `Data: ${new Date().toLocaleDateString('pt-BR')}`,
        },
        '\n',
        { text: titulo, style: 'titulo' },
        '\n',
        ...(corpo as unknown[]),
        ...blocoAssinatura,
        '\n',
        {
          canvas: [
            {
              type: 'line',
              x1: 0,
              y1: 0,
              x2: 515,
              y2: 0,
              lineWidth: 0.5,
              lineColor: '#94a3b8',
            },
          ],
        },
        {
          text: `Emitido em ${new Date().toLocaleString('pt-BR')}`,
          style: 'rodape',
        },
      ],
      styles: {
        clinica: { fontSize: 18, bold: true, color: '#2563eb', margin: [0, 0, 0, 4] },
        medico: { fontSize: 11, color: '#475569', margin: [0, 0, 0, 10] },
        titulo: { fontSize: 14, bold: true, decoration: 'underline', margin: [0, 0, 0, 8] },
        rodape: {
          fontSize: 9,
          color: '#94a3b8',
          alignment: 'center',
          margin: [0, 4, 0, 0],
        },
      },
      defaultStyle: { fontSize: 11, lineHeight: 1.4 },
    }

    // Gerar blob PDF
    const pdfBlob: Blob = await new Promise((resolve) => {
      pdfMake.createPdf(docDef).getBlob((blob: Blob) => resolve(blob))
    })

    // Upload para Supabase Storage
    const timestamp = Date.now()
    const path = `documentos/${consultaId}/${tipo}_${timestamp}.pdf`

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documentos')
      .upload(path, pdfBlob, {
        contentType: 'application/pdf',
        upsert: false,
      })

    if (uploadError) {
      console.error('Erro upload PDF:', uploadError)
      throw new Error(`Falha no upload do PDF: ${uploadError.message}`)
    }

    // O bucket é privado — guardamos o path e resolvemos uma signed URL
    // sob demanda (ver resolverUrlAssinada), nunca uma URL pública fixa.
    return path
  }

  /**
   * Resolve um path do storage (ou link externo, ex: Memed) numa URL
   * utilizável. Links externos (http/https) passam direto; paths internos
   * viram uma signed URL de curta duração — nunca ficam permanentemente
   * acessíveis.
   */
  async function resolverUrlAssinada(pathOuLink: string, expiresInSeg = 600): Promise<string | null> {
    if (/^https?:\/\//i.test(pathOuLink)) return pathOuLink
    const { data, error } = await supabase.storage.from('documentos').createSignedUrl(pathOuLink, expiresInSeg)
    if (error) {
      console.error('Erro ao gerar signed URL:', error)
      return null
    }
    return data?.signedUrl ?? null
  }

  async function salvarDocumento(opts: {
    consultaId: string | null
    agendamentoId?: string | null
    medicoId: string
    pacienteId: string
    tipo: DocumentoTipo
    conteudo: Record<string, unknown>
    pdfUrl: string | null
  }) {
    const linkAcesso = crypto.randomUUID()
    const linkExpiraEm = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    return supabase.from('documentos').insert({
      consulta_id: opts.consultaId,
      agendamento_id: opts.agendamentoId ?? null,
      medico_id: opts.medicoId,
      paciente_id: opts.pacienteId,
      tipo: opts.tipo,
      conteudo: opts.conteudo,
      pdf_url: opts.pdfUrl,
      status: 'gerado',
      link_acesso: linkAcesso,
      link_expira_em: linkExpiraEm,
    })
  }

  // ---------- Construtores de corpo PDF por tipo ----------
  function corpoAtestado(c: any) {
    const linhas: any[] = []
    linhas.push({
      text: `Atesto, para os devidos fins, que o(a) paciente acima identificado(a) necessita de afastamento de suas atividades por ${c.dias ?? c.dias_afastamento ?? '—'} dia(s), a partir desta data.`,
      margin: [0, 0, 0, 8],
    })
    if (c.cid) linhas.push({ text: `CID: ${c.cid}`, margin: [0, 0, 0, 6] })
    if (c.descricao || c.observacoes) linhas.push({ text: c.descricao ?? c.observacoes })
    return { titulo: 'ATESTADO MÉDICO', corpo: linhas }
  }

  function corpoPedidoExame(c: any) {
    const exames: string[] = (c.exames ?? []).filter((e: string) => e?.trim())
    const corpo: any[] = [
      { text: 'Solicito a realização do(s) exame(s):', margin: [0, 0, 0, 6] },
      { ul: exames.length ? exames : ['—'], margin: [0, 0, 0, 10] },
    ]
    if (c.indicacaoClinica || c.orientacoes) {
      corpo.push({ text: 'Indicação clínica:', bold: true, margin: [0, 6, 0, 4] })
      corpo.push({ text: c.indicacaoClinica ?? c.orientacoes })
    }
    return { titulo: 'PEDIDO DE EXAME', corpo }
  }

  function corpoReceita(c: any) {
    const meds: any[] = c.medicamentos ?? c.itens ?? []
    const corpo: any[] = []
    meds.forEach((m, i) => {
      corpo.push({
        text: `${i + 1}. ${m.nome ?? m.medicamento ?? '—'}`,
        bold: true,
        margin: [0, i === 0 ? 0 : 8, 0, 2],
      })
      if (m.posologia) corpo.push({ text: `   Posologia: ${m.posologia}` })
      if (m.quantidade) corpo.push({ text: `   Quantidade: ${m.quantidade}` })
    })
    return { titulo: 'RECEITA MÉDICA', corpo }
  }

  function corpoReceitaControlada(c: any) {
    const corpo: any[] = [
      { text: c.medicamento ?? '—', bold: true, fontSize: 13, margin: [0, 0, 0, 6] },
      { text: `Posologia: ${c.posologia ?? '—'}` },
      { text: `Quantidade: ${c.quantidade ?? '—'}`, margin: [0, 0, 0, 6] },
    ]
    if (c.observacoes) corpo.push({ text: 'Observações:', bold: true, margin: [0, 6, 0, 2] }, { text: c.observacoes })
    corpo.push({ text: '\nReceita de medicamento controlado — uso conforme legislação vigente.', italics: true, fontSize: 9, color: '#64748b', margin: [0, 12, 0, 0] })
    return { titulo: 'RECEITA DE MEDICAMENTO CONTROLADO', corpo }
  }

  function corpoEncaminhamento(c: any) {
    const corpo: any[] = [
      { text: `Encaminho o(a) paciente para avaliação em: ${c.especialidade ?? c.especialidade_destino ?? '—'}`, margin: [0, 0, 0, 8] },
    ]
    if (c.hipoteseDiagnostica || c.motivo) {
      corpo.push({ text: 'Hipótese diagnóstica / Motivo:', bold: true, margin: [0, 0, 0, 4] })
      corpo.push({ text: c.hipoteseDiagnostica ?? c.motivo, margin: [0, 0, 0, 8] })
    }
    if (c.resumoClinico) {
      corpo.push({ text: 'Resumo clínico:', bold: true, margin: [0, 0, 0, 4] })
      corpo.push({ text: c.resumoClinico })
    }
    return { titulo: 'ENCAMINHAMENTO MÉDICO', corpo }
  }

  function corpoDeclaracao(c: any) {
    const data = new Date().toLocaleDateString('pt-BR')
    const corpo: any[] = [
      {
        text: `Declaro, para os devidos fins, que o(a) paciente acima identificado(a) compareceu a esta consulta em ${data}` +
          (c.horaInicio || c.horaFim ? `, no período das ${c.horaInicio ?? '—'} às ${c.horaFim ?? '—'}.` : '.'),
      },
    ]
    if (c.finalidade) corpo.push({ text: '\nFinalidade: ' + c.finalidade })
    return { titulo: 'DECLARAÇÃO DE COMPARECIMENTO', corpo }
  }

  function montarCorpo(tipo: DocumentoTipo, conteudo: any) {
    switch (tipo) {
      case 'atestado': return corpoAtestado(conteudo)
      case 'pedido_exame': return corpoPedidoExame(conteudo)
      case 'receita': return corpoReceita(conteudo)
      case 'receita_controlada': return corpoReceitaControlada(conteudo)
      case 'encaminhamento': return corpoEncaminhamento(conteudo)
      case 'declaracao': return corpoDeclaracao(conteudo)
    }
  }

  /**
   * Gera PDF, faz upload e salva o documento.
   * Retorna { ok, pdfUrl, doc } para feedback no formulário — pdfUrl aqui é
   * o PATH no storage privado, não uma URL utilizável; use
   * resolverUrlAssinada(pdfUrl) para abrir/exibir o arquivo.
   */
  async function gerarESalvar(opts: {
    tipo: DocumentoTipo
    conteudo: any
    paciente: { id: string, nome: string, cpf: string, data_nascimento?: string | null, sus_cartao?: string | null }
    medico: { id: string, nome: string, crm: string, especialidade: string, assinatura_url?: string | null }
    agendamentoId: string  // usado para nomear o arquivo (não vai para a coluna consulta_id)
  }): Promise<{ ok: boolean, pdfUrl: string | null, error?: string }> {
    try {
      const { titulo, corpo } = montarCorpo(opts.tipo, opts.conteudo) ?? { titulo: '', corpo: [] }

      // gerarEFazerUpload lança erro se o upload falhar (não retorna null)
      const pdfUrl = await gerarEFazerUpload({
        tipo: opts.tipo,
        consultaId: opts.agendamentoId,
        paciente: opts.paciente as any,
        medico: opts.medico as any,
        titulo,
        corpo,
      })

      if (!pdfUrl) {
        return { ok: false, pdfUrl: null, error: 'URL do PDF não retornada pelo storage' }
      }

      // Salva no banco vinculado ao agendamento. consulta_id será preenchido
      // quando o médico encerrar a consulta (vide encerrarConsulta).
      const { error } = await salvarDocumento({
        consultaId: null,
        agendamentoId: opts.agendamentoId,
        medicoId: opts.medico.id,
        pacienteId: opts.paciente.id,
        tipo: opts.tipo,
        conteudo: opts.conteudo,
        pdfUrl,
      })

      if (error) return { ok: false, pdfUrl: null, error: error.message }
      return { ok: true, pdfUrl }
    } catch (err: any) {
      return { ok: false, pdfUrl: null, error: err?.message ?? 'Erro ao gerar documento' }
    }
  }

  /**
   * Salva um documento gerado fora do sistema (ex: Memed) — sem gerar PDF,
   * apenas registra o link informado pelo médico como pdf_url.
   */
  async function salvarDocumentoExterno(opts: {
    tipo: DocumentoTipo
    medicoId: string
    pacienteId: string
    agendamentoId: string
    link: string
  }): Promise<{ ok: boolean, error?: string }> {
    if (!/^https?:\/\//i.test(opts.link.trim())) {
      return { ok: false, error: 'Cole um link válido (começando com http:// ou https://)' }
    }
    const { error } = await salvarDocumento({
      consultaId: null,
      agendamentoId: opts.agendamentoId,
      medicoId: opts.medicoId,
      pacienteId: opts.pacienteId,
      tipo: opts.tipo,
      conteudo: { origem: 'memed', link: opts.link.trim() },
      pdfUrl: opts.link.trim(),
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  }

  return { gerarEFazerUpload, salvarDocumento, gerarESalvar, salvarDocumentoExterno, resolverUrlAssinada, formatarCPF, calcularIdade }
}
