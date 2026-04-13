import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export interface DisbursementRequest {
  id: string;
  reference: string;
  service: string | null;
  lastName: string;
  firstName: string;
  position: string | null;
  phone: string | null;
  matricule: string | null;
  email: string | null;
  amount: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PROCESSED' | 'VALIDATING' | 'VALIDATED';
  processedById: string | null;
  linkedExpenseId: string | null;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
}

const KEYS = {
  all: ['disbursement-requests'] as const,
  pending: ['disbursement-requests', 'pending'] as const,
  detail: (id: string) => ['disbursement-requests', id] as const,
};

/** Fetch a single disbursement request by ID */
export function useDisbursementRequest(id: string | null | undefined) {
  return useQuery({
    queryKey: KEYS.detail(id!),
    queryFn: async (): Promise<DisbursementRequest> => {
      const { data } = await api.get(`/disbursement-requests/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

/** List pending disbursement requests (for ClosingPage) */
export function usePendingDisbursementRequests() {
  return useQuery({
    queryKey: KEYS.pending,
    queryFn: async (): Promise<DisbursementRequest[]> => {
      const { data } = await api.get('/disbursement-requests/pending');
      return data.data ?? [];
    },
    refetchInterval: 15_000,
  });
}

/** List all disbursement requests */
export function useDisbursementRequests(status?: string) {
  return useQuery({
    queryKey: [...KEYS.all, status] as const,
    queryFn: async (): Promise<DisbursementRequest[]> => {
      const params = status ? { status } : {};
      const { data } = await api.get('/disbursement-requests', { params });
      return data.data ?? [];
    },
  });
}

/** Create a new disbursement request (public — employee portal) */
export function useCreateDisbursementRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: {
      tenantId?: string;
      lastName: string;
      firstName: string;
      position?: string;
      service?: string;
      phone?: string;
      matricule?: string;
      email?: string;
      amount: number;
      reason: string;
    }): Promise<DisbursementRequest> => {
      const { data } = await api.post('/disbursement-requests', dto);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      qc.invalidateQueries({ queryKey: KEYS.pending });
    },
  });
}

/** Track a disbursement request by reference (public) */
export async function trackDisbursementRequest(
  reference: string,
): Promise<DisbursementRequest | null> {
  const { data } = await api.get(`/disbursement-requests/track/${encodeURIComponent(reference)}`);
  return data.data ?? null;
}

/** Approve a disbursement request */
export function useApproveDisbursementRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<DisbursementRequest> => {
      const { data } = await api.patch(`/disbursement-requests/${id}/approve`);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      qc.invalidateQueries({ queryKey: KEYS.pending });
    },
  });
}

/** Reject a disbursement request */
export function useRejectDisbursementRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      comment,
    }: {
      id: string;
      comment?: string;
    }): Promise<DisbursementRequest> => {
      const { data } = await api.patch(`/disbursement-requests/${id}/reject`, { comment });
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      qc.invalidateQueries({ queryKey: KEYS.pending });
    },
  });
}

/** Mark as processed (linked to expense) */
export function useProcessDisbursementRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      linkedExpenseId,
    }: {
      id: string;
      linkedExpenseId?: string;
    }): Promise<DisbursementRequest> => {
      const { data } = await api.patch(`/disbursement-requests/${id}/process`, { linkedExpenseId });
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      qc.invalidateQueries({ queryKey: KEYS.pending });
    },
  });
}
