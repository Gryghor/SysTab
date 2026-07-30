-- SysTAB: status das contas e revogação imediata de sessões.
-- Aplicar depois de 2026-07-29_contas_acesso.sql.

ALTER TABLE `login`
  ADD COLUMN IF NOT EXISTS `ativo` tinyint(1) NOT NULL DEFAULT 1 AFTER `nivel`,
  ADD COLUMN IF NOT EXISTS `tokenVersion` int unsigned NOT NULL DEFAULT 0 AFTER `ativo`;
