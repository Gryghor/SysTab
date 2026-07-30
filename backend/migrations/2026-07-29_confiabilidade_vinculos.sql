-- SysTAB: confiabilidade de vínculos, concorrência e histórico de chamados.
-- IMPORTANTE: executar somente após backup e validação dos tablets atualmente sem usuário.
-- A migração não restaura vínculos antigos e não preenche snapshots históricos automaticamente.
-- MariaDB confirma ALTER TABLE com commit implícito; por isso backup e janela de manutenção são obrigatórios.

-- Controle otimista de concorrência. Toda alteração do tablet incrementa esta versão.
ALTER TABLE `tablets`
  ADD COLUMN IF NOT EXISTS `rowVersion` int unsigned NOT NULL DEFAULT 1 AFTER `idEmp`;

-- Excluir um usuário vinculado passa a ser proibido pelo próprio banco.
ALTER TABLE `tablets`
  DROP FOREIGN KEY `fk_usuario`;

-- O MariaDB exige nomes de constraints únicos no schema e pode rejeitar a
-- reutilização do nome no mesmo ALTER TABLE (errno 121).
ALTER TABLE `tablets`
  ADD CONSTRAINT `fk_tablets_usuario`
  FOREIGN KEY (`idUser`) REFERENCES `usuarios` (`idUser`)
  ON UPDATE RESTRICT ON DELETE RESTRICT;

-- Histórico imutável de toda mudança de responsável do tablet.
CREATE TABLE `tablet_usuario_historico` (
  `idHistorico` bigint unsigned NOT NULL AUTO_INCREMENT,
  `idTab` int NOT NULL,
  `idTombSnapshot` int NOT NULL,
  `idUserAnterior` int DEFAULT NULL,
  `nomeUserAnterior` varchar(100) DEFAULT NULL,
  `idUserNovo` int DEFAULT NULL,
  `nomeUserNovo` varchar(100) DEFAULT NULL,
  `idLoginResponsavel` int DEFAULT NULL,
  `acao` varchar(40) NOT NULL,
  `motivo` varchar(500) NOT NULL,
  `rowVersionAnterior` int unsigned NOT NULL,
  `rowVersionNova` int unsigned NOT NULL,
  `dataHora` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`idHistorico`),
  KEY `idx_historico_tablet_data` (`idTab`, `dataHora`),
  KEY `idx_historico_usuario_anterior` (`idUserAnterior`),
  KEY `idx_historico_usuario_novo` (`idUserNovo`),
  KEY `idx_historico_responsavel` (`idLoginResponsavel`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Fotografia do responsável no momento em que o chamado é aberto.
ALTER TABLE `chamados`
  ADD COLUMN `idUserOriginal` int DEFAULT NULL AFTER `idTab`,
  ADD COLUMN `nomeUserSnapshot` varchar(100) DEFAULT NULL AFTER `idUserOriginal`,
  ADD COLUMN `telUserSnapshot` varchar(20) DEFAULT NULL AFTER `nomeUserSnapshot`,
  ADD COLUMN `cpfSnapshot` varchar(14) DEFAULT NULL AFTER `telUserSnapshot`,
  ADD COLUMN `idUnidadeSnapshot` int DEFAULT NULL AFTER `cpfSnapshot`,
  ADD COLUMN `nomeUnidadeSnapshot` varchar(120) DEFAULT NULL AFTER `idUnidadeSnapshot`,
  ADD COLUMN `regionalSnapshot` int DEFAULT NULL AFTER `nomeUnidadeSnapshot`,
  ADD KEY `idx_chamados_usuario_original` (`idUserOriginal`);

-- Validações pós-migração sugeridas:
-- SELECT COUNT(*) FROM tablets WHERE idUser IS NULL; -- não deve mudar até revisão manual
-- SELECT idUser, COUNT(*) FROM tablets WHERE idUser IS NOT NULL GROUP BY idUser HAVING COUNT(*) > 1;
-- SHOW CREATE TABLE tablets;
-- SHOW CREATE TABLE chamados;
