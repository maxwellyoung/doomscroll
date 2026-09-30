export interface TokenStorage {
  readSecure(): Promise<string | null>;
  writeSecure(value: string): Promise<void>;
  removeSecure(): Promise<void>;
  readLegacy(): Promise<string | null>;
  removeLegacy(): Promise<void>;
}

/** Serialize migration and settings actions so removal cannot resurrect a token. */
export function createTokenVault(storage: TokenStorage) {
  let pending: Promise<unknown> = Promise.resolve();
  function serialize<T>(action: () => Promise<T>): Promise<T> {
    const result = pending.then(action);
    pending = result.catch(() => {});
    return result;
  }
  return {
    get: () => serialize(async () => {
      const secure = await storage.readSecure();
      if (secure) {
        await storage.removeLegacy();
        return secure;
      }
      const legacy = (await storage.readLegacy())?.trim();
      if (!legacy) {
        await storage.removeLegacy();
        return null;
      }
      await storage.writeSecure(legacy);
      // Do not erase the only copy until the vault has confirmed the write.
      if (await storage.readSecure() !== legacy) throw new Error("Could not secure GitHub access. Try again.");
      await storage.removeLegacy();
      return legacy;
    }),
    save: (value: string) => serialize(async () => {
      const token = value.trim();
      if (!token) throw new Error("Enter a GitHub token.");
      await storage.writeSecure(token);
      if (await storage.readSecure() !== token) throw new Error("Could not secure GitHub access. Try again.");
      await storage.removeLegacy();
    }),
    clear: () => serialize(async () => {
      // Erase legacy first, so a failed vault removal cannot remigrate plaintext.
      await storage.removeLegacy();
      await storage.removeSecure();
    }),
  };
}
