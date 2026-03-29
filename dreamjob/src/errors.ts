/**
 * Thrown when PDF parsing fails (corrupt, empty, or unreadable PDF).
 * Should map to 400 Bad Request.
 */
export class PdfParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfParseError";
  }
}

/**
 * Thrown when the AI extraction service fails (OpenAI API error, rate limit, etc.).
 * Should map to 500 Internal Server Error.
 */
export class AiExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiExtractionError";
  }
}

/**
 * Thrown when post-processing of extracted data fails (ID assignment, date normalization, etc.).
 * Should map to 500 Internal Server Error.
 */
export class PostProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PostProcessingError";
  }
}

/**
 * Thrown when an AI service is unavailable (missing API key, rate limit, transient error).
 * Should map to 503 Service Unavailable.
 */
export class AiServiceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiServiceUnavailableError";
  }
}
