import type { NitroSQLiteConnection, NitroSQLiteConnectionOptions } from '../types';
export declare function open(options: NitroSQLiteConnectionOptions): NitroSQLiteConnection;
/**
 * Open an additional, independent connection to an already-open database, addressed by `handle`.
 *
 * Every connection is opened in SQLite's serialized mode (`SQLITE_OPEN_FULLMUTEX`), so all callers of one
 * connection queue behind a single mutex: a synchronous `execute` on the JS thread waits out an in-flight
 * `executeBatchAsync` on a worker thread. A second connection removes that coupling — under WAL it reads a
 * consistent committed snapshot while the writer appends, sharing no mutex — which is what makes a read-heavy
 * path (a query run during render) immune to a large concurrent write.
 *
 * `handle` is the connection's identity: pass it to `execute`/`close`/etc., not the file name. Use `readOnly` to
 * have SQLite reject writes through this connection outright; `TEMP` tables stay writable either way, since
 * SQLite keeps them in a separate temp database, so a read path may still build connection-local scratch tables.
 *
 * The target database must already exist — a secondary connection never creates one, so a wrong `dbName` throws
 * instead of quietly attaching to an empty file.
 */
export declare function openSecondary(options: NitroSQLiteConnectionOptions & {
    handle: string;
    readOnly?: boolean;
}): NitroSQLiteConnection;
//# sourceMappingURL=session.d.ts.map