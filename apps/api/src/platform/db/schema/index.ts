/**
 * Índice de esquemas Drizzle. Cada módulo vertical agregará aquí su archivo
 * (`modules/<modulo>/infrastructure/schema.ts`) cuando se construya.
 */
export * from './auth.js';
export * from './platform.js';
export * from '../../../modules/admin/infrastructure/schema.js';
export * from '../../../modules/catalog/infrastructure/schema.js';
export * from '../../../modules/inventory/infrastructure/schema.js';
export * from '../../../modules/purchasing/infrastructure/schema.js';
export * from '../../../modules/production/infrastructure/schema.js';
export * from '../../../modules/sales/infrastructure/schema.js';
export * from '../../../modules/distribution/infrastructure/schema.js';
export * from '../../../modules/finance/infrastructure/schema.js';
