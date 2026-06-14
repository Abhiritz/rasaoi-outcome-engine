// Stable anonymous device id for outcome attribution before accounts ship.
const KEY = "rasaoi.device_id.v1";

export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "anon";
  }
}
