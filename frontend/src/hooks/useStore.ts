
import { create } from 'zustand';
import { Trade, BotConfig, DashboardStats, SignalPreview } from '../types';

interface AppState {
  // Dashboard
  stats: DashboardStats | null;
  setStats: (stats: DashboardStats) => void;

  // Trades
  trades: Trade[];
  pendingTrades: Trade[];
  activeTrades: Trade[];
  setTrades: (trades: Trade[]) => void;
  setPendingTrades: (trades: Trade[]) => void;
  setActiveTrades: (trades: Trade[]) => void;

  // Bots
  bots: BotConfig[];
  setBots: (bots: BotConfig[]) => void;

  // Signals
  signals: SignalPreview[];
  setSignals: (signals: SignalPreview[]) => void;

  // UI
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  currentPage: string;
  setCurrentPage: (page: string) => void;

  // WebSocket
  wsConnected: boolean;
  setWsConnected: (connected: boolean) => void;
  lastUpdate: Date | null;
  setLastUpdate: (date: Date) => void;
}

export const useAppStore = create<AppState>((set) => ({
  stats: null,
  setStats: (stats) => set({ stats }),

  trades: [],
  pendingTrades: [],
  activeTrades: [],
  setTrades: (trades) => set({ trades }),
  setPendingTrades: (pendingTrades) => set({ pendingTrades }),
  setActiveTrades: (activeTrades) => set({ activeTrades }),

  bots: [],
  setBots: (bots) => set({ bots }),

  signals: [],
  setSignals: (signals) => set({ signals }),

  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  currentPage: 'dashboard',
  setCurrentPage: (currentPage) => set({ currentPage }),

  wsConnected: false,
  setWsConnected: (wsConnected) => set({ wsConnected }),
  lastUpdate: null,
  setLastUpdate: (lastUpdate) => set({ lastUpdate }),
}));
