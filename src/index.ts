import { EventEmitter } from "events";
import {
	Client,
	Guild,
	GuildMember,
	Invite,
	GatewayIntentBits,
	PermissionFlagsBits,
} from "discord.js";
import * as Types from "./types";
import { InMemoryCacheStore } from "./cacheStore";
import { GuildTaskQueue } from "./queue";
import { MemoryStorageAdapter, MongooseStorageAdapter } from "./storage";

// Re-export public types, schemas, and classes
export * from "./types";
export { InMemoryCacheStore } from "./cacheStore";
export { GuildTaskQueue } from "./queue";
export { MemoryStorageAdapter, MongooseStorageAdapter, MongooseStorageOptions } from "./storage";
export { getInviteModel, getBonusInviteModel, BonusInviteDocument } from "./inviteSchema";

/**
 * High-performance, production-ready Discord invite tracking engine.
 */
export class InviteTracker extends EventEmitter {
	public client: Client;
	public invites: Types.CacheStore;
	public storage: Types.StorageAdapter;

	protected options: Required<
		Omit<Types.InviteTrackerOptions, "mongoURI" | "mongooseConnection" | "cacheStore" | "storage">
	> & {
		storage?: "memory" | "mongoose" | Types.StorageAdapter;
		mongoURI?: string;
		mongooseConnection?: any;
		cacheStore?: Types.CacheStore;
	};

	protected queue: GuildTaskQueue;
	private boundHandlers: { [event: string]: (...args: any[]) => void } = {};
	private isDestroyed = false;

	/**
	 * Creates an instance of InviteTracker.
	 *
	 * @param client The discord.js Client instance.
	 * @param mongoURIOrOptions Either a MongoDB URI string (legacy) or InviteTrackerOptions.
	 * @param options Optional InviteTrackerOptions when mongoURI is provided as 2nd argument.
	 */
	constructor(
		client: Client,
		mongoURIOrOptions?: string | Types.InviteTrackerOptions,
		options?: Types.InviteTrackerOptions
	) {
		super();
		this.client = client;

		let mergedOptions: Types.InviteTrackerOptions = {};
		if (typeof mongoURIOrOptions === "string") {
			mergedOptions = {
				mongoURI: mongoURIOrOptions,
				storage: "mongoose",
				...options,
			};
		} else if (mongoURIOrOptions && typeof mongoURIOrOptions === "object") {
			mergedOptions = { ...mongoURIOrOptions };
		}

		this.options = {
			modelName: mergedOptions.modelName || "inviteSchema",
			bonusModelName: mergedOptions.bonusModelName || "bonusInviteSchema",
			verbose: mergedOptions.verbose ?? false,
			fakeThresholdMs: mergedOptions.fakeThresholdMs ?? 7 * 24 * 60 * 60 * 1000,
			rejoinThresholdMs: mergedOptions.rejoinThresholdMs ?? 7 * 24 * 60 * 60 * 1000,
			emitOnClient: mergedOptions.emitOnClient ?? true,
			concurrency: mergedOptions.concurrency ?? 3,
			trackBots: mergedOptions.trackBots ?? true,
			storage: mergedOptions.storage,
			mongoURI: mergedOptions.mongoURI,
			mongooseConnection: mergedOptions.mongooseConnection,
			cacheStore: mergedOptions.cacheStore,
		};

		this.invites = mergedOptions.cacheStore || new InMemoryCacheStore();
		this.queue = new GuildTaskQueue();

		// Configure Storage Adapter
		if (
			mergedOptions.storage &&
			typeof mergedOptions.storage === "object" &&
			"recordJoin" in mergedOptions.storage
		) {
			this.storage = mergedOptions.storage;
		} else if (
			mergedOptions.storage === "mongoose" ||
			mergedOptions.mongoURI ||
			mergedOptions.mongooseConnection
		) {
			this.storage = new MongooseStorageAdapter({
				mongoURI: mergedOptions.mongoURI,
				connection: mergedOptions.mongooseConnection,
				modelName: this.options.modelName,
				bonusModelName: this.options.bonusModelName,
				onError: (err) => this.emitSafeError(err),
				onDebug: (msg) => this.emitSafeDebug(msg),
			});
		} else {
			this.storage = new MemoryStorageAdapter();
		}

		// Initialize storage asynchronously without unhandled promise rejections
		if (this.storage.init) {
			this.storage.init().catch((err: Error) => {
				this.emitSafeError(err);
			});
		}

		this.registerGatewayListeners();
	}

