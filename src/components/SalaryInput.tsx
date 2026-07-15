import { StyleSheet, Text, TextInput, View } from "react-native";

type Props = {
  salary: number;
  setSalary: (val: number) => void;
};

export default function SalaryInput({ salary, setSalary }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Gaji Bulanan (Rp)</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        placeholder="Masukkan gaji kamu"
        value={salary === 0 ? "" : String(salary)}
        onChangeText={(text) => setSalary(parseFloat(text) || 0)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 6, color: "#333" },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
});
