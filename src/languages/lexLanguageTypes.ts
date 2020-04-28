export enum ProblemType {
    Information,
    Warning,
    Error
};

export interface ProblemRelated {
    readonly message: string;
    readonly offset: number;
    readonly end: number;
};

export interface Problem {
    readonly message: string;
    readonly offset: number;
    readonly end: number;
    readonly type: ProblemType;
    readonly related?: ProblemRelated;
};

export enum TokenType {
    Word,
    Literal,
    Bar,
    Percent,
    Option,
    RulesTag,
    StartComment,
    EndComment,
    Comment,
    StartAction,
    EndAction,
    Action,
    StartCode,
    EndCode,
    Code,
    StartPredefined,
    EndPredefined,
    Predefined,
    StartStates,
    EndStates,
    States,
    Invalid,
    Unknown,
    Divider,
    EOL,
    EOS
}

export enum ScannerState {
    WithinContent,
    WithinComment,
    WithinCode,
    WithinAction,
    WithinPredefined,
    WithinStates
}

export interface Scanner {
    scan(): TokenType;
    getTokenType(): TokenType;
    getTokenOffset(): number;
    getTokenLength(): number;
    getTokenEnd(): number;
    getTokenText(): string;
    getTokenError(): string | undefined;
    getScannerState(): ScannerState;
    disableMultiLineBrackets(): void;
    enableMultiLineBrackets(): void;
}