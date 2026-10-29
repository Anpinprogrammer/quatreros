-- Verificación de integridad tras restaurar (deployment-design §4).
-- Cada control se ejecuta solo si su tabla existe (los módulos se agregan con el tiempo).
\set ON_ERROR_STOP on

DO $$
DECLARE
  n bigint;
BEGIN
  -- 1. Migraciones aplicadas
  SELECT count(*) INTO n FROM drizzle.__drizzle_migrations;
  RAISE NOTICE 'Migraciones aplicadas: %', n;

  -- 2. Auditoría presente y protegida
  IF to_regclass('audit.audit_log') IS NOT NULL THEN
    SELECT count(*) INTO n FROM audit.audit_log;
    RAISE NOTICE 'Registros de auditoría: %', n;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_log_append_only') THEN
      RAISE EXCEPTION 'Falta el trigger append-only de auditoría';
    END IF;
  END IF;

  -- 3. Saldos de inventario = suma del kardex (ADR-009) — cuando exista el módulo de inventario
  IF to_regclass('inventory.stock_balances') IS NOT NULL THEN
    SELECT count(*) INTO n FROM (
      SELECT b.lot_id, b.presentation_id, b.location_id
      FROM inventory.stock_balances b
      LEFT JOIN (
        SELECT lot_id, presentation_id, location_id, sum(quantity) AS q
        FROM inventory.stock_movements GROUP BY 1, 2, 3
      ) m USING (lot_id, presentation_id, location_id)
      WHERE b.quantity <> coalesce(m.q, 0)
    ) d;
    IF n > 0 THEN RAISE EXCEPTION 'Saldos que no cuadran con el kardex: %', n; END IF;
    RAISE NOTICE 'Saldos vs. kardex: OK';
  END IF;

  -- 4. Asientos balanceados (BR-201) — cuando exista el módulo contable
  IF to_regclass('accounting.journal_lines') IS NOT NULL THEN
    SELECT count(*) INTO n FROM (
      SELECT entry_id FROM accounting.journal_lines GROUP BY entry_id HAVING sum(debit) <> sum(credit)
    ) d;
    IF n > 0 THEN RAISE EXCEPTION 'Asientos desbalanceados: %', n; END IF;
    RAISE NOTICE 'Asientos balanceados: OK';
  END IF;
END $$;
