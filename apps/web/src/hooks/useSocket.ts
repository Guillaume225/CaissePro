import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';

let globalSocket: Socket | null = null;

const WS_ENABLED = Boolean(import.meta.env.VITE_WS_ENABLED);

function getSocket(token: string | null): Socket | null {
  if (!WS_ENABLED || !token) return null;
  if (globalSocket?.connected) return globalSocket;

  globalSocket = io('/ws', {
    auth: { token },
    transports: ['websocket'],
    reconnectionAttempts: 10,
    reconnectionDelay: 3000,
  });

  return globalSocket;
}

export function useSocket() {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = getSocket(token);
    if (!socket) return;
    socketRef.current = socket;

    // Real-time invalidation handlers
    socket.on('notification:new', () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    });

    socket.on('dashboard:kpis-updated', () => {
      qc.invalidateQueries({ queryKey: ['dashboard', 'kpis'] });
    });

    socket.on('alert:new', () => {
      qc.invalidateQueries({ queryKey: ['dashboard', 'ai-alerts'] });
    });

    return () => {
      socket.off('notification:new');
      socket.off('dashboard:kpis-updated');
      socket.off('alert:new');
    };
  }, [token, qc]);

  const emit = useCallback((event: string, data?: unknown) => {
    socketRef.current?.emit(event, data);
  }, []);

  return { socket: socketRef.current, emit };
}
