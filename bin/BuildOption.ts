import { Hook } from "bin/Hook";

export enum BuildType {

    WebBuilder = "webBuilder",

    webpack = "webpack",
}

export enum BuildPlatformType {

    /** Web */
    Web = "web",

    /** Cordova */
    Cordova = "cordova",

    /** Capacitor */
    Capacitor = "capacitor",

    /** Electro */
    Electron = "electron",
}

export interface BuildPlatform {

    /**
     * ***disable*** : If you set this to true, the build will not include it.
     */
    disable? : boolean,

    /**
     * ***name*** : platform name
     */
    name? : string,

    /**
     * ***build*** : build type
     */
    build?: BuildType,

    /**
     * ***buildType*** : 
     */
    buildType? : BuildPlatformType,

    path?: string,

    outPath? : string,

    /**
     * ***debug*** : debug mode
     */
    debug? : boolean,
    
    /**
     * ***codeCompress*** : code compress.
     */
    codeCompress? : boolean,

    /**
     * ***outOptionDir*** : output option directory
     */
    optionDir?: string,

    /**
     * ***obfuscated*** : javascript obfuscate.
     */
    obfuscated? : boolean,

    /**
     * ***mapping*** : Enable source mapping with browsers like Chrome.
     */
    mapping?: boolean,

    /**
     * ***hooks*** :  
     */
    hooks? : string | Array<string>,

    hookClass? : Array<Hook>,
}

export interface BuildOption {

    /**
     * ***platforms*** : Platform specific settings.
     */
    platforms? :  Array<BuildPlatform>,
    
    /**
     * ***plugins*** : A list of plugin packages to use.  
     * The specified plugin's npm package must be installed.
     */
    plugins?: Array<string>,
}