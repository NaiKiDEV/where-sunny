import type { ReactNode } from 'react';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { del, get, set } from 'idb-keyval';

const HOUR_MS = 3_600_000;
const FORECAST_STALE_MS = 2 * HOUR_MS;
const FORECAST_GC_MS = 6 * HOUR_MS;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: FORECAST_STALE_MS,
      gcTime: FORECAST_GC_MS,
      retry: 1,
      // focus refetch respects staleTime, so a long-lived PWA tab picks up
      // fresh forecasts when re-opened without hammering the API meanwhile
      refetchOnWindowFocus: true,
    },
  },
});

const persister = createAsyncStoragePersister({
  key: 'where-sunny-query-cache',
  storage: {
    getItem: async (key) => ((await get<string>(key)) ?? null),
    setItem: (key, value) => set(key, value),
    removeItem: (key) => del(key),
  },
});

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: FORECAST_GC_MS,
        buster: 'v1',
        dehydrateOptions: {
          // forecasts are worth persisting, and climate normals never change
          // so they should survive sessions; the city dataset is already
          // cached by the service worker at the HTTP layer
          shouldDehydrateQuery: (query) =>
            query.state.status === 'success' &&
            (query.queryKey[0] === 'forecasts' || query.queryKey[0] === 'climate-normals'),
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
