ALTER TABLE chamados
    ADD COLUMN IF NOT EXISTS idLoginCriador INT NULL AFTER regionalSnapshot,
    ADD COLUMN IF NOT EXISTS nomeCriadorSnapshot VARCHAR(100) NULL AFTER idLoginCriador;
