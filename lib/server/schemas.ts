import { z } from 'zod';

const nstr = (max: number) => z.string().max(max).nullish();

export const connectorMetaSchema = z
  .object({
    human: nstr(300),
    agent_name: nstr(200),
    agent_role: nstr(200),
    host: nstr(300),
    cwd: nstr(2000),
    git_branch: nstr(300),
    redacted: z.boolean().optional(),
    connector_version: z.string().max(32).default('1'),
    sent_at: z.string().max(64).default(() => new Date().toISOString()),
  })
  .passthrough();

export const hookSchema = z
  .object({
    session_id: z.string().min(1).max(200),
    hook_event_name: z.string().min(1).max(64),
  })
  .passthrough();

export const ingestSchema = z.object({
  hook: hookSchema,
  meta: connectorMetaSchema.default({ connector_version: '1', sent_at: new Date().toISOString() }),
});

export const createRequestSchema = z.object({
  session_id: z.string().min(1).max(200).nullish(),
  prompt: z.string().min(1).max(4000),
  kind: z.enum(['question', 'action', 'approval']).optional(),
  options: z.array(z.string().min(1).max(200)).max(10).optional(),
  context: z.string().max(8000).nullish(),
  expires_in_sec: z.number().int().min(60).max(604800).optional(),
  asked_by: z.string().max(200).nullish(),
  meta: connectorMetaSchema.default({ connector_version: '1', sent_at: new Date().toISOString() }),
});

export const answerSchema = z.object({ answer: z.string().trim().min(1).max(8000) });
export const dismissSchema = z.object({ reason: z.string().max(2000).nullish() });

const repo = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, 'must be owner/repo');

export const createProjectSchema = z.object({
  team_id: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  description: z.string().max(2000).nullish(),
  repo_full_name: repo.nullish().or(z.literal('').transform(() => null)),
});

export const updateProjectSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().max(2000).nullish(),
  repo_full_name: repo.nullish().or(z.literal('').transform(() => null)),
});

export const createTokenSchema = z.object({ label: z.string().trim().max(80).nullish() });
export const joinTeamSchema = z.object({ code: z.string().trim().min(1).max(100) });
export const updateTeamSchema = z.object({ name: z.string().trim().min(1).max(80) });
