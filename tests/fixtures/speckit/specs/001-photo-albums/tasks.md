---

description: "Task list for Photo albums"
---

# Tasks: Photo albums

**Input**: Design documents from `/specs/001-photo-albums/`

**Prerequisites**: plan.md (required), spec.md (required for user stories)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)

<!--
  IMPORTANT: The tasks below are generated.
  - [ ] T900 a task inside a comment must be ignored
-->

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create project structure per implementation plan
- [x] T002 Initialize Python project with FastAPI dependencies
- [ ] T003 [P] Configure linting and formatting tools

---

## Phase 2: Foundational (Blocking Prerequisites)

- [ ] T004 Setup SQLite schema and migrations framework in src/db/schema.py

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Upload photos (Priority: P1) 🎯 MVP

**Goal**: Users can upload photos

### Tests for User Story 1 (OPTIONAL - only if tests requested) ⚠️

- [ ] T005 [P] [US1] Contract test for upload in tests/contract/test_upload.py
- [ ] T006 [P] [US1] Integration test for upload journey in tests/integration/test_upload.py

### Implementation for User Story 1

- [ ] T007 [P] [US1] Create Photo model in src/models/photo.py
- [ ] T008 [US1] Implement UploadService in src/services/upload.py (depends on T007)

---

## Phase 4: User Story 2 - Organize albums by date (Priority: P2)

- [ ] T009 [P] [US2] Create Album model in src/models/album.py
- [ ] T010 [US2] Implement album grouping in src/services/albums.py

---

## Phase 5: Polish & Cross-Cutting Concerns

- [ ] T011 [P] Documentation updates in docs/
- [ ] TXXX Security hardening

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
- [ ] T999 [P] [US1] a task inside a code fence must be ignored
Task: "Contract test for upload in tests/contract/test_upload.py"
```

## Notes

- [P] tasks = different files, no dependencies
