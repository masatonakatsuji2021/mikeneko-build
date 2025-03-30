import * as fs from "fs";
import * as path from "path";
import * as mime from "mime-types";
import * as UglifyJS  from "uglify-js";
import * as strip from "strip-comments";
import { exec } from "child_process";
import * as obfucator from "javascript-obfuscator";
import { BuildOption, BuildPlatform, BuildPlatformType, BuildType } from "./BuildOption";
import { CLI, Color } from "nktj_cli";

export class Builder {

    /**
     * web builder
     * @param option 
     * @returns 
     */
    public static async build(option? : BuildOption) {
        if (!option) {
            try {
                option = require(process.cwd() + "/mikeneko.json");
            } catch (error) {
                CLI.outn(CLI.setColor(`[Build Error] Not found "mikeneko.json".`,Color.Red));
                return;
            }
        }

        const argsOption = CLI.getArgsOPtion();
        let platformnames = [];
        let selectPlatform : string;
        if (argsOption["platform"] || argsOption["p"]) {

            if (argsOption["platform"]) selectPlatform = argsOption["platform"];
            if (argsOption["p"]) selectPlatform = argsOption["p"];
        }

        for(let n = 0 ; n< option.platforms.length ; n++) {
            const platform = option.platforms[n];
            platformnames.push(platform.name);
            if (selectPlatform) {
                if (platform.name != selectPlatform) {
                    platform.disable = true;
                }
            }
            if (platform.hooks) {
                if (typeof platform.hooks == "string") platform.hooks = [ platform.hooks ];
                platform.hookClass = [];
                for(let n = 0 ; n < platform.hooks.length ; n++) {
                    const hookPath = platform.hooks[n];
                    try {
                        platform.hookClass.push(require(process.cwd() + "/" + hookPath));
                    } catch (error) {
                        console.error(error);
                        return;
                    }    
                }
            }
        }

        let corelibTsc : boolean = false;
        if (argsOption["corelibtsc"] || argsOption["force"]) corelibTsc = true;

        if (!option) option = {};
        if (option.platforms == undefined) option.platforms = [ { name: "web" } ];

        CLI.outn("** mikeneko build start **");
        const rootDir : string = process.cwd();

        if (!fs.existsSync(rootDir + "/node_modules/mikeneko-corelib/package.json")) {
            try {
                await this.installCoreLib(rootDir);
            } catch(error) {
                CLI.outn(error);
                CLI.outn(CLI.setColor(" .... Install Failed!", Color.Red));
                return;
            }
        }

        let CoreLibList = require(rootDir + "/node_modules/mikeneko-corelib/list.json");
        
        // plugin library add
        let pluginList = [];
        if (option.plugins) {
            for(let n = 0 ; n < option.plugins.length ; n++) {
                const libname = option.plugins[n];
                if (
                    fs.existsSync(rootDir + "/node_modules/" + libname + "/package.json") &&
                    fs.existsSync(rootDir + "/node_modules/" + libname + "/list.json")
                ) {
                    pluginList.push({
                        libname: libname,
                        list: require(rootDir + "/node_modules/" + libname + "/list.json"),
                    });
                }
                else {
                    CLI.outn(CLI.setColor("# [WARM] Unable to find package \"" + libname + "\" as plugin.", Color.Orange));
                }
            }
        }

        // typescript trance complie
        let tsType : string = "es6";
        const tsType_ = this.getTsType(rootDir);
        if (tsType_) tsType = tsType_;

        CLI.setIndent(4).br();
        let platformText = platformnames.join(", ");
        if (selectPlatform) platformText = selectPlatform;
        CLI.outData({
            "TypeSCript Type": tsType,
            "corelibtsc" : corelibTsc,
            "root": rootDir,
            "platform": platformText,
        });
        CLI.br().setIndent(0);

        // trancecomplie in core library trancecomplie on select type 
        try {
            await this.typescriptComplieCoreLib(rootDir, tsType, corelibTsc);
        } catch(error) {
            CLI.outn("[TypeScript TrancePlie CoreLib Error]", Color.Red);
            CLI.outn(error);
            CLI.outn("...... " + CLI.setColor("Failed!", Color.Red));
            return;
        }

        // trancecomplie in plugin
        for(let n = 0 ; n < pluginList.length ; n++) {
            const lib = pluginList[n];
            try {
                await this.typescriptCompliePlugin(rootDir, tsType, corelibTsc, lib);
            } catch (error) {
                CLI.outn("[TypeScript TrancePlie Plugin Error (" + lib.libname + ")]", Color.Red);
                CLI.outn(error);
                CLI.outn("...... " + CLI.setColor("Failed!", Color.Red));
                return;
            }
        }

        // trancecomplie in local content
        try {
            await this.typescriptComplieLocal(tsType);
        } catch (error) {
            CLI.outn("[TypeScript TrancePlie Error]", Color.Red);
            CLI.outn(error);
            CLI.outn("...... " + CLI.setColor("Failed!", Color.Red));
            return;
        }

        // mkdir
        const buildDir : string = rootDir + "/output";
        this.outMkdir(buildDir);

        for (let n = 0 ; n < option.platforms.length ; n++) {
            // platforms building 
            let platform = option.platforms[n];
            if (platform.disable) continue;

            if (!platform.build) platform.build = BuildType.WebBuilder;

            if (!platform.buildType) platform.buildType = BuildPlatformType.Web;

            CLI.outn(CLI.setColor("# ", Color.Green) + "platform = " + platform.name + ", buildType = " + platform.buildType);
          
            // create platform directory
            let platformDir : string = buildDir + "/" + platform.name;
            if (platform.optionDir) platformDir += "/" + platform.optionDir;

            if (platform.build == BuildType.webpack) {
                this.buildWebPack(
                    rootDir, 
                    platformDir, 
                    tsType, 
                    platform, 
                    CoreLibList,
                    pluginList);
                return;
            }

            if (platform.hookClass) {
                for(let n2 = 0 ; n2 < platform.hookClass.length ; n2++) {
                    const hook = platform.hookClass[n2];
                    if (!hook.begin) continue;
                    hook.begin();
                }
            }
    
            this.outMkdir(platformDir, true);

            platform.outPath = platformDir;
            platform.path = buildDir + "/" + platform.name;

            // code set
            let codeList : {[name : string] : string} = {};

            // start head
            let debug :boolean = false;
            if (platform.debug != undefined) debug = platform.debug;                
            this.jsStart(rootDir, codeList, tsType, platform.name, debug);

            // core module mount
            CoreLibList.forEach((core : string) => {
                 // core module mount
                 this.coreModuleMount(rootDir, codeList, tsType, core, platform);
            });

            // plugin module mount
            pluginList.forEach(lib => {
                this.pluginModuleMount(rootDir, codeList, tsType, lib, platform);
            });

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

            let coreStr : string = Object.values(codeList).join("");

            // code compress
            let codeCompress : boolean = false;
            if (platform.codeCompress != undefined) codeCompress = platform.codeCompress;
            if (codeCompress) coreStr = this.codeCompress(coreStr);

            // code obfuscated
            let obfuscated : boolean = false;
            if (platform.obfuscated != undefined) obfuscated = platform.obfuscated;
            if (obfuscated) coreStr = this.codeObfuscate(coreStr);
            
            CLI.outn(CLI.setColor("# ", Color.Green) + "write index.js");
            if (platform.hookClass) {
                for(let n2 = 0 ; n2 < platform.hookClass.length ; n2++) {
                    const hook = platform.hookClass[n2];
                    if (!hook.setIndexJS) continue;
                    const buffer = hook.setIndexJS(coreStr);
                    if (buffer) coreStr = buffer;
                }
            }

            fs.writeFileSync(platformDir + "/index.js", coreStr);
    
            CLI.outn(CLI.setColor("# ", Color.Green) + "write index.html");
            let indexHTML : string = "<!DOCTYPE html><head><meta charset=\"UTF-8\"><script src=\"index.js\"></script></head><body></body></html>";

            if (platform.hookClass) {
                for(let n2 = 0 ; n2 < platform.hookClass.length ; n2++) {
                    const hook = platform.hookClass[n2];
                    if (!hook.setIndexHTML) continue;
                    const buffer = hook.setIndexHTML(indexHTML);
                    if (buffer) indexHTML = buffer;
                }
            }

            fs.writeFileSync(platformDir + "/index.html", indexHTML);
    
            CLI.outn(CLI.setColor("# ", Color.Green) + "Web Build Comlete.");
            CLI.outn(CLI.setColor("# ", Color.Green) + "........ platform = " + platform.name + " ok");

            if (platform.hookClass) {
                for(let n2 = 0 ; n2 < platform.hookClass.length ; n2++) {
                    const hook = platform.hookClass[n2];
                    if (!hook.complete) continue;
                    hook.complete();
                }
            }
        }

        CLI.br().outn("...... Complete!", Color.Green);
    }

