import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseSpecification } from '../../src/features/spec-parser.js';

const raw = readFileSync(new URL('../fixtures/speckit/specs/001-photo-albums/spec.md', import.meta.url), 'utf8');

describe('FR-003: spec.md parser', () => {
  const spec = parseSpecification(raw);

  it('FR-003: reads the title and the metadata lines', () => {
    expect(spec).toMatchObject({
      title: 'Photo albums',
      branch: '001-photo-albums',
      created: '2026-10-01',
      status: 'Draft',
      input: 'User description: "Build a photo organizer with albums grouped by date."',
    });
  });

  it('FR-003: reads user stories with number, title, priority and scenarios', () => {
    expect(spec.userStories).toEqual([
      {
        number: 1,
        title: 'Upload photos',
        priority: 'P1',
        scenarios: [
          'Given an empty library, When the user uploads a photo, Then it appears in the "Unsorted" album',
          'Given a photo larger than the limit, When the user uploads it, Then an error explains the limit',
        ],
      },
      {
        number: 2,
        title: 'Organize albums by date',
        priority: 'P2',
        scenarios: ['Given photos from March and April, When the library is opened, Then two albums are shown, newest first'],
      },
    ]);
  });

  it('FR-003: reads FR and SC items, ignoring those inside comments', () => {
    expect(spec.requirements.map((r) => r.id)).toEqual(['FR-001', 'FR-002', 'FR-003', 'FR-004', 'FR-005']);
    expect(spec.requirements[0]).toEqual({ id: 'FR-001', text: 'System MUST accept JPEG and PNG uploads' });
    expect(spec.successCriteria.map((r) => r.id)).toEqual(['SC-001', 'SC-002']);
  });

  it('FR-003: reads edge cases, assumptions and open clarifications (not the commented one)', () => {
    expect(spec.edgeCases).toEqual(['What happens when a photo has no date metadata?', 'How does the system handle duplicate uploads?']);
    expect(spec.assumptions).toHaveLength(2);
    expect(spec.clarifications).toEqual(['size limit not specified']);
  });

  it('FR-003: exposes ## sections without the template comments', () => {
    const keys = spec.sections.map((s) => s.key);
    expect(keys).toContain('requirements-mandatory');
    expect(spec.sections.find((s) => s.key.startsWith('user-scenarios'))!.content).not.toContain('IMPORTANT');
  });

  it('FR-003: LF, CRLF and a BOM give the same result', () => {
    expect(parseSpecification('﻿' + raw.replace(/\n/g, '\r\n'))).toEqual(spec);
  });

  it('FR-003: a scenario inside a code fence is not read', () => {
    const s = parseSpecification('# Feature Specification: X\n\n### User Story 1 - A (Priority: P1)\n\n```\n1. **Given** a, **When** b, **Then** c\n```\n');
    expect(s.userStories[0].scenarios).toEqual([]);
  });

  it('FR-003: a marker quoted in inline code is not an open clarification', () => {
    const s = parseSpecification('# Feature Specification: X\n\n- **FR-001**: read the `[NEEDS CLARIFICATION: …]` markers\n- **FR-002**: [NEEDS CLARIFICATION: real one]\n');
    expect(s.clarifications).toEqual(['real one']);
  });

  it('returns an empty title when the heading is missing', () => {
    expect(parseSpecification('## Requirements\n').title).toBe('');
  });
});
