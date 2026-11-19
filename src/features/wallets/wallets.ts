import { useQuery } from "@/db/DatabaseProvider";
import { listWallets, type Wallet } from "@/db/repo/wallets";
import type { Strings } from "@/i18n/id";

/** The shipped main wallet has no name of its own, so it is named in the person's language. */
export function walletName(wallet: Pick<Wallet, "name" | "isDefault">, t: Strings): string {
  return wallet.isDefault && wallet.name === "Main" ? t.wallets.main : wallet.name;
}

/** The wallets that can be picked: the main one and every one that is not hidden. */
export function useWallets() {
  return useQuery(["wallets"], (db) => listWallets(db));
}
