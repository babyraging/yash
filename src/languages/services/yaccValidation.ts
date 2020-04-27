import { TextDocument, Diagnostic, Range, DiagnosticSeverity, DiagnosticRelatedInformation, Location } from "vscode";
import { YACCDocument } from "../parser/yaccParser";
import { ProblemType } from "../yaccLanguageTypes";

export function doYACCValidation(document: TextDocument, yaccDocument: YACCDocument): Diagnostic[] {
    const diags: Diagnostic[] = [];
    yaccDocument.problems.forEach(problem => {
        const range = new Range(document.positionAt(problem.offset), document.positionAt(problem.end));
        let severity: DiagnosticSeverity = DiagnosticSeverity.Information;
        switch (problem.type) {
            case ProblemType.Error:
                severity = DiagnosticSeverity.Error;
                break;
            case ProblemType.Information:
                severity = DiagnosticSeverity.Information;
                break;
            case ProblemType.Warning:
                severity = DiagnosticSeverity.Warning;
                break;
        }
        const diag = new Diagnostic(range, problem.message, severity);
        if (problem.related) {
            diag.relatedInformation = [new DiagnosticRelatedInformation(
                new Location(document.uri, new Range(document.positionAt(problem.related.offset), document.positionAt(problem.related.end))),
                problem.related.message
            )];
        }
        diags.push(diag);
    });
    return diags;
}