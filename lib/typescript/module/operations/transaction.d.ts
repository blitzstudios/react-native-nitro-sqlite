import type { Transaction } from '../types';
export declare const transaction: <Result = void>(dbName: string, transactionCallback: (tx: Transaction) => Promise<Result>, isExclusive?: boolean) => Promise<Result>;
//# sourceMappingURL=transaction.d.ts.map