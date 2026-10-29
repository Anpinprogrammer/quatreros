-- =====================================================================
-- Quatreros — Esquema relacional PRELIMINAR (Etapa C, v0.1, 2026-10-29)
-- NO es una migración definitiva. Sirve para validar el diseño.
-- Las migraciones reales se generan y revisan en Etapa F (ADR-005).
-- Excluido a propósito (BLOCKED): reglas de contabilización, impuestos,
-- plan de cuentas concreto, costeo (P-01..P-04), liquidación (P-08),
-- clasificación de cocina (P-07), descuentos/anulaciones POS (P-09).
-- Requiere PostgreSQL 15+ (UNIQUE NULLS NOT DISTINCT).
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS admin;
CREATE SCHEMA IF NOT EXISTS catalog;
CREATE SCHEMA IF NOT EXISTS purchasing;
CREATE SCHEMA IF NOT EXISTS production;
CREATE SCHEMA IF NOT EXISTS inventory;
CREATE SCHEMA IF NOT EXISTS sales;
CREATE SCHEMA IF NOT EXISTS distribution;
CREATE SCHEMA IF NOT EXISTS pos;
CREATE SCHEMA IF NOT EXISTS finance;
CREATE SCHEMA IF NOT EXISTS accounting;
CREATE SCHEMA IF NOT EXISTS platform;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS assistant;
CREATE SCHEMA IF NOT EXISTS telegram;

-- Dominios reutilizables (ADR-008)
CREATE DOMAIN platform.money     AS NUMERIC(14,2);
CREATE DOMAIN platform.qty       AS NUMERIC(14,3);
CREATE DOMAIN platform.unit_cost AS NUMERIC(14,4);

-- Función genérica: prohíbe UPDATE/DELETE en tablas append-only (ADR-009, ADR-012)
CREATE OR REPLACE FUNCTION platform.forbid_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Tabla append-only: % no permitido en %', TG_OP, TG_TABLE_NAME;
END $$;

-- ---------------------------------------------------------------------
-- ADMIN
-- ---------------------------------------------------------------------
CREATE TABLE admin.sites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  kind        text NOT NULL CHECK (kind IN ('warehouse','point_of_sale')),
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE admin.locations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     uuid NOT NULL REFERENCES admin.sites(id),
  name        text NOT NULL,
  kind        text NOT NULL CHECK (kind IN
               ('warehouse','pos_goods','kitchen','in_transit','in_route','in_inspection','production')),
  is_active   boolean NOT NULL DEFAULT true,
  UNIQUE (site_id, name)
);

CREATE TABLE admin.users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id  text NOT NULL UNIQUE,          -- id en tablas de Better Auth (esquema auth)
  full_name     text NOT NULL,
  email         text NOT NULL UNIQUE,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE admin.roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,            -- ADM, MGR, COMP, PROD, DIST, CAJ, CONT, ...
  name        text NOT NULL,
  is_system   boolean NOT NULL DEFAULT false,
  requires_mfa boolean NOT NULL DEFAULT false,
  is_active   boolean NOT NULL DEFAULT true
);

CREATE TABLE admin.permissions (
  code        text PRIMARY KEY,                -- p. ej. 'inv.transfer.create'
  description text NOT NULL
);

CREATE TABLE admin.role_permissions (
  role_id          uuid NOT NULL REFERENCES admin.roles(id),
  permission_code  text NOT NULL REFERENCES admin.permissions(code),
  scope            text NOT NULL CHECK (scope IN ('ALL','SITE','OWN')),
  PRIMARY KEY (role_id, permission_code)
);

CREATE TABLE admin.user_roles (
  user_id uuid NOT NULL REFERENCES admin.users(id),
  role_id uuid NOT NULL REFERENCES admin.roles(id),
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE admin.user_sites (
  user_id uuid NOT NULL REFERENCES admin.users(id),
  site_id uuid NOT NULL REFERENCES admin.sites(id),
  PRIMARY KEY (user_id, site_id)
);

CREATE TABLE admin.approval_policies (
  code             text PRIMARY KEY,           -- AP-01 .. AP-10
  description      text NOT NULL,
  is_active        boolean NOT NULL DEFAULT true,
  is_mandatory     boolean NOT NULL DEFAULT false,  -- AP-01..03 no desactivables
  threshold_amount platform.money,             -- PENDING (Q-B-02)
  approver_permission text NOT NULL REFERENCES admin.permissions(code),
  expires_after    interval NOT NULL DEFAULT interval '24 hours',  -- PENDING (Q-B-03)
  CHECK (NOT (is_mandatory AND NOT is_active))
);

CREATE TABLE admin.approval_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_code     text NOT NULL REFERENCES admin.approval_policies(code),
  site_id         uuid NOT NULL REFERENCES admin.sites(id),
  requested_by    uuid NOT NULL REFERENCES admin.users(id),
  channel         text NOT NULL CHECK (channel IN ('web','assistant','telegram','system')),
  operation       text NOT NULL,               -- caso de uso, p. ej. 'sales.ConfirmOrder'
  payload         jsonb NOT NULL,              -- datos exactos de la operación
  payload_hash    text NOT NULL,
  reason          text NOT NULL,
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','approved','rejected','expired','consumed','failed')),
  decided_by      uuid REFERENCES admin.users(id),
  decided_at      timestamptz,
  decision_note   text,
  expires_at      timestamptz NOT NULL,
  consumed_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (decided_by IS NULL OR decided_by <> requested_by)        -- BR-004
);
CREATE INDEX approval_requests_pending_idx ON admin.approval_requests (site_id, status) WHERE status = 'pending';

