export enum ProblemType {
    Information,
    Warning,
    Error
};

export interface ProblemRelated {
    readonly message: string;
    readonly offset: number;
    readonly end: number;
};

export interface Problem {
    readonly message: string;
    readonly offset: number;
    readonly end: number;
    readonly type: ProblemType;
    readonly related?: ProblemRelated;
};
