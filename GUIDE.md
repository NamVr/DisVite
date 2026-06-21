# DisVite Discord Bot Integration Guide

This guide provides a quick and comprehensive walkthrough of how to integrate and use **DisVite** (`disvite`) in a real-world Discord.js bot. It is based on standard modular architectures (like the one in Nyaru5).

---

## 1. Prerequisites & Required Gateway Intents

For invite tracking to function, your Discord bot client **must** request the following gateway intents in its client options:

- `GatewayIntentBits.Guilds` (or legacy bitmask equivalent)
- `GatewayIntentBits.GuildMembers` (privileged intent, must be enabled in the Discord Developer Portal)
- `GatewayIntentBits.GuildInvites` (essential for tracking invite updates)

### Example Client Setup

```javascript
const { Client, GatewayIntentBits, Partials } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildInvites
    ]
});
```

---

## 2. Initialization in the Bot Core

Import the `InviteTracker` from the library, instantiate it, and bind it to your client. You will pass the Discord client instance, your MongoDB connection URI, and configuration options.

### Initialization Snippet (`bot.js`)

```javascript
const { InviteTracker } = require('disvite');

// Initialize the invite manager
client.inviteManager = new InviteTracker(client, process.env.MONGODB_URI, {
    verbose: false,      // Set to true to enable logs from the module
    modelName: 'invites' // The mongoose collection name for invite logs
});
```

---

## 3. Handling Invite Events

DisVite acts as an `EventEmitter` and emits custom events on the Discord `client` object rather than the tracker itself, making it seamlessly compatible with standard modular event handlers.

### Event 1: User Joins (`inviteJoin`)

When a user joins a server, DisVite determines how they joined and emits `inviteJoin` with the `GuildMember` and an `InviteInfo` object.

Here is a full example of an event handler (e.g. `events/discord/inviteJoin.js`) that handles the event, resolves vanity URL joins, fetches inviter statistics, parses custom welcome message templates, and posts a welcome message:

```javascript
const mongoose = require('mongoose');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'inviteJoin',

    /**
     * Executes when a user joins via an invite.
     * @param {import('discord.js').GuildMember} member The member who joined
     * @param {import('disvite').InviteInfo} info Invite metadata returned by DisVite
     */
    async execute(member, info) {
        const { client, guild } = member;
        
        // Define your server's tracking configuration (example placeholder)
        const config = client.guildConfig?.get(guild.id) || {
            inviteTracking: { enabled: true },
            inviteWelcome: { 
                guildEnable: true, 
                channel: 'WELCOME_CHANNEL_ID', 
                guildMessage: 'Welcome {{user}}! You joined using code **{invite.code}** invited by **{invite.inviter}** (uses: {invite.uses}).' 
            }
        };

        if (!config.inviteTracking?.enabled) return;
        if (!config.inviteWelcome || !config.inviteWelcome.guildEnable || !config.inviteWelcome.channel) return;

        const rawMessage = config.inviteWelcome.guildMessage;

        let inviterString = 'Unknown';
        let inviterTag = 'Unknown';
        let inviterUsername = 'Unknown';
        let inviterId = 'Unknown';
        let inviteUses = 0;

        // 1. Resolve based on the Join Type
        if (info.joinType === 'vanity') {
            inviterString = 'Vanity URL';
            inviterTag = 'Vanity URL';
            inviterUsername = 'Vanity URL';
            inviterId = 'Vanity URL';
        } else if (info.inviterId) {
            // Fetch the user object of the inviter
            const inviter = await client.users.fetch(info.inviterId).catch(() => null);
            if (inviter) {
                inviterString = `<@${inviter.id}>`;
                inviterTag = inviter.tag;
                inviterUsername = inviter.username;
                inviterId = inviter.id;

                // 2. Query MongoDB for active uses count using DisVite's model name
                try {
                    // Uses the same modelName passed during InviteTracker configuration
                    const inviteModel = mongoose.model('invites'); 
                    inviteUses = await inviteModel.countDocuments({
                        guildId: guild.id,
                        inviterId: inviter.id,
                        fake: false
                    });
                } catch (err) {
                    console.error('[ERR] :: inviteJoin uses count retrieval failed:', err);
                }
            }
        }

        const inviteCode = info.inviteCode || (info.joinType === 'vanity' ? (guild.vanityURLCode || 'Vanity') : 'Unknown');

        // 3. Process template placeholders
        const processedMessage = rawMessage
            .replace(/{{guild\.name}}|{{server\.name}}/gi, guild.name)
            .replace(/{{guild\.count}}|{{server\.count}}/gi, guild.memberCount.toString())
            .replace(/{{user}}|{{member}}/gi, member.toString())
            .replace(/{{user\.tag}}|{{member\.tag}}/gi, member.user.tag)
            .replace(/{{user\.username}}|{{member\.username}}/gi, member.user.username)
            .replace(/{{user\.id}}|{{member\.id}}/gi, member.user.id)
            .replace(/{{user\.avatar}}|{{member\.avatar}}/gi, member.user.displayAvatarURL())
            // Invite Placeholders
            .replace(/{invite\.code}|{{invite\.code}}/gi, inviteCode)
            .replace(/{invite\.inviter}|{{invite\.inviter}}/gi, inviterString)
            .replace(/{invite\.inviter\.mention}|{{invite\.inviter\.mention}}/gi, inviterString)
            .replace(/{invite\.inviter\.tag}|{{invite\.inviter\.tag}}/gi, inviterTag)
            .replace(/{invite\.inviter\.username}|{{invite\.inviter\.username}}/gi, inviterUsername)
            .replace(/{invite\.inviter\.id}|{{invite\.inviter\.id}}/gi, inviterId)
            .replace(/{invite\.uses}|{{invite\.uses}}/gi, inviteUses.toString())
            .replace(/{invite\.joinType}|{{invite\.joinType}}/gi, info.joinType);

        // 4. Create and send a welcome embed
        const welcomeEmbed = new EmbedBuilder()
            .setColor(3447003)
            .setTitle(`Welcome ${member.user.username}!`)
            .setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL() })
            .setDescription(processedMessage)
            .setThumbnail(member.user.displayAvatarURL())
            .setTimestamp();

        try {
            const channel = guild.channels.cache.get(config.inviteWelcome.channel);
            if (channel) {
                await channel.send({ embeds: [welcomeEmbed] });
            }
        } catch (err) {
            console.error('[ERR] :: inviteJoin welcome message failed to send:', err);
        }
    },
};
```

### Event 2: User Leaves (`inviteLeave`)

When a user leaves the server, DisVite matches the user's join record, updates the `leftAt` field in the database, and emits the `inviteLeave` event:

```javascript
module.exports = {
    name: 'inviteLeave',

    /**
     * Executes when a member leaves a guild.
     * @param {import('discord.js').GuildMember} member The member who left
     * @param {import('disvite').InviteSchema} record The mongoose document updated with leave timestamps
     */
    async execute(member, record) {
        console.log(`${member.user.tag} left the guild. Join record resolved:`, record);
    }
};
```

---

## 4. API Reference & Data Structures

Here is what the `InviteInfo` object payload emitted on `inviteJoin` contains:

| Property | Type | Description |
| :--- | :--- | :--- |
| `guildId` | `string` | The ID of the guild the user joined. |
| `inviteeId` | `string` | The Discord User ID of the member who joined. |
| `inviterId` | `string \| undefined` | The Discord User ID of the member who created the invite (undefined for Vanity/Unknown). |
| `inviteCode` | `string \| undefined` | The invite code string used to join. |
| `joinType` | `'normal' \| 'vanity' \| 'unknown'` | Method utilized to connect (enum value). |
| `fake` | `boolean` | Detects accounts younger than 7 days or rapid leave/rejoin loops. |
| `joinedAt` | `Date` | Timestamp of join. |

---

## 5. Generating Developer Documentation

We have set up **TypeDoc** for the `disvite` package. TypeDoc reads the JSDoc comments inside the TypeScript source code and compiles them into a beautiful, static HTML documentation website.

### Run Docs Generation
To generate the API docs locally, run the following command in the `disvite` package root directory:

```bash
npm run docs
```

This creates a `docs/` folder in the package root containing your complete, styled HTML API reference pages. Open `docs/index.html` in any browser to navigate the types, interfaces, classes, and options definitions.
