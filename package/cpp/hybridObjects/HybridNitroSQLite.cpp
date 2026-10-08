#include "HybridNitroSQLite.hpp"
#include "HybridNitroSQLiteQueryResult.hpp"
#include "NitroSQLiteException.hpp"
#include "importSqlFile.hpp"
#include "logs.hpp"
#include "macros.hpp"
#include "operations.hpp"
#include "sqliteExecuteBatch.hpp"
#include <iostream>
#include <map>
#include <optional>
#include <string>
#include <variant>
#include <vector>

namespace margelo::nitro::rnnitrosqlite {

// Copy any JS-backed ArrayBuffers on the JS thread so they can be safely
// accessed from the background thread used by Promise::async. Other params are left in place.
static void copyArrayBufferParamsForBackground(std::optional<SQLiteQueryParams>& params) {
  if (!params) {
    return;
  }

  for (auto& value : *params) {
    if (std::holds_alternative<std::shared_ptr<ArrayBuffer>>(value)) {
      value = ArrayBuffer::copy(std::get<std::shared_ptr<ArrayBuffer>>(value));
    }
  }
}

// Nitro passes each argument as a temporary converted from JS, so a method may move out of it.
template <typename T>
static T&& takeArgument(const T& argument) {
  return std::move(const_cast<T&>(argument));
}

const std::string getDocPath(const std::optional<std::string>& location) {
  std::string tempDocPath = std::string(HybridNitroSQLite::docPath);
  if (location) {
    tempDocPath = tempDocPath + "/" + *location;
  }

  return tempDocPath;
}

void HybridNitroSQLite::open(const std::string& dbName, const std::optional<std::string>& location) {
  const auto docPath = getDocPath(location);
  sqliteOpenDb(dbName, docPath);
}

void HybridNitroSQLite::openSecondary(const std::string& dbName, const std::string& handle, std::optional<bool> readOnly,
                                      const std::optional<std::string>& location) {
  const auto docPath = getDocPath(location);
  sqliteOpenSecondaryDb(dbName, handle, readOnly.value_or(false), docPath);
}

void HybridNitroSQLite::close(const std::string& dbName) {
  sqliteCloseDb(dbName);
};

void HybridNitroSQLite::drop(const std::string& dbName, const std::optional<std::string>& location) {
  const auto docPath = getDocPath(location);
  sqliteRemoveDb(dbName, docPath);
};

void HybridNitroSQLite::attach(const std::string& mainDbName, const std::string& dbNameToAttach, const std::string& alias,
                               const std::optional<std::string>& location) {
  std::string tempDocPath = std::string(docPath);
  if (location) {
    tempDocPath = tempDocPath + "/" + *location;
  }

  sqliteAttachDb(mainDbName, tempDocPath, dbNameToAttach, alias);
};

void HybridNitroSQLite::detach(const std::string& mainDbName, const std::string& alias) {
  sqliteDetachDb(mainDbName, alias);
};

std::shared_ptr<HybridNitroSQLiteQueryResultSpec> HybridNitroSQLite::execute(const std::string& dbName, const std::string& query,
                                                                             const std::optional<SQLiteQueryParams>& params) {
  return sqliteExecute(dbName, query, params);
};

std::shared_ptr<Promise<std::shared_ptr<HybridNitroSQLiteQueryResultSpec>>>
HybridNitroSQLite::executeAsync(const std::string& dbName, const std::string& query, const std::optional<SQLiteQueryParams>& params) {
  auto ownedParams = takeArgument(params);
  copyArrayBufferParamsForBackground(ownedParams);

  return Promise<std::shared_ptr<HybridNitroSQLiteQueryResultSpec>>::async(
      [dbName, query = takeArgument(query), params = std::move(ownedParams)]() -> std::shared_ptr<HybridNitroSQLiteQueryResultSpec> {
        auto result = sqliteExecute(dbName, query, params);
        return result;
      });
};

BatchQueryResult HybridNitroSQLite::executeBatch(const std::string& dbName, const std::vector<BatchQueryCommand>& batchParams) {
  const auto commands = batchParamsToCommands(takeArgument(batchParams));

  auto result = sqliteExecuteBatch(dbName, commands);
  return BatchQueryResult(result.rowsAffected);
};

std::shared_ptr<Promise<BatchQueryResult>> HybridNitroSQLite::executeBatchAsync(const std::string& dbName,
                                                                                const std::vector<BatchQueryCommand>& batchParams) {
  // Convert BatchQueryCommand objects on the JS thread and copy any JS-backed
  // ArrayBuffers into native buffers before going off-thread.
  auto commands = batchParamsToCommands(takeArgument(batchParams));
  for (auto& command : commands) {
    copyArrayBufferParamsForBackground(command.params);
  }

  return Promise<BatchQueryResult>::async([dbName, commands = std::move(commands)]() -> BatchQueryResult {
    auto result = sqliteExecuteBatch(dbName, commands);
    return BatchQueryResult(result.rowsAffected);
  });
};

FileLoadResult HybridNitroSQLite::loadFile(const std::string& dbName, const std::string& location) {
  const auto result = importSqlFile(dbName, location);
  return FileLoadResult(result.commands, result.rowsAffected);
};

std::shared_ptr<Promise<FileLoadResult>> HybridNitroSQLite::loadFileAsync(const std::string& dbName, const std::string& location) {
  return Promise<FileLoadResult>::async([=, this]() -> FileLoadResult {
    auto result = loadFile(dbName, location);
    return result;
  });
};

} // namespace margelo::nitro::rnnitrosqlite
