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

  // `results` is a Nitro getter, not a field: every read returns `getResults()` by value and rebuilds
  // the whole result set as JS objects. Read it once. Reading it per use cost two materializations per
  // query, and made `item` O(n) per element -- iterating a result set that way is quadratic.
  const rows = result.results;
  resultWithRows.rows = {
    _array: rows,
    length: rows.length,
    item: idx => rows[idx]
  };
  return resultWithRows;
}
//# sourceMappingURL=execute.js.map