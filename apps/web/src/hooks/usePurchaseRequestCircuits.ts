import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type {
  PurchaseRequestApprovalCircuit,
  CreatePurchaseRequestCircuitDto,
  UpdatePurchaseRequestCircuitDto,
} from '@/types/demande-achat';

const CIRCUIT_KEYS = {
  all: ['purchase-requests', 'circuits'] as const,
};

export function usePurchaseRequestCircuits() {
  return useQuery({
    queryKey: CIRCUIT_KEYS.all,
    queryFn: async (): Promise<PurchaseRequestApprovalCircuit[]> => {
      const { data } = await api.get('/demandes-achat/circuits');
      return data.data ?? data;
    },
  });
}

export function useCreatePurchaseRequestCircuit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      dto: CreatePurchaseRequestCircuitDto,
    ): Promise<PurchaseRequestApprovalCircuit> => {
      const { data } = await api.post('/demandes-achat/circuits', dto);
      return data.data ?? data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CIRCUIT_KEYS.all }),
  });
}

export function useUpdatePurchaseRequestCircuit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...dto
    }: UpdatePurchaseRequestCircuitDto & { id: string }): Promise<PurchaseRequestApprovalCircuit> => {
      const { data } = await api.put(`/demandes-achat/circuits/${id}`, dto);
      return data.data ?? data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CIRCUIT_KEYS.all }),
  });
}

export function useDeletePurchaseRequestCircuit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.delete(`/demandes-achat/circuits/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CIRCUIT_KEYS.all }),
  });
}