-- ---------------------------------------------------------------------
-- CATALOG
-- ---------------------------------------------------------------------
CREATE TABLE catalog.products (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL UNIQUE,
  kind            text NOT NULL CHECK (kind IN ('manufactured','prepared')),
  base_unit       text NOT NULL,               -- 'unidad'
  shelf_life_days integer CHECK (shelf_life_days > 0),
  reorder_point   platform.qty CHECK (reorder_point >= 0),  -- BR-067 (PENDING criterio)
  is_active       boolean NOT NULL DEFAULT true,
  CHECK (kind = 'prepared' OR shelf_life_days IS NOT NULL)
);

CREATE TABLE catalog.presentations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid NOT NULL REFERENCES catalog.products(id),
  name          text NOT NULL,                 -- 'Unidad', 'Paquete x10'
  units_per     platform.qty NOT NULL CHECK (units_per > 0),   -- BR-020
  is_active     boolean NOT NULL DEFAULT true,
  UNIQUE (product_id, name)
);

CREATE TABLE catalog.price_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id uuid NOT NULL REFERENCES catalog.presentations(id),
  price           platform.money NOT NULL CHECK (price > 0),
  valid_from      timestamptz NOT NULL DEFAULT now(),
  valid_to        timestamptz,
  set_by          uuid NOT NULL REFERENCES admin.users(id),
  CHECK (valid_to IS NULL OR valid_to > valid_from)
);
-- BR-022: un único precio vigente por presentación
CREATE UNIQUE INDEX price_history_current_uq ON catalog.price_history (presentation_id) WHERE valid_to IS NULL;

CREATE TABLE catalog.raw_materials (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text NOT NULL UNIQUE,
  unit               text NOT NULL,            -- kg, unidad, m ...
  tracks_expiry      boolean NOT NULL DEFAULT false,
  reorder_point      platform.qty CHECK (reorder_point >= 0),
  is_active          boolean NOT NULL DEFAULT true
);

CREATE TABLE catalog.recipes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        text NOT NULL CHECK (kind IN ('production','dish')),
  product_id  uuid NOT NULL REFERENCES catalog.products(id),
  UNIQUE (kind, product_id)
);

CREATE TABLE catalog.recipe_versions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id         uuid NOT NULL REFERENCES catalog.recipes(id),
  version           integer NOT NULL CHECK (version > 0),
  base_output_qty   platform.qty NOT NULL CHECK (base_output_qty > 0),   -- en unidad base
  expected_yield_pct NUMERIC(5,2) CHECK (expected_yield_pct > 0 AND expected_yield_pct <= 100),
  tolerance_pct     NUMERIC(5,2) CHECK (tolerance_pct >= 0),
  is_current        boolean NOT NULL DEFAULT false,
  published_at      timestamptz NOT NULL DEFAULT now(),
  published_by      uuid NOT NULL REFERENCES admin.users(id),
  UNIQUE (recipe_id, version)
);
CREATE UNIQUE INDEX recipe_versions_current_uq ON catalog.recipe_versions (recipe_id) WHERE is_current;

CREATE TABLE catalog.recipe_lines (
  recipe_version_id uuid NOT NULL REFERENCES catalog.recipe_versions(id),
  raw_material_id   uuid REFERENCES catalog.raw_materials(id),
  product_id        uuid REFERENCES catalog.products(id),   -- platos: ingrediente fabricado (chorizo)
  quantity          platform.qty NOT NULL CHECK (quantity > 0),
  CHECK (num_nonnulls(raw_material_id, product_id) = 1),
  UNIQUE NULLS NOT DISTINCT (recipe_version_id, raw_material_id, product_id)
);

-- ---------------------------------------------------------------------
-- PURCHASING
-- ---------------------------------------------------------------------
CREATE TABLE purchasing.suppliers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  tax_id          text UNIQUE,
  phone           text,
  is_active       boolean NOT NULL DEFAULT true
);

CREATE TABLE purchasing.purchases (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number        text NOT NULL UNIQUE,          -- C-0418 (DR-005)
  supplier_id   uuid NOT NULL REFERENCES purchasing.suppliers(id),
  site_id       uuid NOT NULL REFERENCES admin.sites(id),
  purchased_on  date NOT NULL,
  total         platform.money NOT NULL CHECK (total >= 0),   -- sin desglose fiscal (BR-044 BLOCKED)
  status        text NOT NULL DEFAULT 'pending_receipt'
                CHECK (status IN ('pending_receipt','partially_received','received','closed_with_balance','voided')),
  attachment_key text,
  created_by    uuid NOT NULL REFERENCES admin.users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE purchasing.purchase_lines (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id     uuid NOT NULL REFERENCES purchasing.purchases(id),
  raw_material_id uuid NOT NULL REFERENCES catalog.raw_materials(id),
  quantity        platform.qty NOT NULL CHECK (quantity > 0),
  unit_cost       platform.unit_cost NOT NULL CHECK (unit_cost > 0),
  received_qty    platform.qty NOT NULL DEFAULT 0 CHECK (received_qty >= 0)
);

CREATE TABLE purchasing.receipts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number        text NOT NULL UNIQUE,
  purchase_id   uuid NOT NULL REFERENCES purchasing.purchases(id),
  location_id   uuid NOT NULL REFERENCES admin.locations(id),
  received_at   timestamptz NOT NULL DEFAULT now(),
  status        text NOT NULL DEFAULT 'posted' CHECK (status IN ('posted','reversed')),
  received_by   uuid NOT NULL REFERENCES admin.users(id)
);

