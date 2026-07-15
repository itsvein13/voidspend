import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Item = {
  id: number;
  name: string;
  amount: number;
};

type Props = {
  title: string;
  items: Item[];
  onDelete: (id: number) => void;
};

const fmt = (n: number) => "Rp " + n.toLocaleString("id-ID");

export default function ItemList({ title, items, onDelete }: Props) {
  if (items.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {items.map((item) => (
        <View key={item.id} style={styles.row}>
          <View style={styles.info}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.amount}>{fmt(item.amount)}</Text>
          </View>
          <TouchableOpacity
            style={styles.delBtn}
            onPress={() => onDelete(item.id)}
          >
            <Text style={styles.delText}>Hapus</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 20 },
  title: { fontSize: 16, fontWeight: "bold", marginBottom: 10, color: "#333" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  info: { flex: 1 },
  name: { fontSize: 14, color: "#333", fontWeight: "500" },
  amount: { fontSize: 13, color: "#666", marginTop: 2 },
  delBtn: { backgroundColor: "#eee", borderRadius: 6, padding: 6 },
  delText: { fontSize: 12, color: "#e74c3c", fontWeight: "600" },
});