	// ==========================================
	// Strongly Typed EventEmitter Overrides
	// ==========================================

	public override on<K extends keyof Types.InviteTrackerEvents>(
		event: K,
		listener: (...args: Types.InviteTrackerEvents[K]) => void
	): this {
		return super.on(event, listener as (...args: any[]) => void);
	}

	public override once<K extends keyof Types.InviteTrackerEvents>(
		event: K,
		listener: (...args: Types.InviteTrackerEvents[K]) => void
	): this {
		return super.once(event, listener as (...args: any[]) => void);
	}

	public override emit<K extends keyof Types.InviteTrackerEvents>(
		event: K,
		...args: Types.InviteTrackerEvents[K]
	): boolean {
		return super.emit(event, ...args);
	}

	public override off<K extends keyof Types.InviteTrackerEvents>(
		event: K,
		listener: (...args: Types.InviteTrackerEvents[K]) => void
	): this {
		return super.off(event, listener as (...args: any[]) => void);
	}

	// ==========================================
	// Safe Internal Event Dispatchers (Zero Console Logs)
	// ==========================================

	protected emitSafeDebug(message: string): void {
		if (this.options.verbose) {
			this.emit("debug", message);
		}
	}

	protected emitSafeWarn(message: string): void {
		this.emit("warn", message);
	}

	protected emitSafeError(error: Error): void {
		if (this.listenerCount("error") > 0) {
			this.emit("error", error);
		}
	}

	// ==========================================
	// Gateway Initialization & Intent Validation
	// ==========================================

	protected validateGatewayIntents(): void {
		const clientIntents = this.client.options?.intents;
		if (!clientIntents) return;

		try {
			// Check GuildMembers and GuildInvites bits
			const membersBit = GatewayIntentBits.GuildMembers;
			const invitesBit = GatewayIntentBits.GuildInvites;

			let hasMembers = false;
			let hasInvites = false;

			if (typeof clientIntents === "number" || typeof clientIntents === "bigint") {
				const bitmask = BigInt(clientIntents);
				hasMembers = (bitmask & BigInt(membersBit)) !== BigInt(0);
				hasInvites = (bitmask & BigInt(invitesBit)) !== BigInt(0);
			} else if (Array.isArray(clientIntents)) {
				hasMembers = clientIntents.includes(membersBit) || clientIntents.includes("GuildMembers" as any);
				hasInvites = clientIntents.includes(invitesBit) || clientIntents.includes("GuildInvites" as any);
			}

			if (!hasMembers) {
				this.emitSafeWarn(
					"DisVite: GuildMembers gateway intent is missing. Tracking member joins and leaves will fail. Enable GuildMembers in client options and Discord Developer Portal."
				);
			}
			if (!hasInvites) {
				this.emitSafeWarn(
					"DisVite: GuildInvites gateway intent is missing. Real-time invite tracking requires GuildInvites in client options."
				);
			}
		} catch {
			// Intent check failed gracefully without throwing
		}
	}

