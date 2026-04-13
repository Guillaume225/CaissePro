import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type {
  AdminUser, CreateUserDto, UpdateUserDto,
  Role, CreateRoleDto,
  AppSettings,
  AuditLogEntry, AuditLogFilters,
  ExpenseCategory, CreateCategoryDto, UpdateCategoryDto,
  Company, CreateCompanyDto, UpdateCompanyDto,
  ApprovalCircuit, CreateApprovalCircuitDto, UpdateApprovalCircuitDto,
  EmployeeAccount, CreateEmployeeDto, UpdateEmployeeDto,
} from '@/types/admin';

// ── Query keys ───────────────────────────────────────────
const ADMIN_KEYS = {
  users: ['admin', 'users'] as const,
  roles: ['admin', 'roles'] as const,
  permissions: ['admin', 'permissions'] as const,
  settings: ['admin', 'settings'] as const,
  auditLogs: (f?: AuditLogFilters) => ['admin', 'audit-logs', f] as const,
  categories: ['admin', 'categories'] as const,
  companies: ['admin', 'companies'] as const,
  approvalCircuits: ['admin', 'approval-circuits'] as const,
  employees: ['admin', 'employees'] as const,
};

// ── Role name ↔ frontend role mapping ────────────────────
const ROLE_NAME_TO_FRONTEND: Record<string, string> = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  CASHIER: 'cashier',
  ACCOUNTANT: 'viewer',
};

const FRONTEND_TO_ROLE_NAME: Record<string, string> = {
  admin: 'ADMIN',
  manager: 'MANAGER',
  cashier: 'CASHIER',
  viewer: 'ACCOUNTANT',
};

function mapBackendUser(u: Record<string, unknown>): AdminUser {
  const roleName = u.roleName as string;
  return {
    id: u.id as string,
    email: u.email as string,
    firstName: u.firstName as string,
    lastName: u.lastName as string,
    role: ROLE_NAME_TO_FRONTEND[roleName] || roleName?.toLowerCase() || 'viewer',
    roleId: u.roleId as string,
    roleName: roleName,
    isActive: u.isActive as boolean,
    mfaEnabled: u.mfaEnabled as boolean,
    mfaConfigured: (u.mfaConfigured as boolean) ?? false,
    allowedModules: (u.allowedModules as string[]) || [],
    lastLogin: (u.lastLogin as string) || undefined,
    createdAt: u.createdAt as string,
    companyIds: (u.companyIds as string[]) || [],
    companyNames: (u.companyNames as string[]) || [],
  };
}

// Helper: fetch roles from backend and return a map of frontendRole → roleId
async function getRoleIdMap(): Promise<Record<string, string>> {
  const { data } = await api.get('/roles');
  const roles = data.data as { id: string; name: string }[];
  const map: Record<string, string> = {};
  for (const r of roles) {
    const frontendRole = ROLE_NAME_TO_FRONTEND[r.name];
    if (frontendRole) map[frontendRole] = r.id;
  }
  return map;
}

// ═══════════════ USERS (real backend via proxy) ═════════

export function useUsers() {
  return useQuery({
    queryKey: ADMIN_KEYS.users,
    queryFn: async (): Promise<AdminUser[]> => {
      const { data } = await api.get('/users', { params: { perPage: 100 } });
      const list = (data.data ?? data) as Record<string, unknown>[];
      return Array.isArray(list) ? list.map(mapBackendUser) : [];
    },
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: CreateUserDto) => {
      // Resolve roleId: prefer explicit roleId, then resolve from role name
      let roleId = dto.roleId;
      if (!roleId && dto.role) {
        const roleMap = await getRoleIdMap();
        roleId = roleMap[dto.role];
      }
      const payload: Record<string, unknown> = {
        email: dto.email,
        password: dto.password,
        firstName: dto.firstName,
        lastName: dto.lastName,
        roleId,
      };
      if (dto.allowedModules?.length) payload.allowedModules = dto.allowedModules;
      if (dto.companyIds?.length) payload.companyIds = dto.companyIds;
      const { data } = await api.post('/users', payload);
      return mapBackendUser(data.data ?? data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ADMIN_KEYS.users }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...dto }: UpdateUserDto & { id: string }) => {
      const backendDto: Record<string, unknown> = {};
      if (dto.firstName !== undefined) backendDto.firstName = dto.firstName;
      if (dto.lastName !== undefined) backendDto.lastName = dto.lastName;
      if (dto.roleId) {
        backendDto.roleId = dto.roleId;
      } else if (dto.role !== undefined) {
        // Resolve roleId: prefer explicit roleId, then from role name
        const roleMap = await getRoleIdMap();
        backendDto.roleId = roleMap[dto.role];
      }
      if (dto.isActive !== undefined) backendDto.isActive = dto.isActive;
      if (dto.allowedModules?.length) backendDto.allowedModules = dto.allowedModules;
      if (dto.companyIds?.length) backendDto.companyIds = dto.companyIds;

      const { data } = await api.patch(`/users/${id}`, backendDto);
      return mapBackendUser(data.data ?? data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ADMIN_KEYS.users }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/users/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ADMIN_KEYS.users }),
  });
}

