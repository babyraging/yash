import { TextDocument, CompletionList, CompletionItem, CompletionItemKind, Position, Range } from 'vscode';
import { LexDocument } from '../parser/lexParser';
import { createScanner } from '../parser/lexScanner';
import { TokenType } from '../lexLanguageTypes';

const keywords = ['array', 'pointer', 'option', 's', 'x'];

export function doLEXCompletion(document: TextDocument, position: Position, lexDocument: LexDocument): CompletionItem[] | CompletionList {
    const offset = document.offsetAt(position);
    const text = document.getText();
    const embedded = lexDocument.getEmbeddedCode(offset);
    if (embedded !== undefined) {
        return [];
    }

    const scanner = createScanner(text, offset - 1);
    if (scanner.scan() === TokenType.Percent) {
        if (position.character === 1 && offset < lexDocument.rulesRange[0])
            return keywords.map((keyword) => {
                const completion = new CompletionItem(keyword);
                completion.detail = "keyword";
                completion.kind = CompletionItemKind.Constructor;
                return completion;
            });
        return [];
    }

    const word = document.getText(document.getWordRangeAtPosition(position)).toUpperCase();

    const line = document.lineAt(position.line).text.substring(0, position.character);
    const result: CompletionItem[] = [];
    if (offset < lexDocument.rulesRange[0]) {
        // if before rules zone, definition need to be on the right
        const ok = line.match(/^\w+.*({\w*}?)+/);
        if (ok) {
            Object.keys(lexDocument.defines).filter(t=>t.toUpperCase().startsWith(word)).forEach((key) => {
                const completion = new CompletionItem(key);
                completion.detail = "definition";
                completion.kind = CompletionItemKind.Class;
                result.push(completion);
            })
        }
    } else if (offset < lexDocument.rulesRange[1]) {
        const res = line.match(/^[^\s]*(?:{\w*}?)+$/);
        if (res) {
            if (res[0].length >= position.character) {
                Object.keys(lexDocument.defines).filter(t=>t.toUpperCase().startsWith(word)).forEach((key) => {
                    const completion = new CompletionItem(key);
                    completion.detail = "definition";
                    completion.kind = CompletionItemKind.Class;
                    result.push(completion);
                })
            }
        } else {
            if (line.match(/^<[\w,]*>[^\s]*(?:{\w*}?)+$/)) {
                Object.keys(lexDocument.defines).filter(t=>t.toUpperCase().startsWith(word)).forEach((key) => {
                    const completion = new CompletionItem(key);
                    completion.detail = "definition";
                    completion.kind = CompletionItemKind.Class;
                    result.push(completion);
                })
            } else if (line.match(/^<[\w,]*$/)) { // TODO: fix completion for {} after <>

                Object.keys(lexDocument.states).filter(t=>t.toUpperCase().startsWith(word)).forEach((key) => {
                    const completion = new CompletionItem(key);
                    completion.detail = "initial state";
                    completion.kind = CompletionItemKind.Class;
                    result.push(completion);
                })
            }
        }
    }
    return result;
}