"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.typeORMDriver = void 0;
var Operations = _interopRequireWildcard(require("./operations/session.js"));
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
//   _________     _______  ______ ____  _____  __  __            _____ _____
//  |__   __\ \   / /  __ \|  ____/ __ \|  __ \|  \/  |     /\   |  __ \_   _|
//     | |   \ \_/ /| |__) | |__ | |  | | |__) | \  / |    /  \  | |__) || |
//     | |    \   / |  ___/|  __|| |  | |  _  /| |\/| |   / /\ \ |  ___/ | |
//     | |     | |  | |    | |___| |__| | | \ \| |  | |  / ____ \| |    _| |_
//     |_|     |_|  |_|    |______\____/|_|  \_\_|  |_| /_/    \_\_|   |_____|

/**
 * DO NOT USE THIS! THIS IS MEANT FOR TYPEORM
 * If you are looking for a convenience wrapper use `connect`
 */
const typeORMDriver = exports.typeORMDriver = {
  openDatabase: (options, ok, fail) => {
    try {
      const db = Operations.open(options);
      const connection = {
        executeSql: async (sql, params, okExecute, failExecute) => {
          try {
            const result = await db.executeAsync(sql, params);
            okExecute(result);
          } catch (e) {
            failExecute(e);
          }
        },
        transaction: fn => {
          return db.transaction(fn);
        },
        close: (okClose, failClose) => {
          try {
            db.close();
            okClose();
          } catch (e) {
            failClose(e);
          }
        },
        attach: (dbNameToAttach, alias, location, callback) => {
          db.attach(dbNameToAttach, alias, location);
          callback();
        },
        detach: (alias, callback) => {
          db.detach(alias);
          callback();
        }
      };
      ok(connection);
      return connection;
    } catch (e) {
      fail(e);
      return null;
    }
  }
};
//# sourceMappingURL=typeORM.js.map