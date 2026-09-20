"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryCacheStore = void 0;
/**
 * High-performance, zero-dependency in-memory implementation of the CacheStore.
 */
class InMemoryCacheStore {
    constructor() {
        this.store = new Map();
    }
    /**
     * Retrieve cached invites mapping for a guild.
     */
    get(guildId) {
        return this.store.get(guildId);
    }
    /**
     * Store invites mapping for a guild.
     */
    set(guildId, invites) {
        this.store.set(guildId, invites);
    }
    /**
     * Remove a guild's invites from the cache.
     */
    delete(guildId) {
        this.store.delete(guildId);
    }
    /**
     * Clear all cached invites across all guilds.
     */
    clear() {
        this.store.clear();
    }
    /**
     * Check if a guild is cached.
     */
    has(guildId) {
        return this.store.has(guildId);
    }
    /**
     * Number of guilds currently cached.
     */
    get size() {
        return this.store.size;
    }
    /**
     * O(1) retrieval of a specific invite code's uses.
     */
    getInviteUses(guildId, code) {
        return this.store.get(guildId)?.get(code);
    }
    /**
     * O(1) insertion or update of a single invite code without cloning/re-fetching.
     */
    setInviteUses(guildId, code, uses) {
        let guildMap = this.store.get(guildId);
        if (!guildMap) {
            guildMap = new Map();
            this.store.set(guildId, guildMap);
        }
        guildMap.set(code, uses);
    }
    /**
     * O(1) deletion of a single invite code.
     */
    deleteInvite(guildId, code) {
        this.store.get(guildId)?.delete(code);
    }
}
exports.InMemoryCacheStore = InMemoryCacheStore;
