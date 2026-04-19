UPDATE roles 
SET permissions = '["expense.create","expense.read","expense.update","expense.delete","expense.approve_l1","expense.approve_l2","expense.pay","expense.cancel","expense.export","sale.create","sale.read","sale.update","sale.export","payment.create","payment.read","client.create","client.read","client.update","product.read","budget.create","budget.read","budget.update","user.read","audit.read","report.read","report.export","dashboard.read","cash_closing.create","cash_closing.read","cash_closing.validate","fne.create","fne.read","fne.update","fne.credit_note","company.read"]'
WHERE name = 'MANAGER';
GO
