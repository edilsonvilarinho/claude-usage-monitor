type Subscriber<T> = (value: T) => void;

export function createStore<T extends object>(initial: T) {
  let state = { ...initial };
  const subscribers = new Map<keyof T, Set<Subscriber<any>>>();

  function get<K extends keyof T>(key: K): T[K] {
    return state[key];
  }

  function set<K extends keyof T>(key: K, value: T[K]): void {
    state[key] = value;
    subscribers.get(key)?.forEach(cb => cb(value));
  }

  function subscribe<K extends keyof T>(key: K, cb: Subscriber<T[K]>): () => void {
    if (!subscribers.has(key)) subscribers.set(key, new Set());
    subscribers.get(key)!.add(cb);
    return () => subscribers.get(key)?.delete(cb);
  }

  return { get, set, subscribe };
}

export type Store<T> = ReturnType<typeof createStore<T>>;
