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
  return connectionFor(options.name, options.location, {
    owns: true
  });
}

/**
 * Open an additional, independent connection to an already-open database, addressed by `handle`.
 *
 * Every connection is opened in SQLite's serialized mode (`SQLITE_OPEN_FULLMUTEX`), so all callers of one
 * connection queue behind a single mutex: a synchronous `execute` on the JS thread waits out an in-flight
 * `executeBatchAsync` on a worker thread. A second connection removes that coupling — under WAL it reads a
 * consistent committed snapshot while the writer appends, sharing no mutex — which is what makes a read-heavy
 * path (a query run during render) immune to a large concurrent write.
 *
 * `handle` is the connection's identity: pass it to `execute`/`close`/etc., not the file name. Use `readOnly` to
 * have SQLite reject writes through this connection outright; `TEMP` tables stay writable either way, since
 * SQLite keeps them in a separate temp database, so a read path may still build connection-local scratch tables.
 *
 * The target database must already exist — a secondary connection never creates one, so a wrong `dbName` throws
 * instead of quietly attaching to an empty file.
 */
export function openSecondary(options) {
  try {
    HybridNitroSQLite.openSecondary(options.name, options.handle, options.readOnly, options.location);
    openDatabaseQueue(options.handle);
  } catch (error) {
    throw NitroSQLiteError.fromError(error);
  }
  return connectionFor(options.handle, options.location, {
    owns: false
  });
}

/**
 * The `NitroSQLiteConnection` facade over one registered connection name (a db name or a secondary handle).
 *
 * `owns` distinguishes the connection that names the file from a secondary one that only borrows it: everything
 * here addresses a connection by its registered name, except `delete`, which resolves a filesystem path. A
 * secondary connection's name is a handle, not a file, so deleting through it is refused rather than aimed at
 * whatever path the handle happens to spell.
 */
function connectionFor(name, fileLocation, {
  owns
}) {
  const options = {
    name,
    location: fileLocation
  };
  return {
    close: () => {
      try {
        HybridNitroSQLite.close(options.name);
        closeDatabaseQueue(options.name);
      } catch (error) {
        throw NitroSQLiteError.fromError(error);
      }
    },
    delete: () => {
      if (!owns) {
        throw new NitroSQLiteError(`'${options.name}' is a secondary connection; close it and delete the database through the connection that opened it`);
      }
      HybridNitroSQLite.drop(options.name, options.location);
    },
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