-- SysTAB: garante nomes únicos para contas de acesso criadas pelo administrador.
-- Antes de aplicar, a consulta abaixo deve retornar zero linhas:
-- SELECT nome, COUNT(*) FROM login GROUP BY nome HAVING COUNT(*) > 1;

ALTER TABLE `login`
  ADD UNIQUE KEY `uq_login_nome` (`nome`);
