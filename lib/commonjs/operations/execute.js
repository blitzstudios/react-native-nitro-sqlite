"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.execute = execute;
exports.executeAsync = executeAsync;
var _nitro = require("../nitro.js");
var _NitroSQLiteError = _interopRequireDefault(require("../NitroSQLiteError.js"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function execute(dbName, query, params) {
  try {
    const nativeResult = _nitro.HybridNitroSQLite.execute(dbName, query, params);
    return buildJSQueryResult(nativeResult);
  } catch (error) {
    throw _NitroSQLiteError.default.fromError(error);
  }
}
async function executeAsync(dbName, query, params) {
  try {
    const nativeResult = await _nitro.HybridNitroSQLite.executeAsync(dbName, query, params);
    return buildJSQueryResult(nativeResult);
  } catch (error) {
    throw _NitroSQLiteError.default.fromError(error);
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