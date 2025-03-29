import { TokenType, ScannerState, Scanner } from '../yaccLanguageTypes'

import {
    MultiLineStream, _FSL, _AST, _NWL, _BAR, _COL, _BOP, _BCL, _DOT, _PCS, _LAN, _DQO, _SQO, _RAN, _SBO, _SCL, _COM
} from './utils'

export function createScanner(input: string, initialOffset = 0, initialState: ScannerState = ScannerState.WithinContent): Scanner {
    const stream = new MultiLineStream(input, initialOffset);
    let state = initialState;
    let tokenOffset: number = 0;
    let tokenType: TokenType = TokenType.Unknown;
    let tokenError: string | undefined;

    function nextWord(): string {
        // return stream.advanceIfRegExp(/^[a-zA-Z][\w.]*/);
        return stream.advanceIfRegExp(/^[a-zA-Z][\w.-]*/);  // gnu bison extension allows the dash symbol
    }

    function nextType(): string {
        // Allow C++ types like std::string, std::vector<int>, etc.
        let typeName = stream.advanceIfRegExp(/^[a-zA-Z][\w.-:]*/);
    
        stream.skipWhitespace?.();
    
        if (stream.advanceIfChar(_LAN)) { // '<'
            typeName += '<';
            stream.skipWhitespace?.();
            typeName += nextType();
    
            for (;;) {
                stream.skipWhitespace?.();
                if (!stream.advanceIfChar(_COM)) break;
                typeName += ',';
                stream.skipWhitespace?.();
                typeName += nextType();
            }
    
            stream.skipWhitespace?.();
            if (stream.advanceIfChar(_RAN)) { // '>'
                typeName += '>';
            }
        }
    
        return typeName;
    }
    

    function nextLiteral(): string {
        return stream.advanceIfRegExp(/^("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')/);
    }

    function nextParam(): string {
        return stream.advanceIfRegExp(/^\[[a-zA-Z]\w*\]/);
    }

    function nextMiddleRule(): string {
        return stream.advanceIfRegExp(/^<[a-zA-Z]\w*>/);
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
                    case _BAR: // |
                        return finishToken(offset, TokenType.Bar);
                    case _COL: // :
                        return finishToken(offset, TokenType.Colon);
                    case _BOP: // {
                        state = ScannerState.WithinCode;
                        return finishToken(offset, TokenType.StartAction);
                    case _BCL: // }
                        return finishToken(offset, TokenType.EndAction);
                    case _DOT: // .
                        return finishToken(offset, TokenType.Dot);
                    case _PCS: // %
                        if (stream.advanceIfChar(_PCS)) { // %%
                            return finishToken(offset, TokenType.RulesTag);
                        }
                        if (stream.advanceIfChar(_BOP)) { // %{
                            state = ScannerState.WithinCode;
                            return finishToken(offset, TokenType.StartAction);
                        }

                        if (stream.advanceIfRegExp(/^[\w-]+/)) {
                            if (stream.getSource().substring(offset, stream.pos()).toLowerCase() === '%define') {
                                // We have a define; we return the ENTIRE line up to (but not including) the newline
                                stream.advanceUntilChar(_NWL);
                                return finishToken(offset, TokenType.Definition);
                            }
                            return finishToken(offset, TokenType.Option);
                        }
                        return finishToken(offset, TokenType.Percent);
                    case _LAN: // <
                        state = ScannerState.WithinTypeValue;
                        return finishToken(offset, TokenType.StartType);
                    case _DQO: // "
                    case _SQO: // '
                        stream.goBack(1);
                        const literal = nextLiteral()
                        if (literal.length > 0) {
                            return finishToken(offset, TokenType.Literal);
                        }
                        stream.advance(1);
                        return finishToken(offset, TokenType.Unknown);
                    case _SBO: // [
                        stream.goBack(1);
                        const param = nextParam()
                        if (param.length > 0) {
                            return finishToken(offset, TokenType.Param);
                        }
                        stream.advance(1);
                        return finishToken(offset, TokenType.Unknown);
                    case _SCL:
                        return finishToken(offset, TokenType.SemiColon);
                }

                stream.goBack(1);

                const literal = nextLiteral()
                if (literal.length > 0) {
                    return finishToken(offset, TokenType.Literal);
                }

                const component = nextWord();
                if (component.length > 0) {
                    return finishToken(offset, TokenType.Word);
                }

                stream.advance(1);
                return finishToken(offset, TokenType.Unknown);
            case ScannerState.WithinTypeValue:
                if (stream.advanceIfChar(_RAN)) { // >
                    state = ScannerState.WithinContent;
                    return finishToken(offset, TokenType.EndType);
                }

                const typeValue = nextType();
                if (typeValue.length > 0) {
                    return finishToken(offset, TokenType.TypeValue);
                }
                stream.advance(1);
                state = ScannerState.WithinContent;
                return finishToken(offset, TokenType.Unknown);
            case ScannerState.WithinComment:
                if (stream.advanceIfChars([_AST, _FSL])) { // */
                    state = ScannerState.WithinContent;
                    return finishToken(offset, TokenType.EndComment);
                }
                stream.advanceUntilChars([_AST, _FSL]); // */
                return finishToken(offset, TokenType.Comment);
            case ScannerState.WithinCode:
                if (stream.advanceIfChar(_BCL)) { // }
                    state = ScannerState.WithinContent;
                    return finishToken(offset, TokenType.EndAction);
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
                        case _SQO: // ' 
                        case _DQO: // " 
                            stream.goBack(1);
                            if (!nextLiteral()) // skip string if not skip character
                                stream.advance(1);
                            break;
                    }
                    if (ch === 0) break;
                }
                if (brackets > 0) {
                    return finishToken(offset, TokenType.Unknown, "Code not closed!");
                }
                stream.goBack(1);
                return finishToken(offset, TokenType.Action);
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
