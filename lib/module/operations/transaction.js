"use strict";

import { queueOperationAsync, throwIfDatabaseIsNotOpen } from "../DatabaseQueue.js";
import { execute, executeAsync } from "./execute.js";
import NitroSQLiteError from "../NitroSQLiteError.js";
export const transaction = async (dbName, transactionCallback, isExclusive = false) => {
  throwIfDatabaseIsNotOpen(dbName);
  let isFinished = false;
  const executeOnTransaction = (query, params) => {
    if (isFinished) {
      throw new NitroSQLiteError(`Cannot execute query on finalized transaction: ${dbName}`);
    }
    return execute(dbName, query, params);
  };
  const executeAsyncOnTransaction = (query, params) => {
    if (isFinished) {
      throw new NitroSQLiteError(`Cannot execute query on finalized transaction: ${dbName}`);
    }
    return executeAsync(dbName, query, params);
  };
  const commit = () => {
    if (isFinished) {
      throw new NitroSQLiteError(`Cannot execute commit on finalized transaction: ${dbName}`);
    }
    isFinished = true;
    return execute(dbName, 'COMMIT');
  };
  const rollback = () => {
    if (isFinished) {
      throw new NitroSQLiteError(`Cannot execute rollback on finalized transaction: ${dbName}`);
    }
    isFinished = true;
    return execute(dbName, 'ROLLBACK');
  };
  return await queueOperationAsync(dbName, async () => {
    try {
      await executeAsync(dbName, isExclusive ? 'BEGIN EXCLUSIVE TRANSACTION' : 'BEGIN TRANSACTION');
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
          throw NitroSQLiteError.fromError(rollbackError);
        }
      }
      throw NitroSQLiteError.fromError(executionError);
    }
  });
};
//# sourceMappingURL=transaction.js.map