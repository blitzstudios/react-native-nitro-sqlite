"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.open = open;
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
  return {
    close: () => {
      try {
        _nitro.HybridNitroSQLite.close(options.name);
        (0, _DatabaseQueue.closeDatabaseQueue)(options.name);
      } catch (error) {
        throw _NitroSQLiteError.default.fromError(error);
      }
    },
    delete: () => _nitro.HybridNitroSQLite.drop(options.name, options.location),
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