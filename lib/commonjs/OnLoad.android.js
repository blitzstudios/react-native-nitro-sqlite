"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.init = void 0;
var _reactNativeNitroModules = require("react-native-nitro-modules");
const NitroSQLiteOnLoad = _reactNativeNitroModules.NitroModules.createHybridObject('NitroSQLiteOnLoad');
const init = () => NitroSQLiteOnLoad.init();
exports.init = init;
//# sourceMappingURL=OnLoad.android.js.map