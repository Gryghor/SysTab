-- Preferência administrativa para permitir cadastros sem CPF.
-- O valor inicial 1 preserva a regra atual até que um administrador altere o toggle.

CREATE TABLE IF NOT EXISTS `configuracoes` (
  `chave` varchar(100) NOT NULL,
  `valor` varchar(255) NOT NULL,
  `atualizadoEm` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`chave`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `configuracoes` (`chave`, `valor`)
VALUES ('cpf_obrigatorio', '1')
ON DUPLICATE KEY UPDATE `chave` = `chave`;

ALTER TABLE `usuarios`
  MODIFY COLUMN `cpf` varchar(14) NULL;
