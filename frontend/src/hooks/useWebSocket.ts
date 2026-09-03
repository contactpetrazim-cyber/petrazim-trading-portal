
import { useEffect, useRef } from 'react';
import { useAppStore } from './useStore';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws';

export function useWebSocket() {
  const ws = useRef<WebSocket | null>(null);
  const { setWsConnected, setLastUpdate, setStats, setTrades, setPendingTrades } = useAppStore();

  useEffect(() => {
    const socket = new WebSocket(WS_URL);
    ws.current = socket;

    socket.onopen = () => {
      console.log('WebSocket connected');
      setWsConnected(true);
      socket.send(JSON.stringify({ action: 'subscribe', channel: 'all' }));
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setLastUpdate(new Date());

      // Handle different message types
      switch (data.type) {
        case 'trade_update':
          // Refresh trades
          break;
        case 'stats_update':
          if (data.stats) setStats(data.stats);
          break;
        case 'new_signal':
          // Handle new signal
          break;
        case 'approval_required':
          // Handle approval notification
          break;
      }
    };

    socket.onclose = () => {
      console.log('WebSocket disconnected');
      setWsConnected(false);
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setWsConnected(false);
    };

    return () => {
      socket.close();
    };
  }, [setWsConnected, setLastUpdate, setStats]);

  return ws.current;
}
