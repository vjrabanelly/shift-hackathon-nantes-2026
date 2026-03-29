import type { FastifyInstance } from "fastify";
import { readJSON, writeJSON } from "../services/store.js";
import { PROFILE_PATH } from "../services/paths.js";
import { ProfileSchema, type Profile } from "../schemas/profile.js";

export async function profileRoutes(app: FastifyInstance) {
  app.get("/api/profile", async (_request, reply) => {
    const profile = await readJSON<Profile>(PROFILE_PATH);
    if (!profile) {
      return reply.code(404).send({ error: "No profile found" });
    }
    return reply.send(profile);
  });

  app.put<{ Body: Profile }>("/api/profile", {
    schema: {
      body: ProfileSchema,
    },
  }, async (request, reply) => {
    const body = request.body;
    const profile: Profile = {
      ...body,
      updatedAt: new Date().toISOString(),
    };
    await writeJSON(PROFILE_PATH, profile);
    return reply.code(200).send(profile);
  });
}
