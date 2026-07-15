import { useState } from "react";
import {
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

type Props = {
  onAdd: (name: string, amount: number) => void;
};

export default function SavingForm({ onAdd }: Props) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");

  function handleAdd() {
    if (!name.trim() || !amount) return;
    onAdd(name.trim(), parseFloat(amount));
    setName("");
    setAmount("");
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tambah Tabungan</Text>
      <TextInput
        style={styles.input}
        placeholder="Nama tabungan"
        value={name}
        onChangeText={setName}
      />
      <TextInput
        style={styles.input}
        placeholder="Nominal"
        keyboardType="numeric"
        value={amount}
        onChangeText={setAmount}
      />
      <TouchableOpacity style={styles.btn} onPress={handleAdd}>
        <Text style={styles.btnText}>+ Tabung</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 20 },
  title: { fontSize: 16, fontWeight: "bold", marginBottom: 10, color: "#333" },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 10,
  },
  btn: {
    backgroundColor: "#3498db",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
});