-- ---------------------------------------------------------------------
-- INVENTORY (lotes, kardex, saldos) — ADR-009
-- ---------------------------------------------------------------------
CREATE TABLE inventory.lots (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                text NOT NULL UNIQUE,     -- MP-2026-0153 / PT-2026-0042
  lot_type            text NOT NULL CHECK (lot_type IN ('raw_material','finished_good')),
  product_id          uuid REFERENCES catalog.products(id),
  raw_material_id     uuid REFERENCES catalog.raw_materials(id),
  supplier_id         uuid REFERENCES purchasing.suppliers(id),
  receipt_id          uuid REFERENCES purchasing.receipts(id),
  production_order_id uuid,                     -- FK lógica a production.orders (evita ciclo)
  unit_cost           platform.unit_cost,       -- MP: costo de compra; PT: NULL hasta P-03
  manufactured_on     date,
  expires_on          date,
  status              text NOT NULL DEFAULT 'available'
                      CHECK (status IN ('available','in_inspection','blocked','expired','written_off')),
  is_opening_balance  boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CHECK ((lot_type = 'finished_good' AND product_id IS NOT NULL AND raw_material_id IS NULL)
      OR (lot_type = 'raw_material'  AND raw_material_id IS NOT NULL AND product_id IS NULL)),
  CHECK (expires_on IS NULL OR manufactured_on IS NULL OR expires_on >= manufactured_on)
);
CREATE INDEX lots_fefo_idx ON inventory.lots (product_id, expires_on) WHERE status = 'available';

CREATE TABLE inventory.stock_movements (
  id               bigserial PRIMARY KEY,
  movement_type    text NOT NULL CHECK (movement_type IN (
                     'receipt','production_consumption','production_output','transfer_out','transfer_in',
                     'dispatch_out','dispatch_return','sale','customer_return','return_reinstated',
                     'write_off','adjustment','package_open_out','package_open_in','opening_balance','reversal')),
  lot_id           uuid NOT NULL REFERENCES inventory.lots(id),
  presentation_id  uuid REFERENCES catalog.presentations(id),   -- NULL para MP
  location_id      uuid NOT NULL REFERENCES admin.locations(id),
  quantity         platform.qty NOT NULL CHECK (quantity <> 0),  -- en unidad de la presentación; + entra / − sale
  base_quantity    platform.qty NOT NULL CHECK (base_quantity <> 0),  -- convertida a unidad base (BR-009)
  source_type      text NOT NULL,              -- 'purchasing.receipt', 'pos.sale', ...
  source_id        uuid NOT NULL,
  reverses_id      bigint REFERENCES inventory.stock_movements(id),
  reason           text,
  created_by       uuid NOT NULL REFERENCES admin.users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (sign(quantity) = sign(base_quantity))
);
CREATE INDEX stock_movements_lot_loc_idx ON inventory.stock_movements (lot_id, location_id, created_at);
CREATE INDEX stock_movements_source_idx  ON inventory.stock_movements (source_type, source_id);
CREATE TRIGGER stock_movements_append_only BEFORE UPDATE OR DELETE ON inventory.stock_movements
  FOR EACH ROW EXECUTE FUNCTION platform.forbid_mutation();

CREATE TABLE inventory.stock_balances (
  lot_id           uuid NOT NULL REFERENCES inventory.lots(id),
  presentation_id  uuid REFERENCES catalog.presentations(id),
  location_id      uuid NOT NULL REFERENCES admin.locations(id),
  quantity         platform.qty NOT NULL DEFAULT 0 CHECK (quantity >= 0),   -- BR-081 (sujeto a Q-B-08)
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (lot_id, presentation_id, location_id)
);
CREATE INDEX stock_balances_location_idx ON inventory.stock_balances (location_id) WHERE quantity > 0;

CREATE TABLE inventory.transfers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number           text NOT NULL UNIQUE,
  from_location_id uuid NOT NULL REFERENCES admin.locations(id),
  to_location_id   uuid NOT NULL REFERENCES admin.locations(id),
  status           text NOT NULL DEFAULT 'in_transit'
                   CHECK (status IN ('in_transit','received','received_with_variance','resolved')),
  sent_by          uuid NOT NULL REFERENCES admin.users(id),
  sent_at          timestamptz NOT NULL DEFAULT now(),
  received_by      uuid REFERENCES admin.users(id),
  received_at      timestamptz,
  CHECK (from_location_id <> to_location_id)
);

CREATE TABLE inventory.transfer_lines (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id      uuid NOT NULL REFERENCES inventory.transfers(id),
  lot_id           uuid NOT NULL REFERENCES inventory.lots(id),
  presentation_id  uuid REFERENCES catalog.presentations(id),
  sent_qty         platform.qty NOT NULL CHECK (sent_qty > 0),
  received_qty     platform.qty CHECK (received_qty >= 0)
);

