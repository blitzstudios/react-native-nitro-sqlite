#pragma once

#include <string>
#include <sys/stat.h>

namespace margelo::rnnitrosqlite {

bool folder_exists(const std::string& foldername) {
  struct stat buffer;
  return (stat(foldername.c_str(), &buffer) == 0);
}

/**
 * Portable wrapper for mkdir. Internally used by mkdir()
 * @param[in] path the full path of the directory to create.
 * @return zero on success, otherwise -1.
 */
int _mkdir(const char* path) {
#if _POSIX_C_SOURCE
  return mkdir(path);
#else
  return mkdir(path, 0755); // not sure if this works on mac
#endif
}

/**
 * Recursive, portable wrapper for mkdir.
 * @param[in] path the full path of the directory to create.
 * @return zero on success, otherwise -1.
 */
int mkdir(const char* path) {
  std::string current_level = "/";
  std::string level;
  std::stringstream ss(path);
  // First line is empty because it starts with /User
  getline(ss, level, '/');
  // split path using slash as a separator
  while (getline(ss, level, '/')) {
    current_level += level; // append folder to the current level
    // create current level
    if (!folder_exists(current_level) && _mkdir(current_level.c_str()) != 0)
      return -1;

    current_level += "/"; // don't forget to append a slash
  }

  return 0;
}

inline bool file_exists(const std::string& path) {
  struct stat buffer;
  return (stat(path.c_str(), &buffer) == 0);
}

/**
 * Whether `dbName` names a private in-memory database: `:memory:`, optionally followed by a label, such as
 * `:memory:player_stats`. The label is only the connection's name, so each labelled database is a separate one.
 */
inline bool is_memory_db(const std::string& dbName) {
  return dbName.rfind(":memory:", 0) == 0;
}

std::string get_db_path(const std::string& dbName, const std::string& docPath) {
  // SQLite opens an in-memory database only for the exact name `:memory:`, so a label must not reach it.
  if (is_memory_db(dbName)) {
    return ":memory:";
  }
  mkdir(docPath.c_str());
  return docPath + "/" + dbName;
}

} // namespace margelo::rnnitrosqlite
