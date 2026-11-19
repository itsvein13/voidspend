import { useLocalSearchParams, useRouter } from "expo-router";

import { TransactionDetail } from "@/features/transactions/TransactionDetail";

export default function TransactionDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  return <TransactionDetail id={id} onClose={() => router.back()} />;
}
