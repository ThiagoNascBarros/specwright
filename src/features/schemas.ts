import * as z from 'zod';
import { FEATURE_ID_PATTERN, READABLE_ARTIFACTS, STORY_PATTERN, TASK_ID_PATTERN } from './types.js';

/** Validated before any disk access (TRD §12): no slashes, dots or uppercase can reach a path. */
export const featureIdSchema = z.string().regex(FEATURE_ID_PATTERN, 'feature must look like 001-short-name');
export const taskIdSchema = z.string().regex(TASK_ID_PATTERN, 'task_id must look like T012');
export const storySchema = z.string().regex(STORY_PATTERN, 'story must look like US1');
export const artifactSchema = z.enum(READABLE_ARTIFACTS);
/** Checklist or contract file name, with or without its extension. */
export const artifactFileSchema = z.string().regex(/^[a-z0-9][a-z0-9._-]*$/, 'name must be a file name like "ux" or "api.yaml"');
