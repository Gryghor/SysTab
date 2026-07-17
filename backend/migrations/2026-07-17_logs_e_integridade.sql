-- Migração: tabela de auditoria (logs) + correção de integridade em `tablets`
-- Rode este script uma única vez no banco `systab` (ex: via phpMyAdmin ou `mysql < arquivo.sql`).
--
-- Contexto: investigação mostrou tablets sendo cadastrados/editados sem dono (idUser NULL)
-- por (1) falta de indicação/erro claro no cadastro quando o usuário já possui tablet e
-- (2) ausência de qualquer histórico de reatribuição de dono. Este script:
--   1) remove uma FK duplicada/conflitante em tablets.idUser;
--   2) adiciona uma trava de unicidade em tablets.idUser (permite múltiplos NULL, mas nunca
--      dois tablets com o mesmo dono) como última linha de defesa contra condição de corrida;
--   3) cria a tabela `logs` usada pelo novo sistema de auditoria.

-- 1) e 2): `tablets_ibfk_1` duplicava `fk_usuario` na mesma coluna com ON DELETE diferente
-- (comportamento indefinido). Substituímos o índice não-único por um UNIQUE KEY.
ALTER TABLE `tablets`
  DROP FOREIGN KEY `tablets_ibfk_1`,
  DROP INDEX `idUser`,
  ADD UNIQUE KEY `idUser` (`idUser`);

-- 3) Tabela de auditoria
CREATE TABLE IF NOT EXISTS `logs` (
  `idLog` int(11) NOT NULL AUTO_INCREMENT,
  `acao` varchar(50) NOT NULL,
  `entidade` varchar(50) NOT NULL,
  `entidadeId` int(11) DEFAULT NULL,
  `idLoginResponsavel` int(11) DEFAULT NULL,
  `nomeResponsavel` varchar(100) DEFAULT NULL,
  `detalhes` text DEFAULT NULL,
  `dataHora` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`idLog`),
  KEY `idx_logs_entidade` (`entidade`,`entidadeId`),
  KEY `idx_logs_dataHora` (`dataHora`),
  KEY `idx_logs_responsavel` (`idLoginResponsavel`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
