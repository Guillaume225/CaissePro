import type { ModuleId } from '@/stores/module-store';

/**
 * Modules that manipulate a physical cash register, where an open cash day
 * is a real precondition. The cash-day gate (Sidebar, MainLayout) only
 * applies within these — it has no meaning for e.g. e-DA, FNE or decision.
 */
export const CASH_DAY_GATED_MODULES: ModuleId[] = ['expense', 'manager-caisse'];
