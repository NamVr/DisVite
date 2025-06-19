import { EventEmitter } from "events";
import { Model, Document } from "mongoose";
import { Client, Collection, GuildMember, Guild } from "discord.js";
import * as Types from "./types";
export * from "./types";
export declare class InviteTracker extends EventEmitter {
    client: Client;
    invites: Map<string, Collection<string, number>>;
    protected inviteModel: Model<Types.InviteSchema & Document>;
    protected options: Types.InviteTrackerOptions | undefined;
    constructor(client: Client, mongoURI: string, options?: Types.InviteTrackerOptions);
    protected connectToDatabase(mongoURI: string, attempt?: number): Promise<void>;
    protected initialize(): void;
    protected cacheGuildInvitesForGuild(guild: Guild, attempt?: number): Promise<void>;
    protected cacheGuildInvites(): Promise<void>;
    protected inviteJoin(member: GuildMember): Promise<void>;
    protected detectFakeInvite(member: GuildMember): Promise<boolean>;
    protected inviteLeave(member: GuildMember): Promise<void>;
}
