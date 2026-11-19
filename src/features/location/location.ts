// One-shot, foreground-only location. It is never started by itself: only a tap
// on "Use current location" runs it. There is no watching, no background use and
// no automatic attachment. A reading becomes a place name where it can and is
// stored on the device only, rounded to about 110 m by the repository.
import * as Location from "expo-location";

import type { Location as Place } from "@/db/repo/transactions";

export type LocationOutcome =
  | { status: "ok"; place: Place }
  | { status: "denied"; canAskAgain: boolean }
  | { status: "unavailable" }
  | { status: "timeout" };

const TIMEOUT_MS = 8_000;

type Address = Partial<Pick<Location.LocationGeocodedAddress, "name" | "street" | "district" | "subregion" | "city" | "region">>;

/** A short readable name from a reverse-geocoded address: "Jl. Sudirman, Tanah Abang, Jakarta". Null when it has nothing useful. */
export function placeName(address: Address | null | undefined): string | null {
  if (!address) return null;
  const street = address.street ?? address.name ?? null;
  const parts = [street, address.district ?? address.subregion ?? null, address.city ?? address.region ?? null].filter((part): part is string => Boolean(part && part.trim() !== ""));
  const unique = parts.filter((part, index) => parts.indexOf(part) === index);
  return unique.length > 0 ? unique.slice(0, 3).join(", ") : null;
}

/** An Android `geo:` link that opens the place in whatever maps app the person has. */
export function geoUrl(place: Pick<Place, "lat" | "lng" | "name">): string | null {
  if (place.lat === null || place.lng === null) return null;
  const point = `${place.lat},${place.lng}`;
  return place.name ? `geo:${point}?q=${point}(${encodeURIComponent(place.name)})` : `geo:${point}?q=${point}`;
}

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T | "timeout"> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), ms);
  });
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
};

/**
 * Asks for foreground permission if needed, reads the position once, and names it when the network allows.
 * It never throws: a phone without Google Play services, or any native failure, comes back as "unavailable".
 */
export async function readCurrentPlace(): Promise<LocationOutcome> {
  try {
    return await readOnce();
  } catch {
    return { status: "unavailable" };
  }
}

async function readOnce(): Promise<LocationOutcome> {
  let permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted) permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) return { status: "denied", canAskAgain: permission.canAskAgain };

  if (!(await Location.hasServicesEnabledAsync())) return { status: "unavailable" };

  // A recent known position is instant and good enough. Otherwise one balanced reading, with a time limit.
  let position = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 }).catch(() => null);
  if (!position) {
    const fresh = await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), TIMEOUT_MS);
    if (fresh === "timeout") return { status: "timeout" };
    position = fresh;
  }

  const { latitude, longitude } = position.coords;
  let name: string | null = null;
  try {
    // Offline this can fail. The point is kept and the person can type a name.
    const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
    name = placeName(address);
  } catch {
    name = null;
  }
  return { status: "ok", place: { name, lat: latitude, lng: longitude, source: "device" } };
}
