const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { MongooseStorageAdapter } = require("../dist/index.js");

describe("MongooseStorageAdapter", () => {
	it("should initialize safely with custom connection without connecting globally", async () => {
		const mockConnection = {
			models: {},
			model: (name, schema) => {
				mockConnection.models[name] = function (data) {
					return {
						...data,
						save: async () => data,
					};
				};
				mockConnection.models[name].find = () => ({
					lean: () => ({ exec: async () => [] }),
				});
				mockConnection.models[name].findOne = () => ({
					lean: () => ({ exec: async () => null }),
				});
				mockConnection.models[name].findOneAndUpdate = () => ({
					exec: async () => null,
				});
				mockConnection.models[name].aggregate = () => ({
					exec: async () => [],
				});
				return mockConnection.models[name];
			},
		};

		let debugMsg = "";
		const adapter = new MongooseStorageAdapter({
			connection: mockConnection,
			modelName: "testInvite",
			bonusModelName: "testBonus",
			onDebug: (msg) => {
				debugMsg = msg;
			},
		});

		await adapter.init();
		assert.match(debugMsg, /Reusing provided Mongoose connection/);

		const stats = await adapter.getMemberStats("g1", "u1");
		assert.equal(stats.total, 0);
		assert.equal(stats.valid, 0);
		assert.equal(stats.bonus, 0);
	});
});
