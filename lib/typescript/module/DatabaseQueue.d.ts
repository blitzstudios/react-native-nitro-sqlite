export interface QueuedOperation {
    /**
     * Starts the operation
     */
    start: () => void;
}
export type DatabaseQueue = {
    queue: QueuedOperation[];
    inProgress: boolean;
};
export declare function openDatabaseQueue(dbName: string): void;
export declare function closeDatabaseQueue(dbName: string): void;
export declare function isDatabaseOpen(dbName: string): boolean;
export declare function throwIfDatabaseIsNotOpen(dbName: string): void;
export declare function getDatabaseQueue(dbName: string): DatabaseQueue;
export declare function openDatabase(dbName: string): void;
export declare function closeDatabase(dbName: string): void;
export declare function queueOperationAsync<Result>(dbName: string, callback: () => Promise<Result>): Promise<Result>;
export declare function startOperationSync<OperationCallback extends () => Result, Result = void>(dbName: string, callback: OperationCallback): Result;
//# sourceMappingURL=DatabaseQueue.d.ts.map