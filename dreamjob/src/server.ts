import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { ensureDataDirs } from "./ensure-dirs.js";
import { profileRoutes } from "./routes/profile.js";
import { resumeRoutes } from "./routes/resume.js";
import { jobsRoutes } from "./routes/jobs.js";
import { cvsRoutes } from "./routes/cvs.js";
import { AiServiceUnavailableError } from "./errors.js";

const PORT = Number(process.env.PORT) || 3000;

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: (origin, cb) => {
    if (
      !origin ||
      origin === "http://localhost:5173" ||
      origin.startsWith("chrome-extension://")
    ) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});

await app.register(multipart, {
  limits: { fileSize: 10 * 1024 * 1024 },
});

await ensureDataDirs();

app.setErrorHandler((error, _request, reply) => {
  if (error instanceof AiServiceUnavailableError) {
    return reply.code(503).send({ error: error.message });
  }
  // Let Fastify handle validation errors and other errors
  reply.send(error);
});

await app.register(profileRoutes);
await app.register(resumeRoutes);
await app.register(jobsRoutes);
await app.register(cvsRoutes);

if (!process.env.OPENAI_API_KEY) {
  app.log.warn("OPENAI_API_KEY is not set. AI-powered endpoints (resume extraction, job normalization, CV generation) will return 503.");
}

const start = async () => {
  try {
    await app.listen({ port: PORT, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
