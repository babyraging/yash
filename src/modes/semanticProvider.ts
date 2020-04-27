/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. 
 *  
 *  Modified to adapt the project
 *--------------------------------------------------------------------------------------------*/

import { SemanticTokenData } from '../languages/semanticTokens';
import { TextDocument, Range, SemanticTokens, SemanticTokensBuilder } from 'vscode';
import { LanguageModes } from './languageModes';

export interface SemanticTokenProvider {
    readonly legend: { types: string[]; modifiers: string[] };
    getSemanticTokens(document: TextDocument): SemanticTokens;
}

interface LegendMapping {
    types: number[] | undefined;
    modifiers: number[] | undefined;
}

export function newSemanticTokenProvider(languageModes: LanguageModes): SemanticTokenProvider {
    const legend = { types: [], modifiers: [] };
    const legendMappings: { [modeId: string]: LegendMapping } = {};

    for (let mode of languageModes.getAllModes()) {
        if (mode.getSemanticTokenLegend && mode.getSemanticTokens) {
            const modeLegend = mode.getSemanticTokenLegend();
            legendMappings[mode.getId()] = { types: createMapping(modeLegend.types, legend.types), modifiers: createMapping(modeLegend.modifiers, legend.modifiers) };
        }
    }

    return {
        legend,
        getSemanticTokens(document: TextDocument, ranges?: Range[]): SemanticTokens {
            const builder = new SemanticTokensBuilder();
            for (let mode of languageModes.getAllModes()) {
                if (mode.getSemanticTokens) {
                    const mapping = legendMappings[mode.getId()];
                    const tokens = mode.getSemanticTokens(document);
                    applyTypesMapping(tokens, mapping.types);
                    applyModifiersMapping(tokens, mapping.modifiers);
                    tokens.forEach(token => {
                        builder.push(token.start.line, token.start.character, token.length, token.typeIdx, token.modifierSet);
                    });
                }
            }
            return builder.build();
        }
    };
}

function createMapping(origLegend: string[], newLegend: string[]): number[] | undefined {
    const mapping: number[] = [];
    let needsMapping = false;
    for (let origIndex = 0; origIndex < origLegend.length; origIndex++) {
        const entry = origLegend[origIndex];
        let newIndex = newLegend.indexOf(entry);
        if (newIndex === -1) {
            newIndex = newLegend.length;
            newLegend.push(entry);
        }
        mapping.push(newIndex);
        needsMapping = needsMapping || (newIndex !== origIndex);
    }
    return needsMapping ? mapping : undefined;
}

function applyTypesMapping(tokens: SemanticTokenData[], typesMapping: number[] | undefined): void {
    if (typesMapping) {
        for (let token of tokens) {
            token.typeIdx = typesMapping[token.typeIdx];
        }
    }
}

function applyModifiersMapping(tokens: SemanticTokenData[], modifiersMapping: number[] | undefined): void {
    if (modifiersMapping) {
        for (let token of tokens) {
            let modifierSet = token.modifierSet;
            if (modifierSet) {
                let index = 0;
                let result = 0;
                while (modifierSet > 0) {
                    if ((modifierSet & 1) !== 0) {
                        result = result + (1 << modifiersMapping[index]);
                    }
                    index++;
                    modifierSet = modifierSet >> 1;
                }
                token.modifierSet = result;
            }
        }
    }
}