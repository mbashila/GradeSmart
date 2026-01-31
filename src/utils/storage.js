let AsyncStorage = null;
try {
  const req = eval('require');
  AsyncStorage = req('@react-native-async-storage/async-storage').default;
} catch (e) {
  AsyncStorage = null;
}

const isAvailable = !!AsyncStorage;

async function getItem(key) {
  if (!AsyncStorage) return null;
  try {
    return await AsyncStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

async function setItem(key, value) {
  if (!AsyncStorage) return;
  try {
    await AsyncStorage.setItem(key, value);
  } catch (e) {}
}

async function removeItem(key) {
  if (!AsyncStorage) return;
  try {
    await AsyncStorage.removeItem(key);
  } catch (e) {}
}

export const storage = {
  isAvailable,
  getItem,
  setItem,
  removeItem,
};

export default storage;
