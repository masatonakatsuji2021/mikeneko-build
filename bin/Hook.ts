export interface Hook {

    /**
     * ***begin*** :
     * @returns 
     */
    begin? : () => void,

    /**
     * ***complete*** :
     * @returns 
     */
    complete?: () => void,

    /**
     * ***setIndexJS*** :
     * @returns 
     */
    setIndexJS? : (content: string) => string | void,

    /**
     * ***setIndexHTML*** :
     * @returns 
     */
    setIndexHTML? : (content: string) => string | void,
}