/**
 * SQL File Loader implementation
 */

#include "importSqlFile.hpp"
#include "NitroSQLiteException.hpp"
#include "operations.hpp"
#include <fstream>
#include <iostream>

namespace margelo::rnnitrosqlite {

SQLiteOperationResult importSqlFile(const std::string& dbName, const std::string& fileLocation) {
  std::string line;
  std::ifstream sqFile(fileLocation);
  if (sqFile.is_open()) {
    // BEGIN runs outside the try: if it fails, no transaction of ours is open, so there is nothing to roll back.
    sqliteExecuteLiteral(dbName, "BEGIN EXCLUSIVE TRANSACTION");
    try {
      int rowsAffected = 0;
      int commands = 0;
      while (std::getline(sqFile, line, '\n')) {
        if (!line.empty()) {
          try {
            SQLiteOperationResult result = sqliteExecuteLiteral(dbName, line);
            rowsAffected += result.rowsAffected;
            commands++;
          } catch (NitroSQLiteException& e) {
            // The rollback happens once, in the outer catch.
            throw NitroSQLiteException::CouldNotLoadFile(fileLocation, std::string(e.what()) + ". Transaction was rolled back");
          }
        }
      }

      sqFile.close();
      sqliteExecuteLiteral(dbName, "COMMIT");
      return {.rowsAffected = rowsAffected, .commands = commands};
    } catch (...) {
      sqFile.close();
      // Roll back exactly once, and only if SQLite has not already rolled back on its own.
      // A failed ROLLBACK must never mask the original error.
      if (sqliteIsInTransaction(dbName)) {
        try {
          sqliteExecuteLiteral(dbName, "ROLLBACK");
        } catch (...) {
          // ignore: rethrow the original error below
        }
      }
      throw;
    }
  } else {
    throw NitroSQLiteException::CouldNotLoadFile(fileLocation);
  }
}

} // namespace margelo::rnnitrosqlite
