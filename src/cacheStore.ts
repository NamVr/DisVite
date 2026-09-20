import { CacheStore } from "./types";

/**
 * High-performance, zero-dependency in-memory implementation of the CacheStore.
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

	/**
	 * Check if a guild is cached.
	 */
	public has(guildId: string): boolean {
		return this.store.has(guildId);
	}

	/**
	 * Number of guilds currently cached.
	 */
	public get size(): number {
		return this.store.size;
	}

	/**
	 * O(1) retrieval of a specific invite code's uses.
	 */
	public getInviteUses(guildId: string, code: string): number | undefined {
		return this.store.get(guildId)?.get(code);
	}

	/**
	 * O(1) insertion or update of a single invite code without cloning/re-fetching.
	 */
	public setInviteUses(guildId: string, code: string, uses: number): void {
		let guildMap = this.store.get(guildId);
		if (!guildMap) {
			guildMap = new Map<string, number>();
			this.store.set(guildId, guildMap);
		}
		guildMap.set(code, uses);
	}

	/**
	 * O(1) deletion of a single invite code.
	 */
	public deleteInvite(guildId: string, code: string): void {
		this.store.get(guildId)?.delete(code);
	}
}
