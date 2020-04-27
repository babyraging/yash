import { TextDocument, CompletionList, CompletionItem, CompletionItemKind, Position } from 'vscode';
import { YACCDocument, NodeType } from '../parser/yaccParser';
import { createScanner } from '../parser/yaccScanner';
import { TokenType } from '../yaccLanguageTypes';

const keywords = ['type', 'option', 'token', 'left', 'right', 'define', 'output',
    'precedence', 'nterm', 'destructor', 'union', 'code', 'printer',
    'parse-param', 'lex-param', 'pure-parser', 'expect', 'name-prefix', 'locations', 'nonassoc'];

export function doYACCComplete(document: TextDocument, position: Position, yaccDocument: YACCDocument): CompletionItem[] | CompletionList {
    const offset = document.offsetAt(position);
    const text = document.getText();
    const embedded = yaccDocument.getEmbeddedNode(offset);
    if (embedded !== undefined) {
        return [];
    }

    const scanner = createScanner(text, offset - 1);
    if (scanner.scan() === TokenType.Percent) {
        if (position.character === 1 && offset < yaccDocument.rulesRange[0])
            return keywords.map((keyword) => {
                const completion = new CompletionItem(keyword);
                completion.detail = "keyword";
                completion.kind = CompletionItemKind.Constructor;
                return completion;
            });
        return [];
    }

    const node = yaccDocument.getNodeByOffset(offset);
    if (node === undefined) {
        return [];
    }

    var completion: CompletionItem;
    const result: CompletionItem[] = [];
    switch (node.nodeType) {
        case NodeType.Token:
        case NodeType.Type:
            if (node.typeOffset && offset > node.typeOffset) {
                if (!node.typeEnd || offset <= node.typeEnd) {
                    Object.keys(yaccDocument.types).forEach((type) => {
                        completion = new CompletionItem(type)
                        completion.detail = "type"
                        completion.kind = CompletionItemKind.TypeParameter;
                        result.push(completion);
                    })
                    break;
                }
            }
            if (node.nodeType === NodeType.Type)
                Object.keys(yaccDocument.symbols).forEach((symbol) => {
                    completion = new CompletionItem(symbol)
                    completion.detail = "symbol";
                    completion.kind = CompletionItemKind.Class;
                    result.push(completion);
                });
            break;
        case NodeType.Rule:
            Object.keys(yaccDocument.symbols).forEach((symbol) => {
                completion = new CompletionItem(symbol)
                completion.detail = "symbol";
                completion.kind = CompletionItemKind.Class;
                result.push(completion);
            })
            Object.keys(yaccDocument.tokens).forEach((token) => {
                completion = new CompletionItem(token)
                completion.detail = "token";
                completion.kind = CompletionItemKind.Field;
                result.push(completion);
            })
            break;
        default:
            break;
    }
    return result;
}