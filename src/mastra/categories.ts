import { z } from 'zod';

export const movementCategories = [
  'Bonificaciones',
  'Cheques emitidos',
  'Cobro de cheques',
  'Comisiones',
  'Compras',
  'Efectivo',
  'Impuestos',
  'Inversiones',
  'Pagos a proveedores',
  'Seguros',
  'Servicios',
  'Tarjetas',
  'Transferencias propias',
  'Transferencias recibidas',
  'Ventas',
  'Acreditaciones',
  'SIRCREB',
  'Rescate',
  'Débitos y créditos',
  'IVA',
  'Percepción IVA',
  'Suscripción',
  'Rentas',
  'Municipalidad',
  'Sueldos',
  'AFIP plan de pagos',
  'Rechazo acreditaciones',
  'VEP IVA',
  'Desconocida',
] as const;

export type MovementCategory = (typeof movementCategories)[number];

export const movementCategorySchema = z.enum(movementCategories);
