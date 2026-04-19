-- Insert PENDING approval records for existing PENDING expenses that have no approval records yet

-- Expense DEP-2026-00002: amount 3000 → "Petite dépense" circuit (0-50000), approver 5ADBD038
INSERT INTO expense_approvals (id, expense_id, approver_id, level, status, comment, approved_at, created_at)
VALUES (
  NEWID(),
  'D0257EE3-6180-4D90-92C7-C4016AEF3BED',
  '5ADBD038-002C-41D9-932B-26E99F7ABEED',
  1,
  'PENDING',
  NULL,
  NULL,
  GETDATE()
);

-- Expense DEP-2026-00003: amount 60000 → "Grosse dépense" circuit (50001+), approver 5ADBD038
INSERT INTO expense_approvals (id, expense_id, approver_id, level, status, comment, approved_at, created_at)
VALUES (
  NEWID(),
  'CBC52E51-490F-4718-9610-DFD416D06B52',
  '5ADBD038-002C-41D9-932B-26E99F7ABEED',
  1,
  'PENDING',
  NULL,
  NULL,
  GETDATE()
);
GO
