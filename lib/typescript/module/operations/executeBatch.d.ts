import type { BatchQueryCommand, BatchQueryResult } from '../types';
export declare function executeBatch(dbName: string, commands: BatchQueryCommand[]): BatchQueryResult;
export declare function executeBatchAsync(dbName: string, commands: BatchQueryCommand[]): Promise<BatchQueryResult>;
//# sourceMappingURL=executeBatch.d.ts.map