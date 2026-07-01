import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearSupabaseManualLogout,
  markSupabaseManualLogout,
  wasSupabaseManualLogout,
} from "../src/app/supabaseLogoutGuard";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  } as Storage;
}

describe("Supabase manual logout guard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("records and clears an intentional dashboard logout", () => {
    vi.stubGlobal("window", { sessionStorage: memoryStorage() });

    expect(wasSupabaseManualLogout()).toBe(false);
    markSupabaseManualLogout();
    expect(wasSupabaseManualLogout()).toBe(true);
    clearSupabaseManualLogout();
    expect(wasSupabaseManualLogout()).toBe(false);
  });

  it("does not throw outside browser storage contexts", () => {
    vi.stubGlobal("window", {
      get sessionStorage() {
        throw new Error("storage unavailable");
      },
    });

    expect(() => markSupabaseManualLogout()).not.toThrow();
    expect(() => clearSupabaseManualLogout()).not.toThrow();
    expect(wasSupabaseManualLogout()).toBe(false);
  });

  it("does not throw when browser storage operations fail", () => {
    const failingStorage = {
      get length() {
        return 0;
      },
      clear: () => undefined,
      getItem: () => {
        throw new Error("read failed");
      },
      key: () => null,
      removeItem: () => {
        throw new Error("remove failed");
      },
      setItem: () => {
        throw new Error("write failed");
      },
    } as Storage;
    vi.stubGlobal("window", { sessionStorage: failingStorage });

    expect(() => markSupabaseManualLogout()).not.toThrow();
    expect(() => clearSupabaseManualLogout()).not.toThrow();
    expect(wasSupabaseManualLogout()).toBe(false);
  });
});
