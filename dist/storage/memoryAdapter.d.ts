import { InviteRecord, MemberInviteStats, StorageAdapter } from "../types";
/**
 * Ultra-fast, zero-dependency in-memory storage adapter.
 * Ideal for development, testing, lightweight bots, or bots that manage
 * their own persistent storage via event listeners.
 */
export declare class MemoryStorageAdapter implements StorageAdapter {
    private records;
    private bonusInvites;
    private getBonusKey;
    recordJoin(record: Omit<InviteRecord, "leftAt">): Promise<InviteRecord>;
    recordLeave(guildId: string, inviteeId: string): Promise<InviteRecord | null>;
    getMemberStats(guildId: string, userId: string): Promise<MemberInviteStats>;
    getLeaderboard(guildId: string, limit?: number): Promise<Array<{
        userId: string;
        stats: MemberInviteStats;
    }>>;
    addBonus(guildId: string, userId: string, amount: number): Promise<number>;
    getBonus(guildId: string, userId: string): Promise<number>;
    isFakeRejoin(guildId: string, inviteeId: string, thresholdMs: number): Promise<boolean>;
    clear(): Promise<void>;
}
