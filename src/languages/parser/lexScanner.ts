import { TokenType, ScannerState, Scanner } from '../lexLanguageTypes'
import { MultiLineStream, _FSL, _AST, _NWL, _PCS, _BOP, _LAN, _BAR, _WSP, _DQO, _SQO, _BCL, _RAN } from './utils';

export function createScanner(input: string, initialOffset = 0, initialState: ScannerState = ScannerState.WithinContent): Scanner {
    const stream = new MultiLineStream(input, initialOffset);
    let state = initialState;
    let tokenOffset: number = 0;
    let tokenType: TokenType = TokenType.Unknown;
    let tokenError: string | undefined;
    let multiLineBracket: boolean = true;

    function nextComponent(): string {
        return stream.advanceIfRegExp(/^[a-zA-Z]\w*/);
    }

    function nextLiteral(): string {
        return stream.advanceIfRegExp(/^("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')/);
    }

    function finishToken(offset: number, type: TokenType, errorMessage?: string): TokenType {
        tokenType = type;
        tokenOffset = offset;
        tokenError = errorMessage;
        return type;
    }

    function disableBrackets() {
        multiLineBracket = false;
    }

    function enableBrackets() {
        multiLineBracket = true;
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
        let white = false;
        switch (state) {
            case ScannerState.WithinAction:
            case ScannerState.WithinCode:
            case ScannerState.WithinComment:
                stream.skipWhitespace();
                break;
            default:
                white = stream.skipWitheSpaceWithoutNewLine();
        }

        const offset = stream.pos();
        if (stream.eos()) {
            return finishToken(offset, TokenType.EOS);
        }

        if (white) {
            return finishToken(offset, TokenType.Divider);
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
                    case _PCS: // %
                        if (stream.advanceIfChar(_PCS)) { // %%
                            return finishToken(offset, TokenType.RulesTag);
                        }
                        if (stream.advanceIfChar(_BOP)) { // %{
                            state = ScannerState.WithinCode;
                            return finishToken(offset, TokenType.StartCode);
                        }

                        if (stream.advanceIfRegExp(/^[\w-]+/)) {
                            return finishToken(offset, TokenType.Option);
                        }

                        return finishToken(offset, TokenType.Percent);
                    case _LAN: // <
                        if (stream.advanceIfChar(_LAN)) { // <
                            state = ScannerState.WithinPredefined;
                            return finishToken(offset, TokenType.StartPredefined);
                        }
                        state = ScannerState.WithinStates;
                        return finishToken(offset, TokenType.StartStates);
                    case _BAR: // |
                        return finishToken(offset, TokenType.Bar);
                    case _BOP: // {
                        state = ScannerState.WithinAction;
                        return finishToken(offset, TokenType.StartAction);
                    case _WSP: // ' '
                        stream.advanceUntilChar(_NWL);
                        return finishToken(offset, TokenType.Invalid);
                    case _NWL: // \n
                        return finishToken(offset, TokenType.EOL);
                    case _DQO: // "
                    case _SQO: // '
                        stream.goBack(1);
                        const literal = nextLiteral()
                        if (literal.length > 0) {
                            return finishToken(offset, TokenType.Literal);
                        }
                        stream.advance(1);
                        return finishToken(offset, TokenType.Unknown);
                }

                stream.goBack(1);

                const component = nextComponent();
                if (component.length > 0) {
                    return finishToken(offset, TokenType.Component);
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
            case ScannerState.WithinCode:
                if (stream.advanceIfChars([_PCS, _BCL])) { // %}
                    state = ScannerState.WithinContent;
                    return finishToken(offset, TokenType.EndCode);
                }
                stream.advanceUntilChars([_PCS, _BCL]);
                return finishToken(offset, TokenType.Code);
            case ScannerState.WithinAction:
                if (stream.advanceIfChar(_BCL)) { // }
                    state = ScannerState.WithinContent;
                    return finishToken(offset, TokenType.EndAction);
                }
                var exit = false;
                var brackets = 1;
                while (!exit && brackets > 0) {
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
                        case _NWL:
                            if (!multiLineBracket) {
                                exit = true;
                                state = ScannerState.WithinContent;
                            }
                            break;
                    }
                    if (ch === 0) break;
                }
                if (brackets > 0) {
                    return finishToken(offset, TokenType.Unknown, "Code not closed!");
                }
                if (!exit)
                    stream.goBack(1);
                return finishToken(offset, TokenType.Action);
            case ScannerState.WithinPredefined:
                if (stream.advanceIfChars([_RAN, _RAN])) { // >> 
                    state = ScannerState.WithinContent;
                    return finishToken(offset, TokenType.EndPredefined);
                }
                stream.advanceUntilChars([_RAN, _RAN]);
                return finishToken(offset, TokenType.Predefined);
            case ScannerState.WithinStates:
                if (stream.advanceIfChar(_RAN)) { // > 
                    state = ScannerState.WithinContent;
                    return finishToken(offset, TokenType.EndStates);
                }
                stream.advanceUntilChar(_RAN);
                return finishToken(offset, TokenType.States);
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
        getTokenError: () => tokenError,
        enableMultiLineBrackets: () => enableBrackets(),
        disableMultiLineBrackets: () => disableBrackets()
    };
}
