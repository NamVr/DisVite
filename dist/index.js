"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InviteTracker = exports.getBonusInviteModel = exports.getInviteModel = exports.MongooseStorageAdapter = exports.MemoryStorageAdapter = exports.GuildTaskQueue = exports.InMemoryCacheStore = void 0;
const events_1 = require("events");
const discord_js_1 = require("discord.js");
const Types = __importStar(require("./types"));
const cacheStore_1 = require("./cacheStore");
const queue_1 = require("./queue");
const storage_1 = require("./storage");
// Re-export public types, schemas, and classes
__exportStar(require("./types"), exports);
var cacheStore_2 = require("./cacheStore");
Object.defineProperty(exports, "InMemoryCacheStore", { enumerable: true, get: function () { return cacheStore_2.InMemoryCacheStore; } });
var queue_2 = require("./queue");
Object.defineProperty(exports, "GuildTaskQueue", { enumerable: true, get: function () { return queue_2.GuildTaskQueue; } });
var storage_2 = require("./storage");
Object.defineProperty(exports, "MemoryStorageAdapter", { enumerable: true, get: function () { return storage_2.MemoryStorageAdapter; } });
Object.defineProperty(exports, "MongooseStorageAdapter", { enumerable: true, get: function () { return storage_2.MongooseStorageAdapter; } });
var inviteSchema_1 = require("./inviteSchema");
Object.defineProperty(exports, "getInviteModel", { enumerable: true, get: function () { return inviteSchema_1.getInviteModel; } });
Object.defineProperty(exports, "getBonusInviteModel", { enumerable: true, get: function () { return inviteSchema_1.getBonusInviteModel; } });
/**
 * High-performance, production-ready Discord invite tracking engine.
 */
