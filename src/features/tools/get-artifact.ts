import * as z from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { Config } from '../../config.js';
import { readConstitution } from '../../constitution/repository.js';
import { SpecwrightError, tool } from '../../errors.js';
import { parseDocument, stripComments } from '../../storage/markdown.js';
import { readArtifact } from '../repository.js';
import { artifactFileSchema, artifactSchema, featureIdSchema } from '../schemas.js';
import { findSection } from '../sections.js';
import type { ReadableArtifact } from '../types.js';

interface Args {
  artifact: ReadableArtifact;
  feature?: string;
  name?: string;
  section?: string;
}

/** Body without frontmatter and HTML comments, optionally cut to one `##` section. */
function cut(raw: string, section: string | undefined, where: string): { content: string; section?: string } {
  const doc = parseDocument(stripComments(raw.replace(/^﻿/, '').replace(/\r\n?/g, '\n')));
  if (section === undefined) return { content: doc.body.trim() };
  const found = findSection(doc.sections, section);
  if (!found) {
    throw new SpecwrightError('SECTION_NOT_FOUND', `Section "${section}" not found in ${where}.`, `Available sections: ${doc.sections.map((s) => s.key).join(', ') || '(none)'}.`);
  }
  return { content: found.content, section: found.key };
}

export function registerGetArtifact(server: McpServer, config: Config) {
  server.registerTool(
    'get_artifact',
    {
      description:
        'Return one Spec Kit artifact (spec, plan, tasks, research, data-model, quickstart, a named checklist or contract, or the constitution), or just one of its ## sections. Use it to read exactly what you need instead of whole files.',
      inputSchema: z.object({
        artifact: artifactSchema,
        feature: featureIdSchema.optional(),
        name: artifactFileSchema.optional(),
        section: z.string().min(1).optional(),
      }),
      annotations: { openWorldHint: false, readOnlyHint: true },
    },
    tool(config.maxResponseChars, async ({ artifact, feature, name, section }: Args) => {
      if (artifact === 'constitution') {
        const constitution = await readConstitution(config.root);
        if (!constitution) {
          throw new SpecwrightError('ARTIFACT_NOT_FOUND', 'The project has no .specify/memory/constitution.md.', 'Create it with /speckit-constitution.');
        }
        return { artifact, ...cut(constitution.content, section, 'the constitution') };
      }
      if (!feature) throw new SpecwrightError('INVALID_INPUT', `"feature" is required for the ${artifact} artifact.`);
      const { raw } = await readArtifact(config.root, feature, artifact, name);
      return { artifact, feature, ...(name ? { name } : {}), ...cut(raw, section, `${feature}/${artifact}`) };
    }),
  );
}