CREATE TABLE inventory.adjustments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number           text NOT NULL UNIQUE,
  location_id      uuid NOT NULL REFERENCES admin.locations(id),
  reason           text NOT NULL,                              -- BR-091
  approval_id      uuid REFERENCES admin.approval_requests(id),  -- AP-05 sobre umbral
  physical_count_ref uuid,
  created_by       uuid NOT NULL REFERENCES admin.users(id),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE inventory.reservations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_line_id uuid NOT NULL,           -- FK lógica a sales.order_lines
  product_id       uuid NOT NULL REFERENCES catalog.products(id),
  presentation_id  uuid NOT NULL REFERENCES catalog.presentations(id),
  quantity         platform.qty NOT NULL CHECK (quantity > 0),
  location_id      uuid NOT NULL REFERENCES admin.locations(id),
  status           text NOT NULL DEFAULT 'active' CHECK (status IN ('active','consumed','released')),
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reservations_active_idx ON inventory.reservations (presentation_id, location_id) WHERE status = 'active';
-- Disponible (BR-085) = Σ saldos vendibles − Σ reservas activas, por presentación y ubicación.

-- ---------------------------------------------------------------------
-- PRODUCTION
-- ---------------------------------------------------------------------
CREATE TABLE production.orders (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number             text NOT NULL UNIQUE,     -- OP-0042
  site_id            uuid NOT NULL REFERENCES admin.sites(id),
  product_id         uuid NOT NULL REFERENCES catalog.products(id),
  recipe_version_id  uuid NOT NULL REFERENCES catalog.recipe_versions(id),  -- BR-062
  planned_qty        platform.qty NOT NULL CHECK (planned_qty > 0),         -- unidad base
  actual_qty         platform.qty CHECK (actual_qty >= 0),
  yield_pct          NUMERIC(6,2),
  yield_note         text,                     -- obligatorio fuera de tolerancia (BR-066, validado en app)
  output_lot_id      uuid UNIQUE REFERENCES inventory.lots(id),
  status             text NOT NULL DEFAULT 'planned'
                     CHECK (status IN ('planned','in_progress','closed','voided','reversed')),
  responsible_id     uuid NOT NULL REFERENCES admin.users(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  closed_at          timestamptz,
  CHECK (status <> 'closed' OR (actual_qty IS NOT NULL AND output_lot_id IS NOT NULL))
);

CREATE TABLE production.consumptions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            uuid NOT NULL REFERENCES production.orders(id),
  raw_material_id     uuid NOT NULL REFERENCES catalog.raw_materials(id),
  lot_id              uuid NOT NULL REFERENCES inventory.lots(id),
  theoretical_qty     platform.qty NOT NULL CHECK (theoretical_qty >= 0),
  actual_qty          platform.qty NOT NULL CHECK (actual_qty >= 0)
);

-- Trazabilidad N:M lote PT ← lotes MP (DEC-080, BR-064)
CREATE TABLE inventory.lot_inputs (
  output_lot_id  uuid NOT NULL REFERENCES inventory.lots(id),
  input_lot_id   uuid NOT NULL REFERENCES inventory.lots(id),
  quantity       platform.qty NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (output_lot_id, input_lot_id),
  CHECK (output_lot_id <> input_lot_id)
);

-- ---------------------------------------------------------------------
-- SALES (comercial)
-- ---------------------------------------------------------------------
CREATE TABLE sales.customers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind          text NOT NULL CHECK (kind IN ('restaurant','business','individual')),
  name          text NOT NULL,
  tax_id        text UNIQUE,
  phone         text,
  delivery_address text,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sales.orders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number          text NOT NULL UNIQUE,
  site_id         uuid NOT NULL REFERENCES admin.sites(id),
  customer_id     uuid NOT NULL REFERENCES sales.customers(id),
  channel         text NOT NULL,               -- catálogo PENDING (Q-COM-05)
  payment_mode    text NOT NULL CHECK (payment_mode IN ('cash_on_delivery','credit')),
  requested_date  date,
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN
                  ('draft','pending_approval','confirmed','in_dispatch','partially_delivered','delivered','cancelled','rejected')),
  approval_id     uuid REFERENCES admin.approval_requests(id),
  confirmed_at    timestamptz,
  created_by      uuid NOT NULL REFERENCES admin.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sales_orders_open_idx ON sales.orders (site_id, status)
  WHERE status IN ('confirmed','in_dispatch','partially_delivered');

CREATE TABLE sales.order_lines (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         uuid NOT NULL REFERENCES sales.orders(id),
  presentation_id  uuid NOT NULL REFERENCES catalog.presentations(id),
  ordered_qty      platform.qty NOT NULL CHECK (ordered_qty > 0),
  delivered_qty    platform.qty NOT NULL DEFAULT 0 CHECK (delivered_qty >= 0),
  unit_price       platform.money,            -- fijado al confirmar (BR-024 PENDING)
  CHECK (delivered_qty <= ordered_qty)          -- BR-112: pendiente ≥ 0
);

