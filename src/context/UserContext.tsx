import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useRef, useState } from "react";

type UserContextType = {
  username: string;
  setUsername: (name: string) => void;
  hasOnboarded: boolean;
  setHasOnboarded: (val: boolean) => void;
  isLoaded: boolean;
};

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [username, setUsernameState] = useState("");
  const [hasOnboarded, setHasOnboardedState] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    async function load() {
      const u = await AsyncStorage.getItem("username");
      const o = await AsyncStorage.getItem("hasOnboarded");
      if (u) setUsernameState(u);
      if (o === "true") setHasOnboardedState(true);
      setIsLoaded(true);
      loaded.current = true;
    }
    load();
  }, []);

  function setUsername(name: string) {
    setUsernameState(name);
    AsyncStorage.setItem("username", name);
  }

  function setHasOnboarded(val: boolean) {
    setHasOnboardedState(val);
    AsyncStorage.setItem("hasOnboarded", String(val));
  }

  return (
    <UserContext.Provider
      value={{ username, setUsername, hasOnboarded, setHasOnboarded, isLoaded }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser harus dipakai di dalam UserProvider");
  return ctx;
}
