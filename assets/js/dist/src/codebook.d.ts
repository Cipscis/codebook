declare type CodebookSetArgs<Name extends string = string, Value = any> = Record<Name, Value>;
/**
 * Run all Codebook blocks in all Codebook sets in order, with any specified external arguments made available.
 */
export declare function run(args?: CodebookSetArgs): Promise<void[]>;
/**
 * Run all blocks in a specific Codebook set, with any specified external arguments made available.
 */
export declare function runSet(setName: string, args?: CodebookSetArgs): Promise<void>;
/**
 * Run all blocks in the default Codebook set, with any specified external arguments made available.
 */
export declare function runSet(args?: CodebookSetArgs): Promise<void>;
/**
 * Adjust the indentation of Codebook sets so it appears correctly when viewed on a page.
 */
export declare function tidy(): void;
export {};
