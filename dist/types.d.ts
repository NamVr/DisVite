import type { GuildMember, Invite } from "discord.js";
/**
 * Enum representing the type of join for an invite.
 */
export declare enum JoinType {
    /**
     * A standard invite join created by a user.
     */
    Normal = "normal",
    /**
     * A join using the server's vanity URL.
     */
    Vanity = "vanity",
    /**
     * A bot account joined via OAuth2 bot authorization URL.
     */
    Bot = "bot",
    /**
     * An invite join that could not be determined (e.g., deleted single-use invite, missing permissions).
     */
    Unknown = "unknown"
}
/**
 * Breakdown of member invitation statistics.
 */
export interface MemberInviteStats {
    /**
     * Total recorded joins attributed to this member.
     */
    total: number;
    /**
     * Current net valid invites (total - left - fake + bonus).
     */
    valid: number;
    /**
     * Number of invited users who later left the server.
     */
    left: number;
    /**
     * Number of joins flagged as fake (e.g., young account or rapid rejoin).
     */
    fake: number;
    /**
     * Manually granted or deducted bonus invite points.
     */
    bonus: number;
}
/**
 * Interface representing metadata about an invite join event.
 */
export interface InviteInfo {
    /**
     * The ID of the guild where the join took place.
     */
    guildId: string;
    /**
     * The Discord User ID of the member who joined.
     */
    inviteeId: string;
    /**
     * The Discord User ID of the member who created the invite (null/undefined if vanity or unknown).
     */
    inviterId?: string | null;
    /**
     * The invite code string used to join (e.g. 'discord.gg/abc' -> 'abc').
     */
    inviteCode?: string | null;
    /**
     * The resolved category of join.
     */
    joinType: JoinType;
    /**
     * Whether this join was flagged as fake (account age or rapid rejoin loop).
     */
    fake: boolean;
    /**
     * Timestamp when the member joined.
     */
    joinedAt: Date;
    /**
     * Snapshot of the inviter's updated invite statistics, if resolved.
     */
    inviterStats?: MemberInviteStats;
}
/**
 * Stored invite record for persistence layers.
 */
export interface InviteRecord {
    /**
     * The ID of the guild.
     */
    guildId: string;
    /**
     * The ID of the user who joined.
     */
    inviteeId: string;
    /**
     * The ID of the inviter user, or null if unknown/vanity/bot.
     */
    inviterId?: string | null;
    /**
     * The invite code used, or null.
     */
    inviteCode?: string | null;
    /**
     * The type of join.
     */
    joinType: JoinType | "normal" | "vanity" | "bot" | "unknown";
    /**
     * Timestamp when user joined.
     */
    joinedAt: Date;
    /**
     * Timestamp when user left, if applicable.
     */
    leftAt?: Date | null;
    /**
     * Whether this join was flagged as fake.
     */
    fake: boolean;
}
/**
 * Backwards compatibility interface for Mongoose document records.
 */
export interface InviteSchema {
    guildId: string;
    inviteeId: string;
    inviterId?: string | null;
    inviteCode?: string | null;
    joinType: "normal" | "vanity" | "unknown" | "bot";
    joinedAt: Date;
    leftAt?: Date | null;
    fake: boolean;
}
/**
 * Storage adapter interface to support pluggable backends (In-Memory, Mongoose, Redis, Prisma, etc.).
 */
export interface StorageAdapter {
    /**
     * Optional lifecycle hook to initialize the storage connection.
     */
    init?(): Promise<void>;
    /**
     * Record a member join event.
     */
    recordJoin(record: Omit<InviteRecord, "leftAt">): Promise<InviteRecord>;
    /**
     * Record a member leave event by updating the latest active join record.
     */
    recordLeave(guildId: string, inviteeId: string): Promise<InviteRecord | null>;
    /**
     * Fetch cumulative invite statistics for a user in a guild.
     */
    getMemberStats(guildId: string, userId: string): Promise<MemberInviteStats>;
    /**
     * Fetch top inviters for a guild ordered by net valid invites.
     */
    getLeaderboard(guildId: string, limit?: number): Promise<Array<{
        userId: string;
        stats: MemberInviteStats;
    }>>;
    /**
     * Add or subtract bonus invites for a user in a guild.
     */
    addBonus(guildId: string, userId: string, amount: number): Promise<number>;
    /**
     * Get current bonus invites for a user in a guild.
     */
    getBonus(guildId: string, userId: string): Promise<number>;
    /**
     * Check whether a user recently left this guild within the specified threshold milliseconds.
     */
    isFakeRejoin(guildId: string, inviteeId: string, thresholdMs: number): Promise<boolean>;
    /**
     * Optional lifecycle hook to close database connections upon teardown.
     */
    close?(): Promise<void>;
}
/**
 * Interface representing a cache store for holding guild invite codes and use counts.
 */