	protected registerGatewayListeners(): void {
		this.boundHandlers = {
			ready: () => {
				this.validateGatewayIntents();
				this.cacheGuildInvites()
					.then(() => {
						this.emit("ready");
						this.emitSafeDebug(`DisVite: Synced and ready on ${this.client.guilds.cache.size} guilds.`);
					})
					.catch((err) => this.emitSafeError(err));
			},
			guildMemberAdd: (member: GuildMember) => {
				this.inviteJoin(member).catch((err) => this.emitSafeError(err));
			},
			guildMemberRemove: (member: GuildMember) => {
				this.inviteLeave(member).catch((err) => this.emitSafeError(err));
			},
			inviteCreate: (invite: Invite) => {
				this.handleInviteCreate(invite);
			},
			inviteDelete: (invite: Invite) => {
				this.handleInviteDelete(invite);
			},
			guildCreate: (guild: Guild) => {
				this.cacheGuildInvitesForGuild(guild).catch((err) => this.emitSafeError(err));
			},
			guildDelete: (guild: Guild) => {
				this.handleGuildDelete(guild);
			},
		};

		if (this.client.isReady()) {
			this.validateGatewayIntents();
			this.cacheGuildInvites()
				.then(() => {
					this.emit("ready");
					this.emitSafeDebug(`DisVite: Synced and ready on ${this.client.guilds.cache.size} guilds.`);
				})
				.catch((err) => this.emitSafeError(err));
		} else {
			this.client.once("ready", this.boundHandlers.ready);
		}

		this.client.on("guildMemberAdd", this.boundHandlers.guildMemberAdd);
		this.client.on("guildMemberRemove", this.boundHandlers.guildMemberRemove);
		this.client.on("inviteCreate", this.boundHandlers.inviteCreate);
		this.client.on("inviteDelete", this.boundHandlers.inviteDelete);
		this.client.on("guildCreate", this.boundHandlers.guildCreate);
		this.client.on("guildDelete", this.boundHandlers.guildDelete);
	}

	// ==========================================
	// O(1) Delta Caching for Invite Create/Delete
	// ==========================================

	protected handleInviteCreate(invite: Invite): void {
		if (this.isDestroyed || !invite.guild) return;
		const guildId = invite.guild.id;

		if (this.invites.setInviteUses) {
			this.invites.setInviteUses(guildId, invite.code, invite.uses || 0);
		} else {
			const current = this.invites.get(guildId);
			if (current instanceof Map) {
				current.set(invite.code, invite.uses || 0);
				this.invites.set(guildId, current);
			}
		}

		this.emit("inviteCreate", invite);
		this.emitSafeDebug(`DisVite: Added invite ${invite.code} to cache for guild ${guildId} [O(1)].`);
	}

	protected handleInviteDelete(invite: Invite): void {
		if (this.isDestroyed || !invite.guild) return;
		const guildId = invite.guild.id;

		if (this.invites.deleteInvite) {
			this.invites.deleteInvite(guildId, invite.code);
		} else {
			const current = this.invites.get(guildId);
			if (current instanceof Map) {
				current.delete(invite.code);
				this.invites.set(guildId, current);
			}
		}

		this.emit("inviteDelete", invite);
		this.emitSafeDebug(`DisVite: Removed invite ${invite.code} from cache for guild ${guildId} [O(1)].`);
	}

	protected handleGuildDelete(guild: Guild): void {
		if (this.isDestroyed) return;
		Promise.resolve(this.invites.delete(guild.id)).catch((err) => this.emitSafeError(err));
		this.emitSafeDebug(`DisVite: Evicted cache for removed guild ${guild.id}.`);
	}

	// ==========================================
	// Permission-Safe Guild Invites Caching
	// ==========================================

	protected hasManageGuildPermission(guild: Guild): boolean {
		try {
			const me = guild.members.me;
			if (!me) return true; // optimistic if me is not cached
			return me.permissions.has(PermissionFlagsBits.ManageGuild);
		} catch {
			return false;
		}
	}

