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