import * as z from 'zod';
import { featureIdSchema } from '../features/schemas.js';
import { DERIVED_RELATIONS, SEMANTIC_RELATIONS } from './types.js';

const relationSchema = z.enum([...DERIVED_RELATIONS, ...SEMANTIC_RELATIONS]);
const refSchema = z.string().min(1).max(300);

export const queryGraphInput = z.object({
  question: z.string().min(1).max(500),
  feature: featureIdSchema.optional(),
  mode: z.enum(['bfs', 'dfs']).optional(),
  depth: z.number().int().min(1).max(4).optional(),
  budget_tokens: z.number().int().min(200).max(20000).optional(),
  include_ambiguous: z.boolean().optional(),
});

export const getNodeInput = z.object({
  ref: refSchema,
  feature: featureIdSchema.optional(),
  relation: relationSchema.optional(),
  limit: z.number().int().min(1).max(200).optional(),
});

export const findPathInput = z.object({
  from: refSchema,
  to: refSchema,
  feature: featureIdSchema.optional(),
  max_hops: z.number().int().min(1).max(8).optional(),
  include_ambiguous: z.boolean().optional(),
});
