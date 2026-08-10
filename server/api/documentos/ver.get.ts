import { createClient } from '@supabase/supabase-js'

// Único portão de acesso público a um documento: valida o token
// (link_acesso) e a expiração antes de gerar uma signed URL de vida
// curta para o arquivo, que fica num bucket privado.
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const query = getQuery(event)
  const token = query.token as string | undefined

  if (!token) {
    throw createError({ statusCode: 400, statusMessage: 'Token não informado' })
  }

  const supabaseUrl = process.env.SUPABASE_URL!
  const serviceKey = config.supabaseServiceKey
  if (!serviceKey) {
    throw createError({ statusCode: 500, statusMessage: 'Service key não configurada' })
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: doc, error } = await admin
    .from('documentos')
    .select('pdf_url, tipo, link_expira_em')
    .eq('link_acesso', token)
    .maybeSingle()

  if (error || !doc) {
    return { expirado: true }
  }
  if (doc.link_expira_em && new Date(doc.link_expira_em) < new Date()) {
    return { expirado: true }
  }
  if (!doc.pdf_url) {
    return { expirado: true }
  }

  // Link externo (ex: Memed) — não é um path do nosso storage, usa direto.
  if (/^https?:\/\//i.test(doc.pdf_url)) {
    return { expirado: false, tipo: doc.tipo, pdf_url: doc.pdf_url }
  }

  const { data: signed, error: signError } = await admin.storage
    .from('documentos')
    .createSignedUrl(doc.pdf_url, 600) // 10 min — a página busca de novo se recarregar

  if (signError || !signed) {
    throw createError({ statusCode: 500, statusMessage: 'Erro ao gerar acesso ao documento' })
  }

  return { expirado: false, tipo: doc.tipo, pdf_url: signed.signedUrl }
})
