import { binarySearch, _SQO } from './utils';
import { createScanner } from './yaccScanner';
import { parse as parseUnion, YYType } from './unionParser';
import { Scanner, TokenType } from '../yaccLanguageTypes';
import { ProblemType, Problem, ProblemRelated } from '../common';
import { SemanticTokenData, SemanticTokenModifier, SemanticTokenType } from '../semanticTokens';
import { Position, workspace } from 'vscode';

export const predefined: { [name: string]: string } = {};
predefined['error'] = "Predefined syntax error token.";

enum ParserState {
    WaitingToken,
    WaitingSymbol,
    WaitingPrecedence,
    WaitingRule,
    WaitingUnion,
    Normal
};

export interface ISymbol {
    terminal: boolean;
    offset: number;
    length: number;
    end: number;
    name: string;
    type: string;
    used: boolean;
    definition: [number, number];
    references: [number, number][];

    alias?: ISymbol
    value?: string
};

export interface INamedReference {
    name: string;
    offset: number;
    length: number;
    end: number;

    symbol?: string;
}

export interface YACCDocument {
    readonly embedded: Node[];
    readonly nodes: Node[];
    readonly types: { [name: string]: ISymbol };
    readonly tokens: { [name: string]: ISymbol };
    readonly aliases: { [name: string]: ISymbol };
    readonly symbols: { [name: string]: ISymbol };
    readonly components: ISymbol[];
    readonly namedReferences: { [name: string]: INamedReference };
    readonly rulesRange: [number, number];
    readonly problems: Problem[];
    readonly defines : { [name: string]: ISymbol };

    getNodeByOffset(offset: number): Node | undefined;
    getEmbeddedNode(offset: number): Node | undefined;
    getSemanticTokens(getPos: (offset: number) => Position): SemanticTokenData[];
};

export enum NodeType {
    Token,
    Type,
    Precedence,
    Rule,
    Define,
    Embedded
};

export interface Node {
    nodeType: NodeType;
    offset: number;
    length: number;
    end: number;
    name?: string;

    typeOffset?: number;
    typeEnd?: number;

    actions?: string[];
};

