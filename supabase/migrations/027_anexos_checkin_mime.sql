-- Permite anexar exames/documentos (imagem ou PDF) no check-in, além dos
-- PDFs gerados pelo próprio sistema — o bucket só aceitava application/pdf.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
WHERE id = 'documentos';