export function useToggleMfa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const payload: Record<string, unknown> = { mfaEnabled: enabled };
      if (enabled) payload.mfaConfigured = false; // user must configure at next login
      if (!enabled) payload.mfaConfigured = false; // reset when disabling
      const { data } = await api.patch(`/users/${id}`, payload);
      return mapBackendUser(data.data ?? data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ADMIN_KEYS.users }),
  });
}

// ═══════════════ MFA SETUP / VERIFY ═════════════════════

export function useMfaSetup() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/auth/mfa/setup');
      return (data.data ?? data) as { secret: string; otpauthUrl: string; qrCodeDataUrl: string };
    },
  });
}

export function useMfaVerify() {
  return useMutation({
    mutationFn: async (code: string) => {
      const { data } = await api.post('/auth/mfa/verify', { code });
      return (data.data ?? data) as { enabled: boolean };
    },
  });
}

export function useMfaDisable() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/auth/mfa/disable');
      return (data.data ?? data) as { enabled: boolean };
    },
  });
}

// ═══════════════ ROLES (real backend via proxy) ══════════

export function useRoles() {
  return useQuery({
    queryKey: ADMIN_KEYS.roles,
    queryFn: async (): Promise<Role[]> => {
      const { data } = await api.get('/roles');
      return data.data ?? data;
    },
  });
}

export function usePermissions() {
  return useQuery({
    queryKey: ADMIN_KEYS.permissions,
    queryFn: async (): Promise<{ key: string; label: string; module: string }[]> => {
      const { data } = await api.get('/admin/permissions');
      return data.data ?? data;
    },
  });
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: CreateRoleDto) => {
      const { data } = await api.post('/roles', dto);
      return data.data ?? data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ADMIN_KEYS.roles }),
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...dto }: CreateRoleDto & { id: string }) => {
      const { data } = await api.patch(`/roles/${id}`, dto);
      return data.data ?? data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ADMIN_KEYS.roles }),
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/roles/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ADMIN_KEYS.roles }),
  });
}

// ═══════════════ SETTINGS ════════════════════════════════

export function useSettings() {
  return useQuery({
    queryKey: ADMIN_KEYS.settings,
    queryFn: async (): Promise<AppSettings> => {
      const { data } = await api.get('/admin/settings');
      return data.data;
    },
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (settings: Partial<AppSettings>) => {
      const { data } = await api.put('/admin/settings', settings);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ADMIN_KEYS.settings }),
  });
}

// ═══════════════ AUDIT LOGS ══════════════════════════════

export function useAuditLogs(filters?: AuditLogFilters) {
  return useQuery({
    queryKey: ADMIN_KEYS.auditLogs(filters),
    queryFn: async (): Promise<AuditLogEntry[]> => {
      const { data } = await api.get('/admin/audit-logs', { params: filters });
      return data.data;
    },
  });
}

// ═══════════════ CATEGORIES ══════════════════════════════

export function useCategories() {
  return useQuery({
    queryKey: ADMIN_KEYS.categories,
    queryFn: async (): Promise<ExpenseCategory[]> => {
      const { data } = await api.get('/admin/categories');
      return data.data;
    },
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: CreateCategoryDto) => {
      const { data } = await api.post('/admin/categories', dto);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ADMIN_KEYS.categories }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...dto }: CreateCategoryDto & { id: string }) => {
      const { data } = await api.patch(`/admin/categories/${id}`, dto);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ADMIN_KEYS.categories }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/categories/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ADMIN_KEYS.categories }),
  });
}

