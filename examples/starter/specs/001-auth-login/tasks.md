# Tasks: Login with e-mail and password

**Input**: Design documents from `/specs/001-auth-login/`

## Phase 1: User Story 1 - Log in (Priority: P1) 🎯 MVP

- [ ] T001 [P] [US1] Contract test for POST /login in tests/contract/test_login.py
- [ ] T002 [US1] Implement the login handler in src/auth/login.py

## Phase 2: User Story 2 - Lock out brute force (Priority: P2)

- [ ] T003 [P] [US2] Integration test for lockout in tests/integration/test_lockout.py
- [ ] T004 [US2] Implement the failure counter in src/auth/lockout.py
