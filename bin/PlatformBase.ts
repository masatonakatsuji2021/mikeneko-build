import { BuildPlatform } from "./BuildOption";

export * from "../";

export class PlatformBase {
    
    public static __dirname : string;

    public static handleBuildBegin(platform : BuildPlatform) : BuildPlatform { return; }

    public static handleCreateIndexHTML() : string { return; }

    public static handleWebBuildCompleted(platform : BuildPlatform) { }

    public static handleCoreModuleMount(addModule : (name: string, modulePath: string) => void) {}
}