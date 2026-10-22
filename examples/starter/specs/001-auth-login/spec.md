# Feature Specification: Login with e-mail and password

**Feature Branch**: `001-auth-login`

**Created**: 2026-10-21

**Status**: Draft

**Input**: User description: "Users log in with e-mail and password, and the account locks after repeated failures."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Log in (Priority: P1)

A registered user enters an e-mail and password and reaches the logged-in area.

**Why this priority**: Nothing else in the product is reachable without it.

**Independent Test**: Log in with a seeded user and see the dashboard.

**Acceptance Scenarios**:

1. **Given** a registered user, **When** they submit the right e-mail and password, **Then** a session is created
2. **Given** any e-mail, **When** the login fails, **Then** the error never reveals whether the e-mail exists

---

### User Story 2 - Lock out brute force (Priority: P2)

Repeated failures lock the account for a while.

**Why this priority**: It protects accounts, but login works without it.

**Independent Test**: Fail 5 times and see the lockout message.

**Acceptance Scenarios**:

1. **Given** 5 failed attempts, **When** the user tries again, **Then** the account is locked for 15 minutes

---

### Edge Cases

- What happens when the e-mail has different letter case?
- How does the lockout behave across two browsers?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST create a session for valid credentials
- **FR-002**: System MUST lock an account for 15 minutes after 5 failed attempts
- **FR-003**: Login errors MUST NOT reveal whether the e-mail exists

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users log in in under 2 seconds
- **SC-002**: No login error message differs between known and unknown e-mails

## Assumptions

- Out of scope: social login and password recovery
