ALTER TABLE login
    ADD COLUMN IF NOT EXISTS provisionalPasswordEncrypted TEXT NULL AFTER mustChangePassword;
