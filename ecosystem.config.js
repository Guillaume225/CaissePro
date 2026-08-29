module.exports = {
  apps: [
    // â”€â”€ Auth Service (port 3051) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    {
      name: 'auth-service',
      cwd: './services/auth-service',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: '3001',
      },
    },

    // â”€â”€ Expense Service (port 3052) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    {
      name: 'expense-service',
      cwd: './services/expense-service',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: '3002',
      },
    },

    // â”€â”€ Sales Service (port 3053) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    {
      name: 'sales-service',
      cwd: './services/sales-service',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: '3013',
      },
    },

    // â”€â”€ File Service (port 3055) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    {
      name: 'file-service',
      cwd: './services/file-service',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '384M',
      env: {
        NODE_ENV: 'production',
        PORT: '3055',
      },
    },

    // â”€â”€ HR Service (port 3056) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    {
      name: 'hr-service',
      cwd: './services/hr-service',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '384M',
      env: {
        NODE_ENV: 'production',
        PORT: '3006',
      },
    },

    // ── AI Service (port 8000) ──────────────────────────
    {
      name: 'ai-service',
      cwd: './services/ai-service',
      script: 'C:\\Python314\\python.exe',
      args: '-m uvicorn app.main:app --host 0.0.0.0 --port 8000',
      instances: 1,
      exec_mode: 'fork',
      interpreter: 'none',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
      },
    },

    // ── Report Service (port 8001) ───────────────────────
    {
      name: 'report-service',
      cwd: './services/report-service',
      script: 'C:\\Python314\\python.exe',
      args: '-m uvicorn app.main:app --host 0.0.0.0 --port 8001',
      instances: 1,
      exec_mode: 'fork',
      interpreter: 'none',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
      },
    },

    // ── Audit Service (port 3004) ────────────────────────
    {
      name: 'audit-service',
      cwd: './services/audit-service',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '384M',
      env: {
        NODE_ENV: 'production',
        PORT: '3004',
      },
    },

    // ── Notification Service (port 3005) ─────────────────
    {
      name: 'notification-service',
      cwd: './services/notification-service',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '384M',
      env: {
        NODE_ENV: 'production',
        PORT: '3005',
      },
    },

    // ── Demande d'Achat Service (port 3007) ──────────────
    {
      name: 'demande-achat-service',
      cwd: './services/demande-achat-service',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '384M',
      env: {
        NODE_ENV: 'production',
        PORT: '3007',
      },
    },
  ],
};


