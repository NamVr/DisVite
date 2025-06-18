import { EventEmitter } from "events";
import mongoose from "mongoose";
import { Client, Collection, GuildMember } from "discord.js";
import * as Types from "./types";

export class InviteTracker extends EventEmitter {
	private client: Client;
	private invites = new Map<string, Collection<string, number>>();

	// TODO: Add verbose option to the constructor to enable/disable verbose logging.
	constructor(client: Client, mongoURI: string) {
		super();
		this.client = client;
		this.connectToDatabase(mongoURI);
		this.initialize();
	}

	private async connectToDatabase(mongoURI: string) {
		try {
			await mongoose.connect(mongoURI);
			console.log("Discord Invite Tracker: Connected to MongoDB");
		} catch (error) {
			console.error(
				"Discord Invite Tracker: Failed to connect to MongoDB\n",
				error
			);
			process.exit(1); // Exit the process if the connection fails
		}
	}

	private initialize() {
		this.client.once("ready", () => {
			this.cacheGuildInvites();
			console.log(
				`Discord Invite Tracker: Logged in as ${this.client.user?.tag}`
			);
		});

		this.client.on("guildMemberAdd", (member) => this.onInviteJoin(member));
		this.client.on("guildMemberRemove", (member) =>
			this.onInviteLeave(member as GuildMember)
		);
	}

	private async cacheGuildInvites() {
		for (const [guildId, guild] of this.client.guilds.cache) {
			try {
				const fetchedInvites = await guild.invites.fetch();
				const inviteCollection = new Collection<string, number>();
				fetchedInvites.forEach((invite) => {
					inviteCollection.set(invite.code, invite.uses || 0);
				});
				this.invites.set(guildId, inviteCollection);
			} catch (error) {
				console.error(
					`Discord Invite Tracker: Failed to fetch invites for guild ${guildId}\n`
				);
			}
		}
	}

	private async onInviteJoin(member: GuildMember) {}

	private async onInviteLeave(member: GuildMember) {}
}
