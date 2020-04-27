import { MarkdownString } from 'vscode';

export function createMarkedCodeString(code: string, languageId: string): MarkdownString {
    const str = new MarkdownString();
    str.appendCodeblock(code, languageId);
    return str;
}