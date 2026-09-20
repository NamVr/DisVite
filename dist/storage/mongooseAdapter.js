"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MongooseStorageAdapter = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const inviteSchema_1 = require("../inviteSchema");
/**
 * Production-ready Mongoose persistence adapter with single-roundtrip aggregations,
 * connection sharing, and atomic bonus counters.
 */
class MongooseStorageAdapter {
    constructor(options) {
        this.ownsConnection = false;
        this.options = options;
        const conn = options.connection;
        this.inviteModel = (0, inviteSchema_1.getInviteModel)(options.modelName || "inviteSchema", conn);
        this.bonusModel = (0, inviteSchema_1.getBonusInviteModel)(options.bonusModelName || "bonusInviteSchema", conn);
    }
    async init() {
        if (this.options.connection) {
            this.options.onDebug?.("DisVite: Reusing provided Mongoose connection.");
            return;
        }
        if (this.options.mongoURI) {
            this.ownsConnection = true;
            await this.connectWithRetry(this.options.mongoURI, 1);
        }
    }
    async connectWithRetry(uri, attempt) {
        try {
            await mongoose_1.default.connect(uri);
            this.options.onDebug?.("DisVite: Connected to MongoDB successfully.");
        }
        catch (error) {
            this.options.onError?.(new Error(`DisVite: Failed to connect to MongoDB: ${error?.message || error}`));
            if (attempt < 3) {
                this.options.onDebug?.(`DisVite: Retrying MongoDB connection in 2s (Attempt ${attempt + 1}/3)...`);
                await new Promise((resolve) => setTimeout(resolve, 2000));
                await this.connectWithRetry(uri, attempt + 1);
            }
            else {
                throw new Error("DisVite: Unable to establish MongoDB connection after 3 attempts.");
            }
        }
    }
    async recordJoin(record) {
        const doc = new this.inviteModel({
            guildId: record.guildId,
            inviteeId: record.inviteeId,
            inviterId: record.inviterId || null,
            inviteCode: record.inviteCode || null,
            joinType: record.joinType,
            joinedAt: record.joinedAt,
            leftAt: null,
            fake: record.fake,
        });
        const saved = await doc.save();
        return {
            guildId: saved.guildId,
            inviteeId: saved.inviteeId,
            inviterId: saved.inviterId,
            inviteCode: saved.inviteCode,
            joinType: saved.joinType,
            joinedAt: saved.joinedAt,
            leftAt: saved.leftAt,
            fake: saved.fake,
        };
    }
    async recordLeave(guildId, inviteeId) {
        const updated = await this.inviteModel
            .findOneAndUpdate({ guildId, inviteeId, leftAt: null }, { leftAt: new Date() }, { sort: { joinedAt: -1 }, new: true })
            .exec();
        if (updated) {
            return {
                guildId: updated.guildId,
                inviteeId: updated.inviteeId,
                inviterId: updated.inviterId,
                inviteCode: updated.inviteCode,
                joinType: updated.joinType,
                joinedAt: updated.joinedAt,
                leftAt: updated.leftAt,
                fake: updated.fake,
            };
        }
        return null;
    }
    async getMemberStats(guildId, userId) {
        const [statsAggregate, bonus] = await Promise.all([
            this.inviteModel
                .aggregate([
                { $match: { guildId, inviterId: userId } },
                {
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        left: {
                            $sum: {
                                $cond: [{ $ifNull: ["$leftAt", false] }, 1, 0],
                            },
                        },
                        fake: {
                            $sum: {
                                $cond: ["$fake", 1, 0],
                            },
                        },
                    },
                },
            ])
                .exec(),
            this.getBonus(guildId, userId),
        ]);
        const res = statsAggregate[0] || { total: 0, left: 0, fake: 0 };
        const valid = Math.max(0, res.total - res.left - res.fake + bonus);
        return {
            total: res.total,
            valid,
            left: res.left,
            fake: res.fake,
            bonus,
        };
    }
    async getLeaderboard(guildId, limit = 10) {
        const [aggregates, bonuses] = await Promise.all([
            this.inviteModel
                .aggregate([
                { $match: { guildId, inviterId: { $ne: null } } },
                {
                    $group: {
                        _id: "$inviterId",
                        total: { $sum: 1 },
                        left: {
                            $sum: {
                                $cond: [{ $ifNull: ["$leftAt", false] }, 1, 0],
                            },
                        },
                        fake: {
                            $sum: {
                                $cond: ["$fake", 1, 0],
                            },
                        },
                    },
                },
            ])
                .exec(),
            this.bonusModel.find({ guildId }).lean().exec(),
        ]);
        const bonusMap = new Map();
        for (const b of bonuses) {
            bonusMap.set(b.userId, b.bonus || 0);
        }
        const userIds = new Set();
        const statsMap = new Map();
        for (const row of aggregates) {
            if (row._id) {
                userIds.add(row._id);
                statsMap.set(row._id, { total: row.total, left: row.left, fake: row.fake });
            }
        }
        for (const b of bonuses) {
            userIds.add(b.userId);
        }
        const results = [];
        for (const userId of userIds) {
            const s = statsMap.get(userId) || { total: 0, left: 0, fake: 0 };
            const bonus = bonusMap.get(userId) || 0;
            const valid = Math.max(0, s.total - s.left - s.fake + bonus);
            results.push({
                userId,
                stats: {
                    total: s.total,
                    valid,
                    left: s.left,
                    fake: s.fake,
                    bonus,
                },
            });
        }
        results.sort((a, b) => b.stats.valid - a.stats.valid);
        return results.slice(0, limit);
    }
    async addBonus(guildId, userId, amount) {
        const doc = await this.bonusModel
            .findOneAndUpdate({ guildId, userId }, { $inc: { bonus: amount } }, { upsert: true, new: true })
            .exec();
        return doc?.bonus || 0;
    }
    async getBonus(guildId, userId) {
        const doc = await this.bonusModel.findOne({ guildId, userId }).lean().exec();
        return doc?.bonus || 0;
    }
    async isFakeRejoin(guildId, inviteeId, thresholdMs) {
        const recentRecord = await this.inviteModel
            .findOne({
            guildId,
            inviteeId,
            leftAt: { $ne: null },
        })
            .sort({ leftAt: -1 })
            .lean()
            .exec();
        if (recentRecord && recentRecord.leftAt) {
            const leftTime = new Date(recentRecord.leftAt).getTime();
            if (Date.now() - leftTime < thresholdMs) {
                return true;
            }
        }
        return false;
    }
    async close() {
        if (this.ownsConnection) {
            await mongoose_1.default.disconnect();
        }
    }
}
exports.MongooseStorageAdapter = MongooseStorageAdapter;
