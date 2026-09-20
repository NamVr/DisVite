import { CacheStore } from "./types";
/**
 * High-performance, zero-dependency in-memory implementation of the CacheStore.
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
    /**
     * Check if a guild is cached.
     */
    has(guildId: string): boolean;
    /**
     * Number of guilds currently cached.
     */
    get size(): number;
    /**
     * O(1) retrieval of a specific invite code's uses.
     */
    getInviteUses(guildId: string, code: string): number | undefined;
    /**
     * O(1) insertion or update of a single invite code without cloning/re-fetching.
     */
    setInviteUses(guildId: string, code: string, uses: number): void;
    /**
     * O(1) deletion of a single invite code.
     */
    deleteInvite(guildId: string, code: string): void;
}
