import { createScanner } from "./lexScanner";
import { TokenType } from "../lexLanguageTypes";
import { binarySearch } from "./utils";
import { Problem, ProblemType, ProblemRelated } from "../common";

const _CHX = 'x'.charCodeAt(0);
const _CHS = 's'.charCodeAt(0);

export interface ISymbol {
    offset: number;
    length: number;
    end: number;
    name: string;
    used: boolean;
    definition: [number, number];
    references: [number, number][];
};

export interface LexDocument {
    readonly embedded: Code[];
    readonly rulesRange: [number, number];
    readonly defines: { [name: string]: ISymbol };
    readonly states: { [name: string]: ISymbol };
    readonly components: ISymbol[];
    readonly problems: Problem[];

    getEmbeddedCode(offset: number): Code | undefined;
};

export enum NodeType {
    Token,
    Type,
    Rule,
    Embedded
};

export interface Code {
    offset: number;
    length: number;
    end: number;
};


enum ParserState {
    WaitingDecl,
    WaitingDef,
    WaitingOptionParams,
    WaitingRule,
    WaitingAction,
    WithinRules,
    WithinCode,
};

export function parse(text: string, state: ParserState = ParserState.WaitingDecl): LexDocument {
    const scanner = createScanner(text);
    const embedded: Code[] = [];
    const rulesRange: [number, number] = [-1, -1];
    const defines: { [name: string]: ISymbol } = {};
    const states: { [name: string]: ISymbol } = {};
    const components: ISymbol[] = [];
    const problems: Problem[] = [];

    const document: LexDocument = {
        embedded,
        rulesRange,
        defines,
        states,
        components,
        problems,
        getEmbeddedCode(offset: number) {
            return binarySearch(embedded, offset, (code, offset) => offset < code.offset ? 1 : (offset > code.end ? -1 : 0))
        }
    };

    function addProblem(message: string, offset: number, end: number, severity: ProblemType, related?: ProblemRelated) {
        document.problems.push({
            offset: offset,
            end: end,
            message: message,
            type: severity,
            related: related
        });
    }

    function addSymbol(symbols: { [name: string]: ISymbol }, name: string, offset: number, end: number) {
        const old = symbols[name];
        if (old) {
            addProblem(`Symbol was already declared.`, offset, end, ProblemType.Error, {
                offset: old.offset,
                end: old.end,
                message: "Was declared here."
            });
        } else {
            symbols[name] = {
                offset: offset,
                length: end - offset,
                end: end,
                name: name,
                used: false,
                definition: [offset, end],
                references: [[offset, end]]
            };
        }
    }

    let end = -2;
    // let state = ParserState.WaitingDecl;
    let type = '';
    let token = scanner.scan();
    let offset = 0;
    let codeOffset = 0;
    let tokenText = '';
    let acceptingStates = false;
    let lastToken = token;
    let isConditionScope = false;
    while (end < 0 && token !== TokenType.EOS) {
        offset = scanner.getTokenOffset();
        switch (token) {
            case TokenType.StartCode:
                codeOffset = offset;
                token = scanner.scan();
                continue;
            case TokenType.EndCode:
                document.embedded.push({
                    offset: codeOffset,
                    length: scanner.getTokenEnd() - codeOffset,
                    end: scanner.getTokenEnd()
                });
                token = scanner.scan();
                continue;
            case TokenType.Code:
                token = scanner.scan();
                continue;
            case TokenType.StartComment:
            case TokenType.EndComment:
            case TokenType.Comment:
                token = scanner.scan();
                continue;
        }
        switch (state) {
            case ParserState.WaitingDecl:
                switch (token) {
                    case TokenType.Word:
                        addSymbol(document.defines, scanner.getTokenText(), scanner.getTokenOffset(), scanner.getTokenEnd());

                        // this is stops counting regex pattern like [{] as action opener
                        scanner.disableMultiLineBrackets();
                        state = ParserState.WaitingDef;
                        break;
                    case TokenType.Option:
                        state = ParserState.WaitingOptionParams;
                        const ch = scanner.getTokenText().charCodeAt(1);
                        if (ch === _CHS || ch === _CHX) {
                            acceptingStates = true;
                        }
                        break;
                    case TokenType.RulesTag:
                        state = ParserState.WaitingRule;
                        end++;
                        document.rulesRange[0] = offset;
                        break;
                    case TokenType.Divider:
                        addProblem("No white spaces are allowed at the beginning of the line.", scanner.getTokenOffset(), scanner.getTokenEnd(), ProblemType.Error);
                        break;
                }
                break;
            case ParserState.WaitingDef:
                switch (token) {
                    case TokenType.EOL:
                        state = ParserState.WaitingDecl;
                        scanner.enableMultiLineBrackets();
                        break;
                    case TokenType.Action:
                        tokenText = scanner.getTokenText();
                        if (/^[a-zA-Z]\w*$/.test(tokenText))
                            document.components.push({
                                name: tokenText,
                                offset: offset,
                                length: scanner.getTokenLength(),
                                end: scanner.getTokenEnd(),
                                used: true,
                                definition: [-1, -1],
                                references: [[offset, scanner.getTokenEnd()]]
                            });
                        break;
                }
                break;
            case ParserState.WaitingOptionParams:
                switch (token) {
                    case TokenType.EOL:
                        state = ParserState.WaitingDecl;
                        acceptingStates = false;
                        break;
                    case TokenType.Word:
                        if (acceptingStates)
                            addSymbol(document.states, scanner.getTokenText(), scanner.getTokenOffset(), scanner.getTokenEnd());
                        break;
                }
                break;
            case ParserState.WaitingRule:
                switch (token) {
                    case TokenType.Literal:
                    case TokenType.Word:
                        break;
                    case TokenType.Predefined:
                        break;
                    case TokenType.States: // found initial states
                        tokenText = scanner.getTokenText();
                        const matcher = /\w+/g;
                        var match;
                        while ((match = matcher.exec(tokenText)) !== null) {
                            const start = offset + match.index;
                            const end = offset + match.index + match[0].length;
                            document.components.push({
                                name: match[0],
                                offset: start,
                                length: match[0].length,
                                end: end,
                                used: true,
                                definition: [-1, -1],
                                references: [[start, end]]
                            });
                        }
                        break;
                    case TokenType.StartAction:
                        isConditionScope = lastToken === TokenType.EndStates;
                        break;
                    case TokenType.Action: // found using user defined definition
                        tokenText = scanner.getTokenText();
                        if (/^\w+$/.test(tokenText)) { // if {word}
                            document.components.push({
                                name: scanner.getTokenText(),
                                offset: offset,
                                length: scanner.getTokenLength(),
                                end: scanner.getTokenEnd(),
                                used: true,
                                definition: [-1, -1],
                                references: [[offset, scanner.getTokenEnd()]]
                            });
                        } else if (isConditionScope) {
                            /**
                             * If initial state scope
                             * <state>{
                             * 
                             * {word}   ....
                             * {abc}    ....
                             * 
                             * }
                             */
                            console.log("condition scope");
                            const recursive = parse(tokenText, ParserState.WaitingRule);
                            recursive.components.forEach(c => {
                                c.offset += offset;
                                c.end += offset;
                                c.references[0][0] += offset;
                                c.references[0][1] += offset;
                                document.components.push(c);
                            });
                            recursive.embedded.forEach(code => {
                                code.offset += offset;
                                code.end += offset;
                                document.embedded.push(code);
                            });
                        } else {
                            addProblem("Invalid definition pattern.", scanner.getTokenOffset(), scanner.getTokenEnd(), ProblemType.Error);
                        }
                        break;
                    case TokenType.Divider:
                        state = ParserState.WaitingAction;
                        break;
                    case TokenType.RulesTag:
                        end++;
                        document.rulesRange[1] = offset;
                        break;
                }
                break;
            case ParserState.WaitingAction:
                switch (token) {
                    case TokenType.EOL:
                    case TokenType.Bar:
                        state = ParserState.WaitingRule;
                        break;
                    case TokenType.StartAction:
                        codeOffset = offset;
                        break;
                    case TokenType.EndAction:
                        document.embedded.push({
                            offset: codeOffset,
                            length: scanner.getTokenEnd() - codeOffset,
                            end: scanner.getTokenEnd()
                        });
                        break;
                }
                break;
        }
        lastToken = token;
        token = scanner.scan();
    }

    for (let i = 0; i < document.components.length; i++) {
        const component = document.components[i];
        let symbol: ISymbol;
        if ((symbol = document.defines[component.name])) {
            component.definition = symbol.definition;
            component.references = symbol.references;
            symbol.references.push([component.offset, component.end]);
            symbol.used = true;
        } else if ((symbol = document.states[component.name])) {
            component.definition = symbol.definition;
            component.references = symbol.references;
            symbol.references.push([component.offset, component.end]);
            symbol.used = true;
        } else {
            addProblem('Symbol not declared.',
                component.offset,
                component.end,
                ProblemType.Error
            )
        }
    }

    Object.keys(document.defines).forEach(key => {
        const component = document.defines[key];
        if (!component.used) {
            addProblem('Definition declared but never used.',
                component.offset,
                component.end,
                ProblemType.Warning
            )
        }
    });

    Object.keys(document.states).forEach(key => {
        const component = document.states[key];
        if (!component.used) {
            addProblem('Definition declared but never used.',
                component.offset,
                component.end,
                ProblemType.Warning
            )
        }
    });

    return document;
}