export function useReorderCategories() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const { data } = await api.patch('/admin/categories/reorder', { orderedIds });
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ADMIN_KEYS.categories }),
  });
}

export function useUpdateCategoryAccounting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...dto }: UpdateCategoryDto & { id: string }) => {
      const { data } = await api.patch(`/admin/categories/${id}`, dto);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ADMIN_KEYS.categories }),
  });
}

// ═══════════════ COMPANIES ═══════════════════════════════

export function useCompanies() {
  return useQuery({
    queryKey: ADMIN_KEYS.companies,
    queryFn: async (): Promise<Company[]> => {
      const { data } = await api.get('/companies');
      return data.data;
    },
  });
}

export function useCreateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: CreateCompanyDto) => {
      const { data } = await api.post('/companies', dto);
      return data.data as Company;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ADMIN_KEYS.companies }),
  });
}

export function useUpdateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...dto }: UpdateCompanyDto & { id: string }) => {
      const { data } = await api.patch(`/companies/${id}`, dto);
      return data.data as Company;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ADMIN_KEYS.companies }),
  });
}

export function useSwitchCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (companyId: string) => {
      await api.post(`/companies/${companyId}/switch`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADMIN_KEYS.users });
    },
  });
}

export function useUploadCompanyLogo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const formData = new FormData();
      formData.append('logo', file);
      const { data } = await api.post(`/companies/${id}/logo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.data as Company;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ADMIN_KEYS.companies }),
  });
}

// ═══════════════ APPROVAL CIRCUITS ═══════════════════════

export function useApprovalCircuits() {
  return useQuery({
    queryKey: ADMIN_KEYS.approvalCircuits,
    queryFn: async (): Promise<ApprovalCircuit[]> => {
      const { data } = await api.get('/admin/approval-circuits');
      return data.data;
    },
  });
}

export function useCreateApprovalCircuit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: CreateApprovalCircuitDto) => {
      const { data } = await api.post('/admin/approval-circuits', dto);
      return data.data as ApprovalCircuit;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ADMIN_KEYS.approvalCircuits }),
  });
}

export function useUpdateApprovalCircuit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...dto }: UpdateApprovalCircuitDto & { id: string }) => {
      const { data } = await api.put(`/admin/approval-circuits/${id}`, dto);
      return data.data as ApprovalCircuit;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ADMIN_KEYS.approvalCircuits }),
  });
}

export function useDeleteApprovalCircuit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/approval-circuits/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ADMIN_KEYS.approvalCircuits }),
  });
}

// ═══════════════ ADMIN STATUS QUERY ══════════════════════

export type AdminEntityType = 'expense' | 'cashDay' | 'advance' | 'disbursementRequest';

export interface AdminQueryResult {
  data: Array<Record<string, unknown>>;
  total: number;
  page: number;
  perPage: number;
  allowedStatuses: string[];
}

export function useAdminQuery(
  entity: AdminEntityType,
  search?: string,
  status?: string,
  page?: number,
) {
  return useQuery({
    queryKey: ['admin-query', entity, search, status, page] as const,
    queryFn: async (): Promise<AdminQueryResult> => {
      const { data } = await api.get('/admin-query/search', {
        params: { entity, search: search || undefined, status: status || undefined, page: page || 1 },
      });
      return data;
    },
    enabled: !!entity,
  });
}

export function useAdminUpdateStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: {
      entity: AdminEntityType;
      ids: string[];
      newStatus: string;
      reason?: string;
    }) => {
      const { data } = await api.patch('/admin-query/update-status', dto);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-query'] });
    },
  });
}

// ═══════════════ EMPLOYEES (Salariés) ═══════════════════

export function useEmployees() {
  return useQuery({
    queryKey: ADMIN_KEYS.employees,
    queryFn: async (): Promise<EmployeeAccount[]> => {
      const { data } = await api.get('/employees/all');
      const list = (data as any)?.data ?? data;
      return Array.isArray(list) ? (list as EmployeeAccount[]) : [];
    },
  });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: CreateEmployeeDto) => {
      const { data } = await api.post('/employees', dto);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADMIN_KEYS.employees });
    },
  });
}

export function useUpdateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: UpdateEmployeeDto & { id: string }) => {
      const { id, ...rest } = dto;
      const { data } = await api.patch(`/employees/${id}`, rest);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADMIN_KEYS.employees });
    },
  });
}

export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/employees/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADMIN_KEYS.employees });
    },
  });
}