export interface CacheStore {
    /**
     * Retrieve cached invites mapping (invite code -> use count) for a guild.
     */
    get(guildId: string): Promise<Map<string, number> | undefined> | Map<string, number> | undefined;
    /**
     * Store invites mapping for a guild.
     */
    set(guildId: string, invites: Map<string, number>): Promise<void> | void;
    /**
     * Remove a guild's invites from the cache.
     */
    delete(guildId: string): Promise<void> | void;
    /**
     * Clear all cached invites across all guilds.
     */
    clear(): Promise<void> | void;
    /**
     * O(1) fetch of single invite code use count.
     */
    getInviteUses?(guildId: string, code: string): Promise<number | undefined> | number | undefined;
    /**
     * O(1) update of single invite code use count.
     */
    setInviteUses?(guildId: string, code: string, uses: number): Promise<void> | void;
    /**
     * O(1) removal of single invite code from cache.
     */
    deleteInvite?(guildId: string, code: string): Promise<void> | void;
}
/**
 * Configuration options for DisVite InviteTracker.
 */
export interface InviteTrackerOptions {
    /**
     * Selected storage engine: 'memory', 'mongoose', or a custom StorageAdapter instance.
     * Default: 'memory' if no mongoURI provided; 'mongoose' if mongoURI is supplied.
     */
    storage?: "memory" | "mongoose" | StorageAdapter;
    /**
     * Legacy MongoDB connection URI (backwards compatibility).
     */
    mongoURI?: string;
    /**
     * Mongoose collection model name for invite join logs (default: "inviteSchema").
     */
    modelName?: string;
    /**
     * Mongoose collection model name for bonus invites (default: "bonusInviteSchema").
     */
    bonusModelName?: string;
    /**
     * Existing Mongoose connection to reuse rather than establishing a new global connection.
     */
    mongooseConnection?: any;
    /**
     * Custom cache store implementation. Defaults to InMemoryCacheStore.
     */
    cacheStore?: CacheStore;
    /**
     * Maximum account age in milliseconds below which an account is flagged as fake.
     * Default: 7 days (604,800,000 ms).
     */
    fakeThresholdMs?: number;
    /**
     * Maximum duration in milliseconds between a member's previous leave and rejoin
     * to flag as a fake re-join loop. Default: 7 days (604,800,000 ms).
     */
    rejoinThresholdMs?: number;
    /**
     * If true, emits verbose debug events. (No direct console logging).
     */
    verbose?: boolean;
    /**
     * Whether to also mirror invite events onto the discord.js Client instance for backwards compatibility.
     * Default: true.
     */
    emitOnClient?: boolean;
    /**
     * Concurrency batch limit when fetching invites across all guilds at startup.
     * Default: 3.
     */
    concurrency?: number;
    /**
     * Whether to track bot accounts joining the server (emits with JoinType.Bot).
     * Default: true.
     */
    trackBots?: boolean;
}
/**
 * Strongly typed DisVite event map.
 */
export interface InviteTrackerEvents {
    inviteJoin: [member: GuildMember, inviteInfo: InviteInfo];
    inviteLeave: [member: GuildMember, record: InviteRecord | null];
    inviteCreate: [invite: Invite];
    inviteDelete: [invite: Invite];
    guildSync: [guildId: string, inviteCount: number];
    ready: [];
    error: [error: Error];
    warn: [message: string];
    debug: [message: string];
}
