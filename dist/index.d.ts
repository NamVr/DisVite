import { EventEmitter } from "events";
import { Client } from "discord.js";
export declare class InviteTracker extends EventEmitter {
    private client;
    private invites;
    constructor(client: Client, mongoURI: string);
    private connectToDatabase;
    private initialize;
    private cacheGuildInvitesForGuild;
    private cacheGuildInvites;
    private inviteJoin;
    private detectFakeInvite;
    private inviteLeave;
}
