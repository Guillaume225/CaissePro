import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { mockApiPlugin } from './mock-api';

export default defineConfig({
  plugins: [react(), mockApiPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // ─── ADMIN sub-routes (most specific first) ──
      '/api/admin/audit-logs': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/admin\/audit-logs/, '/api/v1/audit/logs'),
      },
      '/api/admin/categories': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/admin\/categories/, '/api/v1/categories'),
      },
      '/api/admin/approval-circuits': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/admin/, '/api/v1'),
      },
      '/api/admin/settings': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/admin/, '/api/v1'),
      },
      '/api/admin/permissions': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/admin/, '/api/v1'),
      },

      // ─── DASHBOARD sub-routes (most specific first)
      '/api/dashboard/expense': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, '/api/v1'),
      },
      '/api/dashboard/sales': {
        target: 'http://localhost:3003',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, '/api/v1'),
      },
      '/api/dashboard/fne': {
        target: 'http://localhost:3003',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, '/api/v1'),
      },
      '/api/dashboard/admin': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, '/api/v1'),
      },
      // General dashboard catch-all → expense-service
      '/api/dashboard': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, '/api/v1'),
      },

      // ─── Auth-service (3001) ─────────────────────
      '/api/auth': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, '/api/v1'),
      },
      '/api/users': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, '/api/v1'),
      },
      '/api/roles': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, '/api/v1'),
      },
      '/api/companies': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, '/api/v1'),
      },

      // ─── HR-service (3006) ──────────────────────
      '/api/employees': {
        target: 'http://localhost:3006',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, '/api/v1'),
      },

      // ─── Report-configs → expense-service (3002) ─
      '/api/report-configs': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, '/api/v1'),
      },

      // ─── Expense-service (3002) ──────────────────
      '/api/disbursement-requests': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, '/api/v1'),
      },
      '/api/expenses/categories': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        rewrite: () => '/api/v1/categories',
      },
      '/api/expenses': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, '/api/v1'),
      },
      '/api/categories': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, '/api/v1'),
      },
      '/api/budgets': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, '/api/v1'),
      },
      '/api/advances': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, '/api/v1'),
      },
      '/api/closing': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/closing/, '/api/v1/cash-closing'),
      },

      // ─── FNE invoices → sales-service (3003) ────
      '/api/fne-invoices': {
        target: 'http://localhost:3003',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, '/api/v1'),
      },
      // ─── FNE clients → sales-service (3003) ────
      '/api/fne-clients': {
        target: 'http://localhost:3003',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, '/api/v1'),
      },
      // ─── FNE products → sales-service (3003) ───
      '/api/fne-products': {
        target: 'http://localhost:3003',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, '/api/v1'),
      },
      // ─── FNE points of sale → sales-service (3003)
      '/api/fne-points-of-sale': {
        target: 'http://localhost:3003',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, '/api/v1'),
      },
      // ─── FNE establishments → sales-service (3003)
      '/api/fne-establishments': {
        target: 'http://localhost:3003',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, '/api/v1'),
      },
      // ─── FNE settings → sales-service (3003)
      '/api/fne-settings': {
        target: 'http://localhost:3003',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, '/api/v1'),
      },
      // ─── FNE accounting → sales-service (3003)
      '/api/fne-accounting': {
        target: 'http://localhost:3003',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, '/api/v1'),
      },

      // ─── Sales-service (3003) ────────────────────
      '/api/sales': {
        target: 'http://localhost:3003',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, '/api/v1'),
      },
      '/api/clients': {
        target: 'http://localhost:3003',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, '/api/v1'),
      },
      '/api/products': {
        target: 'http://localhost:3003',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, '/api/v1'),
      },
      '/api/payments': {
        target: 'http://localhost:3003',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, '/api/v1'),
      },
      '/api/receivables': {
        target: 'http://localhost:3003',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, '/api/v1'),
      },

      // ─── Notification → expense-service (3002) ─────────────
      '/api/notifications': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, '/api/v1'),
      },

      // ─── AI-service (8000) ───────────────────────
      '/api/ai': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/ai/, '/ai'),
      },

      // ─── Report-service (8001) ───────────────────
      '/api/reports': {
        target: 'http://localhost:8001',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, '/api/v1'),
      },
    },
  },
});
