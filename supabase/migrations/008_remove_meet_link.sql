-- Remove dependência do Google Meet — videochamadas agora são via Jitsi integrado
ALTER TABLE medicos ALTER COLUMN meet_link DROP NOT NULL;
ALTER TABLE medicos ALTER COLUMN meet_link SET DEFAULT '';
