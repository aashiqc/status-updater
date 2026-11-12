import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

const PREFIX = "status-updater:";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function readStored<T>(key: string): T | undefined {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw == null ? undefined : (JSON.parse(raw) as T);
  } catch {
    return undefined;
  }
}

export function writeStored(key: string, value: unknown) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage full or blocked (private mode) — the app still works, it just won't remember.
  }
}

/**
 * useState that survives reloads via localStorage.
 * Reads after mount so server and client render the same first frame (no hydration mismatch).
 */
export function usePersistentState<T>(
  key: string,
  initial: T,
  validate?: (v: unknown) => boolean,
): [T, Dispatch<SetStateAction<T>>, boolean] {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readStored<unknown>(key);
    if (stored !== undefined && (!validate || validate(stored))) {
      if (isPlainObject(initial) && isPlainObject(stored)) {
        setValue({ ...initial, ...stored } as T);
      } else if (Array.isArray(initial) === Array.isArray(stored)) {
        setValue(stored as T);
      }
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (hydrated) writeStored(key, value);
  }, [hydrated, key, value]);

  return [value, setValue, hydrated];
}
