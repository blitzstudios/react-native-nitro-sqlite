#import <Foundation/Foundation.h>
#import "RNNitroSQLite-Swift-Cxx-Umbrella.hpp"
#import "HybridNitroSQLite.hpp"

@interface OnLoad : NSObject
@end

@implementation OnLoad

using namespace margelo::nitro;
using namespace margelo::nitro::rnnitrosqlite;

/**
 * Databases live in `Library/Application Support/NitroSQLite`, which is where Apple asks for a store the app
 * itself manages: it survives the OS reclaiming space, unlike `Caches`, and it is not exposed by File Sharing or
 * mixed in with the user's own files, unlike `Documents`.
 *
 * The directory is also excluded from iCloud and iTunes backup. A SQLite database an app fills from a server is
 * regenerable, so backing it up inflates every user's backup and can restore rows onto a new device that are
 * older than what the server would have given it. A consumer whose database is the only copy of something —
 * written on device and never re-derivable — should set `RNNitroSQLite_BackUpDatabases` to YES in Info.plist.
 *
 * Set `RNNitroSQLite_UseDocumentDirectory` to YES for the pre-1.1.1 behaviour of storing databases directly in
 * `Documents`; an app that already shipped databases there needs it, or its existing files are orphaned.
 */
static NSString *const kNitroSQLiteDirectoryName = @"NitroSQLite";

static BOOL boolFromInfoPlist(NSString *key) {
  id value = [[NSBundle mainBundle] objectForInfoDictionaryKey:key];
  return [value respondsToSelector:@selector(boolValue)] && [value boolValue];
}

/** Excluded on the directory rather than the file: SQLite adds `-wal` and `-shm` beside it later. */
static void excludeFromBackup(NSURL *directoryUrl) {
  NSError *error = nil;
  if (![directoryUrl setResourceValue:@YES forKey:NSURLIsExcludedFromBackupKey error:&error]) {
    // Not fatal: the databases are usable, they are just also in the user's backup.
    NSLog(@"[NitroSQLite] Could not exclude %@ from backup: %@", [directoryUrl path], error);
  }
}

+ (void)load {
  // Get appGroupID value from Info.plist using key "AppGroup"
  NSString *appGroupID = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"RNNitroSQLite_AppGroup"];
  NSFileManager *fileManager = [NSFileManager defaultManager];
  NSString *documentPath;

  if (appGroupID != nil) {
    // Get the app groups container storage url
    NSURL *storeUrl = [fileManager containerURLForSecurityApplicationGroupIdentifier:appGroupID];

    if (storeUrl == nil) {
      NSLog(@"Invalid AppGroup ID provided (%@). Check the value of \"AppGroup\" in your Info.plist file", appGroupID);
      @throw [NSException exceptionWithName:@"SQLiteInitializationException"
                                     reason:@"Error while initializing SQLite database (AppGroup)"
                                   userInfo:nil];
    }
    NSLog(@"Configured with AppGroup ID: %@", appGroupID);

    // A shared container is a deliberate choice about where the file goes, so it is left exactly as asked for.
    documentPath = [storeUrl path];
  } else if (boolFromInfoPlist(@"RNNitroSQLite_UseDocumentDirectory")) {
    NSArray *paths = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, true);
    documentPath = [paths objectAtIndex:0];
  } else {
    NSURL *appSupport = [fileManager URLForDirectory:NSApplicationSupportDirectory
                                           inDomain:NSUserDomainMask
                                  appropriateForURL:nil
                                             create:YES
                                              error:nil];
    NSURL *directoryUrl = [appSupport URLByAppendingPathComponent:kNitroSQLiteDirectoryName isDirectory:YES];

    NSError *createError = nil;
    // Created here and not left to the first `open`, because the backup flag can only be set on a path that exists.
    if ([fileManager createDirectoryAtURL:directoryUrl withIntermediateDirectories:YES attributes:nil error:&createError] ||
        [fileManager fileExistsAtPath:[directoryUrl path]]) {
      if (!boolFromInfoPlist(@"RNNitroSQLite_BackUpDatabases")) {
        excludeFromBackup(directoryUrl);
      }
      documentPath = [directoryUrl path];
    } else {
      // Application Support is unavailable for some reason; a working database beats the right directory.
      NSLog(@"[NitroSQLite] Could not create %@ (%@), falling back to the document directory", [directoryUrl path], createError);
      NSArray *paths = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, true);
      documentPath = [paths objectAtIndex:0];
    }
  }

  HybridNitroSQLite::docPath = [documentPath UTF8String];
}

@end
