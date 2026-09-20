# DisVite

> The ultimate, high-performance Discord invite tracking and analytics engine for Discord.js v14 bots.

[![npm version](https://img.shields.io/npm/v/disvite.svg)](https://npmjs.com/package/disvite)
[![license](https://img.shields.io/npm/l/disvite.svg)](LICENSE)

---

## Why DisVite?

Most Discord invite trackers suffer from fatal production flaws: they crash on missing permissions, fail under high-traffic join storms, pollute stdout with unformatted console logs, duplicate Mongoose connection pools, and misattribute concurrent joins as "unknown".

**DisVite v2.0 is engineered from the ground up to be the most resilient, optimized, and developer-friendly invite tracking module in the Discord ecosystem.**

### Key Highlights

- ⚡ **Zero-Database by Default**: Works right out of the box with high-speed in-memory storage. No MongoDB or external service required unless you want it!
- 🛡️ **Join Storm & Rate-Limit Shield**: Built-in per-guild async task queue serializes join calculations, preventing Discord `429 Too Many Requests` API errors.
- 🎯 **Delta-Credit Smoothing Engine**: World's first tracker to accurately attribute multiple concurrent joins using the same invite code during viral surges without collapsing to "unknown".
- 🤖 **OAuth2 Bot Join Detection**: Distinguishes bot additions (`JoinType.Bot`) from human user invites without wasting Discord API requests.
- 🔄 **O(1) Instant Delta Caching**: Synchronizes invite creation and deletion events in-place without triggering heavy full-server REST round-trips.
- 🍃 **Shared Mongoose Support**: Seamlessly attach existing Mongoose connections with optimized compound indexes and single-roundtrip aggregation pipelines.
- 📊 **Complete Analytics & Leaderboards**: Track `total`, `valid`, `left`, `fake`, and `bonus` invites with built-in guild leaderboard generation.
- 🔇 **Zero Console Pollution**: 100% event-driven telemetry (`debug`, `warn`, `error`). Never pollutes your stdout or structured loggers.
- 🔒 **Permission & Gateway Intent Guards**: Validates `ManageGuild` and gateway intents ahead of time, preventing silent failures and unhandled API crashes.

---

## Installation

```sh
npm install disvite
```

### Peer Dependencies
- [discord.js](https://discord.js.org/) `^14.0.0`
- [mongoose](https://mongoosejs.com/) `>=8.0.0` *(optional, only if using MongoDB persistence)*

---

## Quick Start

### 1. In-Memory Mode (Zero Database Required)

```typescript
import { Client, GatewayIntentBits } from "discord.js";
import { InviteTracker, JoinType } from "disvite";

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers, // Privileged Intent
        GatewayIntentBits.GuildInvites,
    ],
});

// Works immediately with zero configuration!
const tracker = new InviteTracker(client);

tracker.on("inviteJoin", (member, info) => {
    if (info.joinType === JoinType.Bot) {
        console.log(`Bot ${member.user.tag} joined via OAuth2 authorization.`);
        return;
    }

    if (info.joinType === JoinType.Vanity) {
        console.log(`${member.user.tag} joined via server Vanity URL!`);
        return;
    }

    console.log(`${member.user.tag} was invited by <@${info.inviterId}> using code ${info.inviteCode}`);
    console.log(`Inviter Stats:`, info.inviterStats);
});

tracker.on("inviteLeave", (member, record) => {
    console.log(`${member.user.tag} left the server.`);
});

client.login("YOUR_BOT_TOKEN");
```

### 2. MongoDB / Mongoose Mode

#### Using MongoDB Connection URI
```typescript
const tracker = new InviteTracker(client, process.env.MONGODB_URI, {
    modelName: "invites",           // Custom collection name
    bonusModelName: "invite_bonus", // Custom bonus collection
});
```

#### Reusing Existing Mongoose Connection (Recommended for large bots)
```typescript
import mongoose from "mongoose";

const tracker = new InviteTracker(client, {
    storage: "mongoose",
    mongooseConnection: mongoose.connection, // Reuses host connection pool!
});
```

---

## Analytics & Leaderboards API

DisVite provides built-in methods for managing invites and server rankings:

### Fetch Member Invite Breakdown
```typescript
const stats = await tracker.getMemberStats(guildId, userId);
console.log(stats);
// Output:
// {
//   total: 15,  // All recorded joins
//   valid: 12,  // Net valid invites (total - left - fake + bonus)
//   left: 2,    // Members who left
//   fake: 1,    // Flagged as fake account / rapid rejoin
//   bonus: 0    // Bonus invite points
// }
```

### Manage Bonus Invites
```typescript
// Award 3 bonus invites
await tracker.addBonusInvites(guildId, userId, 3);

// Deduct 1 bonus invite
await tracker.addBonusInvites(guildId, userId, -1);

// Get current bonus
const bonus = await tracker.getBonusInvites(guildId, userId);
```

### Guild Leaderboard
```typescript
// Get top 10 inviters sorted by valid invites
const leaderboard = await tracker.getLeaderboard(guildId, 10);

for (const entry of leaderboard) {
    console.log(`<@${entry.userId}>: ${entry.stats.valid} valid invites`);
}
```

---

## Events Reference

DisVite emits strongly-typed events on the `InviteTracker` instance (and mirrors join/leave events to `client` for backward compatibility):

| Event | Payload | Description |
| :--- | :--- | :--- |
| `inviteJoin` | `(member: GuildMember, info: InviteInfo)` | Emitted when any member or bot joins a guild. |
| `inviteLeave` | `(member: GuildMember, record: InviteRecord \| null)` | Emitted when a member leaves a guild. |
| `inviteCreate` | `(invite: Invite)` | Emitted when a new invite is created (O(1) cached). |
| `inviteDelete` | `(invite: Invite)` | Emitted when an invite is deleted (O(1) removed). |
| `guildSync` | `(guildId: string, inviteCount: number)` | Emitted when a guild's invite cache completes sync. |
| `ready` | `()` | Emitted when all guilds have finished initial caching. |
| `warn` | `(message: string)` | Diagnostic warnings (e.g. missing intents or permissions). |
| `debug` | `(message: string)` | Verbose debugging messages (when `verbose: true`). |
| `error` | `(error: Error)` | Emitted on non-fatal operational errors. |

---

## Data Structures

### `InviteInfo`

```typescript
interface InviteInfo {
    guildId: string;
    inviteeId: string;
    inviterId?: string | null;
    inviteCode?: string | null;
    joinType: JoinType; // 'normal' | 'vanity' | 'bot' | 'unknown'
    fake: boolean;
    joinedAt: Date;
    inviterStats?: MemberInviteStats;
}
```

### `JoinType`

- `JoinType.Normal`: Joined using a standard member invite.
- `JoinType.Vanity`: Joined using the server's Discord Vanity URL.
- `JoinType.Bot`: Bot account invited via OAuth2 bot authorization.
- `JoinType.Unknown`: Single-use invite expired, permission restricted, or direct join.

---

## Configuration Options

```typescript
interface InviteTrackerOptions {
    /** Storage engine: 'memory', 'mongoose', or custom StorageAdapter. Default: 'memory' */
    storage?: "memory" | "mongoose" | StorageAdapter;
    /** MongoDB URI (legacy shorthand) */
    mongoURI?: string;
    /** Existing Mongoose connection object */
    mongooseConnection?: Connection;
    /** Model name for invite join logs (default: "inviteSchema") */
    modelName?: string;
    /** Model name for bonus points (default: "bonusInviteSchema") */
    bonusModelName?: string;
    /** Account age threshold in ms to flag as fake (default: 7 days) */
    fakeThresholdMs?: number;
    /** Rejoin duration in ms to flag as fake rejoin loop (default: 7 days) */
    rejoinThresholdMs?: number;
    /** Concurrency limit when caching guilds on startup (default: 3) */
    concurrency?: number;
    /** Emit events on client for backwards compatibility (default: true) */
    emitOnClient?: boolean;
    /** Track bot joins as JoinType.Bot (default: true) */
    trackBots?: boolean;
    /** Enable debug event emission (default: false) */
    verbose?: boolean;
}
```

---

## License

GPL-3.0 © [Naman Vrati](https://github.com/NamVr)