-- ---------------------------------------------------------------------
-- DISTRIBUTION
-- ---------------------------------------------------------------------
CREATE TABLE distribution.dispatches (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number            text NOT NULL UNIQUE,      -- D-301
  site_id           uuid NOT NULL REFERENCES admin.sites(id),
  driver_id         uuid NOT NULL REFERENCES admin.users(id),     -- BR-120
  route_location_id uuid REFERENCES admin.locations(id),          -- ubicación "en ruta" (Q-B-07)
  dispatch_date     date NOT NULL,
  status            text NOT NULL DEFAULT 'prepared'
                    CHECK (status IN ('prepared','in_route','to_settle','settled')),
  created_by        uuid NOT NULL REFERENCES admin.users(id),
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dispatches_driver_idx ON distribution.dispatches (driver_id, status);

CREATE TABLE distribution.dispatch_lines (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id      uuid NOT NULL REFERENCES distribution.dispatches(id),
  order_line_id    uuid NOT NULL,              -- FK lógica a sales.order_lines
  lot_id           uuid REFERENCES inventory.lots(id),   -- asignado por FEFO al salir
  presentation_id  uuid NOT NULL REFERENCES catalog.presentations(id),
  loaded_qty       platform.qty NOT NULL CHECK (loaded_qty > 0),
  delivered_qty    platform.qty NOT NULL DEFAULT 0 CHECK (delivered_qty >= 0),
  returned_qty     platform.qty NOT NULL DEFAULT 0 CHECK (returned_qty >= 0),
  CHECK (delivered_qty <= loaded_qty)
);

CREATE TABLE distribution.deliveries (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id    uuid NOT NULL REFERENCES distribution.dispatches(id),
  order_id       uuid NOT NULL,                -- FK lógica a sales.orders
  is_partial     boolean NOT NULL,
  partial_reason text,
  delivered_at   timestamptz NOT NULL DEFAULT now(),
  registered_by  uuid NOT NULL REFERENCES admin.users(id),
  CHECK (NOT is_partial OR partial_reason IS NOT NULL)
);

CREATE TABLE distribution.delivery_lines (
  delivery_id      uuid NOT NULL REFERENCES distribution.deliveries(id),
  dispatch_line_id uuid NOT NULL REFERENCES distribution.dispatch_lines(id),
  quantity         platform.qty NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (delivery_id, dispatch_line_id)
);

CREATE TABLE distribution.returns (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number           text NOT NULL UNIQUE,
  customer_id      uuid NOT NULL REFERENCES sales.customers(id),
  dispatch_id      uuid REFERENCES distribution.dispatches(id),
  lot_id           uuid REFERENCES inventory.lots(id),
  presentation_id  uuid NOT NULL REFERENCES catalog.presentations(id),
  quantity         platform.qty NOT NULL CHECK (quantity > 0),
  reason           text NOT NULL,
  status           text NOT NULL DEFAULT 'in_inspection'
                   CHECK (status IN ('in_inspection','reinstated','written_off')),
  approval_id      uuid REFERENCES admin.approval_requests(id),   -- AP-08 para descarte
  inspected_by     uuid REFERENCES admin.users(id),
  inspected_at     timestamptz,
  registered_by    uuid NOT NULL REFERENCES admin.users(id),
  created_at       timestamptz NOT NULL DEFAULT now()
);
-- distribution.settlements: NO se crea hasta resolver P-08.

-- ---------------------------------------------------------------------
-- POS
-- ---------------------------------------------------------------------
CREATE TABLE pos.cash_registers (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id   uuid NOT NULL REFERENCES admin.sites(id),
  name      text NOT NULL,
  goods_location_id   uuid NOT NULL REFERENCES admin.locations(id),
  kitchen_location_id uuid REFERENCES admin.locations(id),
  UNIQUE (site_id, name)
);

CREATE TABLE finance.payment_methods (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL UNIQUE,
  is_cash    boolean NOT NULL,
  is_active  boolean NOT NULL DEFAULT true
);

CREATE TABLE pos.shifts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_register_id  uuid NOT NULL REFERENCES pos.cash_registers(id),
  cashier_id        uuid NOT NULL REFERENCES admin.users(id),
  opening_float     platform.money NOT NULL CHECK (opening_float >= 0),   -- BR-142
  opened_at         timestamptz NOT NULL DEFAULT now(),
  closed_at         timestamptz,
  expected_cash     platform.money,
  counted_cash      platform.money,
  variance          platform.money,
  variance_note     text,
  status            text NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','closed','closed_with_variance','reviewed')),
  reviewed_by       uuid REFERENCES admin.users(id),
  reviewed_at       timestamptz,
  review_note       text,
  CHECK (status <> 'closed_with_variance' OR variance_note IS NOT NULL),       -- BR-145
  CHECK (reviewed_by IS NULL OR reviewed_by <> cashier_id)                      -- BR-004
);
-- BR-141: un turno abierto por caja y por cajero
CREATE UNIQUE INDEX shifts_open_register_uq ON pos.shifts (cash_register_id) WHERE status = 'open';
CREATE UNIQUE INDEX shifts_open_cashier_uq  ON pos.shifts (cashier_id)       WHERE status = 'open';

CREATE TABLE pos.shift_counts (
  shift_id          uuid NOT NULL REFERENCES pos.shifts(id),
  payment_method_id uuid NOT NULL REFERENCES finance.payment_methods(id),
  expected_amount   platform.money NOT NULL,
  counted_amount    platform.money NOT NULL CHECK (counted_amount >= 0),
  PRIMARY KEY (shift_id, payment_method_id)
);

