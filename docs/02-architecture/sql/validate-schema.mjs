// Valida preliminary-schema.sql en PostgreSQL embebido (PGlite) y prueba restricciones clave.
// Uso: npm i @electric-sql/pglite@0.5 && node validate-schema.mjs preliminary-schema.sql
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
const db = new PGlite();
const sql = fs.readFileSync(process.argv[2], 'utf8');
await db.exec(sql);
const r = await db.query(
  `select table_schema, count(*)::int n from information_schema.tables where table_schema not in ('pg_catalog','information_schema') group by 1 order by 1`,
);
console.log('Tablas por esquema:', r.rows.map((x) => `${x.table_schema}=${x.n}`).join(' '));
const test = async (name, q, expectFail) => {
  try {
    await db.exec(q);
    console.log(expectFail ? `FAIL (debió fallar): ${name}` : `OK: ${name}`);
  } catch (e) {
    console.log(
      expectFail ? `OK (rechazado): ${name} -> ${e.message.split('\n')[0]}` : `FAIL: ${name} -> ${e.message}`,
    );
  }
};
await db.exec(`
insert into admin.sites(id,name,kind) values ('00000000-0000-0000-0000-000000000001','Bodega','warehouse');
insert into admin.locations(id,site_id,name,kind) values ('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000001','Principal','warehouse');
insert into admin.users(id,auth_user_id,full_name,email) values
 ('00000000-0000-0000-0000-000000000100','a1','Admin','a@x.co'),('00000000-0000-0000-0000-000000000101','a2','Cajero','c@x.co');
insert into catalog.products(id,name,kind,base_unit,shelf_life_days) values ('00000000-0000-0000-0000-000000000200','Chorizo','manufactured','unidad',10);
insert into catalog.presentations(id,product_id,name,units_per) values ('00000000-0000-0000-0000-000000000300','00000000-0000-0000-0000-000000000200','Paquete x10',10);
insert into inventory.lots(id,code,lot_type,product_id,manufactured_on,expires_on) values ('00000000-0000-0000-0000-000000000400','PT-1','finished_good','00000000-0000-0000-0000-000000000200','2026-10-20','2026-10-30');
insert into inventory.stock_balances(lot_id,presentation_id,location_id,quantity) values ('00000000-0000-0000-0000-000000000400','00000000-0000-0000-0000-000000000300','00000000-0000-0000-0000-000000000010',5);
insert into inventory.stock_movements(movement_type,lot_id,presentation_id,location_id,quantity,base_quantity,source_type,source_id,created_by)
 values ('opening_balance','00000000-0000-0000-0000-000000000400','00000000-0000-0000-0000-000000000300','00000000-0000-0000-0000-000000000010',5,50,'opening_balance',gen_random_uuid(),'00000000-0000-0000-0000-000000000100');
insert into catalog.price_history(presentation_id,price,set_by) values ('00000000-0000-0000-0000-000000000300',12000,'00000000-0000-0000-0000-000000000100');
`);
await test('Saldo negativo (BR-081)', `update inventory.stock_balances set quantity = -1`, true);
await test(
  'Duplicado de saldo por lote/presentación/ubicación',
  `insert into inventory.stock_balances(lot_id,presentation_id,location_id,quantity) values ('00000000-0000-0000-0000-000000000400','00000000-0000-0000-0000-000000000300','00000000-0000-0000-0000-000000000010',1)`,
  true,
);
await test('Editar movimiento del kardex', `update inventory.stock_movements set quantity = 9`, true);
await test('Borrar movimiento del kardex', `delete from inventory.stock_movements`, true);
await test(
  'Dos precios vigentes (BR-022)',
  `insert into catalog.price_history(presentation_id,price,set_by) values ('00000000-0000-0000-0000-000000000300',13000,'00000000-0000-0000-0000-000000000100')`,
  true,
);
await test(
  'Lote con vencimiento antes de fabricación',
  `insert into inventory.lots(code,lot_type,product_id,manufactured_on,expires_on) values ('PT-2','finished_good','00000000-0000-0000-0000-000000000200','2026-10-20','2026-10-01')`,
  true,
);
await db.exec(`insert into pos.cash_registers(id,site_id,name,goods_location_id) values ('00000000-0000-0000-0000-000000000500','00000000-0000-0000-0000-000000000001','Caja 1','00000000-0000-0000-0000-000000000010');
insert into pos.shifts(cash_register_id,cashier_id,opening_float) values ('00000000-0000-0000-0000-000000000500','00000000-0000-0000-0000-000000000101',100000);`);
await test(
  'Segundo turno abierto misma caja (BR-141)',
  `insert into pos.shifts(cash_register_id,cashier_id,opening_float) values ('00000000-0000-0000-0000-000000000500','00000000-0000-0000-0000-000000000100',0)`,
  true,
);
await test(
  'Cierre con diferencia sin justificación (BR-145)',
  `update pos.shifts set status='closed_with_variance', variance=-5000`,
  true,
);
await test('Cajero revisa su propio turno (BR-004)', `update pos.shifts set reviewed_by=cashier_id`, true);
await test(
  'Auditoría: borrar registro',
  `insert into audit.audit_log(channel,action,entity_type,entity_id) values ('web','x','y','1'); delete from audit.audit_log`,
  true,
);
await db.exec(`insert into admin.permissions(code,description) values ('fin.credit_override.approve','x');
insert into admin.approval_policies(code,description,approver_permission,is_mandatory) values ('AP-01','x','fin.credit_override.approve',true);`);
await test(
  'Desactivar política obligatoria AP-01',
  `update admin.approval_policies set is_active=false where code='AP-01'`,
  true,
);
await test(
  'Aprobador = solicitante (BR-004)',
  `insert into admin.approval_requests(policy_code,site_id,requested_by,channel,operation,payload,payload_hash,reason,expires_at,decided_by) values ('AP-01','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000100','web','x','{}','h','r',now(),'00000000-0000-0000-0000-000000000100')`,
  true,
);
await db.exec(`insert into accounting.periods(id,starts_on,ends_on) values ('00000000-0000-0000-0000-000000000600','2026-10-01','2026-10-31');
insert into accounting.accounts(id,code,name) values ('00000000-0000-0000-0000-000000000700','X1','Prueba A'),('00000000-0000-0000-0000-000000000701','X2','Prueba B');`);
await test(
  'Asiento desbalanceado (BR-201)',
  `begin; insert into accounting.journal_entries(id,number,period_id,entry_date,description,created_by) values ('00000000-0000-0000-0000-000000000800','A1','00000000-0000-0000-0000-000000000600','2026-10-29','t','00000000-0000-0000-0000-000000000100');
insert into accounting.journal_lines(entry_id,account_id,debit) values ('00000000-0000-0000-0000-000000000800','00000000-0000-0000-0000-000000000700',100);
insert into accounting.journal_lines(entry_id,account_id,credit) values ('00000000-0000-0000-0000-000000000800','00000000-0000-0000-0000-000000000701',90); commit;`,
  true,
);
await db.exec('rollback').catch(() => {});
await test(
  'Asiento balanceado',
  `begin; insert into accounting.journal_entries(id,number,period_id,entry_date,description,created_by) values ('00000000-0000-0000-0000-000000000801','A2','00000000-0000-0000-0000-000000000600','2026-10-29','t','00000000-0000-0000-0000-000000000100');
insert into accounting.journal_lines(entry_id,account_id,debit) values ('00000000-0000-0000-0000-000000000801','00000000-0000-0000-0000-000000000700',100);
insert into accounting.journal_lines(entry_id,account_id,credit) values ('00000000-0000-0000-0000-000000000801','00000000-0000-0000-0000-000000000701',100); commit;`,
  false,
);
await db.exec(`update accounting.periods set status='closed'`);
await test(
  'Asiento en período cerrado (BR-202)',
  `insert into accounting.journal_entries(number,period_id,entry_date,description,created_by) values ('A3','00000000-0000-0000-0000-000000000600','2026-10-29','t','00000000-0000-0000-0000-000000000100')`,
  true,
);
await db.exec(`insert into pos.kitchen_periods(id,kitchen_location_id,period_start) values ('00000000-0000-0000-0000-000000000900','00000000-0000-0000-0000-000000000010',now());
insert into pos.kitchen_counts(period_id,product_id,opening_qty,inbound_qty,closing_qty,theoretical_qty) values ('00000000-0000-0000-0000-000000000900','00000000-0000-0000-0000-000000000200',40,20,15,42);`);
const k = await db.query(`select variance_qty from pos.kitchen_counts`);
console.log('Diferencia de cocina (esperado 3):', k.rows[0].variance_qty);
