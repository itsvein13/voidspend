import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { migrate } from "./migrate";
import type { Db } from "./types";

type DataValue = {
  db: Db;
  /** Goes up after every write, so queries on screen run again. */
  version: number;
  bump: () => void;
};

const DataContext = createContext<DataValue | null>(null);

/** Gives children a ready `Db`. Used directly in tests, and by DatabaseProvider on a device. */
export function DataProvider({ db, children }: { db: Db; children: ReactNode }) {
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((value) => value + 1), []);
  const value = useMemo(() => ({ db, version, bump }), [db, version, bump]);
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

function useData(): DataValue {
  const value = useContext(DataContext);
  if (!value) throw new Error("Database hooks need a DatabaseProvider above them");
  return value;
}

export function useDb(): Db {
  return useData().db;
}

type DatabaseProviderProps = {
  /** The file name. The dev data screen uses its own so it never touches the real data. */
  name?: string;
  children: ReactNode;
  /** Shown while the database opens and migrates. */
  loading?: ReactNode;
  /** Shown when it cannot be opened, with the reason. */
  renderError?: (error: Error) => ReactNode;
};

/** Opens the SQLite file, migrates it, then renders children. */
export function DatabaseProvider({ name = "voidspend.db", children, loading = null, renderError }: DatabaseProviderProps) {
  const [state, setState] = useState<{ db: Db } | { error: Error } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let opened: SQLiteDatabase | null = null;
    (async () => {
      try {
        opened = await openDatabaseAsync(name);
        // expo-sqlite's database has the same methods as `Db`, with wider parameter types.
        const db = opened as unknown as Db;
        await migrate(db);
        if (!cancelled) setState({ db });
      } catch (error) {
        if (!cancelled) setState({ error: error instanceof Error ? error : new Error(String(error)) });
      }
    })();
    return () => {
      cancelled = true;
      opened?.closeAsync().catch(() => {});
    };
  }, [name]);

  if (state === null) return <>{loading}</>;
  if ("error" in state) return <>{renderError ? renderError(state.error) : null}</>;
  return <DataProvider db={state.db}>{children}</DataProvider>;
}

export type QueryState<T> = {
  data: T | undefined;
  error: Error | null;
  loading: boolean;
  reload: () => void;
};

/**
 * Runs a read and runs it again after every write. `key` lists the values the
 * query depends on (a month, a filter); a change in them reloads too.
 */
export function useQuery<T>(key: readonly unknown[], query: (db: Db) => Promise<T>): QueryState<T> {
  const { db, version, bump } = useData();
  const [state, setState] = useState<{ data: T | undefined; error: Error | null; loading: boolean }>({
    data: undefined,
    error: null,
    loading: true,
  });
  const run = useEffectEvent(() => query(db));
  const keyText = JSON.stringify(key);

  useEffect(() => {
    let current = true;
    run().then(
      (data) => current && setState({ data, error: null, loading: false }),
      (error) => current && setState((previous) => ({ data: previous.data, error: error instanceof Error ? error : new Error(String(error)), loading: false })),
    );
    return () => {
      current = false;
    };
  }, [version, keyText]);

  return { ...state, reload: bump };
}

/** Runs a write, then tells every query on screen to refresh. */
export function useWrite(): <T>(write: (db: Db) => Promise<T>) => Promise<T> {
  const { db, bump } = useData();
  return useCallback(
    async <T,>(write: (db: Db) => Promise<T>) => {
      try {
        return await write(db);
      } finally {
        bump();
      }
    },
    [db, bump],
  );
}