CREATE TABLE pos.sales (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number        text NOT NULL UNIQUE,          -- V-1042 (comprobante interno, no fiscal: BR-150)
  shift_id      uuid NOT NULL REFERENCES pos.shifts(id),
  customer_id   uuid REFERENCES sales.customers(id),
  total         platform.money NOT NULL CHECK (total >= 0),
  change_given  platform.money NOT NULL DEFAULT 0 CHECK (change_given >= 0),
  status        text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','voided')),
  created_by    uuid NOT NULL REFERENCES admin.users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pos.sale_lines (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id          uuid NOT NULL REFERENCES pos.sales(id),
  presentation_id  uuid NOT NULL REFERENCES catalog.presentations(id),
  quantity         platform.qty NOT NULL CHECK (quantity > 0),
  unit_price       platform.money NOT NULL CHECK (unit_price >= 0),
  line_total       platform.money NOT NULL CHECK (line_total >= 0),
  dish_recipe_version_id uuid REFERENCES catalog.recipe_versions(id)   -- platos: consumo teórico (BR-147)
);

CREATE TABLE pos.payments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id           uuid NOT NULL REFERENCES pos.sales(id),
  payment_method_id uuid NOT NULL REFERENCES finance.payment_methods(id),
  amount            platform.money NOT NULL CHECK (amount > 0)
);
-- BR-143 (Σ pagos − cambio = total) se valida en la aplicación dentro de la transacción
-- y con un trigger DEFERRABLE en la migración definitiva.

CREATE TABLE pos.kitchen_periods (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kitchen_location_id uuid NOT NULL REFERENCES admin.locations(id),
  period_start        timestamptz NOT NULL,
  period_end          timestamptz,
  status              text NOT NULL DEFAULT 'open' CHECK (status IN ('open','counted','classified')),
  CHECK (period_end IS NULL OR period_end > period_start)
);

CREATE TABLE pos.kitchen_counts (
  period_id        uuid NOT NULL REFERENCES pos.kitchen_periods(id),
  product_id       uuid REFERENCES catalog.products(id),
  raw_material_id  uuid REFERENCES catalog.raw_materials(id),
  opening_qty      platform.qty,
  inbound_qty      platform.qty NOT NULL DEFAULT 0,
  closing_qty      platform.qty,
  theoretical_qty  platform.qty NOT NULL DEFAULT 0,
  variance_qty     platform.qty GENERATED ALWAYS AS
                   (opening_qty + inbound_qty - closing_qty - theoretical_qty) STORED,   -- BR-148
  classification   text,                        -- PENDING P-07
  CHECK (num_nonnulls(product_id, raw_material_id) = 1),
  UNIQUE NULLS NOT DISTINCT (period_id, product_id, raw_material_id)
);

