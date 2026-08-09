import nodemailer from 'nodemailer'
import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const body = await readBody(event)
  const { documentoId, canal, telefone, email } = body as {
    documentoId: string
    canal: 'whatsapp' | 'email' | 'ambos'
    telefone?: string
    email?: string
  }

  if (!documentoId || !canal) {
    throw createError({ statusCode: 400, statusMessage: 'documentoId e canal são obrigatórios' })
  }

  const supabase = await serverSupabaseClient(event)

  // Busca o documento com link de acesso e tipo
  const { data: doc, error: docError } = await supabase
    .from('documentos')
    .select('id, tipo, link_acesso, pdf_url, pacientes(nome)')
    .eq('id', documentoId)
    .single()

  if (docError || !doc) {
    throw createError({ statusCode: 404, statusMessage: 'Documento não encontrado' })
  }

  const TIPOS_LABELS: Record<string, string> = {
    atestado: 'Atestado Médico',
    pedido_exame: 'Pedido de Exame',
    receita: 'Receita Médica',
    receita_controlada: 'Receita Controlada',
    encaminhamento: 'Encaminhamento',
    declaracao: 'Declaração de Comparecimento',
  }

  const tipoLabel = TIPOS_LABELS[doc.tipo] ?? doc.tipo
  const pacienteNome = (doc.pacientes as any)?.nome ?? 'Paciente'

  // URL de acesso ao documento (link com token de 7 dias)
  const baseUrl = process.env.NUXT_PUBLIC_SITE_URL ?? process.env.BASE_URL ?? 'http://localhost:3000'
  const linkDoc = doc.link_acesso
    ? `${baseUrl}/doc/${doc.link_acesso}`
    : doc.pdf_url ?? ''

  const mensagemTexto =
    `Olá, ${pacienteNome}! Seu *${tipoLabel}* foi emitido pela clínica SoMedicos.\n\n` +
    `Acesse pelo link abaixo (válido por 7 dias):\n${linkDoc}\n\n` +
    `Em caso de dúvidas, entre em contato com a clínica.`

  let whatsappUrl: string | null = null
  const erros: string[] = []

  // ── WhatsApp (wa.me deep-link) ────────────────────────────────────────────
  if (canal === 'whatsapp' || canal === 'ambos') {
    if (telefone) {
      const numero = telefone.replace(/\D/g, '')
      const numeroInternacional = numero.startsWith('55') ? numero : `55${numero}`
      const mensagemEncoded = encodeURIComponent(mensagemTexto)
      whatsappUrl = `https://wa.me/${numeroInternacional}?text=${mensagemEncoded}`
    } else {
      erros.push('Número de telefone não informado para WhatsApp')
    }
  }

  // ── E-mail (nodemailer via SMTP) ──────────────────────────────────────────
  if (canal === 'email' || canal === 'ambos') {
    if (!email) {
      erros.push('E-mail do paciente não informado')
    } else if (!config.smtpHost || !config.smtpUser || !config.smtpPass) {
      erros.push('SMTP não configurado (verifique SMTP_HOST, SMTP_USER, SMTP_PASS no .env)')
    } else {
      try {
        const transporter = nodemailer.createTransport({
          host: config.smtpHost,
          port: Number(config.smtpPort),
          secure: Number(config.smtpPort) === 465,
          auth: { user: config.smtpUser, pass: config.smtpPass },
        })

        await transporter.sendMail({
          from: config.smtpFrom,
          to: email,
          subject: `SoMedicos — Seu ${tipoLabel} está disponível`,
          text: mensagemTexto,
          html: `
            <div style="font-family:sans-serif;max-width:520px;margin:auto;background:#f8fafc;border-radius:12px;overflow:hidden">
              <div style="background:#2563eb;padding:24px 28px">
                <h2 style="color:white;margin:0;font-size:18px">SoMedicos — Teleconsultas</h2>
              </div>
              <div style="padding:28px">
                <p style="margin:0 0 16px;font-size:15px;color:#1e293b">
                  Olá, <strong>${pacienteNome}</strong>!
                </p>
                <p style="margin:0 0 24px;color:#475569;font-size:14px;line-height:1.6">
                  Seu <strong>${tipoLabel}</strong> foi emitido pela clínica SoMedicos
                  e está disponível para acesso pelo link abaixo.
                  O link é válido por <strong>7 dias</strong>.
                </p>
                <a
                  href="${linkDoc}"
                  style="display:inline-block;background:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px"
                >
                  Acessar documento →
                </a>
                <p style="margin:24px 0 0;color:#94a3b8;font-size:12px">
                  Em caso de dúvidas, entre em contato com a clínica.<br>
                  Caso não reconheça este envio, ignore este e-mail.
                </p>
              </div>
            </div>
          `,
        })
      } catch (err: any) {
        erros.push(`Falha ao enviar e-mail: ${err.message}`)
      }
    }
  }

  // Atualiza status no banco — mesmo que haja erros parciais
  const enviadoVia = canal === 'ambos'
    ? (whatsappUrl ? 'whatsapp' : 'email')
    : canal === 'whatsapp' ? 'whatsapp' : 'email'

  await supabase
    .from('documentos')
    .update({ status: 'enviado_paciente', enviado_via: enviadoVia })
    .eq('id', documentoId)

  return {
    success: erros.length === 0,
    whatsappUrl,     // frontend abre numa nova aba quando não-null
    erros: erros.length ? erros : undefined,
  }
})
