import { CacheStore } from "./types";

/**
 * An in-memory implementation of the CacheStore using JavaScript's Map.
 */
export class InMemoryCacheStore implements CacheStore {
	private store = new Map<string, Map<string, number>>();

	/**
	 * Retrieve cached invites mapping for a guild.
	 */
	public get(guildId: string): Map<string, number> | undefined {
		return this.store.get(guildId);
	}

	/**
	 * Store invites mapping for a guild.
	 */
	public set(guildId: string, invites: Map<string, number>): void {
		this.store.set(guildId, invites);
	}

	/**
	 * Remove a guild's invites from the cache.
	 */
	public delete(guildId: string): void {
		this.store.delete(guildId);
	}

	/**
	 * Clear all cached invites across all guilds.
	 */
	public clear(): void {
		this.store.clear();
	}
}
