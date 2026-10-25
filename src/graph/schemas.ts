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

export const extractionBatchInput = z.object({
  units: z.array(refSchema).min(1).max(30).optional(),
  feature: featureIdSchema.optional(),
  budget_tokens: z.number().int().min(500).max(8000).optional(),
  limit: z.number().int().min(1).max(200).optional(),
});

// Bounds (sizes, lengths, 0..1 score) are checked in runSaveRelations and prepareSave: the listing entry must stay under 1,200 characters.
export const saveRelationsInput = z.object({
  relations: z.array(z.object({
    source: z.string(),
    relation: z.string(),
    target: z.string(),
    confidence: z.enum(['INFERRED', 'AMBIGUOUS', 'REJECTED']),
    score: z.number(),
    evidence: z.string().optional(),
  })).optional(),
  concepts: z.array(z.object({ id: z.string(), label: z.string(), summary: z.string().optional() })).optional(),
  covered: z.array(z.object({ unit: z.string(), hash: z.string() })).optional(),
});

export const graphReportInput = z.object({
  top: z.number().int().min(1).max(50).optional(),
  community: z.number().int().min(0).optional(),
  offset: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

export const lintMemoryInput = z.object({
  feature: featureIdSchema.optional(),
  limit: z.number().int().min(1).max(1000).optional(),
});

export const exportGraphInput = z.object({
  format: z.enum(['json', 'report', 'obsidian']),
});
