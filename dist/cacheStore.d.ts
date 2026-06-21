import { CacheStore } from "./types";
/**
 * An in-memory implementation of the CacheStore using JavaScript's Map.
 */
export declare class InMemoryCacheStore implements CacheStore {
    private store;
    /**
     * Retrieve cached invites mapping for a guild.
     */
    get(guildId: string): Map<string, number> | undefined;
    /**
     * Store invites mapping for a guild.
     */
    set(guildId: string, invites: Map<string, number>): void;
    /**
     * Remove a guild's invites from the cache.
     */
    delete(guildId: string): void;
    /**
     * Clear all cached invites across all guilds.
     */
    clear(): void;
}
