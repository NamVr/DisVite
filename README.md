# discord-invite-tracker

> An advanced Discord invite tracking module with native Mongoose support for Discord.js bots.

[![npm version](https://img.shields.io/npm/v/discord-invite-tracker.svg)](https://npmjs.com/package/discord-invite-tracker)
[![license](https://img.shields.io/npm/l/discord-invite-tracker.svg)](LICENSE)

---

## Features

-   **Tracks all invite joins:** Normal, vanity, and unknown joins
-   **Persistent storage:** MongoDB/Mongoose integration
-   **Customizable:** Model name, verbose logging, and extensible via subclassing
-   **TypeScript & JSDoc support:** Full typings and easy integration in JS or TS bots
-   **Event-driven:** Emits events for joins, leaves, and errors

---

## Table of Contents

-   [Installation](#installation)
-   [Requirements](#requirements)
-   [Quick Start](#quick-start)
-   [Options](#options)
-   [Events](#events)
-   [Types & JSDoc Usage](#types--jsdoc-usage)
-   [API Reference](#api-reference)
-   [Extending the Module](#extending-the-module)
-   [Troubleshooting & FAQ](#troubleshooting--faq)
-   [Contributing](#contributing)
-   [License](#license)

---

## Installation

```sh
npm install discord-invite-tracker
```

---

## Requirements

-   [discord.js](https://discord.js.org/) v14+
-   [mongoose](https://mongoosejs.com/) v8+
-   Node.js v18+

---

## Quick Start

### TypeScript Example

```typescript
import { Client, GatewayIntentBits } from "discord.js";
import { InviteTracker } from "discord-invite-tracker";

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildInvites,
	],
});

const tracker = new InviteTracker(client, "mongodb://localhost:27017/mydb", {
	modelName: "customInviteModel", // optional
	verbose: true, // optional
});

tracker.on("inviteJoin", (member, info) => {
	console.log(`${member.user.tag} joined via:`, info);
});

tracker.on("inviteLeave", (member, record) => {
	console.log(`${member.user.tag} left. Record:`, record);
});

client.login("YOUR_BOT_TOKEN");
```

### JavaScript Example with JSDoc

```javascript
const { Client, GatewayIntentBits } = require("discord.js");
const { InviteTracker } = require("discord-invite-tracker");

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildInvites,
	],
});

const tracker = new InviteTracker(client, "mongodb://localhost:27017/mydb", {
	verbose: true,
});

/**
 * @param {import('discord.js').GuildMember} member
 * @param {import('discord-invite-tracker').InviteTrackerTypes.InviteInfo} info
 */
tracker.on("inviteJoin", (member, info) => {
	console.log(`${member.user.tag} joined via:`, info);
});

client.login("YOUR_BOT_TOKEN");
```

---

## Options

| Option    | Type    | Default        | Description                           |
| --------- | ------- | -------------- | ------------------------------------- |
| modelName | string  | "inviteSchema" | MongoDB model name for invite records |
| verbose   | boolean | false          | Enable verbose logging                |

Pass these as the third argument to the `InviteTracker` constructor.

---

## Events

| Event       | Arguments        | Description                                  |
| ----------- | ---------------- | -------------------------------------------- |
| inviteJoin  | (member, info)   | Emitted when a member joins (see InviteInfo) |
| inviteLeave | (member, record) | Emitted when a member leaves                 |
| error       | (error)          | Emitted on non-critical or critical errors   |

---

## Types & JSDoc Usage

### TypeScript

All types are exported as a namespace:

```typescript
import { InviteTrackerTypes } from "discord-invite-tracker";

// Example:
const info: InviteTrackerTypes.InviteInfo = { ... };
```

### JavaScript (JSDoc)

Reference types for IntelliSense:

```javascript
/**
 * @param {import('discord-invite-tracker').InviteTrackerTypes.InviteInfo} info
 */
function handleInvite(info) { ... }
```

Or define a global typedef:

```javascript
/**
 * @typedef {import('discord-invite-tracker').InviteTrackerTypes.InviteInfo} InviteInfo
 */
```

---

## API Reference

### `InviteTracker(client, mongoURI, options?)`

-   `client`: Discord.js Client instance
-   `mongoURI`: MongoDB connection string
-   `options`: See [Options](#options)

### `InviteInfo` object

| Field      | Type                              | Description                          |
| ---------- | --------------------------------- | ------------------------------------ |
| guildId    | string                            | Guild/server ID                      |
| inviteeId  | string                            | User who joined                      |
| inviterId  | string \| null                    | User who created the invite          |
| inviteCode | string \| null                    | Invite code used                     |
| joinType   | "normal" \| "vanity" \| "unknown" | Type of join                         |
| fake       | boolean                           | Whether the join is detected as fake |
| joinedAt   | Date                              | When the user joined                 |

---

## Extending the Module

You can extend `InviteTracker` and override protected methods for custom logic.

```typescript
class MyTracker extends InviteTracker {
	protected async detectFakeInvite(member) {
		// Custom logic
		return false;
	}
}
```

---

## Troubleshooting & FAQ

**Q: My bot isn't tracking invites correctly!**  
A: Ensure your bot has the `GUILD_MEMBERS` and `GUILD_INVITES` intents enabled and the correct permissions.

**Q: How do I use the types in JavaScript?**  
A: Use JSDoc with `import('discord-invite-tracker').InviteTrackerTypes.InviteInfo`.

**Q: How do I change the MongoDB model name?**  
A: Pass `modelName: "yourModelName"` in the options object.

**Q: How do I disable verbose logging?**  
A: Pass `verbose: false` in the options object.

---

## Contributing

Pull requests and issues are welcome!  
Please open an issue for bugs, feature requests, or questions.

---

## License

ISC

---

## Changelog

See [Releases](https://github.com/NamVr/discord-invite-tracker/releases) for version history.

---

**Enjoy using `discord-invite-tracker`!**