-- ---------------------------------------------------------------------
-- FINANCE (cartera, recaudos, conciliación)
-- ---------------------------------------------------------------------
CREATE TABLE finance.credit_terms (
  customer_id   uuid PRIMARY KEY REFERENCES sales.customers(id),
  enabled       boolean NOT NULL DEFAULT false,
  credit_limit  platform.money NOT NULL DEFAULT 0 CHECK (credit_limit >= 0),   -- BR-170
  term_days     integer NOT NULL DEFAULT 0 CHECK (term_days >= 0),
  updated_by    uuid NOT NULL REFERENCES admin.users(id),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE finance.receivables (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   uuid NOT NULL REFERENCES sales.customers(id),
  source_type   text NOT NULL,                 -- 'distribution.delivery', 'pos.sale', 'opening_balance'
  source_id     uuid NOT NULL,
  amount        platform.money NOT NULL CHECK (amount > 0),
  balance       platform.money NOT NULL CHECK (balance >= 0),
  issued_on     date NOT NULL,
  due_on        date NOT NULL,                 -- BR-172 (origen sujeto a Q-B-05)
  status        text NOT NULL DEFAULT 'open' CHECK (status IN ('open','partially_paid','paid')),
  approval_id   uuid REFERENCES admin.approval_requests(id),   -- AP-01/AP-02 si aplicó
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (balance <= amount),
  CHECK (due_on >= issued_on),
  UNIQUE (source_type, source_id)
);
CREATE INDEX receivables_open_idx ON finance.receivables (customer_id, due_on) WHERE balance > 0;

CREATE TABLE finance.collections (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number            text NOT NULL UNIQUE,
  site_id           uuid NOT NULL REFERENCES admin.sites(id),
  collector_type    text NOT NULL CHECK (collector_type IN ('driver','cash_register','office')),  -- BR-175
  collector_user_id uuid REFERENCES admin.users(id),
  cash_register_id  uuid REFERENCES pos.cash_registers(id),
  customer_id       uuid REFERENCES sales.customers(id),
  payment_method_id uuid NOT NULL REFERENCES finance.payment_methods(id),
  amount            platform.money NOT NULL CHECK (amount > 0),
  attachment_key    text,
  status            text NOT NULL DEFAULT 'registered'
                    CHECK (status IN ('registered','reconciled','reconciled_with_variance')),
  reconciliation_id uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CHECK ((collector_type = 'driver' AND collector_user_id IS NOT NULL)
      OR (collector_type = 'cash_register' AND cash_register_id IS NOT NULL)
      OR (collector_type = 'office'))
);

CREATE TABLE finance.payment_allocations (
  collection_id  uuid NOT NULL REFERENCES finance.collections(id),
  receivable_id  uuid NOT NULL REFERENCES finance.receivables(id),
  amount         platform.money NOT NULL CHECK (amount > 0),
  PRIMARY KEY (collection_id, receivable_id)
);

CREATE TABLE finance.reconciliations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number            text NOT NULL UNIQUE,
  site_id           uuid NOT NULL REFERENCES admin.sites(id),
  responsible_type  text NOT NULL CHECK (responsible_type IN ('driver','cash_register')),
  responsible_ref   uuid NOT NULL,
  expected_amount   platform.money NOT NULL,
  received_amount   platform.money NOT NULL CHECK (received_amount >= 0),
  variance          platform.money GENERATED ALWAYS AS (received_amount - expected_amount) STORED,  -- BR-177
  note              text,
  reconciled_by     uuid NOT NULL REFERENCES admin.users(id),
  reconciled_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE finance.collections
  ADD CONSTRAINT collections_reconciliation_fk FOREIGN KEY (reconciliation_id) REFERENCES finance.reconciliations(id);

-- ---------------------------------------------------------------------
-- ACCOUNTING — capa (a) genérica + hechos económicos (ADR-021)
-- Sin plan de cuentas, sin reglas de contabilización, sin impuestos.
-- ---------------------------------------------------------------------
CREATE TABLE accounting.economic_events (
  id            bigserial PRIMARY KEY,
  event_type    text NOT NULL,                 -- PurchaseReceived, ProductionCompleted, SaleCompleted, ...
  source_type   text NOT NULL,
  source_id     uuid NOT NULL,
  site_id       uuid NOT NULL REFERENCES admin.sites(id),
  occurred_at   timestamptz NOT NULL,
  payload       jsonb NOT NULL,                -- montos (string decimal), cantidades, referencias
  posting_status text NOT NULL DEFAULT 'pending_posting'
                CHECK (posting_status IN ('pending_posting','posted','not_applicable')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_type, source_type, source_id)
);
-- posting_status es la única columna mutable: se controla con permiso de columna (GRANT UPDATE (posting_status)).

CREATE TABLE accounting.periods (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  starts_on   date NOT NULL,
  ends_on     date NOT NULL,
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  closed_by   uuid REFERENCES admin.users(id),
  closed_at   timestamptz,
  CHECK (ends_on >= starts_on),
  UNIQUE (starts_on, ends_on)
);

CREATE TABLE accounting.accounts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,            -- contenido BLOCKED (P-04)
  name        text NOT NULL,
  parent_id   uuid REFERENCES accounting.accounts(id),
  allows_posting boolean NOT NULL DEFAULT true,
  is_active   boolean NOT NULL DEFAULT true
);

CREATE TABLE accounting.journal_entries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number      text NOT NULL UNIQUE,
  period_id   uuid NOT NULL REFERENCES accounting.periods(id),
  entry_date  date NOT NULL,
  description text NOT NULL,
  economic_event_id bigint REFERENCES accounting.economic_events(id),
  reverses_id uuid REFERENCES accounting.journal_entries(id),
  created_by  uuid NOT NULL REFERENCES admin.users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE accounting.journal_lines (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id    uuid NOT NULL REFERENCES accounting.journal_entries(id),
  account_id  uuid NOT NULL REFERENCES accounting.accounts(id),
  debit       platform.money NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit      platform.money NOT NULL DEFAULT 0 CHECK (credit >= 0),
  third_party_ref uuid,
  CHECK ((debit = 0) <> (credit = 0))
);

-- BR-201: partida doble verificada al confirmar la transacción
CREATE OR REPLACE FUNCTION accounting.check_entry_balanced() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE d numeric; c numeric;
BEGIN
  SELECT coalesce(sum(debit),0), coalesce(sum(credit),0) INTO d, c
    FROM accounting.journal_lines WHERE entry_id = NEW.entry_id;
  IF d <> c THEN
    RAISE EXCEPTION 'Asiento % desbalanceado: débitos % ≠ créditos %', NEW.entry_id, d, c;
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER journal_lines_balanced
  AFTER INSERT OR UPDATE ON accounting.journal_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION accounting.check_entry_balanced();

-- BR-202: no se registran asientos en período cerrado
CREATE OR REPLACE FUNCTION accounting.check_period_open() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT status FROM accounting.periods WHERE id = NEW.period_id) <> 'open' THEN
    RAISE EXCEPTION 'Período cerrado';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER journal_entries_period_open BEFORE INSERT ON accounting.journal_entries
  FOR EACH ROW EXECUTE FUNCTION accounting.check_period_open();
CREATE TRIGGER journal_entries_append_only BEFORE UPDATE OR DELETE ON accounting.journal_entries
  FOR EACH ROW EXECUTE FUNCTION platform.forbid_mutation();

