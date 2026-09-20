const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { InMemoryCacheStore } = require("../dist/index.js");

describe("InMemoryCacheStore", () => {
	it("should store and retrieve guild invites", () => {
		const cache = new InMemoryCacheStore();
		const invites = new Map([
			["abc", 5],
			["xyz", 10],
		]);

		cache.set("guild1", invites);
		assert.equal(cache.has("guild1"), true);
		assert.equal(cache.size, 1);

		const retrieved = cache.get("guild1");
		assert.equal(retrieved.get("abc"), 5);
		assert.equal(retrieved.get("xyz"), 10);
	});

	it("should perform O(1) delta operations", () => {
		const cache = new InMemoryCacheStore();
		cache.setInviteUses("guild1", "codeA", 3);

		assert.equal(cache.getInviteUses("guild1", "codeA"), 3);

		cache.setInviteUses("guild1", "codeA", 4);
		assert.equal(cache.getInviteUses("guild1", "codeA"), 4);

		cache.deleteInvite("guild1", "codeA");
		assert.equal(cache.getInviteUses("guild1", "codeA"), undefined);
	});

	it("should delete and clear cache", () => {
		const cache = new InMemoryCacheStore();
		cache.setInviteUses("guild1", "codeA", 1);
		cache.setInviteUses("guild2", "codeB", 2);

		assert.equal(cache.size, 2);

		cache.delete("guild1");
		assert.equal(cache.has("guild1"), false);
		assert.equal(cache.has("guild2"), true);

		cache.clear();
		assert.equal(cache.size, 0);
	});
});
