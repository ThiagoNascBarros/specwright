import * as z from 'zod';
import { SPEC_ID_PATTERN } from './types.js';

/** Validated before any disk access (TRD §12): no slashes, dots or uppercase can reach a path. */
export const specIdSchema = z.string().regex(SPEC_ID_PATTERN, 'spec_id must match ^[a-z0-9][a-z0-9-]*$');

export const criterionIdSchema = z.string().regex(/^AC-\d+$/, 'ac_id must look like AC-3');
