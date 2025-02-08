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
}

export interface BuildOption {

    /**
     * ***debug*** : debug mode.
     */
    debug? : boolean,

    /**
     * ***rootDir*** : Root Directory.
     */
    rootDir? : string,

    /**
     * ***platforms*** : Platform specific settings.
     */
    platforms? :  Array<BuildPlatform>,

    /**
     * ***codeCompress*** : code compress.
     */
    codeCompress? : boolean,

    /**
     * ***tranceComplied*** : Tyepscript trance complie.
     */
    tranceComplied? : boolean,

    /**
     * ***tscType*** : Specify the TypeScript transpilation type.  
     * If not specified, it will be transpiled to ES6 by default.
     */
    tscType? : string,

    /**
     * ***corelibtsc*** : Force transpilation of core libraries.  
     * Used to update transpiled files when the core library is updated.
     */
    corelibtsc?: boolean,

    /**
     * ***obfuscated*** : javascript obfuscate.
     */
    obfuscated? : boolean,
}