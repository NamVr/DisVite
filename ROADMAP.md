# DisVite Invite Tracking Roadmap

This roadmap establishes the technical strategy and development phases to turn `disvite` into a highly resilient, production-ready invite-tracking library tailored for high-scale discord bots (such as Nyaru v5).

---

## Phase 1: Core Cache Manager

Build a high-performance cache manager that acts as the source of truth for guild invites, supporting both standalone in-memory structures and multi-process/sharded Redis backends.

```
                  ┌───────────────────────────────┐
                  │          CacheStore           │
                  └───────────────┬───────────────┘
                                  │ (Abstract)
                  ┌───────────────┴───────────────┐
                  │                               │
        ┌─────────▼─────────┐           ┌─────────▼─────────┐
        │ InMemoryCacheStore│           │  RedisCacheStore  │
        └───────────────────┘           └───────────────────┘
```

### Potential Bottlenecks
* **Memory Exhaustion on Large Bots**: Storing full invite objects for thousands of guilds leads to high memory utilization. Cache store entries must be minimized (mapping only `code` to `uses`).
* **Gateway Startup Block (REST Rate Limits)**: Initiating full invite fetches for all guilds on startup will trigger immediate rate-limiting. A throttled queue system is necessary.

### Implementation Checklist
- [ ] **Define the `CacheStore` Interface**: Define a standardized interface containing `get(guildId)`, `set(guildId, code, uses)`, `delete(guildId)`, and `clear(guildId)`.
- [ ] **Implement `InMemoryCacheStore`**: The default fallback storage using a structured JS `Map`.
- [ ] **Implement `RedisCacheStore` (Optional Dependency)**: A redis-backed cache layer allowing shared state across multi-process clusters.
- [ ] **Gateway Throttler for Initial Fetching**: Implement a concurrency-controlled queue (e.g., using `p-limit` or a simple chunked batch worker) to fetch server invites upon startup without hitting rate limits (limiting to ~3 concurrent fetches).
- [ ] **Add `guildCreate` and `guildDelete` Listeners**:
  * On `guildCreate`: Populate cache dynamically for the new guild.
  * On `guildDelete`: Evict cache records to prevent memory leaks.

---

## Phase 2: Event Reconciliation Sync

Implement tracking synchronization using a strict queue mechanism to avoid race conditions when diffing invite use counters upon user joins.

### Potential Bottlenecks
* **Join Storm Race Conditions**: When multiple users join a server at the same time, concurrent REST requests to fetch current guild invites will resolve before the cache is updated, leading to duplicate calculations and inaccurate inviter detection.
* **Redundant Rest Fetching**: Fetching the entire guild invite list on every single join event causes unnecessary API load.

### Implementation Checklist
- [ ] **Implement a Guild-Specific Promise Queue**:
  * Serialize the reconciliation processing for each guild.
  * Ensure that if User A and User B join the same guild concurrently, the check for User B waits until User A's reconciliation and cache updates are completely resolved.
- [ ] **Build the Diffing Engine**:
  * Create a utility to diff the freshly fetched guild invites against the `CacheStore` data.
  * Correctly identify the matching invite code and increment the local cache counter.
- [ ] **Streamline `inviteCreate` and `inviteDelete` Hooks**:
  * Ensure that when `inviteCreate` triggers, the invite is injected into the cache directly instead of forcing a full fetch of all guild invites.
  * Remove deleted invites from the cache immediately upon `inviteDelete`.

---

## Phase 3: Special Cases & Resiliency

Implement guards for permission errors, vanity URL changes, and state mismatch issues.

### Potential Bottlenecks
* **Missing Guild Permissions**: Large bots are frequently stripped of permissions. Attempting to fetch invites without permissions throws a REST API exception that crashes execution.
* **Vanity URL Rate Limits**: Vanity URLs are resolved by querying the vanity endpoint, which is highly restricted. Queries must be cached and throttled aggressively.

### Implementation Checklist
- [ ] **Permission Pre-Validation**:
  * Before calling `guild.invites.fetch()`, verify that the bot has `ManageGuild` permission.
  * If permissions are missing, fallback immediately to an `Unknown` join type and emit a warning event.
- [ ] **Robust Vanity URL Handling**:
  * Wrap all `guild.fetchVanityData()` calls in `try...catch` blocks to prevent crashes on permissions errors.
  * Consolidate the vanity fetches in `inviteJoin` to a single REST call to avoid rate limits.
- [ ] **Re-Sync Logic on Gateway Reconnections**:
  * Listen for client `shardReconnecting` and `shardResume` events to schedule background synchronization of invites that might have changed while the bot was offline.

---

## Phase 4: Developer Experience & Packaging

Expose safe, type-safe API hooks, clear up dependencies, and optimize compilation to support hybrid module targeting (ESM and CJS).

### Potential Bottlenecks
* **Type Collisions**: Mismatched versions of `discord.js` between the library and the parent application.
* **Mongoose Overwrite Errors**: Schema compilation crashes if imported multiple times.

### Implementation Checklist
- [ ] **Peer Dependency Refactoring**:
  * Move `discord.js` and `mongoose` to `peerDependencies` in `package.json` so the host application governs their versions.
- [ ] **Safe Schema Compiles**:
  * Update `inviteSchema.ts` to check `mongoose.models[modelName]` prior to schema compilation, preventing Mongoose from throwing duplicate registration errors.
- [ ] **Strict Event Emitter Interfaces**:
  * Implement strong typing for class events using generic TypeScript EventEmitters:
    ```typescript
    export interface InviteTrackerEvents {
        inviteJoin: [member: GuildMember, invite: InviteInfo];
        inviteLeave: [member: GuildMember, invite: InviteSchema];
        error: [error: Error];
        debug: [message: string];
    }
    ```
- [ ] **Hybrid Outputs Config (ESM/CJS)**:
  * Replace the raw `tsc` script with a modern bundler like `tsup` or `microbundle` to package both `.js` (ESM) and `.cjs` (CommonJS) files alongside source maps and type definitions.
- [ ] **Remove Fire-and-Forget Construction**:
  * Introduce an explicit async initialization flow (e.g. `await tracker.connect()`) or handle constructor exceptions by piping database connection errors directly to `tracker.emit('error', err)`.
