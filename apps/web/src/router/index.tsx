import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { MainLayout } from '@/components/layout';
import { AuthGuard } from '@/guards/AuthGuard';
import { EmployeeGuard } from '@/guards/EmployeeGuard';

// ── Lazy-loaded pages ───────────────────────────
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const GeneralPage = lazy(() => import('@/pages/GeneralPage'));
const DemandePage = lazy(() => import('@/pages/DemandePage'));
const EmployeeLoginPage = lazy(() => import('@/pages/EmployeeLoginPage'));


const FneInvoiceListPage = lazy(() => import('@/pages/sales/FneInvoiceListPage'));
const FneInvoiceCreatePage = lazy(() => import('@/pages/sales/FneInvoiceCreatePage'));
const FneInvoiceDetailPage = lazy(() => import('@/pages/sales/FneInvoiceDetailPage'));
const FneInvoiceEditPage = lazy(() => import('@/pages/sales/FneInvoiceEditPage'));
const FneClientListPage = lazy(() => import('@/pages/sales/FneClientListPage'));
const FneProductListPage = lazy(() => import('@/pages/sales/FneProductListPage'));
const FneAccountingPage = lazy(() => import('@/pages/sales/FneAccountingPage'));
const FneDashboardPage = lazy(() => import('@/pages/sales/FneDashboardPage'));

// ── Admin module ────────────────────────────────
const AdminPage = lazy(() => import('@/pages/AdminPage'));
const UserManagementPage = lazy(() => import('@/pages/admin/UserManagementPage'));
const RoleManagementPage = lazy(() => import('@/pages/admin/RoleManagementPage'));
const AuditLogPage = lazy(() => import('@/pages/admin/AuditLogPage'));
const CompanyManagementPage = lazy(() => import('@/pages/admin/CompanyManagementPage'));
const ApprovalCircuitPage = lazy(() => import('@/pages/admin/ApprovalCircuitPage'));
const ReportDesignerPage = lazy(() => import('@/pages/admin/ReportDesignerPage'));
const EmployeeManagementPage = lazy(() => import('@/pages/admin/EmployeeManagementPage'));
const SecurityPage = lazy(() => import('@/pages/admin/SecurityPage'));
const FneConfigPage = lazy(() => import('@/pages/admin/FneConfigPage'));

// ── Manager Caisse module ───────────────────────
const ManagerCaissePage = lazy(() => import('@/pages/ManagerCaissePage'));
const ManagerDashboardPage = lazy(() => import('@/pages/manager-caisse/ManagerDashboardPage'));
const ManagerClosingListPage = lazy(() => import('@/pages/manager-caisse/ManagerClosingListPage'));
const CashDayDetailPage = lazy(() => import('@/pages/manager-caisse/CashDayDetailPage'));
const CategoryManagementPage = lazy(() => import('@/pages/admin/CategoryManagementPage'));
const AccountingConfigPage = lazy(() => import('@/pages/admin/AccountingConfigPage'));
const CashSettingsPage = lazy(() => import('@/pages/manager-caisse/CashSettingsPage'));
const ClosingHistoryPage = lazy(() => import('@/pages/ClosingHistoryPage'));
const AccountingEntriesPage = lazy(() => import('@/pages/AccountingEntriesPage'));
const CashReportsPage = lazy(() => import('@/pages/CashReportsPage'));
const ManagerCashReportsPage = lazy(() => import('@/pages/manager-caisse/ManagerCashReportsPage'));

const NotificationsPage = lazy(() => import('@/pages/NotificationsPage'));

// ── Expense module ──────────────────────────────
const ExpenseListPage = lazy(() => import('@/pages/expenses/ExpenseListPage'));
const ExpenseCreatePage = lazy(() => import('@/pages/expenses/ExpenseCreatePage'));
const ExpenseDetailPage = lazy(() => import('@/pages/expenses/ExpenseDetailPage'));
const ExpenseValidationPage = lazy(() => import('@/pages/decision/ExpenseValidationPage'));
const MonthExpensesPage = lazy(() => import('@/pages/decision/MonthExpensesPage'));
const DevisListPage = lazy(() => import('@/pages/decision/DevisListPage'));
const PendingRequestsPage = lazy(() => import('@/pages/PendingRequestsPage'));

function PageLoader() {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-gold border-t-transparent" />
    </div>
  );
}

