"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.transaction = void 0;
var _DatabaseQueue = require("../DatabaseQueue.js");
var _execute = require("./execute.js");
var _NitroSQLiteError = _interopRequireDefault(require("../NitroSQLiteError.js"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
const transaction = async (dbName, transactionCallback, isExclusive = false) => {
  (0, _DatabaseQueue.throwIfDatabaseIsNotOpen)(dbName);
  let isFinished = false;
  const executeOnTransaction = (query, params) => {
    if (isFinished) {
      throw new _NitroSQLiteError.default(`Cannot execute query on finalized transaction: ${dbName}`);
    }
    return (0, _execute.execute)(dbName, query, params);
  };
  const executeAsyncOnTransaction = (query, params) => {
    if (isFinished) {
      throw new _NitroSQLiteError.default(`Cannot execute query on finalized transaction: ${dbName}`);
    }
    return (0, _execute.executeAsync)(dbName, query, params);
  };
  const commit = () => {
    if (isFinished) {
      throw new _NitroSQLiteError.default(`Cannot execute commit on finalized transaction: ${dbName}`);
    }
    isFinished = true;
    return (0, _execute.execute)(dbName, 'COMMIT');
  };
  const rollback = () => {
    if (isFinished) {
      throw new _NitroSQLiteError.default(`Cannot execute rollback on finalized transaction: ${dbName}`);
    }
    isFinished = true;
    return (0, _execute.execute)(dbName, 'ROLLBACK');
  };
  return await (0, _DatabaseQueue.queueOperationAsync)(dbName, async () => {
    try {
      await (0, _execute.executeAsync)(dbName, isExclusive ? 'BEGIN EXCLUSIVE TRANSACTION' : 'BEGIN TRANSACTION');
      const result = await transactionCallback({
        commit,
        execute: executeOnTransaction,
        executeAsync: executeAsyncOnTransaction,
        rollback
      });
      if (!isFinished) commit();
      return result;
    } catch (executionError) {
      if (!isFinished) {
        try {
          rollback();
        } catch (rollbackError) {
          throw _NitroSQLiteError.default.fromError(rollbackError);
        }
      }
      throw _NitroSQLiteError.default.fromError(executionError);
    }
  });
};
exports.transaction = transaction;
//# sourceMappingURL=transaction.js.map