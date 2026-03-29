import express, { NextFunction, Request, Response } from "express";

import { config } from "./config";
import { CandidateRepository } from "./repositories/candidate-repository";
import { AgentsService } from "./services/agents";
import { JobOfferNormalizer } from "./services/job-offer-normalizer";
import { OpenAIJsonService } from "./services/openai-json-service";
import { WorkflowService } from "./services/workflow-service";
import {
  AtsAgentInput,
  CandidateAgentInput,
  RecruiterAgentInput,
  WorkflowRunInput
} from "./types";

const app = express();
app.use(express.json({ limit: "2mb" }));

const candidateRepository = new CandidateRepository();
const jobOfferNormalizer = new JobOfferNormalizer();
const openAiJsonService = new OpenAIJsonService();
const agentsService = new AgentsService(openAiJsonService);
const workflowService = new WorkflowService(
  candidateRepository,
  jobOfferNormalizer,
  agentsService
);

app.get("/health", (_request, response) => {
  response.json({
    status: "ok"
  });
});

app.get("/api/models", (_request, response) => {
  response.json({
    provider: "openai-responses-api",
    models: config.models
  });
});

app.get("/api/candidates/:candidateId", async (request, response, next) => {
  try {
    const candidate = await candidateRepository.getById(request.params.candidateId);
    response.json(candidate);
  } catch (error) {
    next(error);
  }
});

app.post("/api/job-offers/normalize", async (request, response, next) => {
  try {
    const jobOfferRaw = requireField(request.body, "jobOfferRaw");
    const normalized = await workflowService.normalizeJobOffer(jobOfferRaw);
    response.json(normalized);
  } catch (error) {
    next(error);
  }
});

app.post("/api/agents/candidate/run", async (request, response, next) => {
  try {
    const payload = request.body as CandidateAgentInput;
    requireField(payload, "jobOffer");
    requireField(payload, "candidateMasterProfile");
    const result = await agentsService.runCandidateAgent(payload);
    response.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/agents/ats/run", async (request, response, next) => {
  try {
    const payload = request.body as AtsAgentInput;
    requireField(payload, "jobOffer");
    requireField(payload, "generatedCv");
    const result = await agentsService.runAtsAgent(payload);
    response.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/agents/recruiter/run", async (request, response, next) => {
  try {
    const payload = request.body as RecruiterAgentInput;
    requireField(payload, "jobOffer");
    requireField(payload, "generatedCv");
    const result = await agentsService.runRecruiterAgent(payload);
    response.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/workflows/run", async (request, response, next) => {
  try {
    const payload = request.body as WorkflowRunInput;
    requireField(payload, "jobOfferRaw");
    const result = await workflowService.run(payload);
    response.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/addon/run", async (request, response, next) => {
  try {
    const payload = request.body as WorkflowRunInput;
    requireField(payload, "jobOfferRaw");
    const result = await workflowService.run(payload);
    response.json(result.addon_result);
  } catch (error) {
    next(error);
  }
});

app.use(
  (error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    const message = error instanceof Error ? error.message : "Unknown error";
    const statusCode = /required|not found/i.test(message) ? 400 : 500;
    response.status(statusCode).json({
      error: message
    });
  }
);

app.listen(config.port, () => {
  console.log(`Dreamjob backend listening on http://localhost:${config.port}`);
  console.log("Agent mode: openai");
});

function requireField<T extends object, K extends keyof T>(
  payload: T,
  field: K
): T[K] {
  const value = payload[field];
  if (value === undefined || value === null) {
    throw new Error(`${String(field)} is required`);
  }
  return value;
}
