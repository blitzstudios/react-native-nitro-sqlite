import type { QueryResult, QueryResultRow, SQLiteQueryParams } from '../types';
export declare function execute<Row extends QueryResultRow = never>(dbName: string, query: string, params?: SQLiteQueryParams): QueryResult<Row>;
export declare function executeAsync<Row extends QueryResultRow = never>(dbName: string, query: string, params?: SQLiteQueryParams): Promise<QueryResult<Row>>;
//# sourceMappingURL=execute.d.ts.map