	/**
	 * Cache all invites for a specific guild safely.
	 */
	public async cacheGuildInvitesForGuild(guild: Guild, attempt = 1): Promise<Map<string, number>> {
		if (this.isDestroyed || !guild.available) {
			return new Map();
		}

		// Pre-flight permission check
		if (!this.hasManageGuildPermission(guild)) {
			this.emitSafeWarn(
				`DisVite: Bot lacks ManageGuild permission in guild "${guild.name}" (${guild.id}). Unable to fetch invites.`
			);
			return new Map();
		}

		try {
			const fetchedInvites = await guild.invites.fetch();
			const inviteMap = new Map<string, number>();

			fetchedInvites.forEach((invite) => {
				inviteMap.set(invite.code, invite.uses || 0);
			});

			// Single-pass vanity check if server has vanity enabled
			if (guild.vanityURLCode) {
				try {
					const vanityData = await guild.fetchVanityData();
					if (vanityData) {
						inviteMap.set("VANITY", vanityData.uses || 0);
					}
				} catch {
					// Vanity fetch failed gracefully without crashing
				}
			}

			await this.invites.set(guild.id, inviteMap);
			this.emit("guildSync", guild.id, inviteMap.size);
			this.emitSafeDebug(`DisVite: Cached ${inviteMap.size} invites for guild ${guild.id}.`);
			return inviteMap;
		} catch (error: any) {
			if (attempt < 3) {
				this.emitSafeDebug(
					`DisVite: Retrying invite fetch for guild ${guild.id} (Attempt ${attempt + 1}/3)...`
				);
				await new Promise((resolve) => setTimeout(resolve, 1500));
				return this.cacheGuildInvitesForGuild(guild, attempt + 1);
			}

			this.emitSafeWarn(
				`DisVite: Failed to fetch invites for guild ${guild.id} after 3 attempts: ${error?.message || error}`
			);
			return new Map();
		}
	}

	/**
	 * Cache invites for all guilds with throttled concurrency to avoid 429s.
	 */
	public async cacheGuildInvites(): Promise<void> {
		const guilds = Array.from(this.client.guilds.cache.values());
		const concurrency = this.options.concurrency;

		for (let i = 0; i < guilds.length; i += concurrency) {
			const chunk = guilds.slice(i, i + concurrency);
			await Promise.allSettled(chunk.map((guild) => this.cacheGuildInvitesForGuild(guild)));
		}
	}

	// ==========================================
	// Serialized Join Reconciliation (Queue-Guarded)
	// ==========================================

