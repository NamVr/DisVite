import { Connection } from "mongoose";
import { InviteRecord, MemberInviteStats, StorageAdapter } from "../types";
export interface MongooseStorageOptions {
    mongoURI?: string;
    connection?: Connection;
    modelName?: string;
    bonusModelName?: string;
    onError?: (error: Error) => void;
    onDebug?: (message: string) => void;
}
/**
 * Production-ready Mongoose persistence adapter with single-roundtrip aggregations,
 * connection sharing, and atomic bonus counters.
 */
export declare class MongooseStorageAdapter implements StorageAdapter {
    private inviteModel;
    private bonusModel;
    private options;
    private ownsConnection;
    constructor(options: MongooseStorageOptions);
    init(): Promise<void>;
    private connectWithRetry;
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
    close(): Promise<void>;
}
