"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryCacheStore = void 0;
/**
 * An in-memory implementation of the CacheStore using JavaScript's Map.
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
}
exports.InMemoryCacheStore = InMemoryCacheStore;
