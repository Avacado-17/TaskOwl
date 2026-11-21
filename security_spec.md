# Security Specification for TaskOwl Shared Workspaces

## Data Invariants
1. A private workspace can only be read or listed by its `ownerId` or an authenticated, email-verified user whose lowercase email is in `memberEmails`. Public link-shared workspaces (`shareEnabled == true` with a valid `shareToken`) allow direct `get` and collaborative task access via the unguessable share token lookup (`/workspaceShares/{shareToken}`) while keeping `allow list` on `/workspaces` and `/workspaceShares` strictly restricted/disabled.
2. Only the workspace `ownerId` may rename the workspace, toggle/regenerate `shareEnabled`/`shareToken`, add/remove `memberEmails`, or delete the workspace. The `ownerEmail` must always remain in `memberEmails`.
3. Every workspace subcollection (`/members`, `/tasks`, `/preferences`, `/logs`, `/notifications`) enforces the Master Gate via `get(/databases/.../workspaces/$(workspaceId))` so revoked members or disabled share links lose access immediately.
4. All document IDs must match `^[a-zA-Z0-9_\-]+$` and be at most 128 characters.
5. Immutable fields (`id`, `ownerId`, `ownerEmail`, `createdAt`, `addedBy`, `addedAt`) cannot be modified after creation.
6. Every string and array enforces explicit `.size()` bounds and strict `keys().hasOnly(...)` schema allowlists.
7. Legacy `/users/{userId}/...` and `/users/{userId}/savedShares/{workspaceId}` paths remain strictly isolated to `request.auth.uid == userId`.
8. Workspace automation preferences (`/preferences/automation`, containing `recipientEmail`) remain strictly restricted to verified workspace members (`isWorkspaceMember`).

## The "Dirty Dozen" Payloads
1. **Identity Theft**: Creating a workspace or `/workspaceShares` doc with `ownerId` set to another user's UID.
2. **Email Spoofing**: Listing or joining a workspace when `email_verified` is `false`.
3. **Ghost Field Injection**: Adding `isAdmin: true` to a task, workspace share, or workspace member document.
4. **Privilege Escalation**: A non-owner workspace member or link visitor updating `memberEmails`, `shareEnabled`, or `shareToken` on `/workspaces/{workspaceId}` or changing `workspaceRole` to `owner`.
5. **Owner Lockout**: Updating a workspace to remove `ownerEmail` from `memberEmails`.
6. **ID Poisoning**: Creating a task, share token, or member with a 1KB path ID containing `/` or spaces.
7. **Volumetric Attack**: Sending a 10KB `title` or 1MB `description` on a task.
8. **Array Overflow**: Adding > 50 tags to a task or > 50 members to `memberEmails`.
9. **Type Poisoning**: Sending a boolean or number for `task.title`, `shareToken`, or `member.email`.
10. **Cross-Workspace Leakage**: Reading `/workspaces/{otherWsId}/tasks/{taskId}` when `shareEnabled` is not `true` for an uninvited user, or listing `/workspaceShares`.
11. **Enum Bypass**: Setting `task.lane` to `"archived"` or `member.workspaceRole` to `"superadmin"`.
12. **Immutable Mutation**: Changing `createdAt`, `token`, or `ownerId` on an existing workspace, share link, or task.

## Test Runner Assertions
All 12 payloads above must resolve to `PERMISSION_DENIED`.
