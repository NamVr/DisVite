const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { GuildTaskQueue } = require("../dist/index.js");

describe("GuildTaskQueue", () => {
	it("should execute tasks sequentially for the same guild", async () => {
		const queue = new GuildTaskQueue();
		const order = [];

		const p1 = queue.enqueue("guild1", async () => {
			await new Promise((r) => setTimeout(r, 40));
			order.push(1);
			return "task1";
		});

		const p2 = queue.enqueue("guild1", async () => {
			await new Promise((r) => setTimeout(r, 10));
			order.push(2);
			return "task2";
		});

		const [r1, r2] = await Promise.all([p1, p2]);
		assert.equal(r1, "task1");
		assert.equal(r2, "task2");
		assert.deepEqual(order, [1, 2]); // Sequential FIFO guarantee
		assert.equal(queue.activeGuilds, 0); // No memory leak
	});

	it("should execute tasks concurrently for different guilds", async () => {
		const queue = new GuildTaskQueue();
		const order = [];

		const p1 = queue.enqueue("guildA", async () => {
			await new Promise((r) => setTimeout(r, 50));
			order.push("A");
		});

		const p2 = queue.enqueue("guildB", async () => {
			await new Promise((r) => setTimeout(r, 10));
			order.push("B");
		});

		await Promise.all([p1, p2]);
		assert.deepEqual(order, ["B", "A"]); // Guild B finishes before Guild A
	});

	it("should survive errors in earlier tasks without breaking queue chain", async () => {
		const queue = new GuildTaskQueue();

		const p1 = queue.enqueue("guild1", async () => {
			throw new Error("Simulated failure");
		});

		const p2 = queue.enqueue("guild1", async () => {
			return "recovered";
		});

		await assert.rejects(p1, /Simulated failure/);
		const r2 = await p2;
		assert.equal(r2, "recovered");
		assert.equal(queue.activeGuilds, 0);
	});
});
