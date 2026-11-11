# Security Specification for TaskOwl

## Data Invariants
1. A user can only read, create, update, or delete their own tasks, preferences, logs, and notifications.
2. The `userId` in the path must match the authenticated user's UID.
3. Timestamps like `createdAt` and `triggeredAt` must be set to `request.time` during creation.
4. IDs must be alphanumeric with hyphens or underscores and limited in length.

## The "Dirty Dozen" Payloads
1. **Identity Theft**: Creating a task in another user's collection.
2. **Field Injection**: Adding an `isAdmin: true` field to a task.
3. **Type Poisoning**: Sending a number for the `title` field.
4. **ID Poisoning**: Using a 2KB string as a `taskId`.
5. **State Shortcut**: Manually setting `escalated: true` without hitting thresholds.
6. **Timestamp Spoofing**: Manually setting `createdAt` to a past or future date.
7. **Orphaned Write**: Creating a log entry for a non-existent task.
8. **PII Leak**: Reading another user's `preferences` document.
9. **Volumetric Attack**: Sending a 1MB string in the `description` field.
10. **Array Overflow**: Adding 1000 tags to a task.
11. **Enum Bypass**: Setting `lane` to "archived" (not in allowed list).
12. **Malicious Update**: Modifying `createdAt` on an existing task.

## Test Runner (Simplified for Rules Generation)
All payloads above must return `PERMISSION_DENIED`.