-- ---------------------------------------------------------------------
-- PLATFORM y AUDIT
-- ---------------------------------------------------------------------
CREATE TABLE audit.audit_log (
  id           bigserial PRIMARY KEY,
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  user_id      uuid REFERENCES admin.users(id),
  role_codes   text[] NOT NULL DEFAULT '{}',
  site_id      uuid REFERENCES admin.sites(id),
  channel      text NOT NULL CHECK (channel IN ('web','assistant','telegram','system')),
  action       text NOT NULL,                  -- 'cat.price.update'
  entity_type  text NOT NULL,
  entity_id    text NOT NULL,
  before_data  jsonb,
  after_data   jsonb,
  reason       text,
  approval_id  uuid REFERENCES admin.approval_requests(id),
  proposal_id  uuid,                            -- propuesta de IA, si aplica
  request_id   text,
  ip_address   inet
);
CREATE INDEX audit_log_entity_idx ON audit.audit_log (entity_type, entity_id, occurred_at DESC);
CREATE INDEX audit_log_user_idx   ON audit.audit_log (user_id, occurred_at DESC);
CREATE TRIGGER audit_log_append_only BEFORE UPDATE OR DELETE ON audit.audit_log
  FOR EACH ROW EXECUTE FUNCTION platform.forbid_mutation();

CREATE TABLE platform.idempotency_keys (
  key            uuid NOT NULL,
  user_id        uuid NOT NULL REFERENCES admin.users(id),
  route          text NOT NULL,
  request_hash   text NOT NULL,
  status         text NOT NULL CHECK (status IN ('in_progress','completed','failed')),
  response_code  integer,
  response_body  jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  PRIMARY KEY (user_id, key)
);

CREATE TABLE platform.outbox (
  id            bigserial PRIMARY KEY,
  topic         text NOT NULL,                 -- 'approval.requested', 'stock.low', ...
  payload       jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  published_at  timestamptz
);
CREATE INDEX outbox_unpublished_idx ON platform.outbox (id) WHERE published_at IS NULL;

CREATE TABLE platform.addon_settings (
  addon         text PRIMARY KEY CHECK (addon IN ('assistant','telegram')),
  is_enabled    boolean NOT NULL DEFAULT false,
  settings      jsonb NOT NULL DEFAULT '{}',
  updated_by    uuid REFERENCES admin.users(id),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE platform.feature_flags (
  key           text PRIMARY KEY,              -- 'feature.inventory.packageOpening'
  is_enabled    boolean NOT NULL DEFAULT false,
  blocked_by    text,                          -- 'P-06'
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE platform.document_sequences (
  doc_type      text PRIMARY KEY,              -- 'C', 'OP', 'D', 'V', ...
  next_value    bigint NOT NULL DEFAULT 1 CHECK (next_value > 0)
);

-- ---------------------------------------------------------------------
-- ASSISTANT (opcional) — ver ai-architecture.md
-- ---------------------------------------------------------------------
CREATE TABLE assistant.conversations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES admin.users(id),
  channel     text NOT NULL CHECK (channel IN ('web','telegram')),
  started_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE assistant.requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid NOT NULL REFERENCES assistant.conversations(id),
  user_id          uuid NOT NULL REFERENCES admin.users(id),
  channel          text NOT NULL,
  provider         text NOT NULL,
  model            text NOT NULL,
  input_tokens     integer NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens    integer NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  cost_usd         NUMERIC(12,6) NOT NULL DEFAULT 0,
  tools_called     text[] NOT NULL DEFAULT '{}',
  operation        text,                        -- herramienta de escritura, si la hubo
  outcome          text NOT NULL CHECK (outcome IN ('answered','proposal_created','denied','error','budget_paused')),
  duration_ms      integer,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX assistant_requests_usage_idx ON assistant.requests (created_at, user_id, model);

CREATE TABLE assistant.proposals (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id       uuid NOT NULL REFERENCES assistant.requests(id),
  user_id          uuid NOT NULL REFERENCES admin.users(id),
  site_id          uuid NOT NULL REFERENCES admin.sites(id),
  tool             text NOT NULL,              -- 'purchasing.registerPurchase'
  arguments        jsonb NOT NULL,             -- normalizados por el backend
  arguments_hash   text NOT NULL,
  summary          jsonb NOT NULL,             -- resumen estructurado mostrado al usuario
  status           text NOT NULL DEFAULT 'awaiting_confirmation' CHECK (status IN
                   ('awaiting_confirmation','confirmed','awaiting_approval','executed','rejected','expired','failed','cancelled')),
  approval_id      uuid REFERENCES admin.approval_requests(id),
  expires_at       timestamptz NOT NULL,
  confirmed_at     timestamptz,
  executed_at      timestamptz,
  result_ref       text,                       -- id real de la operación (BR-233)
  error            jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- TELEGRAM (opcional) — ver telegram-architecture.md
-- ---------------------------------------------------------------------
CREATE TABLE telegram.link_codes (
  code        text PRIMARY KEY,                -- un solo uso
  user_id     uuid NOT NULL REFERENCES admin.users(id),
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz
);

CREATE TABLE telegram.links (
  user_id        uuid PRIMARY KEY REFERENCES admin.users(id),
  chat_id        bigint NOT NULL UNIQUE,
  linked_at      timestamptz NOT NULL DEFAULT now(),
  revoked_at     timestamptz
);

CREATE TABLE telegram.updates (
  update_id      bigint PRIMARY KEY,           -- idempotencia (RNF-132)
  chat_id        bigint NOT NULL,
  received_at    timestamptz NOT NULL DEFAULT now(),
  processed_at   timestamptz,
  outcome        text
);
