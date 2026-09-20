import { EventEmitter } from "events";
import { Client, Guild, GuildMember, Invite } from "discord.js";
import * as Types from "./types";
import { GuildTaskQueue } from "./queue";
export * from "./types";
export { InMemoryCacheStore } from "./cacheStore";
export { GuildTaskQueue } from "./queue";
export { MemoryStorageAdapter, MongooseStorageAdapter, MongooseStorageOptions } from "./storage";
export { getInviteModel, getBonusInviteModel, BonusInviteDocument } from "./inviteSchema";
/**
 * High-performance, production-ready Discord invite tracking engine.
 */
export declare class InviteTracker extends EventEmitter {
    client: Client;
    invites: Types.CacheStore;
    storage: Types.StorageAdapter;
    protected options: Required<Omit<Types.InviteTrackerOptions, "mongoURI" | "mongooseConnection" | "cacheStore" | "storage">> & {
        storage?: "memory" | "mongoose" | Types.StorageAdapter;
        mongoURI?: string;
        mongooseConnection?: any;
        cacheStore?: Types.CacheStore;
    };
    protected queue: GuildTaskQueue;
    private boundHandlers;
    private isDestroyed;
    /**
     * Creates an instance of InviteTracker.
     *
     * @param client The discord.js Client instance.
     * @param mongoURIOrOptions Either a MongoDB URI string (legacy) or InviteTrackerOptions.
     * @param options Optional InviteTrackerOptions when mongoURI is provided as 2nd argument.
     */
    constructor(client: Client, mongoURIOrOptions?: string | Types.InviteTrackerOptions, options?: Types.InviteTrackerOptions);
    on<K extends keyof Types.InviteTrackerEvents>(event: K, listener: (...args: Types.InviteTrackerEvents[K]) => void): this;
    once<K extends keyof Types.InviteTrackerEvents>(event: K, listener: (...args: Types.InviteTrackerEvents[K]) => void): this;
    emit<K extends keyof Types.InviteTrackerEvents>(event: K, ...args: Types.InviteTrackerEvents[K]): boolean;
    off<K extends keyof Types.InviteTrackerEvents>(event: K, listener: (...args: Types.InviteTrackerEvents[K]) => void): this;
    protected emitSafeDebug(message: string): void;
    protected emitSafeWarn(message: string): void;
    protected emitSafeError(error: Error): void;
    protected validateGatewayIntents(): void;
    protected registerGatewayListeners(): void;
    protected handleInviteCreate(invite: Invite): void;
    protected handleInviteDelete(invite: Invite): void;
    protected handleGuildDelete(guild: Guild): void;
    protected hasManageGuildPermission(guild: Guild): boolean;
    /**
     * Cache all invites for a specific guild safely.
     */
    cacheGuildInvitesForGuild(guild: Guild, attempt?: number): Promise<Map<string, number>>;
    /**
     * Cache invites for all guilds with throttled concurrency to avoid 429s.
     */
    cacheGuildInvites(): Promise<void>;
    protected inviteJoin(member: GuildMember): Promise<void>;
    protected dispatchInviteJoin(member: GuildMember, info: Types.InviteInfo): void;
    protected inviteLeave(member: GuildMember): Promise<void>;
    detectFakeInvite(member: GuildMember): Promise<boolean>;
    /**
     * Retrieve comprehensive invite stats for a member in a guild.
     */
    getMemberStats(guildId: string, userId: string): Promise<Types.MemberInviteStats>;
    /**
     * Add or subtract bonus invites for a member in a guild.
     */
    addBonusInvites(guildId: string, userId: string, amount: number): Promise<number>;
    /**
     * Get current bonus invite points for a member in a guild.
     */
    getBonusInvites(guildId: string, userId: string): Promise<number>;
    /**
     * Get guild invite leaderboard sorted by net valid invites.
     */
    getLeaderboard(guildId: string, limit?: number): Promise<Array<{
        userId: string;
        stats: Types.MemberInviteStats;
    }>>;
    /**
     * Manually resynchronize invite cache for a specific guild.
     */
    syncGuild(guildOrId: Guild | string): Promise<number>;
    /**
     * Manually resynchronize invite cache across all guilds.
     */
    syncAll(): Promise<void>;
    /**
     * Teardown tracker: deregister client listeners, clear queues, close database.
     */
    destroy(): Promise<void>;
}
