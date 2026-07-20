#pragma once

#include "types.hpp"
#include <sqlite3.h>
#include <string>

namespace margelo::rnnitrosqlite {

/**
 * Native (simdjson) shred — the fast ingest path for the off-heap stores (see the app-side
 * `store_common/shred_spec.ts`). Parses `rawJson` once with simdjson On-Demand and binds each per-row element
 * straight into a prepared INSERT on the live `db` handle, following the data-driven `specJson` program (one
 * op per column). The spec's `source` selects the element stream: a top-level JSON array (default) or the
 * *values* of a top-level JSON object/map (`objectValues`). Does the whole atomic partition replace —
 * `DELETE` (from the spec's `deleteWhere`, bound from `scopeBinds`) then the insert loop — in one
 * transaction. Elements failing the spec's `whereGuard` (empty player id) are skipped.
 *
 * This never marshals per-row values across the JSI bridge; the only thing that crossed the bridge is the
 * single `rawJson` string. Returns rows inserted. Throws `NitroSQLiteException` on any parse/SQL error (the
 * caller rolls back and the JS side falls back to the store's JS `parseRows` builder).
 */
int sqliteShredJsonArray(sqlite3* db, const std::string& specJson, const std::string& rawJson, const SQLiteQueryParams& scopeBinds);

} // namespace margelo::rnnitrosqlite