	protected async inviteJoin(member: GuildMember): Promise<void> {
		if (this.isDestroyed) return;
		const { guild } = member;

		// Serialize execution per guild to eliminate race conditions during join storms
		await this.queue.enqueue(guild.id, async () => {
			// 1. Bot Join Detection (Bots use OAuth2 authorization, not member invites!)
			if (member.user.bot) {
				if (!this.options.trackBots) return;

				const botInfo: Types.InviteInfo = {
					joinType: Types.JoinType.Bot,
					guildId: guild.id,
					inviteeId: member.id,
					inviterId: null,
					inviteCode: null,
					fake: false,
					joinedAt: new Date(),
				};

				await this.storage.recordJoin(botInfo).catch((err) => this.emitSafeError(err));
				this.dispatchInviteJoin(member, botInfo);
				return;
			}

			const cachedInvites = await this.invites.get(guild.id);
			const isFake = await this.detectFakeInvite(member);

			const inviteInfo: Types.InviteInfo = {
				joinType: Types.JoinType.Unknown,
				guildId: guild.id,
				inviteeId: member.id,
				fake: isFake,
				joinedAt: new Date(),
			};

			// If no cache exists or bot lacks permissions, sync and emit Unknown
			if (!cachedInvites || !this.hasManageGuildPermission(guild)) {
				if (!cachedInvites && this.hasManageGuildPermission(guild)) {
					await this.cacheGuildInvitesForGuild(guild);
				}

				await this.storage.recordJoin(inviteInfo).catch((err) => this.emitSafeError(err));
				this.dispatchInviteJoin(member, inviteInfo);
				return;
			}

			// 2. Fetch fresh invites for comparison
			let currentInvites;
			try {
				currentInvites = await guild.invites.fetch();
			} catch (error: any) {
				this.emitSafeWarn(
					`DisVite: Failed to fetch fresh invites during join in ${guild.id}: ${error?.message || error}`
				);
				await this.storage.recordJoin(inviteInfo).catch((err) => this.emitSafeError(err));
				this.dispatchInviteJoin(member, inviteInfo);
				return;
			}

			// 3. Diff current invites against cached invites
			const usedInvite = currentInvites.find(
				(inv) => (inv.uses || 0) > (cachedInvites.get(inv.code) || 0)
			);

			// Copy current cache as base to support delta credit smoothing during join storms
			const newInviteMap = new Map<string, number>(cachedInvites);

			// Sync invites whose uses are already equal or lower
			for (const inv of currentInvites.values()) {
				const currentUses = inv.uses || 0;
				const cachedUses = cachedInvites.get(inv.code) || 0;
				if (currentUses <= cachedUses) {
					newInviteMap.set(inv.code, currentUses);
				}
			}

			if (usedInvite) {
				inviteInfo.inviterId = usedInvite.inviter?.id || null;
				inviteInfo.inviteCode = usedInvite.code;
				inviteInfo.joinType =
					guild.vanityURLCode && usedInvite.code === guild.vanityURLCode
						? Types.JoinType.Vanity
						: Types.JoinType.Normal;

				// Delta increment: advance cache by 1 so remaining queued joins in this storm
				// can consume their respective delta credits!
				const previousCachedUses = cachedInvites.get(usedInvite.code) || 0;
				newInviteMap.set(usedInvite.code, previousCachedUses + 1);
			} else if (guild.vanityURLCode) {
				// 4. Check Vanity URL single-fetch if no regular invite changed
				const oldVanityUses = cachedInvites.get("VANITY") || 0;
				try {
					const vanityData = await guild.fetchVanityData();
					const currentVanityUses = vanityData?.uses || 0;

					if (currentVanityUses > oldVanityUses) {
						inviteInfo.inviteCode = guild.vanityURLCode;
						inviteInfo.joinType = Types.JoinType.Vanity;
						newInviteMap.set("VANITY", oldVanityUses + 1);
					} else {
						newInviteMap.set("VANITY", currentVanityUses);
					}
				} catch {
					// Vanity check failed gracefully
				}
			} else {
				// 5. Check for single-use / max-uses invite that expired and disappeared from currentInvites
				const currentCodes = new Set(Array.from(currentInvites.values()).map((i) => i.code));
				for (const [cachedCode] of cachedInvites.entries()) {
					if (cachedCode !== "VANITY" && !currentCodes.has(cachedCode)) {
						inviteInfo.inviteCode = cachedCode;
						inviteInfo.joinType = Types.JoinType.Normal;
						newInviteMap.delete(cachedCode);
						break;
					}
				}
			}

			// If the queue for this guild has drained (no more pending joins), synchronize cache fully
			if (this.queue.getQueueDepth(guild.id) <= 1) {
				for (const inv of currentInvites.values()) {
					newInviteMap.set(inv.code, inv.uses || 0);
				}
			}

			// Update cache in-place with latest state for next queued member in this guild
			await this.invites.set(guild.id, newInviteMap);

			// 5. Persist record to storage
			await this.storage.recordJoin(inviteInfo).catch((err) => this.emitSafeError(err));

			// 6. Query updated inviter stats
			if (inviteInfo.inviterId) {
				try {
					inviteInfo.inviterStats = await this.storage.getMemberStats(
						guild.id,
						inviteInfo.inviterId
					);
				} catch {
					// Stats fetch failed gracefully
				}
			}

			// 7. Dispatch events to both Tracker and Client
			this.dispatchInviteJoin(member, inviteInfo);
		});
	}

	protected dispatchInviteJoin(member: GuildMember, info: Types.InviteInfo): void {
		this.emit("inviteJoin", member, info);

		if (this.options.emitOnClient) {
			this.client.emit("inviteJoin" as any, member, info);
		}
	}

	// ==========================================
	// Serialized Leave Reconciliation
	// ==========================================

