import { SemanticTokenType, SemanticTokenModifier } from "./semanticTokens";

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
    Dot,
    Colon,
    SemiColon,
    Percent,
    Param,
    Option,
    RulesTag,
    StartType,
    EndType,
    TypeValue,
    StartComment,
    EndComment,
    Comment,
    StartAction,
    EndAction,
    Action,
    Unknown,
    EOS
}

export enum ScannerState {
    WithinContent,
    WithinComment,
    WithinCode,
    WithinUnion,
    WithinTypeValue
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
}

export const tokenTypes: string[] = [];
tokenTypes[SemanticTokenType.class] = 'class';
tokenTypes[SemanticTokenType.enum] = 'enum';
tokenTypes[SemanticTokenType.interface] = 'interface';
tokenTypes[SemanticTokenType.namespace] = 'namespace';
tokenTypes[SemanticTokenType.typeParameter] = 'typeParameter';
tokenTypes[SemanticTokenType.type] = 'type';
tokenTypes[SemanticTokenType.parameter] = 'parameter';
tokenTypes[SemanticTokenType.variable] = 'variable';
tokenTypes[SemanticTokenType.property] = 'property';
tokenTypes[SemanticTokenType.function] = 'function';
tokenTypes[SemanticTokenType.member] = 'member';

export const tokenModifiers: string[] = [];
tokenModifiers[SemanticTokenModifier.async] = 'async';
tokenModifiers[SemanticTokenModifier.declaration] = 'declaration';
tokenModifiers[SemanticTokenModifier.readonly] = 'readonly';
tokenModifiers[SemanticTokenModifier.static] = 'static';