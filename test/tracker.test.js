const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("events");
const { InviteTracker, JoinType, MemoryStorageAdapter } = require("../dist/index.js");

// Mock Discord.js Classes
class MockClient extends EventEmitter {
	constructor() {
		super();
		this.options = {
			intents: 1 | (1 << 1) | (1 << 3), // mock bitmask
		};
		this.guilds = {
			cache: new Map(),
		};
		this.user = { tag: "DisViteBot#0001", id: "bot999" };
	}

	isReady() {
		return true;
	}
}

class MockGuild {
	constructor(id, name = "Test Guild") {
		this.id = id;
		this.name = name;
		this.available = true;
		this.vanityURLCode = null;
		this.invitesList = new Map();
		this.vanityUses = 0;
		this.members = {
			me: {
				permissions: {
					has: () => true, // has ManageGuild
				},
			},
		};
		this.invites = {
			fetch: async () => {
				return Array.from(this.invitesList.values());
			},
		};
	}

	async fetchVanityData() {
		return { uses: this.vanityUses };
	}
}

function createMockMember(guild, id, options = {}) {
	return {
		id,
		guild,
		user: {
			id,
			bot: options.bot ?? false,
			createdAt: options.createdAt ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days old
		},
	};
}

describe("InviteTracker Integration", () => {
	it("should detect bot joins without fetching guild invites", async () => {
		const client = new MockClient();
		const guild = new MockGuild("g1");
		client.guilds.cache.set("g1", guild);

		const tracker = new InviteTracker(client, { storage: new MemoryStorageAdapter() });

		let receivedInfo = null;
		tracker.on("inviteJoin", (member, info) => {
			receivedInfo = info;
		});

		const botMember = createMockMember(guild, "bot1", { bot: true });
		client.emit("guildMemberAdd", botMember);

		// Wait for queue processing
		await new Promise((r) => setTimeout(r, 30));

		assert.ok(receivedInfo);
		assert.equal(receivedInfo.joinType, JoinType.Bot);
		assert.equal(receivedInfo.inviteeId, "bot1");
		assert.equal(receivedInfo.fake, false);

		await tracker.destroy();
	});

	it("should identify normal invite join and emit on both tracker and client", async () => {
		const client = new MockClient();
		const guild = new MockGuild("g1");
		client.guilds.cache.set("g1", guild);

		// Pre-populate guild invites: code1 with 5 uses
		guild.invitesList.set("code1", {
			code: "code1",
			uses: 5,
			inviter: { id: "inviterUser1" },
		});

		const tracker = new InviteTracker(client, { storage: new MemoryStorageAdapter() });
		await tracker.cacheGuildInvitesForGuild(guild);

		// Increment use count on code1
		guild.invitesList.set("code1", {
			code: "code1",
			uses: 6,
			inviter: { id: "inviterUser1" },
		});

		let trackerJoinInfo = null;
		let clientJoinInfo = null;

		tracker.on("inviteJoin", (member, info) => {
			trackerJoinInfo = info;
		});
		client.on("inviteJoin", (member, info) => {
			clientJoinInfo = info;
		});

		const joinMember = createMockMember(guild, "member99");
		client.emit("guildMemberAdd", joinMember);

		await new Promise((r) => setTimeout(r, 40));

		assert.ok(trackerJoinInfo);
		assert.ok(clientJoinInfo);
		assert.equal(trackerJoinInfo.joinType, JoinType.Normal);
		assert.equal(trackerJoinInfo.inviteCode, "code1");
		assert.equal(trackerJoinInfo.inviterId, "inviterUser1");
		assert.equal(trackerJoinInfo.fake, false);
		assert.ok(trackerJoinInfo.inviterStats);
		assert.equal(trackerJoinInfo.inviterStats.total, 1);
		assert.equal(trackerJoinInfo.inviterStats.valid, 1);

		await tracker.destroy();
	});

	it("should identify vanity URL join", async () => {
		const client = new MockClient();
		const guild = new MockGuild("g1");
		guild.vanityURLCode = "discord-gg-vanity";
		guild.vanityUses = 10;
		client.guilds.cache.set("g1", guild);

		const tracker = new InviteTracker(client, { storage: new MemoryStorageAdapter() });
		await tracker.cacheGuildInvitesForGuild(guild);

		// Simulate vanity URL increment
		guild.vanityUses = 11;

		let receivedInfo = null;
		tracker.on("inviteJoin", (m, info) => {
			receivedInfo = info;
		});

		const joinMember = createMockMember(guild, "userVanity");
		client.emit("guildMemberAdd", joinMember);

		await new Promise((r) => setTimeout(r, 40));

		assert.ok(receivedInfo);
		assert.equal(receivedInfo.joinType, JoinType.Vanity);
		assert.equal(receivedInfo.inviteCode, "discord-gg-vanity");

		await tracker.destroy();
	});

	it("should flag accounts younger than 7 days as fake", async () => {
		const client = new MockClient();
		const guild = new MockGuild("g1");
		guild.invitesList.set("codeA", { code: "codeA", uses: 0, inviter: { id: "inv1" } });
		client.guilds.cache.set("g1", guild);

		const tracker = new InviteTracker(client, { storage: new MemoryStorageAdapter() });
		await tracker.cacheGuildInvitesForGuild(guild);

		guild.invitesList.set("codeA", { code: "codeA", uses: 1, inviter: { id: "inv1" } });

		let joinInfo = null;
		tracker.on("inviteJoin", (m, info) => {
			joinInfo = info;
		});

		// Account created 2 days ago (< 7 days)
		const youngMember = createMockMember(guild, "babyAccount", {
			createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
		});
		client.emit("guildMemberAdd", youngMember);

		await new Promise((r) => setTimeout(r, 40));

		assert.ok(joinInfo);
		assert.equal(joinInfo.fake, true);

		await tracker.destroy();
	});

	it("should handle serialized join storms cleanly", async () => {
		const client = new MockClient();
		const guild = new MockGuild("g1");
		client.guilds.cache.set("g1", guild);

		let uses = 0;
		guild.invitesList.set("stormCode", {
			code: "stormCode",
			get uses() {
				return uses;
			},
			inviter: { id: "host1" },
		});

		const tracker = new InviteTracker(client, { storage: new MemoryStorageAdapter() });
		await tracker.cacheGuildInvitesForGuild(guild);

		const joined = [];
		tracker.on("inviteJoin", (m, info) => {
			joined.push(info);
		});

		// Simulate 5 users joining in immediate succession
		for (let i = 1; i <= 5; i++) {
			uses++;
			const member = createMockMember(guild, `stormUser${i}`);
			client.emit("guildMemberAdd", member);
		}

		await new Promise((r) => setTimeout(r, 100));

		assert.equal(joined.length, 5);
		for (const j of joined) {
			assert.equal(j.joinType, JoinType.Normal);
			assert.equal(j.inviteCode, "stormCode");
			assert.equal(j.inviterId, "host1");
		}

		const stats = await tracker.getMemberStats("g1", "host1");
		assert.equal(stats.total, 5);
		assert.equal(stats.valid, 5);

		await tracker.destroy();
	});

	it("should handle member leave and emit inviteLeave", async () => {
		const client = new MockClient();
		const guild = new MockGuild("g1");
		client.guilds.cache.set("g1", guild);

		const storage = new MemoryStorageAdapter();
		const tracker = new InviteTracker(client, { storage });

		await storage.recordJoin({
			guildId: "g1",
			inviteeId: "leaveUser",
			inviterId: "inviterX",
			joinType: "normal",
			joinedAt: new Date(),
			fake: false,
		});

		let leaveRecord = null;
		tracker.on("inviteLeave", (m, rec) => {
			leaveRecord = rec;
		});

		const member = createMockMember(guild, "leaveUser");
		client.emit("guildMemberRemove", member);

		await new Promise((r) => setTimeout(r, 40));

		assert.ok(leaveRecord);
		assert.equal(leaveRecord.inviteeId, "leaveUser");
		assert.ok(leaveRecord.leftAt);

		await tracker.destroy();
	});
});
