import {
    MultiLineStream, _FSL, _AST, _NWL, _BAR, _COL, _BOP, _BCL, _DOT, _PCS, _LAN, _DQO, _SQO, _RAN, _SBO, _SCL, _AND
} from './utils'
import { 
	workspace, 
	} from 'vscode';
export enum ScannerState {
    WithinContent,
    WithinDefinition,
    WithinComment,
};

export enum TokenType {
    Word,
    SemiColon,
    Asterisk,
    Ampersand,
    StartComment,
    EndComment,
    Comment,
    StartDefinition,
    EndDefinition,
    Definition,
    Unknown,
    EOS
};

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

export function createScanner(input: string, initialOffset = 0, initialState: ScannerState = ScannerState.WithinContent): Scanner {
    const stream = new MultiLineStream(input, initialOffset);
    let state = initialState;
    let tokenOffset: number = 0;
    let tokenType: TokenType = TokenType.Unknown;
    let tokenError: string | undefined;

    function nextWord(): string {
        return stream.advanceIfRegExp(/^[a-zA-Z]\w*/);
    }

    function finishToken(offset: number, type: TokenType, errorMessage?: string): TokenType {
        tokenType = type;
        tokenOffset = offset;
        tokenError = errorMessage;
        return type;
    }

    function scan(): TokenType {
        const offset = stream.pos();
        const oldState = state;
        const token = internalScan();
        if (token !== TokenType.EOS && offset === stream.pos()) {
            console.log('Scanner.scan has not advanced at offset ' + offset + ', state before: ' + oldState + ' after: ' + state);
            stream.advance(1);
            return finishToken(offset, TokenType.Unknown);
        }
        return token;
    }

    function internalScan(): TokenType {
        stream.skipWhitespace();
        const offset = stream.pos();
        if (stream.eos()) {
            return finishToken(offset, TokenType.EOS);
        }

        switch (state) {
            case ScannerState.WithinContent:
                const ch = stream.nextChar();
                switch (ch) {
                    case _FSL: // /
                        if (stream.advanceIfChar(_AST)) { // /*
                            state = ScannerState.WithinComment;
                            return finishToken(offset, TokenType.StartComment);
                        }
                        if (stream.advanceIfChar(_FSL)) { // //
                            stream.advanceUntilChar(_NWL);
                            return finishToken(offset, TokenType.Comment);
                        }
                        break;
                    case _BOP:
                        state = ScannerState.WithinDefinition;
                        return finishToken(offset, TokenType.StartDefinition);
                    case _AST:
                        return finishToken(offset, TokenType.Asterisk);
                    case _AND:
                        return finishToken(offset, TokenType.Ampersand);
                    case _SCL:
                        return finishToken(offset, TokenType.SemiColon);
                }

                stream.goBack(1);

                const component = nextWord();
                if (component.length > 0) {
                    return finishToken(offset, TokenType.Word);
                }

                stream.advance(1);
                return finishToken(offset, TokenType.Unknown);
            case ScannerState.WithinComment:
                if (stream.advanceIfChars([_AST, _FSL])) { // */
                    state = ScannerState.WithinContent;
                    return finishToken(offset, TokenType.EndComment);
                }
                stream.advanceUntilChars([_AST, _FSL]); // */
                return finishToken(offset, TokenType.Comment);
            case ScannerState.WithinDefinition:
                if (stream.advanceIfChar(_BCL)) { // }
                    state = ScannerState.WithinContent;
                    return finishToken(offset, TokenType.EndDefinition);
                }
                var brackets = 1;
                while (brackets > 0) {
                    const ch = stream.nextChar();
                    switch (ch) {
                        case _BOP:
                            brackets++;
                            break;
                        case _BCL:
                            brackets--;
                            break;
                        case _FSL: // /
                            if (stream.advanceIfChar(_AST)) { // /*
                                stream.advanceUntilChars([_AST, _FSL]);
                                stream.advance(2);
                            } else if (stream.advanceIfChar(_FSL)) { // //
                                stream.advanceUntilChar(_NWL);
                                stream.advance(1);
                            }
                            break;
                    }
                    if (ch === 0) break;
                }
                if (brackets > 0) {
                    return finishToken(offset, TokenType.Unknown, "Definition not closed!");
                }
                stream.goBack(1);
                return finishToken(offset, TokenType.Definition);
        }
        state = ScannerState.WithinContent;
        return finishToken(offset, TokenType.Unknown, "invalid symbol found");
    }
    return {
        scan,
        getTokenType: () => tokenType,
        getTokenOffset: () => tokenOffset,
        getTokenLength: () => stream.pos() - tokenOffset,
        getTokenEnd: () => stream.pos(),
        getTokenText: () => stream.getSource().substring(tokenOffset, stream.pos()),
        getScannerState: () => state,
        getTokenError: () => tokenError
    };
}

function unIndent(text: string): string {
    const lines = text.split(/\r\n|\r|\n/);
    const trimmed = lines.map(line => line.trim());
    const indented: string[] = [];
    let indent = 0;
    trimmed.forEach(line => {
        if (line.indexOf('}') !== -1) {
            indent -= 4;
        }
        indented.push(' '.repeat(indent) + line);
        if (line.indexOf('{') !== -1) {
            indent += 4;
        }
    });
    return indented.join('\n');
}

export interface YYType {
    type: string[];
    info: string;
    location: [number, number];
    name?: string;
};

export function parse(text: string): YYType[] {
    const scanner = createScanner(text);
    const types: YYType[] = [];
    let TargetLanguage = workspace.getConfiguration("yash").get("TargetLanguage");

    let token = scanner.scan();
    let offset = 0;
    let type: YYType | undefined;
    while (token !== TokenType.EOS) {
        offset = scanner.getTokenOffset();
        switch (token) {
            case TokenType.SemiColon:
                if (type !== undefined) {
                    if (TargetLanguage=="go")
                    {
                        type.name = type.type.shift();
                    }
                    else
                    {
                        type.name = type.type.pop();
                    }
                    type.location[1] = scanner.getTokenEnd();
                    type.info = unIndent(text.substring(type.location[0], type.location[1]));
                    types.push(type);
                    type = undefined;
                }
                break;
            case TokenType.Word:
                if (type !== undefined) {
                    type.type.push(scanner.getTokenText());
                    if (TargetLanguage=="go" && type.type.length==2)
                    {
                        type.name = type.type.shift();
                        type.location[1] = scanner.getTokenEnd();
                        type.info = unIndent(text.substring(type.location[0], type.location[1]));
                        types.push(type);
                        type = undefined;
                    }
                } else {
                    type = { type: [scanner.getTokenText()], info: '', location: [offset, -1] }
                }
                break;
            case TokenType.Asterisk:
            case TokenType.Ampersand:
                if (type !== undefined) {
                    type.type.push(scanner.getTokenText());
                }
                break;
            case TokenType.StartDefinition:
            case TokenType.EndDefinition:
                if (type !== undefined) {
                    type.type.push(scanner.getTokenText());
                }
            case TokenType.Definition:
                // if (type !== undefined) {
                //     const recursive = parse(scanner.getTokenText());
                // }
                break;
        }
        token = scanner.scan();
    }

    return types;
};