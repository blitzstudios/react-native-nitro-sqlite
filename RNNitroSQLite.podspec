require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))
folly_compiler_flags = '-DFOLLY_NO_CONFIG -DFOLLY_MOBILE=1 -DFOLLY_USE_LIBCPP=1'

# SQLite's compile-time tuning. `SQLITE_THREADSAFE=1` (serialized) is the only
# supported setting for this fork: `executeAsync` runs statements on a
# background thread and `openSecondary` hands out a second connection to the
# same database, both of which are undefined behaviour without SQLite's mutexes.
sqlite_flags = '$(inherited) -DSQLITE_THREADSAFE=1 -DSQLITE_DQS=0 -DSQLITE_DEFAULT_MEMSTATUS=0 -DSQLITE_DEFAULT_WAL_SYNCHRONOUS=1 -DSQLITE_LIKE_DOESNT_MATCH_BLOBS=1 -DSQLITE_MAX_EXPR_DEPTH=0 -DSQLITE_OMIT_DEPRECATED=1 -DSQLITE_OMIT_PROGRESS_CALLBACK=1 -DSQLITE_OMIT_SHARED_CACHE=1 -DSQLITE_USE_ALLOCA=1'

# The shredder is simdjson, a header-only library whose speed comes almost
# entirely from inlining, and Debug builds compile pods at -O0. Left alone, a
# development build shreds several times slower than the app it ships in, which
# makes every cold-load measurement taken on one meaningless. Set
# NITRO_SQLITE_DEBUG_NATIVE=1 to keep -O0 when stepping through the C++.
debug_native = ENV['NITRO_SQLITE_DEBUG_NATIVE'] == '1'

Pod::Spec.new do |s|
  s.name         = "RNNitroSQLite"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]
  s.platforms    = { :ios => min_ios_version_supported, :visionos => "1.0" }
  s.source       = { :git => "https://github.com/margelo/react-native-nitro-sqlite.git", :tag => "#{s.version}" }

  s.source_files = [
    # Implementation (Swift)
    "ios/**/*.{swift}",
    # Autolinking/Registration (Objective-C++)
    "ios/**/*.{h,hpp,m,mm}",
    # Implementation (C++ objects)
    "cpp/**/*.{h,hpp,c,cpp}"
  ]

  xcconfig = {
    "WARNING_CFLAGS" => "-Wno-shorten-64-to-32 -Wno-comma -Wno-unreachable-code -Wno-conditional-uninitialized -Wno-deprecated-declarations",
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++20',
    'CLANG_CXX_LIBRARY' => 'libc++',
    'DEFINES_MODULE' => 'YES',
    "HEADER_SEARCH_PATHS" => [
      "${PODS_ROOT}/RCT-Folly",
    ],
    # One key: Xcode build settings are a flat map, so listing this twice drops
    # whichever assignment loses, and HAVE_FULLFSYNC is what makes a WAL commit
    # actually durable on iOS.
    "GCC_PREPROCESSOR_DEFINITIONS" => "$(inherited) HAVE_FULLFSYNC=1 FOLLY_NO_CONFIG FOLLY_CFG_NO_COROUTINES",
    "OTHER_CPLUSPLUSFLAGS" => folly_compiler_flags,
    "OTHER_CFLAGS" => sqlite_flags,
  }

  xcconfig["GCC_OPTIMIZATION_LEVEL"] = "s" unless debug_native

  s.pod_target_xcconfig = xcconfig

  load 'nitrogen/generated/ios/RNNitroSQLite+autolinking.rb'
  add_nitrogen_files(s)

  install_modules_dependencies(s)

  if ENV['NITRO_SQLITE_USE_PHONE_VERSION'] == '1' then
    s.exclude_files = "cpp/sqlite/sqlite3.c", "cpp/sqlite/sqlite3.h"
    s.library = "sqlite3"
  end
end
