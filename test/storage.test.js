const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { MemoryStorageAdapter } = require("../dist/index.js");

describe("MemoryStorageAdapter", () => {
	it("should record joins and compute member stats accurately", async () => {
		const storage = new MemoryStorageAdapter();

		// User 1 joins via inviter 100
		await storage.recordJoin({
			guildId: "g1",
			inviteeId: "u1",
			inviterId: "inv100",
			inviteCode: "codeA",
			joinType: "normal",
			joinedAt: new Date(),
			fake: false,
		});

		// User 2 joins via inviter 100
		await storage.recordJoin({
			guildId: "g1",
			inviteeId: "u2",
			inviterId: "inv100",
			inviteCode: "codeA",
			joinType: "normal",
			joinedAt: new Date(),
			fake: false,
		});

		// User 3 joins via inviter 100 (fake)
		await storage.recordJoin({
			guildId: "g1",
			inviteeId: "u3",
			inviterId: "inv100",
			inviteCode: "codeA",
			joinType: "normal",
			joinedAt: new Date(),
			fake: true,
		});

		let stats = await storage.getMemberStats("g1", "inv100");
		assert.equal(stats.total, 3);
		assert.equal(stats.fake, 1);
		assert.equal(stats.left, 0);
		assert.equal(stats.valid, 2); // 3 total - 1 fake

		// User 1 leaves
		const leaveRecord = await storage.recordLeave("g1", "u1");
		assert.ok(leaveRecord);
		assert.ok(leaveRecord.leftAt);

		stats = await storage.getMemberStats("g1", "inv100");
		assert.equal(stats.left, 1);
		assert.equal(stats.valid, 1); // 3 total - 1 fake - 1 left

		// Add bonus
		await storage.addBonus("g1", "inv100", 5);
		stats = await storage.getMemberStats("g1", "inv100");
		assert.equal(stats.bonus, 5);
		assert.equal(stats.valid, 6); // 1 + 5
	});

	it("should generate leaderboard sorted by valid invites", async () => {
		const storage = new MemoryStorageAdapter();

		await storage.recordJoin({
			guildId: "g1",
			inviteeId: "u1",
			inviterId: "userA",
			joinType: "normal",
			joinedAt: new Date(),
			fake: false,
		});

		await storage.recordJoin({
			guildId: "g1",
			inviteeId: "u2",
			inviterId: "userB",
			joinType: "normal",
			joinedAt: new Date(),
			fake: false,
		});
		await storage.recordJoin({
			guildId: "g1",
			inviteeId: "u3",
			inviterId: "userB",
			joinType: "normal",
			joinedAt: new Date(),
			fake: false,
		});

		const leaderboard = await storage.getLeaderboard("g1", 10);
		assert.equal(leaderboard.length, 2);
		assert.equal(leaderboard[0].userId, "userB");
		assert.equal(leaderboard[0].stats.valid, 2);
		assert.equal(leaderboard[1].userId, "userA");
		assert.equal(leaderboard[1].stats.valid, 1);
	});

	it("should detect rapid rejoins", async () => {
		const storage = new MemoryStorageAdapter();

		await storage.recordJoin({
			guildId: "g1",
			inviteeId: "u1",
			joinType: "normal",
			joinedAt: new Date(Date.now() - 10000),
			fake: false,
		});

		await storage.recordLeave("g1", "u1");

		// Left just now, threshold is 60s -> fake rejoin!
		const isFake = await storage.isFakeRejoin("g1", "u1", 60000);
		assert.equal(isFake, true);

		// With 1ms threshold -> not within threshold
		const notFake = await storage.isFakeRejoin("g1", "u1", 0);
		assert.equal(notFake, false);
	});
});
