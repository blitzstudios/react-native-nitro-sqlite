"use strict";

import { HybridNitroSQLite } from "../nitro.js";
import { queueOperationAsync, startOperationSync, throwIfDatabaseIsNotOpen } from "../DatabaseQueue.js";
import NitroSQLiteError from "../NitroSQLiteError.js";
export function executeBatch(dbName, commands) {
  throwIfDatabaseIsNotOpen(dbName);
  try {
    return startOperationSync(dbName, () => HybridNitroSQLite.executeBatch(dbName, commands));
  } catch (error) {
    throw NitroSQLiteError.fromError(error);
  }
}
export async function executeBatchAsync(dbName, commands) {
  throwIfDatabaseIsNotOpen(dbName);
  return queueOperationAsync(dbName, async () => {
    try {
      return await HybridNitroSQLite.executeBatchAsync(dbName, commands);
    } catch (error) {
      throw NitroSQLiteError.fromError(error);
    }
  });
}
//# sourceMappingURL=executeBatch.js.map