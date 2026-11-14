# Security Specification for TaskOwl Shared Workspaces

## Data Invariants
1. A workspace can only be read or listed by its `ownerId` or an authenticated, email-verified user whose lowercase email is in `memberEmails`.
2. Only the workspace `ownerId` may rename the workspace, add/remove `memberEmails`, or delete the workspace. The `ownerEmail` must always remain in `memberEmails`.
3. Every workspace subcollection (`/members`, `/tasks`, `/preferences`, `/logs`, `/notifications`) enforces the Master Gate via `get(/databases/.../workspaces/$(workspaceId))` so revoked members lose access immediately.
4. All document IDs must match `^[a-zA-Z0-9_\-]+$` and be at most 128 characters.
5. Immutable fields (`id`, `ownerId`, `ownerEmail`, `createdAt`, `addedBy`, `addedAt`) cannot be modified after creation.
6. Every string and array enforces explicit `.size()` bounds and strict `keys().hasOnly(...)` schema allowlists.
7. Legacy `/users/{userId}/...` paths remain strictly isolated to `request.auth.uid == userId` for migration.

## The "Dirty Dozen" Payloads
1. **Identity Theft**: Creating a workspace with `ownerId` set to another user's UID.
2. **Email Spoofing**: Listing or joining a workspace when `email_verified` is `false`.
3. **Ghost Field Injection**: Adding `isAdmin: true` to a task or workspace member document.
4. **Privilege Escalation**: A non-owner workspace member updating `memberEmails` on `/workspaces/{workspaceId}` or changing `workspaceRole` to `owner`.
5. **Owner Lockout**: Updating a workspace to remove `ownerEmail` from `memberEmails`.
6. **ID Poisoning**: Creating a task or member with a 1KB path ID containing `/` or spaces.
7. **Volumetric Attack**: Sending a 10KB `title` or 1MB `description` on a task.
8. **Array Overflow**: Adding > 50 tags to a task or > 50 members to `memberEmails`.
9. **Type Poisoning**: Sending a boolean or number for `task.title` or `member.email`.
10. **Cross-Workspace Leakage**: Reading `/workspaces/{otherWsId}/tasks/{taskId}` as an uninvited user.
11. **Enum Bypass**: Setting `task.lane` to `"archived"` or `member.workspaceRole` to `"superadmin"`.
12. **Immutable Mutation**: Changing `createdAt` or `ownerId` on an existing workspace or task.

## Test Runner Assertions
All 12 payloads above must resolve to `PERMISSION_DENIED`.
