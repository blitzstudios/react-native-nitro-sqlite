"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.executeBatch = executeBatch;
exports.executeBatchAsync = executeBatchAsync;
var _nitro = require("../nitro.js");
var _DatabaseQueue = require("../DatabaseQueue.js");
var _NitroSQLiteError = _interopRequireDefault(require("../NitroSQLiteError.js"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function executeBatch(dbName, commands) {
  (0, _DatabaseQueue.throwIfDatabaseIsNotOpen)(dbName);
  try {
    return (0, _DatabaseQueue.startOperationSync)(dbName, () => _nitro.HybridNitroSQLite.executeBatch(dbName, commands));
  } catch (error) {
    throw _NitroSQLiteError.default.fromError(error);
  }
}
async function executeBatchAsync(dbName, commands) {
  (0, _DatabaseQueue.throwIfDatabaseIsNotOpen)(dbName);
  return (0, _DatabaseQueue.queueOperationAsync)(dbName, async () => {
    try {
      return await _nitro.HybridNitroSQLite.executeBatchAsync(dbName, commands);
    } catch (error) {
      throw _NitroSQLiteError.default.fromError(error);
    }
  });
}
//# sourceMappingURL=executeBatch.js.map