export function parse(text: string): YACCDocument {
    const scanner = createScanner(text);

    const embedded: Node[] = [];
    const nodes: Node[] = [];
    const types: { [name: string]: ISymbol } = {};
    const tokens: { [name: string]: ISymbol } = {};
    const aliases: { [name: string]: ISymbol } = {};
    const symbols: { [name: string]: ISymbol } = {};
    const components: ISymbol[] = [];
    const namedReferences: { [name: string]: INamedReference } = {};
    const rulesRange: [number, number] = [0, text.length];
    const problems: Problem[] = [];
    const document: YACCDocument = {
        embedded,
        nodes,
        types,
        tokens,
        aliases,
        symbols,
        components,
        namedReferences,
        rulesRange,
        problems,
        defines: {},

        getNodeByOffset(offset: number): Node | undefined {
            return binarySearch(this.nodes, offset, (node, offset) => offset < node.offset ? 1 : (offset > node.end ? -1 : 0))
        },
        getEmbeddedNode(offset: number): Node | undefined {
            return binarySearch(this.embedded, offset, (node, offset) => offset < node.offset ? 1 : (offset > node.end ? -1 : 0))
        },
        getSemanticTokens(getPos: (offset: number) => Position): SemanticTokenData[] {
            const r: SemanticTokenData[] = [];
            for (let i = 0; i < this.components.length; i++) {
                const component = this.components[i];
                let semanticType = SemanticTokenType.class;
                if (predefined[component.name]) {
                    semanticType = SemanticTokenType.keyword;
                } else if (component.terminal) {
                    semanticType = SemanticTokenType.parameter;
                }
                r.push({
                    start: getPos(component.offset),
                    length: component.length,
                    typeIdx: semanticType,
                    modifierSet: SemanticTokenModifier._
                });
            }

            Object.keys(this.namedReferences).forEach(key => {
                const component = this.namedReferences[key];
                r.push({
                    start: getPos(component.offset + 1),
                    length: component.length - 2,
                    typeIdx: SemanticTokenType.keyword,
                    modifierSet: SemanticTokenModifier._
                });
            });
            return r;
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

    function addSymbolToMap(symbols: { [name: string]: ISymbol }, terminal: boolean, offset: number, end: number, name: string, type: string, value?: string): ISymbol | undefined {
        const old = symbols[name];
        if (old) {
            addProblem(`Symbol was already declared/defined.`, offset, end, ProblemType.Error, {
                offset: old.offset,
                end: old.end,
                message: "Was declared/defined here."
            });
            return undefined;
        } else {
            symbols[name] = {
                terminal: terminal,
                offset: offset,
                length: end - offset,
                end: end,
                name: name,
                type: type,
                used: false,
                definition: [offset, end],
                references: [[offset, end]],
                value: value
            };
            return symbols[name];
        }
    }

    function addUnknownSymbolProblem(scanner: Scanner) {
        addProblem(`Unknown symbol ${scanner.getTokenText()}.`, scanner.getTokenOffset(), scanner.getTokenEnd(), ProblemType.Error);
    }

    let end = -2;
    let state = ParserState.Normal;
    let type = '';
    let token = scanner.scan();
    let offset = 0;
    let actionOffset = 0;
    let tokenText = '';
    let lastNode: Node | undefined;
    let lastToken = token;
    let lastText = scanner.getTokenText();
    let lastTokenSymbol = undefined;
    while (end < 0 && token !== TokenType.EOS) {
        offset = scanner.getTokenOffset();
        switch (token) {
            case TokenType.StartAction: // save the offset of the action zone
                actionOffset = offset;
                break;
            case TokenType.EndAction: // save the action region
                document.embedded.push({ nodeType: NodeType.Embedded, offset: actionOffset, length: scanner.getTokenLength(), end: scanner.getTokenEnd() });
                break;
            case TokenType.Action:
                switch (state) {
                    case ParserState.WaitingUnion: // if we are inside union, extract type information
                        tokenText = scanner.getTokenText();
                        parseUnion(tokenText).forEach(t => {
                            if (t.name) {
                                const typeOffset = offset + t.location[0];
                                const typeEnd = offset + t.location[1];
                                addSymbolToMap(document.types, true, typeOffset, typeEnd, t.name, t.info);
                            }
                        });
                        state = ParserState.Normal;
                        break;
                    case ParserState.WaitingRule: // if we are inside a rule, save the code
                        if (lastNode && lastNode.actions) {
                            lastNode.actions.push(scanner.getTokenText());
                        }
                        break;
                }
                break;
            case TokenType.Definition:
                // A definition line is of the form %define <key> [value]
                const line = scanner.getTokenText().trim();
                const match = line.match(/^\s*%define\s+(\S+)\s*(.*)/);
                if (match) {
                    const key = match[1].trim(); // The key is the first group
                    const value = match[2].trim(); // The value is the second group

                    // Add the key and value to the defines map
                    addSymbolToMap(document.defines, true, offset, scanner.getTokenEnd(), key, value, value);
                } else {
                    addProblem(`Invalid %define line`, offset, scanner.getTokenEnd(), ProblemType.Error);
                }
                
                break;
            case TokenType.Option:
                // save the last node
                if (state !== ParserState.WaitingRule && lastNode !== undefined) {
                    lastNode.end = offset;
                    lastNode.length = lastNode.end - lastNode.offset;
                    document.nodes.push(lastNode);
                    type = '';
                    lastNode = undefined;
                    state = ParserState.Normal;
                }
                tokenText = scanner.getTokenText();
                switch (tokenText) {
                    case '%union':
                        state = ParserState.WaitingUnion;
                        break;
                    case '%token':
                        lastNode = { nodeType: NodeType.Token, offset: offset, length: -1, end: -1 }
                        state = ParserState.WaitingToken;
                        break;
                    case '%type':
                        lastNode = { nodeType: NodeType.Type, offset: offset, length: -1, end: -1 }
                        state = ParserState.WaitingSymbol;
                        break;
                    case '%left':
                    case '%right':
                    case '%nonassoc':
                    case '%precedence':
                        lastNode = { nodeType: NodeType.Precedence, offset: offset, length: -1, end: -1 }
                        state = ParserState.WaitingPrecedence;
                        break;
                    default:
                        break;
                }
                break;
            case TokenType.StartType:
                type = ''
                if (lastNode)
                    lastNode.typeOffset = scanner.getTokenOffset();
                break;
            case TokenType.EndType:
                if (lastNode)
                    lastNode.typeEnd = scanner.getTokenOffset();
                break;
            case TokenType.TypeValue:
                // extract the type inside the tag <[type]>
                type = scanner.getTokenText();
                const t = document.types[type];
                if (t) {
                    t.references.push([scanner.getTokenOffset(), scanner.getTokenEnd()]);
                } else if (!document.defines['api.value.type'] || document.defines['api.value.type'].value !== 'variant') {
                    addProblem(`Type was not declared in the %union.`, scanner.getTokenOffset(), scanner.getTokenEnd(), ProblemType.Error);
                }
                break;
            case TokenType.RulesTag:
                // start of the rule section
                if (lastNode !== undefined) {
                    lastNode.end = offset;
                    lastNode.length = lastNode.end - lastNode.offset;
                    document.nodes.push(lastNode);
                    lastNode = undefined;
                    type = '';
                }
                document.rulesRange[end === -2 ? 0 : 1] = offset;
                end++;
                state = ParserState.WaitingRule;
                break;
            case TokenType.Word:
                const word = scanner.getTokenText();
                switch (state) {
                    case ParserState.Normal:
                        break;
                    case ParserState.WaitingToken:
                        if (predefined[word]) {
                            addProblem(`You cannot declare the preserved keyword "${word}" as a token!`,
                                offset, scanner.getTokenEnd(), ProblemType.Error);
                            break;
                        }
                        lastTokenSymbol = addSymbolToMap(document.tokens, true, offset, scanner.getTokenEnd(), word, type);
                        break;
                    case ParserState.WaitingSymbol:
                        addSymbolToMap(document.symbols, true, offset, scanner.getTokenEnd(), word, type);
                        break;
                    case ParserState.WaitingPrecedence:
                        if (!document.tokens[word]) {
                            addSymbolToMap(document.tokens, true, offset, scanner.getTokenEnd(), word, type);
                        }
                        break;
                    case ParserState.WaitingRule:
                        document.components.push({
                            terminal: true,
                            offset: offset,
                            length: scanner.getTokenLength(),
                            end: scanner.getTokenEnd(),
                            name: scanner.getTokenText(),
                            type: '',
                            used: true,
                            definition: [-1, -1],
                            references: [[offset, scanner.getTokenEnd()]]
                        });
                        break;
                    default:
                        addProblem(`Unexpected symbol ${word}`, offset, scanner.getTokenEnd(), ProblemType.Error);
                }
                break;
            case TokenType.Colon:
                switch (state) {
                    case ParserState.WaitingRule: // we maybe found a new non-terminal symbol definition
                        if (lastToken !== TokenType.Word && lastToken !== TokenType.Param) {
                            addProblem(`Unexpected ':' you can only declare a non-terminal with a word.`, scanner.getTokenOffset(), scanner.getTokenEnd(), ProblemType.Error);
                            break;
                        }
                        const nonTerminal = document.components.pop(); // the last symbol was not part of last rule
                        if (nonTerminal !== undefined) { // I think the array will never be empty, but check for sanity
                            if (lastNode !== undefined) { // Last rule finished
                                lastNode.end = nonTerminal.offset;
                                lastNode.length = lastNode.end - lastNode.offset;
                                document.nodes.push(lastNode);
                                lastNode = undefined;
                            }
                            if (predefined[nonTerminal.name]) {
                                addProblem(`You cannot declare the preserved keyword "${nonTerminal.name}" as a non-terminal!`,
                                    nonTerminal.offset, nonTerminal.end, ProblemType.Error);
                                break;
                            }
                            nonTerminal.terminal = false; // this will not be a terminal
                            nonTerminal.definition = [nonTerminal.offset, nonTerminal.end]; // is defined here
                            const symbol = document.symbols[nonTerminal.name];
                            if (symbol !== undefined) { // if the symbol was previously declared with %type ...
                                if (!symbol.terminal) { // there is a redefinition of the symbol
                                    addProblem(`Non-terminal symbol was already declared.`, nonTerminal.offset, nonTerminal.end, ProblemType.Error, {
                                        offset: symbol.offset,
                                        end: symbol.end,
                                        message: "Was declared here."
                                    });
                                }
                                nonTerminal.references.push(symbol.references[0]); // add %type reference
                                nonTerminal.type = symbol.type; // assign the type from %type
                                symbol.references = nonTerminal.references; // update also the old references
                            }
                            const token = document.tokens[nonTerminal.name];
                            if (token !== undefined) { // if the symbol was already declared as a token
                                addProblem(`Symbol was already declared as a token.`, nonTerminal.offset, nonTerminal.end, ProblemType.Error, {
                                    offset: token.offset,
                                    end: token.end,
                                    message: "Was declared here."
                                });
                            }
                            document.symbols[nonTerminal.name] = nonTerminal; // update symbol table
                            lastNode = { nodeType: NodeType.Rule, name: nonTerminal.name, offset: nonTerminal.offset, length: -1, end: -1, actions: [] }
                        }
                        break;
                    default:
                        addProblem(`Unexpected : character`, scanner.getTokenOffset(), scanner.getTokenEnd(), ProblemType.Error);
                        break;
                }
                break;
            case TokenType.SemiColon:
            case TokenType.StartComment:
            case TokenType.EndComment:
            case TokenType.Comment:
                break;
            case TokenType.Param:
                if (state == ParserState.WaitingRule) {
                    let symbol: string | undefined = undefined;
                    switch (lastToken) {
                        case TokenType.Word:
                            symbol = lastText;
                        case TokenType.EndAction:
                            document.namedReferences[scanner.getTokenText()] = {
                                name: scanner.getTokenText(),
                                offset: scanner.getTokenOffset(),
                                end: scanner.getTokenEnd(),
                                length: scanner.getTokenLength(),
                                symbol: symbol
                            }
                            break;
                        default:
                            addProblem(`Named reference to either non terminal or middle rule action`, scanner.getTokenOffset(), scanner.getTokenEnd(), ProblemType.Error);
                            break;
                    }
                }
                break;
            case TokenType.Literal: {
                const word = scanner.getTokenText();
                const code = word.charCodeAt(0)
                if (code == _SQO) break;
                switch (state) {
                    case ParserState.WaitingToken:
                        if (lastTokenSymbol && lastTokenSymbol.alias == undefined) {
                            lastTokenSymbol.alias = addSymbolToMap(document.aliases, true, offset, scanner.getTokenEnd(), word, lastTokenSymbol.type)
                            if (lastTokenSymbol.alias)
                                lastTokenSymbol.alias.alias = lastTokenSymbol
                        } else {
                            addProblem(`Alias not associated with an token.`, scanner.getTokenOffset(), scanner.getTokenEnd(), ProblemType.Error);
                        }
                        break;
                    case ParserState.WaitingRule:
                        document.components.push({
                            terminal: true,
                            offset: offset,
                            length: scanner.getTokenLength(),
                            end: scanner.getTokenEnd(),
                            name: scanner.getTokenText(),
                            type: '',
                            used: true,
                            definition: [-1, -1],
                            references: [[offset, scanner.getTokenEnd()]]
                        });
                        break;
                }
                break;
            }
            case TokenType.Bar:
                if (state !== ParserState.WaitingRule) {
                    addProblem(`Unexpected | symbol.`, scanner.getTokenOffset(), scanner.getTokenEnd(), ProblemType.Error);
                }
                break;
            default:
                // TODO: better problem detection with unexpected symbols
                if (state === ParserState.WaitingRule)
                    addUnknownSymbolProblem(scanner);
                break;
        }
        lastToken = token;
        lastText = scanner.getTokenText();

        token = scanner.scan();
    }

    for (let i = 0; i < document.components.length; i++) {
        const component = document.components[i];
        let symbol: ISymbol;
        if ((symbol = document.symbols[component.name])) {
            component.terminal = false;
            component.definition = symbol.definition;
            component.type = symbol.type;
            component.references = symbol.references;
            symbol.references.push([component.offset, component.end]);
        } else if ((symbol = document.tokens[component.name])) {
            component.definition = symbol.definition;
            component.type = symbol.type;
            component.references = symbol.references;
            symbol.references.push([component.offset, component.end]);
            symbol.used = true;
        } else if ((symbol = document.aliases[component.name])) {
            component.definition = symbol.definition;
            component.type = symbol.type;
            component.references = symbol.references;
            symbol.references.push([component.offset, component.end]);
            symbol.used = true;
            if (symbol.alias)
                symbol.alias.used = true;
        } else if (!predefined[component.name]) {
            document.problems.push({
                offset: component.offset,
                end: component.end,
                message: 'Symbol was not declared.',
                type: ProblemType.Error
            });
        }
    }

    Object.keys(document.tokens).forEach(key => {
        const component = document.tokens[key];
        if (!component.used) {
            addProblem('Token declared but never used.',
                component.offset,
                component.end,
                ProblemType.Warning
            )
        }
    });

    Object.keys(document.symbols).forEach(key => {
        if (document.symbols[key].definition[0] < document.rulesRange[0]) {
            addProblem('Non-terminal symbol type defined but never declared.',
                document.symbols[key].offset,
                document.symbols[key].end,
                ProblemType.Warning
            )
            delete document.symbols[key];
        }
    });

    document.nodes
        .filter(n => n.nodeType === NodeType.Rule)
        .filter(n => n.actions !== undefined)
        .forEach(node => {
            for (let i = 0; i < node.actions!.length; i++) {
                const element = node.actions![i];
                if (element.indexOf('$$') !== -1) {
                    const symbol = document.symbols[node.name!];
                    const config = workspace.getConfiguration('yash');
                    const yyType = config.get('YYTYPE', '');
                    if (!symbol.type && yyType === '') {
                        addProblem('Semantic value used inside actions but has not declared the type.',
                            symbol.offset,
                            symbol.end,
                            ProblemType.Error
                        )
                    }
                    break;
                }
            }
        });

    return document
}