	protected async inviteLeave(member: GuildMember): Promise<void> {
		if (this.isDestroyed || !member.guild) return;
		const guildId = member.guild.id;

		await this.queue.enqueue(guildId, async () => {
			let record: Types.InviteRecord | null = null;
			try {
				record = await this.storage.recordLeave(guildId, member.id);
			} catch (err: any) {
				this.emitSafeError(err);
			}

			this.emit("inviteLeave", member, record);

			if (this.options.emitOnClient) {
				this.client.emit("inviteLeave" as any, member, record);
			}
		});
	}

	// ==========================================
	// Fake Invite Detection Engine
	// ==========================================

	public async detectFakeInvite(member: GuildMember): Promise<boolean> {
		if (member.user.bot) return false;

		// 1. Check account creation age against threshold
		const accountAge = Date.now() - member.user.createdAt.getTime();
		if (accountAge < this.options.fakeThresholdMs) {
			return true;
		}

		// 2. Check rapid rejoin threshold via storage adapter
		try {
			const isRapidRejoin = await this.storage.isFakeRejoin(
				member.guild.id,
				member.id,
				this.options.rejoinThresholdMs
			);
			if (isRapidRejoin) {
				return true;
			}
		} catch {
			// Storage check failed gracefully
		}

		return false;
	}

	// ==========================================
	// Public Management & Analytics API
	// ==========================================

	/**
	 * Retrieve comprehensive invite stats for a member in a guild.
	 */
	public async getMemberStats(guildId: string, userId: string): Promise<Types.MemberInviteStats> {
		return this.storage.getMemberStats(guildId, userId);
	}

	/**
	 * Add or subtract bonus invites for a member in a guild.
	 */
	public async addBonusInvites(guildId: string, userId: string, amount: number): Promise<number> {
		return this.storage.addBonus(guildId, userId, amount);
	}

	/**
	 * Get current bonus invite points for a member in a guild.
	 */
	public async getBonusInvites(guildId: string, userId: string): Promise<number> {
		return this.storage.getBonus(guildId, userId);
	}

	/**
	 * Get guild invite leaderboard sorted by net valid invites.
	 */
	public async getLeaderboard(
		guildId: string,
		limit = 10
	): Promise<Array<{ userId: string; stats: Types.MemberInviteStats }>> {
		return this.storage.getLeaderboard(guildId, limit);
	}

	/**
	 * Manually resynchronize invite cache for a specific guild.
	 */
	public async syncGuild(guildOrId: Guild | string): Promise<number> {
		const guild =
			typeof guildOrId === "string" ? this.client.guilds.cache.get(guildOrId) : guildOrId;

		if (!guild) {
			throw new Error(`DisVite: Guild "${guildOrId}" is not cached or available.`);
		}

		const map = await this.cacheGuildInvitesForGuild(guild);
		return map.size;
	}

	/**
	 * Manually resynchronize invite cache across all guilds.
	 */
	public async syncAll(): Promise<void> {
		await this.cacheGuildInvites();
	}

	/**
	 * Teardown tracker: deregister client listeners, clear queues, close database.
	 */
	public async destroy(): Promise<void> {
		this.isDestroyed = true;

		// Unbind listeners from client
		this.client.off("ready", this.boundHandlers.ready);
		this.client.off("guildMemberAdd", this.boundHandlers.guildMemberAdd);
		this.client.off("guildMemberRemove", this.boundHandlers.guildMemberRemove);
		this.client.off("inviteCreate", this.boundHandlers.inviteCreate);
		this.client.off("inviteDelete", this.boundHandlers.inviteDelete);
		this.client.off("guildCreate", this.boundHandlers.guildCreate);
		this.client.off("guildDelete", this.boundHandlers.guildDelete);

		// Clear queues and cache
		this.queue.clear();
		await Promise.resolve(this.invites.clear());

		// Close storage
		if (this.storage.close) {
			await this.storage.close();
		}

		this.removeAllListeners();
		this.emitSafeDebug("DisVite: Tracker destroyed cleanly.");
	}
}
