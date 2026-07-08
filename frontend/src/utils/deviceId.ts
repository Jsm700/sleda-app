import AsyncStorage from "@react-native-async-storage/async-storage";

const DEVICE_ID_KEY = "sleda.device_id";

const ADJECTIVES = ["ВЪЛК", "МЕЧКА", "ОРЕЛ", "СОКОЛ", "ЕЛЕН", "РИБАР", "ЛОВЕЦ", "ПЛАНИН"];
const NUMBERS = () => Math.floor(1000 + Math.random() * 9000).toString();

function generateCode(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  return `${adj}-${NUMBERS()}`;
}

export async function getDeviceId(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const newId = generateCode();
    await AsyncStorage.setItem(DEVICE_ID_KEY, newId);
    return newId;
  } catch {
    return "ГОСТ-0000";
  }
}

export async function setDeviceId(id: string): Promise<void> {
  await AsyncStorage.setItem(DEVICE_ID_KEY, id);
}