class InviteTracker extends events_1.EventEmitter {
    /**
     * Creates an instance of InviteTracker.
     *
     * @param client The discord.js Client instance.
     * @param mongoURIOrOptions Either a MongoDB URI string (legacy) or InviteTrackerOptions.
     * @param options Optional InviteTrackerOptions when mongoURI is provided as 2nd argument.
     */
    constructor(client, mongoURIOrOptions, options) {
        super();
        this.boundHandlers = {};
        this.isDestroyed = false;
        this.client = client;
        let mergedOptions = {};
        if (typeof mongoURIOrOptions === "string") {
            mergedOptions = {
                mongoURI: mongoURIOrOptions,
                storage: "mongoose",
                ...options,
            };
        }
        else if (mongoURIOrOptions && typeof mongoURIOrOptions === "object") {
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
        this.invites = mergedOptions.cacheStore || new cacheStore_1.InMemoryCacheStore();
        this.queue = new queue_1.GuildTaskQueue();
        // Configure Storage Adapter
        if (mergedOptions.storage &&
            typeof mergedOptions.storage === "object" &&
            "recordJoin" in mergedOptions.storage) {
            this.storage = mergedOptions.storage;
        }
        else if (mergedOptions.storage === "mongoose" ||
            mergedOptions.mongoURI ||
            mergedOptions.mongooseConnection) {
            this.storage = new storage_1.MongooseStorageAdapter({
                mongoURI: mergedOptions.mongoURI,
                connection: mergedOptions.mongooseConnection,
                modelName: this.options.modelName,
                bonusModelName: this.options.bonusModelName,
                onError: (err) => this.emitSafeError(err),
                onDebug: (msg) => this.emitSafeDebug(msg),
            });
        }
        else {
            this.storage = new storage_1.MemoryStorageAdapter();
        }
        // Initialize storage asynchronously without unhandled promise rejections
        if (this.storage.init) {
            this.storage.init().catch((err) => {
                this.emitSafeError(err);
            });
        }
        this.registerGatewayListeners();
    }
    // ==========================================
    // Strongly Typed EventEmitter Overrides
    // ==========================================
    on(event, listener) {
        return super.on(event, listener);
    }
    once(event, listener) {
        return super.once(event, listener);
    }
    emit(event, ...args) {
        return super.emit(event, ...args);
    }
    off(event, listener) {
        return super.off(event, listener);
    }
    // ==========================================
    // Safe Internal Event Dispatchers (Zero Console Logs)
    // ==========================================
    emitSafeDebug(message) {
        if (this.options.verbose) {
            this.emit("debug", message);
        }
    }
    emitSafeWarn(message) {
        this.emit("warn", message);
    }
    emitSafeError(error) {
        if (this.listenerCount("error") > 0) {
            this.emit("error", error);
        }
    }
    // ==========================================
    // Gateway Initialization & Intent Validation
    // ==========================================
    validateGatewayIntents() {
        const clientIntents = this.client.options?.intents;
        if (!clientIntents)
            return;
        try {
            // Check GuildMembers and GuildInvites bits
            const membersBit = discord_js_1.GatewayIntentBits.GuildMembers;
            const invitesBit = discord_js_1.GatewayIntentBits.GuildInvites;
            let hasMembers = false;
            let hasInvites = false;
            if (typeof clientIntents === "number" || typeof clientIntents === "bigint") {
                const bitmask = BigInt(clientIntents);
                hasMembers = (bitmask & BigInt(membersBit)) !== BigInt(0);
                hasInvites = (bitmask & BigInt(invitesBit)) !== BigInt(0);
            }
            else if (Array.isArray(clientIntents)) {
                hasMembers = clientIntents.includes(membersBit) || clientIntents.includes("GuildMembers");
                hasInvites = clientIntents.includes(invitesBit) || clientIntents.includes("GuildInvites");
            }
            if (!hasMembers) {
                this.emitSafeWarn("DisVite: GuildMembers gateway intent is missing. Tracking member joins and leaves will fail. Enable GuildMembers in client options and Discord Developer Portal.");
            }
            if (!hasInvites) {
                this.emitSafeWarn("DisVite: GuildInvites gateway intent is missing. Real-time invite tracking requires GuildInvites in client options.");
            }
        }
        catch {
            // Intent check failed gracefully without throwing
        }
    }
    registerGatewayListeners() {
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
            guildMemberAdd: (member) => {
                this.inviteJoin(member).catch((err) => this.emitSafeError(err));
            },
            guildMemberRemove: (member) => {
                this.inviteLeave(member).catch((err) => this.emitSafeError(err));
            },
            inviteCreate: (invite) => {
                this.handleInviteCreate(invite);
            },
            inviteDelete: (invite) => {
                this.handleInviteDelete(invite);
            },
            guildCreate: (guild) => {
                this.cacheGuildInvitesForGuild(guild).catch((err) => this.emitSafeError(err));
            },
            guildDelete: (guild) => {
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
        }
        else {
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
    handleInviteCreate(invite) {
        if (this.isDestroyed || !invite.guild)
            return;
        const guildId = invite.guild.id;
        if (this.invites.setInviteUses) {
            this.invites.setInviteUses(guildId, invite.code, invite.uses || 0);
        }
        else {
            const current = this.invites.get(guildId);
            if (current instanceof Map) {
                current.set(invite.code, invite.uses || 0);
                this.invites.set(guildId, current);
            }
        }
        this.emit("inviteCreate", invite);
        this.emitSafeDebug(`DisVite: Added invite ${invite.code} to cache for guild ${guildId} [O(1)].`);
    }
    handleInviteDelete(invite) {
        if (this.isDestroyed || !invite.guild)
            return;
        const guildId = invite.guild.id;
        if (this.invites.deleteInvite) {
            this.invites.deleteInvite(guildId, invite.code);
        }
        else {
            const current = this.invites.get(guildId);
            if (current instanceof Map) {
                current.delete(invite.code);
                this.invites.set(guildId, current);
            }
        }
        this.emit("inviteDelete", invite);
        this.emitSafeDebug(`DisVite: Removed invite ${invite.code} from cache for guild ${guildId} [O(1)].`);
    }
    handleGuildDelete(guild) {
        if (this.isDestroyed)
            return;
        Promise.resolve(this.invites.delete(guild.id)).catch((err) => this.emitSafeError(err));
        this.emitSafeDebug(`DisVite: Evicted cache for removed guild ${guild.id}.`);
    }
    // ==========================================
    // Permission-Safe Guild Invites Caching
    // ==========================================
    hasManageGuildPermission(guild) {
        try {
            const me = guild.members.me;
            if (!me)
                return true; // optimistic if me is not cached
            return me.permissions.has(discord_js_1.PermissionFlagsBits.ManageGuild);
        }
        catch {
            return false;
        }
    }
    /**
     * Cache all invites for a specific guild safely.
     */
    async cacheGuildInvitesForGuild(guild, attempt = 1) {
        if (this.isDestroyed || !guild.available) {
            return new Map();
        }
        // Pre-flight permission check
        if (!this.hasManageGuildPermission(guild)) {
            this.emitSafeWarn(`DisVite: Bot lacks ManageGuild permission in guild "${guild.name}" (${guild.id}). Unable to fetch invites.`);
            return new Map();
        }
        try {
            const fetchedInvites = await guild.invites.fetch();
            const inviteMap = new Map();
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
                }
                catch {
                    // Vanity fetch failed gracefully without crashing
                }
            }
            await this.invites.set(guild.id, inviteMap);
            this.emit("guildSync", guild.id, inviteMap.size);
            this.emitSafeDebug(`DisVite: Cached ${inviteMap.size} invites for guild ${guild.id}.`);
            return inviteMap;
        }
        catch (error) {
            if (attempt < 3) {
                this.emitSafeDebug(`DisVite: Retrying invite fetch for guild ${guild.id} (Attempt ${attempt + 1}/3)...`);
                await new Promise((resolve) => setTimeout(resolve, 1500));
                return this.cacheGuildInvitesForGuild(guild, attempt + 1);
            }
            this.emitSafeWarn(`DisVite: Failed to fetch invites for guild ${guild.id} after 3 attempts: ${error?.message || error}`);
            return new Map();
        }
    }
    /**
     * Cache invites for all guilds with throttled concurrency to avoid 429s.
     */
    async cacheGuildInvites() {
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
    async inviteJoin(member) {
        if (this.isDestroyed)
            return;
        const { guild } = member;
        // Serialize execution per guild to eliminate race conditions during join storms
        await this.queue.enqueue(guild.id, async () => {
            // 1. Bot Join Detection (Bots use OAuth2 authorization, not member invites!)
            if (member.user.bot) {
                if (!this.options.trackBots)
                    return;
                const botInfo = {
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
            const inviteInfo = {
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
            }
            catch (error) {
                this.emitSafeWarn(`DisVite: Failed to fetch fresh invites during join in ${guild.id}: ${error?.message || error}`);
                await this.storage.recordJoin(inviteInfo).catch((err) => this.emitSafeError(err));
                this.dispatchInviteJoin(member, inviteInfo);
                return;
            }
            // 3. Diff current invites against cached invites
            const usedInvite = currentInvites.find((inv) => (inv.uses || 0) > (cachedInvites.get(inv.code) || 0));
            // Copy current cache as base to support delta credit smoothing during join storms
            const newInviteMap = new Map(cachedInvites);
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
            }
            else if (guild.vanityURLCode) {
                // 4. Check Vanity URL single-fetch if no regular invite changed
                const oldVanityUses = cachedInvites.get("VANITY") || 0;
                try {
                    const vanityData = await guild.fetchVanityData();
                    const currentVanityUses = vanityData?.uses || 0;
                    if (currentVanityUses > oldVanityUses) {
                        inviteInfo.inviteCode = guild.vanityURLCode;
                        inviteInfo.joinType = Types.JoinType.Vanity;
                        newInviteMap.set("VANITY", oldVanityUses + 1);
                    }
                    else {
                        newInviteMap.set("VANITY", currentVanityUses);
                    }
                }
                catch {
                    // Vanity check failed gracefully
                }
            }
            else {
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
                    inviteInfo.inviterStats = await this.storage.getMemberStats(guild.id, inviteInfo.inviterId);
                }
                catch {
                    // Stats fetch failed gracefully
                }
            }
            // 7. Dispatch events to both Tracker and Client
            this.dispatchInviteJoin(member, inviteInfo);
        });
    }
    dispatchInviteJoin(member, info) {
        this.emit("inviteJoin", member, info);
        if (this.options.emitOnClient) {
            this.client.emit("inviteJoin", member, info);
        }
    }
    // ==========================================
    // Serialized Leave Reconciliation
    // ==========================================
    async inviteLeave(member) {
        if (this.isDestroyed || !member.guild)
            return;
        const guildId = member.guild.id;
        await this.queue.enqueue(guildId, async () => {
            let record = null;
            try {
                record = await this.storage.recordLeave(guildId, member.id);
            }
            catch (err) {
                this.emitSafeError(err);
            }
            this.emit("inviteLeave", member, record);
            if (this.options.emitOnClient) {
                this.client.emit("inviteLeave", member, record);
            }
        });
    }
    // ==========================================
    // Fake Invite Detection Engine
    // ==========================================
    async detectFakeInvite(member) {
        if (member.user.bot)
            return false;
        // 1. Check account creation age against threshold
        const accountAge = Date.now() - member.user.createdAt.getTime();
        if (accountAge < this.options.fakeThresholdMs) {
            return true;
        }
        // 2. Check rapid rejoin threshold via storage adapter
        try {
            const isRapidRejoin = await this.storage.isFakeRejoin(member.guild.id, member.id, this.options.rejoinThresholdMs);
            if (isRapidRejoin) {
                return true;
            }
        }
        catch {
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
    async getMemberStats(guildId, userId) {
        return this.storage.getMemberStats(guildId, userId);
    }
    /**
     * Add or subtract bonus invites for a member in a guild.
     */
    async addBonusInvites(guildId, userId, amount) {
        return this.storage.addBonus(guildId, userId, amount);
    }
    /**
     * Get current bonus invite points for a member in a guild.
     */
    async getBonusInvites(guildId, userId) {
        return this.storage.getBonus(guildId, userId);
    }
    /**
     * Get guild invite leaderboard sorted by net valid invites.
     */
    async getLeaderboard(guildId, limit = 10) {
        return this.storage.getLeaderboard(guildId, limit);
    }
    /**
     * Manually resynchronize invite cache for a specific guild.
     */
    async syncGuild(guildOrId) {
        const guild = typeof guildOrId === "string" ? this.client.guilds.cache.get(guildOrId) : guildOrId;
        if (!guild) {
            throw new Error(`DisVite: Guild "${guildOrId}" is not cached or available.`);
        }
        const map = await this.cacheGuildInvitesForGuild(guild);
        return map.size;
    }
    /**
     * Manually resynchronize invite cache across all guilds.
     */
    async syncAll() {
        await this.cacheGuildInvites();
    }
    /**
     * Teardown tracker: deregister client listeners, clear queues, close database.
     */
    async destroy() {
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
exports.InviteTracker = InviteTracker;
