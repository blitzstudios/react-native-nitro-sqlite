"use strict";

import NitroSQLiteError from "./NitroSQLiteError.js";
const databaseQueues = new Map();
export function openDatabaseQueue(dbName) {
  if (isDatabaseOpen(dbName)) {
    throw new NitroSQLiteError(`Database ${dbName} is already open. There is already a connection to the database.`);
  }
  databaseQueues.set(dbName, {
    queue: [],
    inProgress: false
  });
}
export function closeDatabaseQueue(dbName) {
  const databaseQueue = getDatabaseQueue(dbName);
  if (databaseQueue.inProgress || databaseQueue.queue.length > 0) {
    console.warn(`Database queue for ${dbName} has operations in the queue. Closing anyway.`);
  }
  databaseQueues.delete(dbName);
}
export function isDatabaseOpen(dbName) {
  return databaseQueues.has(dbName);
}
export function throwIfDatabaseIsNotOpen(dbName) {
  if (!isDatabaseOpen(dbName)) throw new NitroSQLiteError(`Database ${dbName} is not open. There is no connection to the database.`);
}
export function getDatabaseQueue(dbName) {
  throwIfDatabaseIsNotOpen(dbName);
  const queue = databaseQueues.get(dbName);
  return queue;
}
export function openDatabase(dbName) {
  databaseQueues.set(dbName, {
    queue: [],
    inProgress: false
  });
}
export function closeDatabase(dbName) {
  databaseQueues.delete(dbName);
}
export function queueOperationAsync(dbName, callback) {
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
export function startOperationSync(dbName, callback) {
  const databaseQueue = getDatabaseQueue(dbName);

  // Database is busy - cannot execute synchronously
  if (databaseQueue.inProgress || databaseQueue.queue.length > 0) {
    throw new NitroSQLiteError(`Cannot run synchronous operation on database. Database ${dbName} is busy with another operation.`);
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