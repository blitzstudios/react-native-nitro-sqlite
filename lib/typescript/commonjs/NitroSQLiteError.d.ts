/**
 * Custom error class for NitroSQLite operations
 * Extends the native Error class with proper prototype chain and error handling
 */
export default class NitroSQLiteError extends Error {
    constructor(message: string, options?: ErrorOptions);
    /**
     * Converts an unknown error to a NitroSQLiteError
     * Preserves stack traces and error causes when available
     */
    static fromError(error: unknown): NitroSQLiteError;
}
//# sourceMappingURL=NitroSQLiteError.d.ts.map