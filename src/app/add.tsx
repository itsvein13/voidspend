import { AddSheet } from "@/features/transactions/AddSheet";

// A sheet over the tabs. /add records, /add?edit=<id> edits, /add?copy=<id> duplicates.
export default function AddRoute() {
  return <AddSheet />;
}
