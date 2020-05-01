import { TextDocument, TextEdit, Range, FormattingOptions } from 'vscode';
import { YACCDocument, ISymbol, NodeType, Node } from '../parser/yaccParser';
import { formatError } from '../../runner';


function findNearestNodes(nodes: Node[], offsetStart: number, offsetEnd: number): [number, number] {
    let minStart = Number.MAX_VALUE;
    let minEnd = Number.MAX_VALUE;
    let indexStart = -1, indexEnd = -1;
    nodes.forEach((node, i) => {
        if (Math.abs(node.offset - offsetStart) < minStart) {
            minStart = Math.abs(node.offset - offsetStart);
            indexStart = i;
        }
        if (Math.abs(node.end - offsetEnd) < minEnd) {
            minEnd = Math.abs(node.end - offsetEnd);
            indexEnd = i;
        }
    });
    return [indexStart, indexEnd];
}

function removeExtraSpaces(result: string): string {
    return result.replace(/[ ]+/g, (m) => {
        return ' ';
    });
}

function removeNonWhiteSpaces(result: string): string {
    return result.replace(/[\s]/g, (m) => {
        return ' ';
    });
}

function appendEOL(result: string): string {
    if (result[result.length] !== '\n') return result + "\n";
    return result;
}

function splitTooLongString(result: string): string {
    var numtoken = 0; /* TODO: take max num token from options */
    return result.replace(/[ ]/g, (m) => {
        if (numtoken++ == 8) {
            numtoken = 0;
            return '\n\t';
        }
        return ' ';
    });
}

function splitSingleLineComment(result: string): string {
    return result;
}

export function doYACCFormat(document: TextDocument, range: Range, options: FormattingOptions, yaccDocument: YACCDocument): TextEdit[] {
    var node;
    let edit = Array();
    console.log("Formatting...");
    //console.log(document.offsetAt(range.start) + " " + document.offsetAt(range.end));
    let indices = findNearestNodes(yaccDocument.nodes, document.offsetAt(range.start), document.offsetAt(range.end));
    let startIndex = indices[0];
    let endIndex = indices[1];
    console.log(startIndex + " " + endIndex)
    for (let i = startIndex; i <= endIndex; i++) {
        let node = yaccDocument.nodes[i];
        console.log(node);
        var textRange = new Range(document.positionAt(node.offset), document.positionAt(node.end + 1))
        var formattedText = undefined
        if (node.nodeType == NodeType.Token || node.nodeType == NodeType.Type) {
            formattedText = document.getText(textRange);
            console.log("originalText:^" + formattedText + "$");
            formattedText = removeNonWhiteSpaces(formattedText);
            formattedText = formattedText.trimLeft();
            formattedText = formattedText.trimRight();
            formattedText = removeExtraSpaces(formattedText);
            formattedText = appendEOL(formattedText);
            //formattedText = splitSingleLineComment(formattedText);
            formattedText = splitTooLongString(formattedText);
            console.log("formattedText:^" + formattedText + "$")
        }
        if (formattedText) edit.push(TextEdit.replace(textRange, formattedText));
    }
    return edit;
}