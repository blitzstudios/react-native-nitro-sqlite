"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.closeDatabase = closeDatabase;
exports.closeDatabaseQueue = closeDatabaseQueue;
exports.getDatabaseQueue = getDatabaseQueue;
exports.isDatabaseOpen = isDatabaseOpen;
exports.openDatabase = openDatabase;
exports.openDatabaseQueue = openDatabaseQueue;
exports.queueOperationAsync = queueOperationAsync;
exports.startOperationSync = startOperationSync;
exports.throwIfDatabaseIsNotOpen = throwIfDatabaseIsNotOpen;
var _NitroSQLiteError = _interopRequireDefault(require("./NitroSQLiteError.js"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
const databaseQueues = new Map();
function openDatabaseQueue(dbName) {
  if (isDatabaseOpen(dbName)) {
    throw new _NitroSQLiteError.default(`Database ${dbName} is already open. There is already a connection to the database.`);
  }
  databaseQueues.set(dbName, {
    queue: [],
    inProgress: false
  });
}
function closeDatabaseQueue(dbName) {
  const databaseQueue = getDatabaseQueue(dbName);
  if (databaseQueue.inProgress || databaseQueue.queue.length > 0) {
    console.warn(`Database queue for ${dbName} has operations in the queue. Closing anyway.`);
  }
  databaseQueues.delete(dbName);
}
function isDatabaseOpen(dbName) {
  return databaseQueues.has(dbName);
}
function throwIfDatabaseIsNotOpen(dbName) {
  if (!isDatabaseOpen(dbName)) throw new _NitroSQLiteError.default(`Database ${dbName} is not open. There is no connection to the database.`);
}
function getDatabaseQueue(dbName) {
  throwIfDatabaseIsNotOpen(dbName);
  const queue = databaseQueues.get(dbName);
  return queue;
}
function openDatabase(dbName) {
  databaseQueues.set(dbName, {
    queue: [],
    inProgress: false
  });
}
function closeDatabase(dbName) {
  databaseQueues.delete(dbName);
}
function queueOperationAsync(dbName, callback) {
  const databaseQueue = getDatabaseQueue(dbName);
  return new Promise((resolve, reject) => {
    async function start() {
      try {
        const result = await callback();
        resolve(result);
      } catch (error) {
        reject(error);
      } finally {
        databaseQueue.inProgress = false;
        startOperationAsync(dbName);
      }
    }
    const operation = {
      start
    };
    databaseQueue.queue.push(operation);
    startOperationAsync(dbName);
  });
}
function startOperationAsync(dbName) {
  const queue = getDatabaseQueue(dbName);

  // Queue is empty or in progress. Bail out.
  if (queue.inProgress || queue.queue.length === 0) {
    return;
  }
  queue.inProgress = true;
  const operation = queue.queue.shift();
  setImmediate(() => {
    operation.start();
  });
}
function startOperationSync(dbName, callback) {
  const databaseQueue = getDatabaseQueue(dbName);

  // Database is busy - cannot execute synchronously
  if (databaseQueue.inProgress || databaseQueue.queue.length > 0) {
    throw new _NitroSQLiteError.default(`Cannot run synchronous operation on database. Database ${dbName} is busy with another operation.`);
  }

  // Execute synchronously
  databaseQueue.inProgress = true;
  try {
    return callback();
  } finally {
    databaseQueue.inProgress = false;
  }
}
//# sourceMappingURL=DatabaseQueue.js.map