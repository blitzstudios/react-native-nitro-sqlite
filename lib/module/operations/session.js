"use strict";

import { HybridNitroSQLite } from "../nitro.js";
import { transaction } from "./transaction.js";
import { execute, executeAsync } from "./execute.js";
import { executeBatch, executeBatchAsync } from "./executeBatch.js";
import NitroSQLiteError from "../NitroSQLiteError.js";
import { closeDatabaseQueue, openDatabaseQueue } from "../DatabaseQueue.js";
export function open(options) {
  try {
    HybridNitroSQLite.open(options.name, options.location);
    openDatabaseQueue(options.name);
  } catch (error) {
    throw NitroSQLiteError.fromError(error);
  }
  return {
    close: () => {
      try {
        HybridNitroSQLite.close(options.name);
        closeDatabaseQueue(options.name);
      } catch (error) {
        throw NitroSQLiteError.fromError(error);
      }
    },
    delete: () => HybridNitroSQLite.drop(options.name, options.location),
    attach: (dbNameToAttach, alias, location) => HybridNitroSQLite.attach(options.name, dbNameToAttach, alias, location),
    detach: alias => HybridNitroSQLite.detach(options.name, alias),
    transaction: fn => transaction(options.name, fn),
    execute: (query, params) => execute(options.name, query, params),
    executeAsync: (query, params) => executeAsync(options.name, query, params),
    executeBatch: commands => executeBatch(options.name, commands),
    executeBatchAsync: commands => executeBatchAsync(options.name, commands),
    loadFile: location => HybridNitroSQLite.loadFile(options.name, location),
    loadFileAsync: location => HybridNitroSQLite.loadFileAsync(options.name, location)
  };
}
//# sourceMappingURL=session.js.map