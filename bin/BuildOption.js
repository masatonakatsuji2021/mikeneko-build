"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BuildPlatformType = exports.BuildType = void 0;
var BuildType;
(function (BuildType) {
    BuildType["WebBuilder"] = "webBuilder";
    BuildType["webpack"] = "webpack";
})(BuildType || (exports.BuildType = BuildType = {}));
var BuildPlatformType;
(function (BuildPlatformType) {
    /** Web */
    BuildPlatformType["Web"] = "web";
    /** Cordova */
    BuildPlatformType["Cordova"] = "cordova";
    /** Capacitor */
    BuildPlatformType["Capacitor"] = "capacitor";
    /** Electro */
    BuildPlatformType["Electron"] = "electron";
})(BuildPlatformType || (exports.BuildPlatformType = BuildPlatformType = {}));
