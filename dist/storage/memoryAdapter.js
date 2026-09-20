"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryStorageAdapter = void 0;
/**
 * Ultra-fast, zero-dependency in-memory storage adapter.
 * Ideal for development, testing, lightweight bots, or bots that manage
 * their own persistent storage via event listeners.
 */
class MemoryStorageAdapter {
    constructor() {
        this.records = [];
        this.bonusInvites = new Map();
    }
    getBonusKey(guildId, userId) {
        return `${guildId}:${userId}`;
    }
    async recordJoin(record) {
        const fullRecord = {
            ...record,
            leftAt: null,
        };
        this.records.push(fullRecord);
        return fullRecord;
    }
    async recordLeave(guildId, inviteeId) {
        // Find latest active join record
        for (let i = this.records.length - 1; i >= 0; i--) {
            const rec = this.records[i];
            if (rec.guildId === guildId && rec.inviteeId === inviteeId && !rec.leftAt) {
                rec.leftAt = new Date();
                return rec;
            }
        }
        // Fallback: update latest record if none without leftAt
        for (let i = this.records.length - 1; i >= 0; i--) {
            const rec = this.records[i];
            if (rec.guildId === guildId && rec.inviteeId === inviteeId) {
                rec.leftAt = new Date();
                return rec;
            }
        }
        return null;
    }
    async getMemberStats(guildId, userId) {
        let total = 0;
        let left = 0;
        let fake = 0;
        for (const rec of this.records) {
            if (rec.guildId === guildId && rec.inviterId === userId) {
                total++;
                if (rec.fake) {
                    fake++;
                }
                if (rec.leftAt) {
                    left++;
                }
            }
        }
        const bonus = await this.getBonus(guildId, userId);
        const valid = Math.max(0, total - left - fake + bonus);
        return { total, valid, left, fake, bonus };
    }
    async getLeaderboard(guildId, limit = 10) {
        const inviters = new Set();
        for (const rec of this.records) {
            if (rec.guildId === guildId && rec.inviterId) {
                inviters.add(rec.inviterId);
            }
        }
        for (const key of this.bonusInvites.keys()) {
            if (key.startsWith(`${guildId}:`)) {
                inviters.add(key.split(":")[1]);
            }
        }
        const results = [];
        for (const userId of inviters) {
            const stats = await this.getMemberStats(guildId, userId);
            results.push({ userId, stats });
        }
        results.sort((a, b) => b.stats.valid - a.stats.valid);
        return results.slice(0, limit);
    }
    async addBonus(guildId, userId, amount) {
        const key = this.getBonusKey(guildId, userId);
        const current = this.bonusInvites.get(key) || 0;
        const updated = current + amount;
        this.bonusInvites.set(key, updated);
        return updated;
    }
    async getBonus(guildId, userId) {
        return this.bonusInvites.get(this.getBonusKey(guildId, userId)) || 0;
    }
    async isFakeRejoin(guildId, inviteeId, thresholdMs) {
        const now = Date.now();
        for (let i = this.records.length - 1; i >= 0; i--) {
            const rec = this.records[i];
            if (rec.guildId === guildId && rec.inviteeId === inviteeId && rec.leftAt) {
                if (now - rec.leftAt.getTime() < thresholdMs) {
                    return true;
                }
            }
        }
        return false;
    }
    async clear() {
        this.records = [];
        this.bonusInvites.clear();
    }
}
exports.MemoryStorageAdapter = MemoryStorageAdapter;
