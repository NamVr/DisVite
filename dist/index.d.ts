import { EventEmitter } from "events";
import { Client, Collection, GuildMember, Guild } from "discord.js";
export * as InviteTrackerTypes from "./types";
export * as InviteTrackerSchema from "./inviteSchema";
export declare class InviteTracker extends EventEmitter {
    client: Client;
    invites: Map<string, Collection<string, number>>;
    constructor(client: Client, mongoURI: string);
    protected connectToDatabase(mongoURI: string, attempt?: number): Promise<void>;
    protected initialize(): void;
    protected cacheGuildInvitesForGuild(guild: Guild, attempt?: number): Promise<void>;
    protected cacheGuildInvites(): Promise<void>;
    protected inviteJoin(member: GuildMember): Promise<void>;
    protected detectFakeInvite(member: GuildMember): Promise<boolean>;
    protected inviteLeave(member: GuildMember): Promise<void>;
}
