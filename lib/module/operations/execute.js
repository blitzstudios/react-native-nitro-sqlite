"use strict";

import { HybridNitroSQLite } from "../nitro.js";
import NitroSQLiteError from "../NitroSQLiteError.js";
export function execute(dbName, query, params) {
  try {
    const nativeResult = HybridNitroSQLite.execute(dbName, query, params);
    return buildJSQueryResult(nativeResult);
  } catch (error) {
    throw NitroSQLiteError.fromError(error);
  }
}
export async function executeAsync(dbName, query, params) {
  try {
    const nativeResult = await HybridNitroSQLite.executeAsync(dbName, query, params);
    return buildJSQueryResult(nativeResult);
  } catch (error) {
    throw NitroSQLiteError.fromError(error);
  }
}
function buildJSQueryResult(result) {
  const resultWithRows = result;
  resultWithRows.rows = {
    _array: result.results,
    length: result.results.length,
    item: idx => result.results[idx]
  };
  return resultWithRows;

  // return Object.assign(result, {
  //   rows: {
  //     _array: result.results,
  //     length: result.results.length,
  //     item: (idx: number) => result.results[idx],
  //   },
  // })
}
//# sourceMappingURL=execute.js.map