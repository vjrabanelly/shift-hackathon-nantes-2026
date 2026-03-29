export interface CreateTextAnalysisDto {
  content: string;
}

export interface CreateImageAnalysisDto {
  // file sent as multipart/form-data
}

export interface CreateAnalysisResponse {
  id: string;
}
