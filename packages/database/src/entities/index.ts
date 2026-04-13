// Enums
export * from './enums';

// Tenant
export { Tenant, TenantPlan } from './tenant.entity';
export { Company } from './company.entity';

// Transversal
export { Role } from './role.entity';
export { Department } from './department.entity';
export { User } from './user.entity';
export { AuditLog } from './audit-log.entity';
export { CashDay } from './cash-day.entity';
export { CashMovement } from './cash-movement.entity';
export { Notification } from './notification.entity';
export { AIPrediction } from './ai-prediction.entity';
export { ValidationHistory } from './validation-history.entity';

// Module Dépenses
export { ExpenseCategory } from './expense-category.entity';
export { Expense } from './expense.entity';
export { ExpenseApproval } from './expense-approval.entity';
export { ExpenseAttachment } from './expense-attachment.entity';
export { Advance } from './advance.entity';
export { Budget } from './budget.entity';

// Salariés (HR)
export { Employee } from './employee.entity';

// Demandes de décaissement
export { DisbursementRequest } from './disbursement-request.entity';

// Circuits de validation
export { ApprovalCircuit } from './approval-circuit.entity';
export { ApprovalCircuitStep } from './approval-circuit-step.entity';

// Module Vente
export { Client } from './client.entity';
export { Product } from './product.entity';
export { Sale } from './sale.entity';
export { SaleItem } from './sale-item.entity';
export { Payment } from './payment.entity';
export { Receivable } from './receivable.entity';

// Configuration des états imprimables
export { ReportConfiguration } from './report-config.entity';
