import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Platform } from "react-native";

import { formatLocalDate, type LocalDate } from "@/lib/dates";

/** The native date and time dialogs exist on Android. Other platforms use Now and Yesterday only. */
export const canPickDateTime = Platform.OS === "android";

export type PickedMoment = { date: LocalDate; hour: number; minute: number };

/**
 * Opens the system date dialog, then the time dialog when asked. The values
 * are the wall-clock numbers the person chose, in the phone's own zone. Null
 * means they dismissed it.
 */
export function pickDateTime(initial: Date, withTime: boolean): Promise<PickedMoment | null> {
  return new Promise((resolve) => {
    if (!canPickDateTime) return resolve(null);
    DateTimePickerAndroid.open({
      value: initial,
      mode: "date",
      maximumDate: new Date(),
      onChange: (event, picked) => {
        if (event.type !== "set" || !picked) return resolve(null);
        const date = formatLocalDate(picked.getFullYear(), picked.getMonth() + 1, picked.getDate());
        if (!withTime) return resolve({ date, hour: 12, minute: 0 });
        DateTimePickerAndroid.open({
          value: initial,
          mode: "time",
          is24Hour: true,
          onChange: (timeEvent, time) => {
            if (timeEvent.type !== "set" || !time) return resolve(null);
            resolve({ date, hour: time.getHours(), minute: time.getMinutes() });
          },
        });
      },
    });
  });
}
