"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Builder = void 0;
const fs = require("fs");
const path = require("path");
const mime = require("mime-types");
const UglifyJS = require("uglify-js");
const strip = require("strip-comments");
const child_process_1 = require("child_process");
const obfucator = require("javascript-obfuscator");
const BuildHandle_1 = require("./BuildHandle");
const BuildOption_1 = require("./BuildOption");
const nktj_cli_1 = require("nktj_cli");
class Builder {
    /**
     * web builder
     * @param option
     * @returns
     */
    static build(option) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!option) {
                try {
                    option = require(process.cwd() + "/mikeneko.json");
                }
                catch (error) {
                    nktj_cli_1.CLI.outn(nktj_cli_1.CLI.setColor(`[Build Error] Not found "mikeneko.json".`, nktj_cli_1.Color.Red));
                    return;
                }
            }
            const argsOption = nktj_cli_1.CLI.getArgsOPtion();
            let platformnames = [];
            let selectPlatform;
            if (argsOption["platform"] || argsOption["p"]) {
                if (argsOption["platform"])
                    selectPlatform = argsOption["platform"];
                if (argsOption["p"])
                    selectPlatform = argsOption["p"];
            }
            for (let n = 0; n < option.platforms.length; n++) {
                const platform = option.platforms[n];
                platformnames.push(platform.name);
                if (selectPlatform) {
                    if (platform.name != selectPlatform) {
                        platform.disable = true;
                    }
                }
            }
            let corelibTsc = false;
            if (argsOption["corelibtsc"] || argsOption["force"])
                corelibTsc = true;
            if (!option)
                option = {};
            if (option.platforms == undefined)
                option.platforms = [{ name: "web" }];
            nktj_cli_1.CLI.outn("** mikeneko build start **");
            const rootDir = process.cwd();
            if (!fs.existsSync(rootDir + "/node_modules/mikeneko-corelib/package.json")) {
                try {
                    yield this.installCoreLib(rootDir);
                }
                catch (error) {
                    nktj_cli_1.CLI.outn(error);
                    nktj_cli_1.CLI.outn(nktj_cli_1.CLI.setColor(" .... Install Failed!", nktj_cli_1.Color.Red));
                    return;
                }
            }
            let CoreLibList = require(rootDir + "/node_modules/mikeneko-corelib/list.json");
            // plugin library add
            let pluginList = [];
            if (option.plugins) {
                for (let n = 0; n < option.plugins.length; n++) {
                    const libname = option.plugins[n];
                    if (fs.existsSync(rootDir + "/node_modules/" + libname + "/package.json") &&
                        fs.existsSync(rootDir + "/node_modules/" + libname + "/list.json")) {
                        pluginList.push({
                            libname: libname,
                            list: require(rootDir + "/node_modules/" + libname + "/list.json"),
                        });
                    }
                    else {
                        nktj_cli_1.CLI.outn(nktj_cli_1.CLI.setColor("# [WARM] Unable to find package \"" + libname + "\" as plugin.", nktj_cli_1.Color.Orange));
                    }
                }
            }
            // typescript trance complie
            let tsType = "es6";
            const tsType_ = this.getTsType(rootDir);
            if (tsType_)
                tsType = tsType_;
            nktj_cli_1.CLI.setIndent(4).br();
            let platformText = platformnames.join(", ");
            if (selectPlatform)
                platformText = selectPlatform;
            nktj_cli_1.CLI.outData({
                "TypeSCript Type": tsType,
                "corelibtsc": corelibTsc,
                "root": rootDir,
                "platform": platformText,
            });
            nktj_cli_1.CLI.br().setIndent(0);
            // trancecomplie in core library trancecomplie on select type 
            try {
                yield this.typescriptComplieCoreLib(rootDir, tsType, corelibTsc);
            }
            catch (error) {
                nktj_cli_1.CLI.outn("[TypeScript TrancePlie CoreLib Error]", nktj_cli_1.Color.Red);
                nktj_cli_1.CLI.outn(error);
                nktj_cli_1.CLI.outn("...... " + nktj_cli_1.CLI.setColor("Failed!", nktj_cli_1.Color.Red));
                return;
            }
            // trancecomplie in plugin
            for (let n = 0; n < pluginList.length; n++) {
                const lib = pluginList[n];
                try {
                    yield this.typescriptCompliePlugin(rootDir, tsType, corelibTsc, lib);
                }
                catch (error) {
                    nktj_cli_1.CLI.outn("[TypeScript TrancePlie Plugin Error (" + lib.libname + ")]", nktj_cli_1.Color.Red);
                    nktj_cli_1.CLI.outn(error);
                    nktj_cli_1.CLI.outn("...... " + nktj_cli_1.CLI.setColor("Failed!", nktj_cli_1.Color.Red));
                    return;
                }
            }
            // trancecomplie in local content
            try {
                yield this.typescriptComplieLocal(tsType);
            }
            catch (error) {
                nktj_cli_1.CLI.outn("[TypeScript TrancePlie Error]", nktj_cli_1.Color.Red);
                nktj_cli_1.CLI.outn(error);
                nktj_cli_1.CLI.outn("...... " + nktj_cli_1.CLI.setColor("Failed!", nktj_cli_1.Color.Red));
                return;
            }
            // mkdir
            const buildDir = rootDir + "/output";
            this.outMkdir(buildDir);
            for (let n = 0; n < option.platforms.length; n++) {
                // platforms building 
                let platform = option.platforms[n];
                if (platform.disable)
                    continue;
                if (!platform.build)
                    platform.build = BuildOption_1.BuildType.WebBuilder;
                if (!platform.buildType)
                    platform.buildType = BuildOption_1.BuildPlatformType.Web;
                let platformOptionClass;
                try {
                    const pbName = "Platform" + platform.buildType.substring(0, 1).toUpperCase() + platform.buildType.substring(1);
                    const pbModuleName = "mikeneko-platform-" + platform.buildType;
                    const pbPath = require.resolve(pbModuleName);
                    const pb_ = require(pbModuleName);
                    if (pb_[pbName]) {
                        platformOptionClass = pb_[pbName];
                        platformOptionClass.__dirname = pbPath;
                    }
                }
                catch (error) { }
                if (platformOptionClass) {
                    const p_ = platformOptionClass.handleBuildBegin(platform);
                    if (p_)
                        platform = p_;
                }
                let buildhandle = BuildHandle_1.BuildHandle;
                try {
                    buildhandle = require(rootDir + "/src/BuildHandle").BuildHandle;
                }
                catch (error) { }
                if (!buildhandle) {
                    try {
                        buildhandle = require(rootDir + "/src_" + platform.name + "/BuildHandle").BuildHandle;
                    }
                    catch (error) { }
                }
                nktj_cli_1.CLI.outn(nktj_cli_1.CLI.setColor("# ", nktj_cli_1.Color.Green) + "platform = " + platform.name + ", buildType = " + platform.buildType);
                // create platform directory
                let platformDir = buildDir + "/" + platform.name;
                if (platform.optionDir)
                    platformDir += "/" + platform.optionDir;
                if (platform.build == BuildOption_1.BuildType.webpack) {
                    this.buildWebPack(rootDir, platformDir, tsType, platform, CoreLibList, pluginList, platformOptionClass, buildhandle);
                    return;
                }
                this.outMkdir(platformDir, true);
                platform.outPath = platformDir;
                platform.path = buildDir + "/" + platform.name;
                // build handle begin
                buildhandle.handleBegin(platform);
                // code set
                let codeList = {};
                // start head
                let debug = false;
                if (platform.debug != undefined)
                    debug = platform.debug;
                this.jsStart(rootDir, codeList, tsType, platform.name, debug);
                // core module mount
                CoreLibList.forEach((core) => {
                    // core module mount
                    this.coreModuleMount(rootDir, codeList, tsType, core, platform);
                });
                // plugin module mount
                pluginList.forEach(lib => {
                    this.pluginModuleMount(rootDir, codeList, tsType, lib, platform);
                });
                if (platformOptionClass) {
                    const addModule = (name, modulePath) => {
                        if (!modulePath)
                            modulePath = name;
                        console.log("# core module mount".padEnd(20) + " " + name);
                        const fullPath = path.dirname(platformOptionClass.__dirname) + "/dist/" + tsType + "/" + modulePath + ".js";
                        let contents = fs.readFileSync(fullPath).toString();
                        contents = "var exports = {};\n" + contents + ";\nreturn exports;";
                        codeList[name] = this.setFn(name, contents, true, platform);
                    };
                    platformOptionClass.handleCoreModuleMount(addModule);
                }
                // core resource mount
                this.coreResourceMount(rootDir, codeList, platform);
                // plugin resource mount
                pluginList.forEach(lib => {
                    this.pluginResourceMount(rootDir, codeList, lib, platform);
                });
                // local module mount
                this.localModuleMount(codeList, rootDir, platform.name, platform);
                // rendering html mount
                this.renderingHtmMount(codeList, rootDir, platform.name, platform);
                // public content mount
                this.resourceContentMount(codeList, rootDir, platform.name, platform);
                // end foot
                this.jsEnd(codeList, platform);
                let coreStr = Object.values(codeList).join("");
                // code compress
                let codeCompress = false;
                if (platform.codeCompress != undefined)
                    codeCompress = platform.codeCompress;
                if (codeCompress)
                    coreStr = this.codeCompress(coreStr);
                // code obfuscated
                let obfuscated = false;
                if (platform.obfuscated != undefined)
                    obfuscated = platform.obfuscated;
                if (obfuscated)
                    coreStr = this.codeObfuscate(coreStr);
                nktj_cli_1.CLI.outn(nktj_cli_1.CLI.setColor("# ", nktj_cli_1.Color.Green) + "write index.js");
                fs.writeFileSync(platformDir + "/index.js", coreStr);
                nktj_cli_1.CLI.outn(nktj_cli_1.CLI.setColor("# ", nktj_cli_1.Color.Green) + "write index.html");
                let indexHTML = "<!DOCTYPE html><head><meta charset=\"UTF-8\"><script src=\"index.js\"></script></head><body></body></html>";
                if (platformOptionClass) {
                    const htmlBuffer = platformOptionClass.handleCreateIndexHTML();
                    if (htmlBuffer)
                        indexHTML = htmlBuffer;
                }
                fs.writeFileSync(platformDir + "/index.html", indexHTML);
                nktj_cli_1.CLI.outn(nktj_cli_1.CLI.setColor("# ", nktj_cli_1.Color.Green) + "Web Build Comlete.");
                if (platformOptionClass) {
                    platformOptionClass.handleWebBuildCompleted(platform);
                }
                nktj_cli_1.CLI.outn(nktj_cli_1.CLI.setColor("# ", nktj_cli_1.Color.Green) + "........ platform = " + platform.name + " ok");
                // build handle platform  complete
                buildhandle.handleComplete(platform);
            }
            nktj_cli_1.CLI.br().outn("...... Complete!", nktj_cli_1.Color.Green);
        });
    }
    static installCoreLib(rootDir) {
        nktj_cli_1.CLI.wait(nktj_cli_1.CLI.setColor("# ", nktj_cli_1.Color.Green) + "Install 'mikeneko-corelib' ...");
        return new Promise((resolve, reject) => {
            (0, child_process_1.exec)("npm i mikeneko-corelib --prefix " + rootDir, (error, stdout, stderr) => {
                if (error) {
                    nktj_cli_1.CLI.waitClose(nktj_cli_1.CLI.setColor("NG", nktj_cli_1.Color.Red));
                    reject(stderr);
                }
                else {
                    nktj_cli_1.CLI.waitClose(nktj_cli_1.CLI.setColor("OK", nktj_cli_1.Color.Green));
                    resolve(true);
                }
            });
        });
    }
    static jsStart(rootDir, codeList, tsType, platformName, debugMode) {
        nktj_cli_1.CLI.outn(nktj_cli_1.CLI.setColor("# ", nktj_cli_1.Color.Green) + "build Start");
        let content = fs.readFileSync(rootDir + "/dist/corelib/Front.js").toString();
        content = content.split("{{platform}}").join(platformName);
        if (!debugMode)
            content += "console.log=()=>{};console.error=()=>{};\n";
        codeList.___HEADER = content;
    }
    static setFn(name, content, rawFlg, platform) {
        let afterContent;
        if (rawFlg) {
            afterContent = "sfa.setFn(\"" + name + "\", ()=>{" + content + "});\n";
        }
        else {
            afterContent = "sfa.setFn(\"" + name + "\", ()=>{ return " + content + "});\n";
        }
        if (platform.mapping) {
            afterContent = this.contentEvalReplace(afterContent);
            if (name.indexOf("app/") === -1 && name.indexOf("rendering") === -1 && name.indexOf("resource") === -1) {
                name = "libs/" + name;
            }
            else {
                name = "src/" + name;
            }
            afterContent += "//# sourceURL=mikeneko:///" + name;
            return "eval(\"" + afterContent + "\");\n";
        }
        return afterContent;
    }
    static contentEvalReplace(content) {
        content = content.replace(/\\/g, '\\\\');
        content = content.replace(/\r/g, '\\r');
        content = content.replace(/\n/g, '\\n');
        content = content.replace(/\'/g, "\\'");
        content = content.replace(/\"/g, '\\"');
        content = content.replace(/\`/g, '\\`');
        return content;
    }
    static coreModuleMount(rootDir, codeList, tsType, name, platform) {
        nktj_cli_1.CLI.outn(nktj_cli_1.CLI.setColor("# ", nktj_cli_1.Color.Green) + "mount core".padEnd(20) + " " + name);
        const fullPath = rootDir + "/dist/corelib/" + name + ".js";
        let contents = fs.readFileSync(fullPath).toString();
        contents = "var exports = {};\n" + contents + ";\nreturn exports;";
        codeList[name] = this.setFn(name, contents, true, platform);
    }
    static pluginModuleMount(rootDir, codeList, tsType, lib, platform) {
        for (let n = 0; n < lib.list.length; n++) {
            const moduleName = lib.list[n];
            const modulePath = rootDir + "/dist/plugins/" + lib.libname + "/" + moduleName + ".js";
            nktj_cli_1.CLI.outn(nktj_cli_1.CLI.setColor("# ", nktj_cli_1.Color.Green) + "mount plugin".padEnd(20) + " " + moduleName);
            let contents = fs.readFileSync(modulePath).toString();
            contents = "var exports = {};\n" + contents + ";\nreturn exports;";
            codeList[moduleName] = this.setFn(moduleName, contents, true, platform);
        }
    }
    static coreResourceMount(rootDir, codeList, platform) {
        const targetPath = rootDir + "/node_modules/mikeneko-corelib/bin/res";
        this.search(targetPath, (file) => {
            const fullPath = file.path + "/" + file.name;
            let basePath = "CORERES/" + fullPath.substring((targetPath + "/").length);
            basePath = basePath.split("\\").join("/");
            basePath = basePath.split("//").join("/");
            const contentB64 = Buffer.from(fs.readFileSync(fullPath)).toString("base64");
            codeList[basePath] = this.setFn(basePath, "\"" + contentB64 + "\"", false, platform);
            nktj_cli_1.CLI.outn(nktj_cli_1.CLI.setColor("# ", nktj_cli_1.Color.Green) + "mount coreres".padEnd(20) + " " + basePath);
        });
    }
    static pluginResourceMount(rootDir, codeList, lib, platform) {
        const targetPath = rootDir + "/node_modules/" + lib.libname + "/bin/res";
        this.search(targetPath, (file) => {
            const fullPath = file.path + "/" + file.name;
            let basePath = "CORERES/" + lib.libname + "/" + fullPath.substring((targetPath + "/").length);
            basePath = basePath.split("\\").join("/");
            basePath = basePath.split("//").join("/");
            const contentB64 = Buffer.from(fs.readFileSync(fullPath)).toString("base64");
            codeList[basePath] = this.setFn(basePath, "\"" + contentB64 + "\"", false, platform);
            nktj_cli_1.CLI.outn(nktj_cli_1.CLI.setColor("# ", nktj_cli_1.Color.Green) + "mount pluginres".padEnd(20) + " " + basePath);
        });
    }
    static localModuleMount(codeList, rootDir, platformName, platform) {
        let targetPaths = [
            rootDir + "/dist/src/app",
            rootDir + "/dist/src_" + platformName + "/app",
        ];
        let strs = "";
        targetPaths.forEach((targetPath) => {
            this.search(targetPath, (file) => {
                if (path.extname(file.name) != ".js")
                    return;
                const fullPath = file.path + "/" + file.name;
                let basePath = "app/" + file.path.substring((targetPath + "/").length) + "/" + file.name.substring(0, file.name.length - path.extname(file.name).length);
                basePath = basePath.split("\\").join("/");
                basePath = basePath.split("//").join("/");
                let contents = fs.readFileSync(fullPath).toString();
                contents = "var exports = {};\n" + contents + ";\nreturn exports;";
                codeList[basePath] = this.setFn(basePath, contents, true, platform);
                nktj_cli_1.CLI.outn(nktj_cli_1.CLI.setColor("# ", nktj_cli_1.Color.Green) + "mount local".padEnd(20) + " " + basePath);
            });
        });
        return strs;
    }
    static jsEnd(codeList, platform) {
        nktj_cli_1.CLI.outn(nktj_cli_1.CLI.setColor("# ", nktj_cli_1.Color.Green) + "build End");
        codeList.___FOOTER = "sfa.start(()=>{ const st = use(\"Startor\");  new st.Startor(); });";
    }
    static resourceContentMount(codeList, rootDir, platformName, platform) {
        let targetPaths = [
            rootDir + "/src/resource",
            rootDir + "/src_" + platformName + "/resource",
        ];
        let strs = "";
        targetPaths.forEach((targetPath) => {
            this.search(targetPath, (file) => {
                const fullPath = file.path + "/" + file.name;
                let basePath = "resource/" + fullPath.substring((targetPath + "/").length);
                basePath = basePath.split("\\").join("/");
                basePath = basePath.split("//").join("/");
                const contentB64 = Buffer.from(fs.readFileSync(fullPath)).toString("base64");
                const mimeType = mime.lookup(basePath);
                let plstr = "";
                if (targetPath != rootDir + "/src/resource") {
                    plstr = "(" + platformName + ")";
                }
                codeList[basePath] = this.setFn(basePath, "\"" + mimeType + "|" + contentB64 + "\"", false, platform);
                nktj_cli_1.CLI.outn(nktj_cli_1.CLI.setColor("# ", nktj_cli_1.Color.Green) + "mount localres".padEnd(20) + " " + basePath);
            });
        });
        return strs;
    }
    static renderingHtmMount(codeList, rootDir, platformName, platform) {
        let targetPaths = [
            rootDir + "/src/rendering",
            rootDir + "/src_" + platformName + "/rendering",
        ];
        let strs = "";
        targetPaths.forEach((targetPath) => {
            this.search(targetPath, (file) => {
                const fullPath = file.path + "/" + file.name;
                let basePath = "rendering/" + fullPath.substring((targetPath + "/").length);
                basePath = basePath.split("\\").join("/");
                basePath = basePath.split("//").join("/");
                const contentB64 = Buffer.from(fs.readFileSync(fullPath)).toString("base64");
                let plstr = "";
                if (targetPath != rootDir + "/src/rendering") {
                    plstr = "(" + platformName + ")";
                }
                codeList[basePath] = this.setFn(basePath, "\"" + contentB64 + "\";", false, platform);
                nktj_cli_1.CLI.outn(nktj_cli_1.CLI.setColor("# ", nktj_cli_1.Color.Green) + "mount render".padEnd(20) + " " + basePath);
            });
        });
        return strs;
    }
    static search(target, callback) {
        if (!fs.existsSync(target))
            return;
        if (!fs.statSync(target).isDirectory())
            return;
        const list = fs.readdirSync(target, {
            withFileTypes: true,
        });
        for (let n = 0; n < list.length; n++) {
            const l_ = list[n];
            if (l_.isDirectory()) {
                this.search(target + "/" + l_.name, callback);
            }
            else {
                // node.js v14 under support.
                const file = l_;
                file.path = target;
                callback(l_);
            }
        }
    }
    static typescriptComplieLocal(tsType) {
        return __awaiter(this, void 0, void 0, function* () {
            nktj_cli_1.CLI.wait(nktj_cli_1.CLI.setColor("# ", nktj_cli_1.Color.Green) + "TranceComplie ...");
            return new Promise((resolve, reject) => {
                (0, child_process_1.exec)("tsc --pretty", (error, stdout, stderr) => {
                    if (error) {
                        nktj_cli_1.CLI.waitClose(nktj_cli_1.CLI.setColor("NG", nktj_cli_1.Color.Red));
                        reject(stdout);
                    }
                    else {
                        nktj_cli_1.CLI.waitClose(nktj_cli_1.CLI.setColor("OK", nktj_cli_1.Color.Green));
                        resolve(tsType);
                    }
                });
            });
        });
    }
    static typescriptComplieCoreLib(rootDir, tsType, corelibtsc) {
        return __awaiter(this, void 0, void 0, function* () {
            const libPath = rootDir + "/node_modules/mikeneko-corelib";
            const binPath = libPath + "/bin";
            const distPath = rootDir + "/dist";
            const outPath = rootDir + "/dist/corelib";
            if (!corelibtsc) {
                if (fs.existsSync(outPath))
                    return;
            }
            if (!fs.existsSync(distPath))
                fs.mkdirSync(distPath);
            if (!fs.existsSync(outPath))
                fs.mkdirSync(outPath);
            let forceStr = "";
            nktj_cli_1.CLI.wait(nktj_cli_1.CLI.setColor("# ", nktj_cli_1.Color.Green) + forceStr + "TranceComplie (Core Library) ...");
            fs.mkdirSync(outPath, { recursive: true });
            return new Promise((resolve, reject) => {
                this.corelibDelete(outPath);
                (0, child_process_1.exec)("cd " + binPath + " && tsc --outdir " + outPath + " --project tsconfigs/" + tsType + ".json", (error, stdout, stderr) => {
                    if (error) {
                        nktj_cli_1.CLI.waitClose(nktj_cli_1.CLI.setColor("NG", nktj_cli_1.Color.Red));
                        reject(stdout);
                    }
                    else {
                        nktj_cli_1.CLI.waitClose(nktj_cli_1.CLI.setColor("OK", nktj_cli_1.Color.Green));
                        resolve(tsType);
                    }
                });
            });
        });
    }
    static typescriptCompliePlugin(rootDir, tsType, corelibtsc, lib) {
        const libPath = rootDir + "/node_modules/" + lib.libname;
        const binPath = libPath + "/bin";
        const distPath = rootDir + "/dist";
        const pluginPath = distPath + "/plugins";
        const outPath = pluginPath + "/" + lib.libname;
        if (!corelibtsc) {
            if (fs.existsSync(outPath))
                return;
        }
        let forceStr = "";
        nktj_cli_1.CLI.wait(nktj_cli_1.CLI.setColor("# ", nktj_cli_1.Color.Green) + forceStr + "TranceComplie (plugin = " + lib.libname + ") ...");
        if (!fs.existsSync(distPath))
            fs.mkdirSync(distPath);
        if (!fs.existsSync(pluginPath))
            fs.mkdirSync(pluginPath);
        if (!fs.existsSync(outPath))
            fs.mkdirSync(outPath);
        return new Promise((resolve, reject) => {
            this.corelibDelete(outPath);
            (0, child_process_1.exec)("cd " + binPath + " && tsc --project ../tsconfigs/" + tsType + ".json --outdir " + outPath, (error, stdout, stderr) => {
                if (error) {
                    nktj_cli_1.CLI.waitClose(nktj_cli_1.CLI.setColor("NG", nktj_cli_1.Color.Red));
                    reject(stdout);
                }
                else {
                    nktj_cli_1.CLI.waitClose(nktj_cli_1.CLI.setColor("OK", nktj_cli_1.Color.Green));
                    resolve(tsType);
                }
            });
        });
    }
    static corelibDelete(distTsTypePath) {
        const lists = fs.readdirSync(distTsTypePath);
        for (let n = 0; n < lists.length; n++) {
            const l_ = distTsTypePath + "/" + lists[n];
            fs.unlinkSync(l_);
        }
        fs.rmdirSync(distTsTypePath);
    }
    static outMkdir(rootDir, alreadyDeleted) {
        nktj_cli_1.CLI.outn(nktj_cli_1.CLI.setColor("# ", nktj_cli_1.Color.Green) + "mkdir " + rootDir);
        if (alreadyDeleted) {
            if (fs.existsSync(rootDir)) {
                nktj_cli_1.CLI.outn(nktj_cli_1.CLI.setColor("# ", nktj_cli_1.Color.Green) + "already directory .... clear");
                fs.rmSync(rootDir, {
                    recursive: true,
                });
            }
        }
        fs.mkdirSync(rootDir, {
            recursive: true,
        });
    }
    static codeCompress(code) {
        // Delete comment
        nktj_cli_1.CLI.outn(nktj_cli_1.CLI.setColor("# ", nktj_cli_1.Color.Green) + "code compress ...");
        const strippedCode = strip(code);
        // Compress JavaScript code
        const result = UglifyJS.minify(strippedCode);
        if (result.error)
            throw result.error;
        return result.code;
    }
    static codeObfuscate(code) {
        nktj_cli_1.CLI.outn(nktj_cli_1.CLI.setColor("# ", nktj_cli_1.Color.Green) + "code obfuscate .... ");
        code = obfucator.obfuscate(code).getObfuscatedCode();
        return code;
    }
    static getTsType(rootDir) {
        let tsConfig, tsType;
        try {
            tsConfig = require(rootDir + "/tsconfig.json");
            if (!tsConfig.compilerOptions)
                return;
            if (!tsConfig.compilerOptions.target)
                return;
            tsType = tsConfig.compilerOptions.target;
        }
        catch (error) {
            return;
        }
        return tsType;
    }
    static buildWebPack(rootDir, platformDir, tscType, platform, CoreLibList, pluginList, platformOptionClass, buildhandle) {
        return __awaiter(this, void 0, void 0, function* () {
            this.setWebPackDist(rootDir, platformDir, tscType, CoreLibList, pluginList);
            this.setWebpackComponent(platformDir);
            try {
                yield this.webPackExec(platform.name);
            }
            catch (error) {
                nktj_cli_1.CLI.outn("[Webpack Build Error]", nktj_cli_1.Color.Red);
                nktj_cli_1.CLI.outn(error);
                nktj_cli_1.CLI.outn("...... " + nktj_cli_1.CLI.setColor("Failed!", nktj_cli_1.Color.Red));
                return;
            }
            nktj_cli_1.CLI.outn(nktj_cli_1.CLI.setColor("# ", nktj_cli_1.Color.Green) + "write index.html");
            let indexHTML = "<!DOCTYPE html><head><meta charset=\"UTF-8\"><script src=\"index.js\"></script></head><body></body></html>";
            if (platformOptionClass) {
                const htmlBuffer = platformOptionClass.handleCreateIndexHTML();
                if (htmlBuffer)
                    indexHTML = htmlBuffer;
            }
            fs.writeFileSync(platformDir + "/www/index.html", indexHTML);
            nktj_cli_1.CLI.br().outn("...... Complete!", nktj_cli_1.Color.Green);
        });
    }
    static webPackExec(platformName) {
        nktj_cli_1.CLI.wait(nktj_cli_1.CLI.setColor("# ", nktj_cli_1.Color.Green) + "webpack build ...");
        return new Promise((resolve, reject) => {
            (0, child_process_1.exec)("cd output/" + platformName + " && webpack", (error, stdout) => {
                if (error) {
                    nktj_cli_1.CLI.waitClose(nktj_cli_1.CLI.setColor("NG", nktj_cli_1.Color.Red));
                    reject(stdout);
                }
                else {
                    nktj_cli_1.CLI.waitClose(nktj_cli_1.CLI.setColor("OK", nktj_cli_1.Color.Green));
                    nktj_cli_1.CLI.outn(stdout);
                    resolve(true);
                }
            });
        });
    }
    static setWebPackDist(rootDir, platformDir, tscType, CoreLibList, pluginList) {
        if (!fs.existsSync(platformDir)) {
            nktj_cli_1.CLI.outn(nktj_cli_1.CLI.setColor("# ", nktj_cli_1.Color.Green) + "mkdir " + platformDir);
            fs.mkdirSync(platformDir);
        }
        const distDir = platformDir + "/dist";
        if (fs.existsSync(distDir)) {
            let lists = fs.readdirSync(distDir, { recursive: true });
            for (let n = 0; n < lists.length; n++) {
                const l_ = distDir + "/" + lists[n];
                if (fs.statSync(l_).isFile())
                    fs.unlinkSync(l_);
            }
        }
        else {
            fs.mkdirSync(distDir);
        }
        CoreLibList.push("FrontWebPack");
        // core library set
        if (!fs.existsSync(distDir + "/core")) {
            fs.mkdirSync(distDir + "/core");
        }
        const distLibPath = rootDir + "/dist/corelib";
        for (let n = 0; n < CoreLibList.length; n++) {
            const coreName = CoreLibList[n];
            fs.copyFileSync(distLibPath + "/" + coreName + ".js", distDir + "/core/" + coreName + ".js");
        }
        const pluginPath = rootDir + "/dist/plugins";
        for (let n = 0; n < pluginList.length; n++) {
            const plugin = pluginList[n];
            const pluginName = plugin.libname;
            for (let n2 = 0; n2 < plugin.list.length; n2++) {
                const moduleName = plugin.list[n2];
                const modulePath = pluginPath + "/" + pluginName + "/" + moduleName + ".js";
                fs.copyFileSync(modulePath, distDir + "/core/" + moduleName + ".js");
            }
        }
        // CORERES set
        if (!fs.existsSync(distDir + "/CORERES")) {
            fs.mkdirSync(distDir + "/CORERES");
        }
        const coreresDir = rootDir + "/node_modules/mikeneko-corelib/bin/res";
        const coreresLIsts = fs.readdirSync(coreresDir, { recursive: true });
        for (let n = 0; n < coreresLIsts.length; n++) {
            const l_ = coreresLIsts[n];
            const fulll_ = coreresDir + "/" + coreresLIsts[n];
            if (fs.statSync(fulll_).isDirectory()) {
                if (!fs.existsSync(distDir + "/CORERES/" + l_)) {
                    fs.mkdirSync(distDir + "/CORERES/" + l_);
                }
            }
            else {
                fs.copyFileSync(fulll_, distDir + "/CORERES/" + l_);
            }
        }
        for (let n = 0; n < pluginList.length; n++) {
            const plugin = pluginList[n];
            const pluginName = plugin.libname;
            const pluginResPath = rootDir + "/node_modules/" + pluginName + "/bin/res";
            if (!fs.existsSync(pluginResPath))
                continue;
            const distPluginPath = distDir + "/CORERES/" + pluginName;
            const coreresLIsts = fs.readdirSync(pluginResPath, { recursive: true });
            for (let n = 0; n < coreresLIsts.length; n++) {
                const l_ = coreresLIsts[n];
                const fulll_ = pluginResPath + "/" + coreresLIsts[n];
                if (!fs.existsSync(distPluginPath)) {
                    fs.mkdirSync(distPluginPath);
                }
                if (fs.statSync(fulll_).isDirectory()) {
                    if (!fs.existsSync(distPluginPath + "//" + l_)) {
                        fs.mkdirSync(distPluginPath + "/" + l_);
                    }
                }
                else {
                    fs.copyFileSync(fulll_, distPluginPath + "/" + l_);
                }
            }
        }
        // app list set
        if (!fs.existsSync(distDir + "/app")) {
            fs.mkdirSync(distDir + "/app");
        }
        const appDistDir = path.dirname(path.dirname(platformDir)) + "/dist/src/app";
        const appLists = fs.readdirSync(appDistDir, { recursive: true });
        for (let n = 0; n < appLists.length; n++) {
            const l_ = appLists[n];
            const fulll_ = appDistDir + "/" + appLists[n];
            if (fs.statSync(fulll_).isDirectory()) {
                if (!fs.existsSync(distDir + "/app/" + l_)) {
                    fs.mkdirSync(distDir + "/app/" + l_);
                }
            }
            else {
                fs.copyFileSync(fulll_, distDir + "/app/" + l_);
            }
        }
        // rendering set
        if (!fs.existsSync(distDir + "/rendering")) {
            fs.mkdirSync(distDir + "/rendering");
        }
        const renderingDir = path.dirname(path.dirname(platformDir)) + "/src/rendering";
        const renderingLists = fs.readdirSync(renderingDir, { recursive: true });
        for (let n = 0; n < renderingLists.length; n++) {
            const l_ = renderingLists[n];
            const fulll_ = renderingDir + "/" + renderingLists[n];
            if (fs.statSync(fulll_).isDirectory()) {
                if (!fs.existsSync(distDir + "/rendering/" + l_)) {
                    fs.mkdirSync(distDir + "/rendering/" + l_);
                }
            }
            else {
                fs.copyFileSync(fulll_, distDir + "/rendering/" + l_);
            }
        }
        // resource set
        if (!fs.existsSync(distDir + "/resource")) {
            fs.mkdirSync(distDir + "/resource");
        }
        const resourceDir = path.dirname(path.dirname(platformDir)) + "/src/resource";
        const resourceLIsts = fs.readdirSync(resourceDir, { recursive: true });
        for (let n = 0; n < resourceLIsts.length; n++) {
            const l_ = resourceLIsts[n];
            const fulll_ = resourceDir + "/" + resourceLIsts[n];
            if (fs.statSync(fulll_).isDirectory()) {
                if (!fs.existsSync(distDir + "/resource/" + l_)) {
                    fs.mkdirSync(distDir + "/resource/" + l_);
                }
            }
            else {
                fs.copyFileSync(fulll_, distDir + "/resource/" + l_);
            }
        }
    }
    static setWebpackComponent(platformDir) {
        if (!fs.existsSync(platformDir + "/webpack.config.js")) {
            nktj_cli_1.CLI.outn("# make webpack.config.js");
            fs.copyFileSync(path.dirname(__dirname) + "/res/webpack/webpack.config.js", platformDir + "/webpack.config.js");
        }
        if (!fs.existsSync(platformDir + "/custom-loader.js")) {
            nktj_cli_1.CLI.outn("# make custom-loader.js");
            fs.copyFileSync(path.dirname(__dirname) + "/res/webpack/custom-loader.js", platformDir + "/custom-loader.js");
        }
        let str = "export const WebPackComponent = {\n";
        const list = fs.readdirSync(platformDir + "/dist", { recursive: true });
        for (let n = 0; n < list.length; n++) {
            const dirBase = platformDir + "/dist/" + list[n];
            if (fs.statSync(dirBase).isDirectory())
                continue;
            const dir = (dirBase).split("\\").join("/");
            let dirPath = dir.substring((platformDir + "/dist/").length);
            if (path.extname(dirPath) === ".js") {
                dirPath = dirPath.replace(/(\.[\w\d]+)$/i, '');
            }
            if (dirPath.indexOf("core/") === 0)
                dirPath = dirPath.substring("core/".length);
            str += "\"" + dirPath + "\" : require(\"" + dirPath + "\"),\n";
        }
        str += "};";
        fs.writeFileSync(platformDir + "/dist/WebPackComponent.js", str);
    }
}
exports.Builder = Builder;
