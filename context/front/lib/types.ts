export interface ArticleSection {
    heading: string;
    paragraphs: string[];
}

export interface ArticleData {
    url: string;
    source: string;
    title: string;
    authors: string[];
    sections: ArticleSection[];
}

export type WorkflowStatus = "idle" | "loading" | "success" | "error";

export interface WorkflowState<T> {
    status: WorkflowStatus;
    data: T | null;
    error: string | null;
}

export interface KeywordsResult {
    keywords: string[];
}

export interface SummaryResult {
    summary: string;
}

export interface Entity {
    name: string;
    type: string;
    category?: string;
    description?: string;
}

export interface EntitiesResult {
    entities: Entity[];
}

export interface BlindSpotsResult {
    blindspots: string[];
}

export interface MediaResult {
    mediaName: string;
    description: string;
    conflicts: string[];
}

export interface OtherMediaItem {
    name: string;
    url?: string;
    angle?: string;
}

export interface OtherMediaResult {
    otherMedia: OtherMediaItem[];
}

export type BiasFamily =
    | "selection_faits"
    | "cadrage_lexical"
    | "causalite_fragile"
    | "usage_chiffres"
    | "structure_recit"
    | "qualite_argumentative";

export interface BiasSignal {
    family: BiasFamily;
    bias: string;
    confidence: "low" | "medium" | "high";
    excerpt?: string;
    explanation: string;
}

export interface CognitiveBiasResult {
    signals: BiasSignal[];
    globalScore: number;
    summary: string;
}

export interface OtherMediaArticle {
    title: string;
    media: string;
    url: string;
}

export interface SynthesisPoint {
    label: string;
    severity: "green" | "orange" | "red";
    explanation?: string;
}

export interface SynthesisResult {
    points: SynthesisPoint[];
}

export type SourceQualityLevel = "low" | "medium" | "high";

export type SourceUsageAssessment =
    | "correct"
    | "partially_correct"
    | "misleading"
    | "unverifiable";

export interface SourceReference {
    sourceName: string;
    sourceType: string;
    citationExcerpt?: string;
    notoriety: SourceQualityLevel;
    reliability: SourceQualityLevel;
    relevance: SourceQualityLevel;
    usageAssessment: SourceUsageAssessment;
    issues: string[];
    assessment: string;
}

export interface SourceVerificationResult {
    sourceCount: number;
    overallAssessment: string;
    sources: SourceReference[];
}

export interface FullAnalysisResult {
    entities: Entity[];
    summary: string;
    keywords: string[];
    blindspots: string[];
    media: MediaResult;
    otherMedia: OtherMediaArticle[];
    cognitiveBias: CognitiveBiasResult;
    synthesis?: SynthesisResult;
}
