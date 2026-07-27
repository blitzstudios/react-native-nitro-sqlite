import type { HybridObject } from 'react-native-nitro-modules'
import type {
  BatchQueryCommand,
  BatchQueryResult,
  FileLoadResult,
  SQLiteQueryParams,
} from '../types'
import type { NitroSQLiteQueryResult } from './NitroSQLiteQueryResult.nitro'

export interface NitroSQLite
  extends HybridObject<{ ios: 'c++'; android: 'c++' }> {
  open(dbName: string, location?: string): void
  /**
   * Open an ADDITIONAL connection to a database that already exists on disk, registered under `handle` instead
   * of `dbName`. Every other method (`execute`, `executeAsync`, `close`, …) then takes `handle` where it would
   * normally take a db name.
   *
   * Why this exists: every connection is opened `SQLITE_OPEN_FULLMUTEX`, so one connection serializes all of its
   * callers behind a single mutex — a synchronous read on the JS thread blocks for the entire duration of an
   * in-flight async write on a worker thread. Under WAL, a *second* connection reads a committed snapshot
   * concurrently with the writer and shares no mutex with it.
   *
   * Two guarantees that distinguish this from opening the same file under a cosmetically different name (e.g.
   * `./foo.db` vs `foo.db`, which happens to key two map entries today):
   *  - `handle` is the connection's identity by contract, so the second connection is genuinely independent and
   *    stays that way regardless of how db names are normalized internally.
   *  - `SQLITE_OPEN_CREATE` is NOT set, so a wrong `dbName` fails loudly instead of silently creating and
   *    attaching to an empty database.
   *
   * @param dbName   Existing database file to attach to (resolved against `location` exactly like `open`).
   * @param handle   The name this connection is registered and addressed by. Must not already be in use.
   * @param readOnly Open the main database read-only, so a stray write through this connection fails instead of
   *                 succeeding. `TEMP` tables remain writable (SQLite keeps them in a separate temp database),
   *                 so a read path that builds connection-local scratch tables can still use this. Defaults to
   *                 false.
   */
  openSecondary(
    dbName: string,
    handle: string,
    readOnly?: boolean,
    location?: string,
  ): void
  close(dbName: string): void
  drop(dbName: string, location?: string): void
  attach(
    mainDbName: string,
    dbNameToAttach: string,
    alias: string,
    location?: string,
  ): void
  detach(mainDbName: string, alias: string): void
  execute(
    dbName: string,
    query: string,
    params?: SQLiteQueryParams,
  ): NitroSQLiteQueryResult
  executeAsync(
    dbName: string,
    query: string,
    params?: SQLiteQueryParams,
  ): Promise<NitroSQLiteQueryResult>
  executeBatch(dbName: string, commands: BatchQueryCommand[]): BatchQueryResult
  executeBatchAsync(
    dbName: string,
    commands: BatchQueryCommand[],
  ): Promise<BatchQueryResult>
  loadFile(dbName: string, location: string): FileLoadResult
  loadFileAsync(dbName: string, location: string): Promise<FileLoadResult>
}
