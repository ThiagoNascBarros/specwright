---
id: auth-login
title: Login with e-mail and password
status: in-progress
---

## Context
Users need to authenticate to reach the logged-in area. The login handler lives in `src/auth/login.ts`.

## Acceptance criteria
- [ ] AC-1: Valid e-mail and password return a session
- [ ] AC-2: After 5 failed attempts the account is locked for 15 minutes
- [ ] AC-3: Login errors never reveal whether the e-mail exists

## Out of scope
- Social login
- Password recovery
