"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.open = open;
exports.openSecondary = openSecondary;
var _nitro = require("../nitro.js");
var _transaction = require("./transaction.js");
var _execute = require("./execute.js");
var _executeBatch = require("./executeBatch.js");
var _NitroSQLiteError = _interopRequireDefault(require("../NitroSQLiteError.js"));
var _DatabaseQueue = require("../DatabaseQueue.js");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function open(options) {
  try {
    _nitro.HybridNitroSQLite.open(options.name, options.location);
    (0, _DatabaseQueue.openDatabaseQueue)(options.name);
  } catch (error) {
    throw _NitroSQLiteError.default.fromError(error);
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
function openSecondary(options) {
  try {
    _nitro.HybridNitroSQLite.openSecondary(options.name, options.handle, options.readOnly, options.location);
    (0, _DatabaseQueue.openDatabaseQueue)(options.handle);
  } catch (error) {
    throw _NitroSQLiteError.default.fromError(error);
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
        _nitro.HybridNitroSQLite.close(options.name);
        (0, _DatabaseQueue.closeDatabaseQueue)(options.name);
      } catch (error) {
        throw _NitroSQLiteError.default.fromError(error);
      }
    },
    delete: () => {
      if (!owns) {
        throw new _NitroSQLiteError.default(`'${options.name}' is a secondary connection; close it and delete the database through the connection that opened it`);
      }
      _nitro.HybridNitroSQLite.drop(options.name, options.location);
    },
    attach: (dbNameToAttach, alias, location) => _nitro.HybridNitroSQLite.attach(options.name, dbNameToAttach, alias, location),
    detach: alias => _nitro.HybridNitroSQLite.detach(options.name, alias),
    transaction: fn => (0, _transaction.transaction)(options.name, fn),
    execute: (query, params) => (0, _execute.execute)(options.name, query, params),
    executeAsync: (query, params) => (0, _execute.executeAsync)(options.name, query, params),
    executeBatch: commands => (0, _executeBatch.executeBatch)(options.name, commands),
    executeBatchAsync: commands => (0, _executeBatch.executeBatchAsync)(options.name, commands),
    loadFile: location => _nitro.HybridNitroSQLite.loadFile(options.name, location),
    loadFileAsync: location => _nitro.HybridNitroSQLite.loadFileAsync(options.name, location)
  };
}
//# sourceMappingURL=session.js.map