    private static installCoreLib(rootDir: string) {
        CLI.wait(CLI.setColor("# ", Color.Green) + "Install 'mikeneko-corelib' ...");

        return new Promise((resolve, reject) => {
            exec("npm i mikeneko-corelib --prefix " + rootDir, (error, stdout, stderr)=>{
                if (error) {
                    CLI.waitClose(CLI.setColor("NG", Color.Red));
                    reject(stderr);
                }
                else {
                    CLI.waitClose(CLI.setColor("OK", Color.Green));
                    resolve(true);
                }
            });
        });
    }

    private static jsStart(rootDir: string, codeList: {[name : string] : string}, tsType : string, platformName : string, debugMode : boolean){
        CLI.outn(CLI.setColor("# ", Color.Green) + "build Start");
        let content =  fs.readFileSync(rootDir + "/dist/corelib/Front.js").toString();
        content = content.split("{{platform}}").join(platformName);
        if (!debugMode) content += "console.log=()=>{};console.error=()=>{};\n"
        codeList.___HEADER = content;
    }

    private static setFn(name : string,  content, rawFlg : boolean, platform : BuildPlatform) {
        let afterContent : string;
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

    private static contentEvalReplace(content: string) {
        content = content.replace(/\\/g, '\\\\');
        content = content.replace(/\r/g, '\\r');
        content = content.replace(/\n/g, '\\n');
        content = content.replace(/\'/g, "\\'");
        content = content.replace(/\"/g, '\\"');
        content = content.replace(/\`/g, '\\`');
        return content;
    }

    private static coreModuleMount(rootDir : string, codeList : {[name : string] : string}, tsType : string, name : string, platform : BuildPlatform) {
        CLI.outn(CLI.setColor("# ", Color.Green) + "mount core".padEnd(20) + " " + name);
        const fullPath : string = rootDir + "/dist/corelib/" + name + ".js"; 
        let contents : string = fs.readFileSync(fullPath).toString() ;
        contents = "var exports = {};\n" + contents + ";\nreturn exports;";
        codeList[name] = this.setFn(name, contents, true, platform);
    }

    private static pluginModuleMount(rootDir: string, codeList: {[name : string] : string}, tsType: string, lib: {libname: string, list: Array<string>}, platform: BuildPlatform) {
        for(let n = 0 ; n < lib.list.length ; n++) {
            const moduleName = lib.list[n];
            const modulePath = rootDir + "/dist/plugins/" + lib.libname + "/" + moduleName + ".js";
            CLI.outn(CLI.setColor("# ", Color.Green) + "mount plugin".padEnd(20) + " " + moduleName);
            let contents : string = fs.readFileSync(modulePath).toString() ;
            contents = "var exports = {};\n" + contents + ";\nreturn exports;";
            codeList[moduleName] = this.setFn(moduleName, contents, true, platform);
        }
    }

    private static coreResourceMount(rootDir: string, codeList : {[name : string] : string}, platform : BuildPlatform) {
        const targetPath = rootDir + "/node_modules/mikeneko-corelib/bin/res";
        this.search(targetPath, (file) => {
            const fullPath = file.path + "/" + file.name;
            let basePath = "CORERES/"+ fullPath.substring((targetPath + "/").length);
            basePath = basePath.split("\\").join("/");
            basePath = basePath.split("//").join("/");
            const contentB64 = Buffer.from(fs.readFileSync(fullPath)).toString("base64");
            codeList[basePath] = this.setFn(basePath,  "\"" + contentB64 + "\"", false, platform) ;
            CLI.outn(CLI.setColor("# ", Color.Green) + "mount coreres".padEnd(20) + " " + basePath);
        });
    }

    private static pluginResourceMount(rootDir: string, codeList : {[name : string] : string}, lib: {libname: string, list: Array<string>}, platform : BuildPlatform) {
        const targetPath = rootDir + "/node_modules/" + lib.libname + "/bin/res";
        this.search(targetPath, (file) => {
            const fullPath = file.path + "/" + file.name;
            let basePath = "CORERES/" + lib.libname + "/" + fullPath.substring((targetPath + "/").length);
            basePath = basePath.split("\\").join("/");
            basePath = basePath.split("//").join("/");
            const contentB64 = Buffer.from(fs.readFileSync(fullPath)).toString("base64");
            codeList[basePath] = this.setFn(basePath,  "\"" + contentB64 + "\"", false, platform) ;
            CLI.outn(CLI.setColor("# ", Color.Green) + "mount pluginres".padEnd(20) + " " + basePath);
        });
    }

    private static localModuleMount(codeList : {[name : string] : string}, rootDir : string, platformName : string, platform : BuildPlatform) {
        let targetPaths = [
            rootDir + "/dist/src/app",
            rootDir + "/dist/src_" + platformName + "/app",
        ];

        let strs : string = "";
        targetPaths.forEach((targetPath : string) => {
            this.search(targetPath, (file)=>{
                if (path.extname(file.name) != ".js") return;
                const fullPath = file.path + "/" + file.name;
                let basePath = "app/" + file.path.substring((targetPath + "/").length) + "/" + file.name.substring(0, file.name.length - path.extname(file.name).length);
                basePath = basePath.split("\\").join("/");
                basePath = basePath.split("//").join("/");
                let contents : string = fs.readFileSync(fullPath).toString() ;
                contents = "var exports = {};\n" + contents + ";\nreturn exports;";                
                codeList[basePath] = this.setFn(basePath, contents, true, platform);
                CLI.outn(CLI.setColor("# ", Color.Green) + "mount local".padEnd(20) +" " + basePath);
            });
        });
        return strs;
    }

    private static jsEnd(codeList : {[name : string] : string}, platform : BuildPlatform) {
        CLI.outn(CLI.setColor("# ", Color.Green) + "build End");
        codeList.___FOOTER = "sfa.start(()=>{ const st = use(\"Startor\");  new st.Startor(); });";
    }

    private static resourceContentMount(codeList : {[name : string] : string}, rootDir : string, platformName : string, platform : BuildPlatform ) {
        let targetPaths = [
            rootDir + "/src/resource",
            rootDir + "/src_" + platformName + "/resource",
        ];

        let strs : string = "";
        targetPaths.forEach((targetPath : string) => {
            this.search(targetPath, (file)=>{
                const fullPath = file.path + "/" + file.name;
                let basePath = "resource/"+ fullPath.substring((targetPath + "/").length);
                basePath = basePath.split("\\").join("/");
                basePath = basePath.split("//").join("/");
                const contentB64 = Buffer.from(fs.readFileSync(fullPath)).toString("base64");
                const mimeType = mime.lookup(basePath);
                let plstr = "";
                if (targetPath != rootDir + "/src/resource") {
                    plstr = "(" + platformName + ")";
                }
                codeList[basePath] = this.setFn(basePath,  "\"" + mimeType + "|" + contentB64 + "\"", false, platform) ;
                CLI.outn(CLI.setColor("# ", Color.Green) + "mount localres".padEnd(20) + " " + basePath);
            });
        });
        return strs;
    }

    private static renderingHtmMount(codeList : {[name : string] : string}, rootDir : string, platformName : string, platform: BuildPlatform) {
        let targetPaths = [
            rootDir + "/src/rendering",
            rootDir + "/src_" + platformName + "/rendering",
        ];
        let strs : string = "";
        targetPaths.forEach((targetPath : string) => {
            this.search(targetPath, (file)=>{
                const fullPath = file.path + "/" + file.name;
                let  basePath = "rendering/" + fullPath.substring((targetPath + "/").length);
                basePath = basePath.split("\\").join("/");
                basePath = basePath.split("//").join("/");
                const contentB64 = Buffer.from(fs.readFileSync(fullPath)).toString("base64");
                let plstr = "";
                if (targetPath != rootDir + "/src/rendering"){
                    plstr = "(" + platformName + ")";
                }
                codeList[basePath] = this.setFn(basePath, "\"" +  contentB64 + "\";", false , platform);
                CLI.outn(CLI.setColor("# ", Color.Green) + "mount render".padEnd(20) + " "+ basePath);
            });            
        });
        return strs;
    }

    private static search(target : string, callback) {
        if (!fs.existsSync(target)) return;
        if (!fs.statSync(target).isDirectory()) return;
        const list = fs.readdirSync(target, {
            withFileTypes: true,
        });
        for (let n = 0 ; n < list.length ; n++) {
            const l_ = list[n];
            if (l_.isDirectory()) {
                this.search(target + "/" + l_.name, callback);
            }
            else {
                // node.js v14 under support.
                const file : any = l_;
                file.path = target;
                callback(l_);
            }
        }
    }

    private static async typescriptComplieLocal(tsType: string) : Promise<string> {
        CLI.wait(CLI.setColor("# ", Color.Green) + "TranceComplie ...");
        return new Promise((resolve, reject) => {
            exec("tsc --pretty", (error, stdout, stderr)=>{
                if (error) {
                    CLI.waitClose(CLI.setColor("NG", Color.Red));
                    reject(stdout);
                }
                else {
                    CLI.waitClose(CLI.setColor("OK", Color.Green));
                    resolve(tsType);
                }
            });
        });
    }

    private static async typescriptComplieCoreLib(rootDir : string, tsType : string, corelibtsc: boolean) : Promise<string> {
        const libPath = rootDir + "/node_modules/mikeneko-corelib";
        const binPath = libPath + "/bin";
        const distPath = rootDir + "/dist";
        const outPath = rootDir + "/dist/corelib";
        if (!corelibtsc) {
            if (fs.existsSync(outPath)) return;
        }
        if (!fs.existsSync(distPath)) fs.mkdirSync(distPath);        
        if (!fs.existsSync(outPath)) fs.mkdirSync(outPath);
        let forceStr = "";
        CLI.wait(CLI.setColor("# ", Color.Green) + forceStr + "TranceComplie (Core Library) ...");

        fs.mkdirSync(outPath, { recursive: true });

        return new Promise((resolve, reject) => {
            this.corelibDelete(outPath);
            exec("cd " + binPath + " && tsc --outdir " + outPath + " --project tsconfig.json --target " + tsType,(error, stdout, stderr)=>{
                if (error) {
                    CLI.waitClose(CLI.setColor("NG", Color.Red));
                    reject(stdout);
                }
                else {
                    CLI.waitClose(CLI.setColor("OK", Color.Green));
                    resolve(tsType);
                }
            });
        });
    }

    private static typescriptCompliePlugin(rootDir : string, tsType: string, corelibtsc: boolean, lib: {libname: string, list: Array<string>}) {
        const libPath = rootDir + "/node_modules/" + lib.libname;
        const binPath = libPath + "/bin";
        const distPath = rootDir + "/dist";
        const pluginPath = distPath + "/plugins";
        const outPath = pluginPath + "/" + lib.libname;
        if (!corelibtsc) {
            if (fs.existsSync(outPath)) return;
        }
        let forceStr = "";
        CLI.wait(CLI.setColor("# ", Color.Green) + forceStr + "TranceComplie (plugin = " + lib.libname + ") ...");
        if (!fs.existsSync(distPath)) fs.mkdirSync(distPath);        
        if (!fs.existsSync(pluginPath)) fs.mkdirSync(pluginPath);
        if (!fs.existsSync(outPath)) fs.mkdirSync(outPath);
        return new Promise((resolve, reject) => {
            this.corelibDelete(outPath);
            exec("cd " + binPath + " && tsc --project tsconfig.json --target " + tsType + " --outdir " + outPath,(error, stdout, stderr)=>{
                if (error) {
                    CLI.waitClose(CLI.setColor("NG", Color.Red));
                    reject(stdout);
                }
                else {
                    CLI.waitClose(CLI.setColor("OK", Color.Green));
                    resolve(tsType);
                }
            });
        });
    }

    private static corelibDelete(distTsTypePath : string) {
        const lists = fs.readdirSync(distTsTypePath);

        for(let n = 0 ; n < lists.length; n++){
            const l_ = distTsTypePath + "/" + lists[n];            
            fs.unlinkSync(l_);
        }
        fs.rmdirSync(distTsTypePath);
    }

    private static outMkdir(rootDir : string, alreadyDeleted? : boolean) {
        CLI.outn(CLI.setColor("# ", Color.Green) + "mkdir " + rootDir);
        if (alreadyDeleted) {
            if (fs.existsSync(rootDir)) {
                CLI.outn(CLI.setColor("# ", Color.Green) + "already directory .... clear");
                fs.rmSync(rootDir, {
                    recursive: true,
                });
            }    
        }
        fs.mkdirSync(rootDir, {
            recursive: true,
        });
    }

    private static codeCompress(code : string) {
        // Delete comment
        CLI.outn(CLI.setColor("# ", Color.Green) + "code compress ...");
        const strippedCode = strip(code);
        // Compress JavaScript code
        const result = UglifyJS.minify(strippedCode);
        if (result.error) throw result.error;
        return result.code;
    }

    private static codeObfuscate(code : string) {
        CLI.outn(CLI.setColor("# ", Color.Green) + "code obfuscate .... ");
        code = obfucator.obfuscate(code).getObfuscatedCode();
        return code;
    }

    private static getTsType(rootDir : string) : string {
        let tsConfig, tsType;
        try {
            tsConfig = require(rootDir + "/tsconfig.json");
            if (!tsConfig.compilerOptions) return;
            if (!tsConfig.compilerOptions.target) return;
            tsType = tsConfig.compilerOptions.target;
        }catch(error){
            CLI.outn(CLI.setColor("[wARM] " + error, Color.Orange));
            return;
        }
        return tsType;
    }

    private static async buildWebPack(rootDir: string, platformDir : string, tscType : string, platform : BuildPlatform, CoreLibList: Array<string>, pluginList : Array<{libname: string, list: Array<string> }>) {

        this.setWebPackDist(rootDir, platformDir, tscType, CoreLibList, pluginList);

        this.setWebpackComponent(platformDir);

        try {
            await this.webPackExec(platform.name);
        } catch(error){
            CLI.outn("[Webpack Build Error]", Color.Red);
            CLI.outn(error);
            CLI.outn("...... " + CLI.setColor("Failed!", Color.Red));
            return;
        }

        CLI.outn(CLI.setColor("# ", Color.Green) + "write index.html");
        let indexHTML : string = "<!DOCTYPE html><head><meta charset=\"UTF-8\"><script src=\"index.js\"></script></head><body></body></html>";
        fs.writeFileSync(platformDir + "/www/index.html", indexHTML);

        CLI.br().outn("...... Complete!", Color.Green);
    }

    private static webPackExec(platformName: string) {
        CLI.wait(CLI.setColor("# ", Color.Green) + "webpack build ...");
        return new Promise((resolve, reject) => {
            exec("cd output/" + platformName + " && webpack",(error, stdout)=>{
                if (error) {
                    CLI.waitClose(CLI.setColor("NG", Color.Red));
                    reject(stdout);
                }
                else {
                    CLI.waitClose(CLI.setColor("OK", Color.Green));
                    CLI.outn(stdout);
                    resolve(true);
                }
            });
        });
    }

    private static setWebPackDist(rootDir: string, platformDir : string, tscType : string, CoreLibList: Array<string>, pluginList: Array<{libname: string, list: Array<string>}>) {

        if (!fs.existsSync(platformDir)){
            CLI.outn(CLI.setColor("# ", Color.Green) + "mkdir " + platformDir);
            fs.mkdirSync(platformDir);
        }

        const distDir = platformDir + "/dist";
        if (fs.existsSync(distDir)){
            let lists = fs.readdirSync(distDir, {recursive : true});
            for (let n = 0 ; n < lists.length ;n++) {
                const l_ = distDir + "/" + lists[n];
                if (fs.statSync(l_).isFile()) fs.unlinkSync(l_);
            }
        }
        else {
            fs.mkdirSync(distDir);
        }

        CoreLibList.push("FrontWebPack");

        // core library set
        if (!fs.existsSync(distDir + "/core")){
            fs.mkdirSync(distDir + "/core");
        }

        const distLibPath = rootDir + "/dist/corelib";
        for (let n = 0 ; n < CoreLibList.length ; n++){
            const coreName = CoreLibList[n];
            fs.copyFileSync(distLibPath + "/" + coreName + ".js", distDir + "/core/" + coreName + ".js");
        }

        const pluginPath = rootDir + "/dist/plugins";
        for (let n = 0 ; n < pluginList.length ; n++) {
            const plugin = pluginList[n];
            const pluginName = plugin.libname;
            for(let n2 = 0 ; n2 < plugin.list.length ; n2++) {
                const moduleName = plugin.list[n2];
                const modulePath = pluginPath + "/" + pluginName + "/" + moduleName + ".js";
                fs.copyFileSync(modulePath, distDir + "/core/" + moduleName + ".js");
            }
        }

        // CORERES set
        if (!fs.existsSync(distDir + "/CORERES")){
            fs.mkdirSync(distDir + "/CORERES");
        }
        const coreresDir = rootDir + "/node_modules/mikeneko-corelib/bin/res";
        const coreresLIsts = fs.readdirSync(coreresDir, { recursive : true });
        for (let n = 0 ; n < coreresLIsts.length ; n++){
            const l_  = coreresLIsts[n];
            const fulll_ = coreresDir + "/" + coreresLIsts[n];
            if (fs.statSync(fulll_).isDirectory()){
                if (!fs.existsSync(distDir + "/CORERES/" + l_)){
                    fs.mkdirSync(distDir + "/CORERES/" + l_);
                }
            }
            else {
                fs.copyFileSync(fulll_, distDir + "/CORERES/" + l_);
            }
        }

        for (let n = 0 ; n < pluginList.length ; n++) {
            const plugin = pluginList[n];
            const pluginName = plugin.libname;
            const pluginResPath = rootDir + "/node_modules/" + pluginName + "/bin/res";
            if (!fs.existsSync(pluginResPath)) continue;
            const distPluginPath = distDir + "/CORERES/" + pluginName;
            const coreresLIsts = fs.readdirSync(pluginResPath, { recursive : true });
            for (let n = 0 ; n < coreresLIsts.length ; n++){
                const l_  = coreresLIsts[n];
                const fulll_ = pluginResPath + "/" + coreresLIsts[n];
                if (!fs.existsSync(distPluginPath)) {
                    fs.mkdirSync(distPluginPath);
                }
                if (fs.statSync(fulll_).isDirectory()){
                    if (!fs.existsSync(distPluginPath + "//" + l_)){
                        fs.mkdirSync(distPluginPath + "/" + l_);
                    }
                }
                else {
                    fs.copyFileSync(fulll_, distPluginPath + "/" + l_);
                }
            }
        }

        // app list set
        if (!fs.existsSync(distDir + "/app")){
            fs.mkdirSync(distDir + "/app");
        }
        const appDistDir = path.dirname(path.dirname(platformDir)) + "/dist/src/app";
        const appLists = fs.readdirSync(appDistDir, { recursive : true });
        for (let n = 0 ; n < appLists.length ; n++){
            const l_  = appLists[n];
            const fulll_ = appDistDir + "/" + appLists[n];
            if (fs.statSync(fulll_).isDirectory()){
                if (!fs.existsSync(distDir + "/app/" + l_)){
                    fs.mkdirSync(distDir + "/app/" + l_);
                }
            }
            else {
                fs.copyFileSync(fulll_, distDir + "/app/" + l_);
            }
        }


        // rendering set
        if (!fs.existsSync(distDir + "/rendering")){
            fs.mkdirSync(distDir + "/rendering");
        }

        const renderingDir = path.dirname(path.dirname(platformDir)) + "/src/rendering";
        const renderingLists = fs.readdirSync(renderingDir, { recursive : true });
        for (let n = 0 ; n < renderingLists.length ; n++){
            const l_  = renderingLists[n];
            const fulll_ = renderingDir + "/" + renderingLists[n];
            if (fs.statSync(fulll_).isDirectory()){
                if (!fs.existsSync(distDir + "/rendering/" + l_)){
                    fs.mkdirSync(distDir + "/rendering/" + l_);
                }
            }
            else {
                fs.copyFileSync(fulll_, distDir + "/rendering/" + l_);
            }
        }

        // resource set
        
        if (!fs.existsSync(distDir + "/resource")){
            fs.mkdirSync(distDir + "/resource");
        }
        const resourceDir = path.dirname(path.dirname(platformDir)) + "/src/resource";
        const resourceLIsts = fs.readdirSync(resourceDir, { recursive : true });
        for (let n = 0 ; n < resourceLIsts.length ; n++){
            const l_  = resourceLIsts[n];
            const fulll_ = resourceDir + "/" + resourceLIsts[n];
            if (fs.statSync(fulll_).isDirectory()){
                if (!fs.existsSync(distDir + "/resource/" + l_)){
                    fs.mkdirSync(distDir + "/resource/" + l_);
                }
            }
            else {
                fs.copyFileSync(fulll_, distDir + "/resource/" + l_);
            }
        }
    }

    private static setWebpackComponent(platformDir : string){

        if (!fs.existsSync(platformDir + "/webpack.config.js")) {
            CLI.outn("# make webpack.config.js");
            fs.copyFileSync(path.dirname(__dirname) + "/res/webpack/webpack.config.js", platformDir + "/webpack.config.js");
        }

        if (!fs.existsSync(platformDir + "/custom-loader.js")) {
            CLI.outn("# make custom-loader.js");
            fs.copyFileSync(path.dirname(__dirname) + "/res/webpack/custom-loader.js", platformDir + "/custom-loader.js");
        }

        let str : string = "export const WebPackComponent = {\n";
        const list = fs.readdirSync(platformDir + "/dist", { recursive: true });
        for(let n = 0 ; n < list.length ; n++){
            const dirBase = platformDir + "/dist/" + list[n];
            if (fs.statSync(dirBase).isDirectory()) continue;
            const dir = (dirBase).split("\\").join("/");
            let dirPath = dir.substring((platformDir + "/dist/").length);
            if (path.extname(dirPath) === ".js") {
                dirPath = dirPath.replace(/(\.[\w\d]+)$/i, '');
            }
            if (dirPath.indexOf("core/") === 0) dirPath = dirPath.substring("core/".length);
            str += "\"" + dirPath + "\" : require(\"" +  dirPath  + "\"),\n";
        }
        str += "};";
        fs.writeFileSync(platformDir + "/dist/WebPackComponent.js", str);
    }
}