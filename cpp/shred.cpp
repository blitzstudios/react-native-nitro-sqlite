#include "shred.hpp"
#include "NitroSQLiteException.hpp"
#include "simdjson.h"
#include <cmath>
#include <cstdio>
#include <sstream>
#include <string>
#include <string_view>
#include <variant>
#include <vector>

using namespace simdjson;

namespace margelo::rnnitrosqlite {

namespace {

// ---------------------------------------------------------------------------------------------------
// Parsed spec (the C++ mirror of app-side `ShredSpec` / `ShredOp` — kept in lockstep with shred_spec.ts)
// ---------------------------------------------------------------------------------------------------

enum class OpKind { Bind, Text, Int, Real, BoolInt, Real0, MetaText, CoalesceText, Concat, FantasyPositions, KickerAggregate, RawJsonField, RawJson };

struct ConcatPart {
  std::vector<std::string> paths;
};

struct ShredOp {
  OpKind kind;
  std::string path;                        // text / int / real / boolInt / real0 / metaText / fantasyPositions / rawJsonField
  std::vector<std::string> paths;          // coalesceText
  bool emptyDefault = false;               // coalesceText
  int fallbackBindIndex = -1;              // coalesceText (scope-bind fallback; -1 = none)
  std::vector<ConcatPart> parts;           // concat
  std::string sep;                         // concat
  std::string aggPath;                     // kickerAggregate
  std::vector<std::string> fallbackPaths;  // kickerAggregate
  int index = 0;                           // bind
};

struct DeleteClause {
  std::string column;
  int bindIndex = 0;
};

struct ShredProgram {
  std::string table;
  std::string insertVerb;
  std::vector<std::string> columns;
  std::vector<ShredOp> ops;
  std::vector<DeleteClause> deleteWhere;
  std::vector<std::string> guardPaths;  // empty => no guard
  bool objectSource = false;            // false => top-level array; true => top-level object's values
};

OpKind parseOpKind(std::string_view s) {
  if (s == "bind") return OpKind::Bind;
  if (s == "text") return OpKind::Text;
  if (s == "int") return OpKind::Int;
  if (s == "real") return OpKind::Real;
  if (s == "boolInt") return OpKind::BoolInt;
  if (s == "real0") return OpKind::Real0;
  if (s == "metaText") return OpKind::MetaText;
  if (s == "coalesceText") return OpKind::CoalesceText;
  if (s == "concat") return OpKind::Concat;
  if (s == "fantasyPositions") return OpKind::FantasyPositions;
  if (s == "kickerAggregate") return OpKind::KickerAggregate;
  if (s == "rawJsonField") return OpKind::RawJsonField;
  if (s == "rawJson") return OpKind::RawJson;
  throw NitroSQLiteException::SqlExecution("nitro_shred: unknown op '" + std::string(s) + "'");
}

std::vector<std::string> parseStringArray(dom::element arr) {
  std::vector<std::string> out;
  for (dom::element e : arr.get_array()) out.emplace_back(e.get_string().value());
  return out;
}

ShredOp parseOp(dom::element opEl) {
  ShredOp op;
  op.kind = parseOpKind(opEl["op"].get_string().value());
  switch (op.kind) {
    case OpKind::Bind:
      op.index = static_cast<int>(opEl["index"].get_int64().value());
      break;
    case OpKind::Text:
    case OpKind::Int:
    case OpKind::Real:
    case OpKind::BoolInt:
    case OpKind::Real0:
    case OpKind::MetaText:
    case OpKind::FantasyPositions:
    case OpKind::RawJsonField:
      op.path = std::string(opEl["path"].get_string().value());
      break;
    case OpKind::CoalesceText: {
      op.paths = parseStringArray(opEl["paths"]);
      auto ed = opEl["emptyDefault"];
      op.emptyDefault = !ed.error() && ed.value().is_bool() && ed.value().get_bool().value();
      auto fbi = opEl["fallbackBindIndex"];
      op.fallbackBindIndex = (!fbi.error() && fbi.value().is_int64()) ? static_cast<int>(fbi.value().get_int64().value()) : -1;
      break;
    }
    case OpKind::Concat: {
      op.sep = std::string(opEl["sep"].get_string().value());
      for (dom::element part : opEl["parts"].get_array()) {
        ConcatPart cp;
        cp.paths = parseStringArray(part["paths"]);
        op.parts.push_back(std::move(cp));
      }
      break;
    }
    case OpKind::KickerAggregate:
      op.aggPath = std::string(opEl["aggPath"].get_string().value());
      op.fallbackPaths = parseStringArray(opEl["fallbackPaths"]);
      break;
    case OpKind::RawJson:
      break;
  }
  return op;
}

ShredProgram parseSpec(const std::string& specJson) {
  dom::parser parser;
  dom::element root = parser.parse(specJson);
  if (root["version"].get_int64().value() != 1) {
    throw NitroSQLiteException::SqlExecution("nitro_shred: unsupported spec version");
  }
  ShredProgram prog;
  prog.table = std::string(root["table"].get_string().value());
  prog.insertVerb = std::string(root["insertVerb"].get_string().value());
  auto source = root["source"];
  prog.objectSource = !source.error() && source.value().is_string() && source.value().get_string().value() == "objectValues";
  for (dom::element c : root["columns"].get_array()) prog.columns.emplace_back(c.get_string().value());
  for (dom::element o : root["ops"].get_array()) prog.ops.push_back(parseOp(o));
  for (dom::element d : root["deleteWhere"].get_array()) {
    DeleteClause clause;
    clause.column = std::string(d["column"].get_string().value());
    clause.bindIndex = static_cast<int>(d["bindIndex"].get_int64().value());
    prog.deleteWhere.push_back(std::move(clause));
  }
  auto guard = root["whereGuard"];
  if (!guard.error() && guard.value().is_object()) {
    prog.guardPaths = parseStringArray(guard.value()["paths"]);
  }
  if (prog.columns.size() != prog.ops.size()) {
    throw NitroSQLiteException::SqlExecution("nitro_shred: columns/ops length mismatch");
  }
  return prog;
}

// ---------------------------------------------------------------------------------------------------
// DOM value helpers (per-element random access — see the streaming loop below)
// ---------------------------------------------------------------------------------------------------

/** Descend a dot path from `root`. Returns false if any segment is missing or a non-object intermediate. */
bool getByPath(dom::element root, const std::string& path, dom::element& out) {
  dom::element cur = root;
  size_t start = 0;
  while (true) {
    size_t dot = path.find('.', start);
    std::string_view key = (dot == std::string::npos) ? std::string_view(path).substr(start) : std::string_view(path).substr(start, dot - start);
    if (!cur.is_object()) return false;
    auto next = cur.get_object()[key];
    if (next.error()) return false;
    cur = next.value();
    if (dot == std::string::npos) break;
    start = dot + 1;
  }
  out = cur;
  return true;
}

/** Present = the path resolves to a non-null value (mirrors JS `v != null`). */
bool getPresent(dom::element root, const std::string& path, dom::element& out) {
  return getByPath(root, path, out) && !out.is_null();
}

/** JS `String(number)`: integral doubles print without a fraction; others compact. */
std::string jsNumberToString(double d) {
  char buf[32];
  if (std::isfinite(d) && d == std::floor(d) && std::fabs(d) < 1e15) {
    std::snprintf(buf, sizeof(buf), "%lld", static_cast<long long>(d));
  } else {
    std::snprintf(buf, sizeof(buf), "%g", d);
  }
  return std::string(buf);
}

/** Minified JSON text of a value (the DOM `operator<<` prints minified) — the twin of JS `JSON.stringify(v)`. */
std::string elementToJson(dom::element el) {
  std::ostringstream oss;
  oss << el;
  return oss.str();
}

/** JS truthiness of a JSON value (`v ? 1 : 0`): bool as-is, number nonzero, string non-empty, array/object true. */
bool jsTruthy(dom::element el) {
  if (el.is_bool()) return el.get_bool().value();
  if (el.is_int64()) return el.get_int64().value() != 0;
  if (el.is_uint64()) return el.get_uint64().value() != 0;
  if (el.is_double()) { double d = el.get_double().value(); return d != 0.0 && !std::isnan(d); }
  if (el.is_string()) return !el.get_string().value().empty();
  return true;  // non-null array/object
}

/** JS `String(v)` for a JSON scalar (used by concat / coalesceText / metaText). */
std::string scalarToString(dom::element el) {
  if (el.is_string()) return std::string(el.get_string().value());
  if (el.is_int64()) return std::to_string(el.get_int64().value());
  if (el.is_uint64()) return std::to_string(el.get_uint64().value());
  if (el.is_double()) return jsNumberToString(el.get_double().value());
  if (el.is_bool()) return el.get_bool().value() ? "true" : "false";
  return "";
}

/** JS `Number(v)`: numbers as-is, bool → 0/1, a fully-numeric string parsed; anything else fails. */
bool coerceNumber(dom::element el, double& out) {
  if (el.is_int64()) { out = static_cast<double>(el.get_int64().value()); return true; }
  if (el.is_uint64()) { out = static_cast<double>(el.get_uint64().value()); return true; }
  if (el.is_double()) { out = el.get_double().value(); return true; }
  if (el.is_bool()) { out = el.get_bool().value() ? 1.0 : 0.0; return true; }
  if (el.is_string()) {
    std::string s(el.get_string().value());
    if (s.empty()) return false;
    try {
      size_t idx = 0;
      double d = std::stod(s, &idx);
      if (idx == s.size()) { out = d; return true; }
    } catch (...) {
    }
    return false;
  }
  return false;
}

// ---------------------------------------------------------------------------------------------------
// Binding
// ---------------------------------------------------------------------------------------------------

void bindText(sqlite3_stmt* stmt, int idx, const std::string& s) {
  sqlite3_bind_text(stmt, idx, s.c_str(), static_cast<int>(s.size()), SQLITE_TRANSIENT);
}

/** Bind one scope value (from `scopeBinds`) — the JS `SqlValue` variant (string | number | null | bool). */
void bindScopeValue(sqlite3_stmt* stmt, int idx, const SQLiteValue& value) {
  if (std::holds_alternative<nitro::NullType>(value)) {
    sqlite3_bind_null(stmt, idx);
  } else if (std::holds_alternative<bool>(value)) {
    sqlite3_bind_int(stmt, idx, std::get<bool>(value) ? 1 : 0);
  } else if (std::holds_alternative<double>(value)) {
    sqlite3_bind_double(stmt, idx, std::get<double>(value));
  } else if (std::holds_alternative<std::string>(value)) {
    bindText(stmt, idx, std::get<std::string>(value));
  } else {
    sqlite3_bind_null(stmt, idx);
  }
}

/** Evaluate `op` against `element` (+ captured `rawElement` for `rawJson`) and bind to statement column `idx`. */
void bindOp(sqlite3_stmt* stmt, int idx, const ShredOp& op, dom::element element, std::string_view rawElement, const SQLiteQueryParams& scopeBinds) {
  switch (op.kind) {
    case OpKind::Bind: {
      if (op.index >= 0 && static_cast<size_t>(op.index) < scopeBinds.size()) {
        bindScopeValue(stmt, idx, scopeBinds[op.index]);
      } else {
        sqlite3_bind_null(stmt, idx);
      }
      return;
    }
    case OpKind::Text: {
      dom::element v;
      if (getByPath(element, op.path, v) && v.is_string()) {
        bindText(stmt, idx, std::string(v.get_string().value()));
      } else {
        sqlite3_bind_null(stmt, idx);
      }
      return;
    }
    case OpKind::Int: {
      dom::element v;
      double n;
      if (getByPath(element, op.path, v) && (v.is_int64() || v.is_uint64() || v.is_double()) && coerceNumber(v, n)) {
        sqlite3_bind_double(stmt, idx, n);
      } else {
        sqlite3_bind_null(stmt, idx);
      }
      return;
    }
    case OpKind::Real: {
      dom::element v;
      double n;
      if (getPresent(element, op.path, v) && coerceNumber(v, n)) {
        sqlite3_bind_double(stmt, idx, n);
      } else {
        sqlite3_bind_null(stmt, idx);
      }
      return;
    }
    case OpKind::BoolInt: {
      dom::element v;
      if (getPresent(element, op.path, v)) {
        sqlite3_bind_int(stmt, idx, jsTruthy(v) ? 1 : 0);
      } else {
        sqlite3_bind_null(stmt, idx);
      }
      return;
    }
    case OpKind::Real0: {
      dom::element v;
      double n;
      if (getPresent(element, op.path, v) && coerceNumber(v, n)) {
        sqlite3_bind_double(stmt, idx, n);
      } else {
        sqlite3_bind_double(stmt, idx, 0.0);
      }
      return;
    }
    case OpKind::MetaText: {
      dom::element v;
      if (getPresent(element, op.path, v)) {
        bindText(stmt, idx, scalarToString(v));
      } else {
        sqlite3_bind_null(stmt, idx);
      }
      return;
    }
    case OpKind::CoalesceText: {
      for (const auto& p : op.paths) {
        dom::element v;
        if (getPresent(element, p, v)) {
          bindText(stmt, idx, scalarToString(v));
          return;
        }
      }
      if (op.fallbackBindIndex >= 0 && static_cast<size_t>(op.fallbackBindIndex) < scopeBinds.size()) {
        bindScopeValue(stmt, idx, scopeBinds[op.fallbackBindIndex]);
      } else if (op.emptyDefault) {
        bindText(stmt, idx, std::string());
      } else {
        sqlite3_bind_null(stmt, idx);
      }
      return;
    }
    case OpKind::Concat: {
      std::string out;
      for (size_t i = 0; i < op.parts.size(); i++) {
        if (i > 0) out += op.sep;
        for (const auto& p : op.parts[i].paths) {
          dom::element v;
          if (getPresent(element, p, v)) {
            out += scalarToString(v);
            break;
          }
        }
      }
      bindText(stmt, idx, out);
      return;
    }
    case OpKind::FantasyPositions: {
      dom::element v;
      if (getByPath(element, op.path, v) && v.is_array()) {
        std::string out = "|";
        bool any = false;
        for (dom::element e : v.get_array()) {
          if (e.is_string()) {
            std::string_view sv = e.get_string().value();
            if (!sv.empty()) {
              out.append(sv);
              out += '|';
              any = true;
            }
          }
        }
        if (any) {
          bindText(stmt, idx, out);
          return;
        }
      }
      sqlite3_bind_null(stmt, idx);
      return;
    }
    case OpKind::KickerAggregate: {
      dom::element agg;
      double aggVal;
      if (getPresent(element, op.aggPath, agg) && coerceNumber(agg, aggVal)) {
        if (aggVal != 0.0) {
          sqlite3_bind_double(stmt, idx, aggVal);
          return;
        }
        double sum = 0.0;
        for (const auto& fp : op.fallbackPaths) {
          dom::element fv;
          double fvn;
          if (getPresent(element, fp, fv) && coerceNumber(fv, fvn)) sum += fvn;
        }
        sqlite3_bind_double(stmt, idx, sum);
      } else {
        sqlite3_bind_double(stmt, idx, 0.0);
      }
      return;
    }
    case OpKind::RawJsonField: {
      dom::element v;
      if (getPresent(element, op.path, v)) {
        bindText(stmt, idx, elementToJson(v));
      } else {
        sqlite3_bind_null(stmt, idx);
      }
      return;
    }
    case OpKind::RawJson:
      sqlite3_bind_text(stmt, idx, rawElement.data(), static_cast<int>(rawElement.size()), SQLITE_TRANSIENT);
      return;
  }
}

/** First-present value across paths is non-empty (mirrors JS `coalesce(guardPaths)` then `String(v) !== ''`). */
bool passesGuard(const ShredProgram& prog, dom::element element) {
  if (prog.guardPaths.empty()) return true;
  for (const auto& p : prog.guardPaths) {
    dom::element v;
    if (getByPath(element, p, v)) {
      if (v.is_null()) continue;  // nullish → not present, try next path
      return !scalarToString(v).empty();
    }
  }
  return false;
}

// ---------------------------------------------------------------------------------------------------
// SQL building
// ---------------------------------------------------------------------------------------------------

std::string joinCsv(const std::vector<std::string>& xs) {
  std::string out;
  for (size_t i = 0; i < xs.size(); i++) {
    if (i > 0) out += ", ";
    out += xs[i];
  }
  return out;
}

std::string buildInsertSql(const ShredProgram& prog) {
  std::string placeholders;
  for (size_t i = 0; i < prog.columns.size(); i++) {
    if (i > 0) placeholders += ", ";
    placeholders += '?';
  }
  return prog.insertVerb + " INTO " + prog.table + " (" + joinCsv(prog.columns) + ") VALUES (" + placeholders + ");";
}

std::string buildDeleteSql(const ShredProgram& prog) {
  std::string sql = "DELETE FROM " + prog.table;
  for (size_t i = 0; i < prog.deleteWhere.size(); i++) {
    sql += (i == 0) ? " WHERE " : " AND ";
    sql += prog.deleteWhere[i].column + " = ?";
  }
  sql += ";";
  return sql;
}

// The shred wraps its delete+insert in a SAVEPOINT rather than BEGIN/COMMIT. nitro runs async DB work on a
// shared thread pool with SQLite compiled `THREADSAFE=0` (performance mode) — so the writer handle can already
// be inside a transaction (e.g. an overlapping `executeBatchAsync`'s `BEGIN EXCLUSIVE`) when we run, and a
// nested `BEGIN` errors with "cannot start a transaction within a transaction". A SAVEPOINT nests cleanly:
// when it is the outermost (autocommit) its RELEASE commits, and when it is inside an existing transaction its
// RELEASE just merges into that outer unit. Same atomic-partition-replace guarantee either way.
constexpr const char* SAVEPOINT_SQL = "SAVEPOINT nitro_shred;";
constexpr const char* RELEASE_SQL = "RELEASE nitro_shred;";

[[noreturn]] void failWithRollback(sqlite3* db, const std::string& message) {
  // Undo just our savepoint's changes, then release it (ROLLBACK TO leaves the savepoint active).
  sqlite3_exec(db, "ROLLBACK TO nitro_shred; RELEASE nitro_shred;", nullptr, nullptr, nullptr);
  throw NitroSQLiteException::SqlExecution(message);
}

} // namespace

int sqliteShredJsonArray(sqlite3* db, const std::string& specJson, const std::string& rawJson, const SQLiteQueryParams& scopeBinds) {
  ShredProgram prog = parseSpec(specJson);

  if (sqlite3_exec(db, SAVEPOINT_SQL, nullptr, nullptr, nullptr) != SQLITE_OK) {
    throw NitroSQLiteException::SqlExecution(std::string("nitro_shred: SAVEPOINT failed: ") + sqlite3_errmsg(db));
  }

  // Atomic partition replace: delete the scope, then re-insert. Same transaction as the JS `parseRows` path's
  // delete+insert batch, so a concurrent WAL reader never sees the partition empty.
  {
    std::string deleteSql = buildDeleteSql(prog);
    sqlite3_stmt* del = nullptr;
    if (sqlite3_prepare_v2(db, deleteSql.c_str(), -1, &del, nullptr) != SQLITE_OK) {
      failWithRollback(db, std::string("nitro_shred: prepare DELETE failed: ") + sqlite3_errmsg(db));
    }
    for (size_t i = 0; i < prog.deleteWhere.size(); i++) {
      int bi = prog.deleteWhere[i].bindIndex;
      if (bi >= 0 && static_cast<size_t>(bi) < scopeBinds.size()) {
        bindScopeValue(del, static_cast<int>(i) + 1, scopeBinds[bi]);
      } else {
        sqlite3_bind_null(del, static_cast<int>(i) + 1);
      }
    }
    int rc = sqlite3_step(del);
    sqlite3_finalize(del);
    if (rc != SQLITE_DONE) {
      failWithRollback(db, std::string("nitro_shred: DELETE failed: ") + sqlite3_errmsg(db));
    }
  }

  std::string insertSql = buildInsertSql(prog);
  sqlite3_stmt* stmt = nullptr;
  if (sqlite3_prepare_v2(db, insertSql.c_str(), -1, &stmt, nullptr) != SQLITE_OK) {
    failWithRollback(db, std::string("nitro_shred: prepare INSERT failed: ") + sqlite3_errmsg(db));
  }

  int inserted = 0;
  try {
    // On-Demand stream of the top-level elements: we never hold the whole payload as a DOM. Each element's raw
    // JSON span (for `data_json`) is captured, then re-parsed into a small reused DOM for random field access
    // — peak transient memory is one element, not the whole-payload graph the JS path would allocate.
    ondemand::parser odParser;
    padded_string payload(rawJson);
    ondemand::document doc = odParser.iterate(payload);

    dom::parser elemParser;  // reused across elements (its padded buffer grows once to the largest element)

    // Shred one element: re-parse its raw JSON into the reused DOM, skip if it fails the guard, else bind + step.
    auto shredElement = [&](ondemand::value ev) {
      std::string_view rawElement = ev.raw_json();
      dom::element element = elemParser.parse(rawElement.data(), rawElement.size());

      if (!passesGuard(prog, element)) return;

      sqlite3_reset(stmt);
      sqlite3_clear_bindings(stmt);
      for (size_t c = 0; c < prog.ops.size(); c++) {
        bindOp(stmt, static_cast<int>(c) + 1, prog.ops[c], element, rawElement, scopeBinds);
      }
      if (sqlite3_step(stmt) != SQLITE_DONE) {
        std::string err = std::string("nitro_shred: INSERT step failed: ") + sqlite3_errmsg(db);
        sqlite3_finalize(stmt);
        failWithRollback(db, err);
      }
      inserted++;
    };

    if (prog.objectSource) {
      // Top-level object/map (`player`): each element is a member's *value* (its key is redundant with the id
      // the value carries). One reused element DOM, same as the array path — peak memory is one value.
      ondemand::object obj = doc.get_object();
      for (auto field : obj) {
        ondemand::value val = field.value();
        shredElement(val);
      }
    } else {
      ondemand::array arr = doc.get_array();
      for (auto item : arr) {
        shredElement(item.value());
      }
    }
  } catch (const NitroSQLiteException&) {
    throw;  // already rolled back by failWithRollback
  } catch (const simdjson_error& e) {
    sqlite3_finalize(stmt);
    failWithRollback(db, std::string("nitro_shred: JSON parse failed: ") + e.what());
  } catch (const std::exception& e) {
    sqlite3_finalize(stmt);
    failWithRollback(db, std::string("nitro_shred: ") + e.what());
  }

  sqlite3_finalize(stmt);
  if (sqlite3_exec(db, RELEASE_SQL, nullptr, nullptr, nullptr) != SQLITE_OK) {
    failWithRollback(db, std::string("nitro_shred: RELEASE failed: ") + sqlite3_errmsg(db));
  }
  return inserted;
}

} // namespace margelo::rnnitrosqlite