function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <SuspenseWrapper>
        <LoginPage />
      </SuspenseWrapper>
    ),
  },
  {
    path: '/demande/login',
    element: (
      <SuspenseWrapper>
        <EmployeeLoginPage />
      </SuspenseWrapper>
    ),
  },
  {
    path: '/demande',
    element: (
      <EmployeeGuard>
        <SuspenseWrapper>
          <DemandePage />
        </SuspenseWrapper>
      </EmployeeGuard>
    ),
  },
  {
    path: '/',
    element: (
      <AuthGuard>
        <MainLayout />
      </AuthGuard>
    ),
    children: [
      {
        index: true,
        element: (
          <SuspenseWrapper>
            <DashboardPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'general',
        element: (
          <SuspenseWrapper>
            <GeneralPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'expenses',
        children: [
          {
            index: true,
            element: (
              <SuspenseWrapper>
                <ExpenseListPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'new',
            element: (
              <SuspenseWrapper>
                <ExpenseCreatePage />
              </SuspenseWrapper>
            ),
          },
          {
            path: ':id',
            element: (
              <SuspenseWrapper>
                <ExpenseDetailPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'cash-reports',
            element: (
              <SuspenseWrapper>
                <CashReportsPage />
              </SuspenseWrapper>
            ),
          },
        ],
      },

      {
        path: 'fne',
        children: [
          {
            index: true,
            element: (
              <SuspenseWrapper>
                <FneDashboardPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'invoices',
            element: (
              <SuspenseWrapper>
                <FneInvoiceListPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'invoices/new',
            element: (
              <SuspenseWrapper>
                <FneInvoiceCreatePage />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'invoices/:id',
            element: (
              <SuspenseWrapper>
                <FneInvoiceDetailPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'invoices/:id/edit',
            element: (
              <SuspenseWrapper>
                <FneInvoiceEditPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'clients',
            element: (
              <SuspenseWrapper>
                <FneClientListPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'products',
            element: (
              <SuspenseWrapper>
                <FneProductListPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'accounting',
            element: (
              <SuspenseWrapper>
                <FneAccountingPage />
              </SuspenseWrapper>
            ),
          },
        ],
      },
      {
        path: 'manager-caisse',
        element: (
          <AuthGuard requiredRole="manager">
            <SuspenseWrapper>
              <ManagerCaissePage />
            </SuspenseWrapper>
          </AuthGuard>
        ),
        children: [
          {
            path: 'dashboard',
            element: (
              <SuspenseWrapper>
                <ManagerDashboardPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'closing',
            element: (
              <SuspenseWrapper>
                <ManagerClosingListPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'closing/:id',
            element: (
              <SuspenseWrapper>
                <CashDayDetailPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'closing-history',
            element: (
              <SuspenseWrapper>
                <ClosingHistoryPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'accounting-entries',
            element: (
              <SuspenseWrapper>
                <AccountingEntriesPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'period-reports',
            element: (
              <SuspenseWrapper>
                <ManagerCashReportsPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'categories',
            element: (
              <SuspenseWrapper>
                <CategoryManagementPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'accounting',
            element: (
              <SuspenseWrapper>
                <AccountingConfigPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'settings',
            element: (
              <SuspenseWrapper>
                <CashSettingsPage />
              </SuspenseWrapper>
            ),
          },

        ],
      },
      {
        path: 'pending-requests',
        element: (
          <SuspenseWrapper>
            <PendingRequestsPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'validation',
        element: (
          <SuspenseWrapper>
            <ExpenseValidationPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'month-expenses',
        element: (
          <SuspenseWrapper>
            <MonthExpensesPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'devis',
        element: (
          <SuspenseWrapper>
            <DevisListPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'admin',
        element: (
          <AuthGuard requiredRole="manager">
            <SuspenseWrapper>
              <AdminPage />
            </SuspenseWrapper>
          </AuthGuard>
        ),
        children: [
          {
            path: 'users',
            element: (
              <SuspenseWrapper>
                <UserManagementPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'roles',
            element: (
              <SuspenseWrapper>
                <RoleManagementPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'companies',
            element: (
              <SuspenseWrapper>
                <CompanyManagementPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'approval-circuits',
            element: (
              <SuspenseWrapper>
                <ApprovalCircuitPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'audit',
            element: (
              <SuspenseWrapper>
                <AuditLogPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'report-designer',
            element: (
              <SuspenseWrapper>
                <ReportDesignerPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'employees',
            element: (
              <SuspenseWrapper>
                <EmployeeManagementPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'security',
            element: (
              <SuspenseWrapper>
                <SecurityPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'fne-config',
            element: (
              <SuspenseWrapper>
                <FneConfigPage />
              </SuspenseWrapper>
            ),
          },
        ],
      },
      {
        path: 'notifications',
        element: (
          <SuspenseWrapper>
            <NotificationsPage />
          </SuspenseWrapper>
        ),
      },
    ],
  },
], {
  future: {
    v7_startTransition: true,
    v7_relativeSplatPath: true,
    v7_fetcherPersist: true,
    v7_normalizeFormMethod: true,
    v7_partialHydration: true,
    v7_skipActionErrorRevalidation: true,
  },
});

export function AppRouter() {
  return <RouterProvider router={router} future={{ v7_startTransition: true }} />;
}
