import AsyncStorage from "@react-native-async-storage/async-storage";
import { usePathname } from "expo-router";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { useDb } from "@/db/DatabaseProvider";
import { LEGACY_META_KEY, readLegacyRaw, runLegacyImport } from "@/db/legacy/import";
import { isEmptyRaw } from "@/db/legacy/parse";
import { getMeta } from "@/db/repo/meta";
import { getClock } from "@/lib/clock";

import { isOnboarded, migrateLegacyProfile } from "../profile/profile";
import { ReminderSync } from "../reminders/ReminderSync";
import { purgeExpired } from "../trash/trash";
import { ImportFlow } from "./ImportFlow";
import { Onboarding } from "./Onboarding";
import { SplashView } from "./Splash";

type Phase = "checking" | "import" | "onboarding" | "ready";

const GateContext = createContext<() => void>(() => {});

/** Sends the app back through the first-run checks, for example after the person deleted all data. */
export function useGateRestart(): () => void {
  return useContext(GateContext);
}

// The dev-only screens bring their own providers and must not start the import.
const DEV_ROUTES = ["/gallery", "/dev-data"];

/**
 * Decides what the person sees first: the one-time import of v1 data (only if
 * there is any), the welcome (only if they never saw it), or the app.
 */
export function AppGate({ children }: { children: ReactNode }) {
  const db = useDb();
  const pathname = usePathname();
  const bypass = __DEV__ && DEV_ROUTES.some((route) => pathname.startsWith(route));
  const [phase, setPhase] = useState<Phase>("checking");
  const [round, setRound] = useState(0);
  const restart = () => {
    setPhase("checking");
    setRound((value) => value + 1);
  };

  const afterImport = async () => {
    await migrateLegacyProfile(db, AsyncStorage);
    setPhase((await isOnboarded(db)) ? "ready" : "onboarding");
  };

  useEffect(() => {
    if (bypass) return;
    let alive = true;
    (async () => {
      const imported = (await getMeta(db, LEGACY_META_KEY)) === "done";
      if (!imported) {
        const raw = await readLegacyRaw(AsyncStorage);
        if (!isEmptyRaw(raw)) {
          if (alive) setPhase("import");
          return;
        }
        // A fresh install: mark the import as done so it is never asked again.
        await runLegacyImport(db, { storage: AsyncStorage, writeBackup: async () => "", ctx: getClock() });
      }
      await migrateLegacyProfile(db, AsyncStorage);
      if (alive) setPhase((await isOnboarded(db)) ? "ready" : "onboarding");
    })();
    return () => {
      alive = false;
    };
  }, [db, bypass, round]);

  // Once the app is up, anything deleted more than 30 days ago goes for good. It never blocks the screen.
  useEffect(() => {
    if (phase === "ready") void purgeExpired(db).catch(() => undefined);
  }, [phase, db]);

  if (bypass) return <>{children}</>;
  if (phase === "checking") return <SplashView />;
  if (phase === "import") return <ImportFlow onDone={afterImport} />;
  if (phase === "onboarding") return <Onboarding onDone={() => setPhase("ready")} />;
  return (
    <GateContext.Provider value={restart}>
      <ReminderSync />
      {children}
    </GateContext.Provider>
  );
}
