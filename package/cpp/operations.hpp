#pragma once

#include "hybridObjects/HybridNitroSQLiteQueryResult.hpp"
#include "types.hpp"

namespace margelo::rnnitrosqlite {

void sqliteOpenDb(const std::string& dbName, const std::string& docPath);

void sqliteOpenSecondaryDb(const std::string& dbName, const std::string& handle, bool readOnly, const std::string& docPath);

void sqliteCloseDb(const std::string& dbName);

void sqliteRemoveDb(const std::string& dbName, const std::string& docPath);

void sqliteAttachDb(const std::string& mainDBName, const std::string& docPath, const std::string& databaseToAttach,
                    const std::string& alias);

void sqliteDetachDb(const std::string& mainDBName, const std::string& alias);

std::shared_ptr<HybridNitroSQLiteQueryResult> sqliteExecute(const std::string& dbName, const std::string& query,
                                                            const std::optional<SQLiteQueryParams>& params);

SQLiteOperationResult sqliteExecuteLiteral(const std::string& dbName, const std::string& query);

/**
 * Whether the connection `dbName` currently has an open transaction (i.e. is not in autocommit mode).
 * Returns false when the database is not open.
 */
bool sqliteIsInTransaction(const std::string& dbName);

void sqliteCloseAll();

} // namespace margelo::rnnitrosqlite
