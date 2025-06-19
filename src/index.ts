import { EventEmitter } from "events";
import mongoose, { Model, Document } from "mongoose";
import { Client, Collection, GuildMember, Guild } from "discord.js";
import * as Types from "./types";
import { getInviteModel } from "./inviteSchema";

// Export types and schema for external use.
export * as InviteTrackerTypes from "./types";
export * as InviteTrackerSchema from "./inviteSchema";

export class InviteTracker extends EventEmitter {
	public client: Client;
	public invites = new Map<string, Collection<string, number>>();

	protected inviteModel: Model<Types.InviteSchema & Document>;
	protected options: Types.InviteTrackerOptions | undefined;

	// TODO: Add queue system to handle invite tracking in case of high traffic.
	constructor(
		client: Client,
		mongoURI: string,
		options?: Types.InviteTrackerOptions
	) {
		super();
		this.client = client;
		this.options = {
			modelName: "inviteSchema",
			verbose: false,
			...options,
		};
		this.inviteModel = getInviteModel(options?.modelName);
		this.connectToDatabase(mongoURI);
		this.initialize();
	}

	protected async connectToDatabase(mongoURI: string, attempt = 1) {
		try {
			await mongoose.connect(mongoURI);
			if (this.options?.verbose)
				console.info("DisVite: Connected to MongoDB");
		} catch (error) {
			if (this.options?.verbose)
				console.error("DisVite: Failed to connect to MongoDB\n", error);

			if (attempt < 3) {
				if (this.options?.verbose)
					console.warn(
						`DisVite: Retrying to connect to MongoDB (Attempt ${
							attempt + 1
						})`
					);
				await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds before retrying
				await this.connectToDatabase(mongoURI, attempt + 1);
			} else {
				console.error(
					"DisVite: Failed to connect to MongoDB after 3 attempts"
				);
				throw new Error("DisVite: MongoDB connection impossible.");
			}
		}
	}

	protected initialize() {
		this.client.once("ready", () => {
			this.cacheGuildInvites();
			if (this.options?.verbose)
				console.info(`DisVite: Logged in as ${this.client.user?.tag}`);
		});

		this.client.on("guildMemberAdd", (member) => this.inviteJoin(member));
		this.client.on("guildMemberRemove", (member) =>
			this.inviteLeave(member as GuildMember)
		);

		// Cache invites on each invite update.
		this.client.on("inviteCreate", (invite) => {
			if (invite.guild && invite.guild instanceof Guild) {
				this.cacheGuildInvitesForGuild(invite.guild);
			}
		});
		this.client.on("inviteDelete", (invite) => {
			if (invite.guild && invite.guild instanceof Guild) {
				this.cacheGuildInvitesForGuild(invite.guild);
			}
		});
	}

	// Cache invites for a single guild, including vanity.
	protected async cacheGuildInvitesForGuild(guild: Guild, attempt = 1) {
		try {
			const fetchedInvites = await guild.invites.fetch();
			const inviteCollection = new Collection<string, number>();
			fetchedInvites.forEach((invite) => {
				inviteCollection.set(invite.code, invite.uses || 0);
			});

			// Handle vanity URL for tier 3 servers.
			if (guild.vanityURLCode) {
				try {
					const vanityData = await guild.fetchVanityData();
					inviteCollection.set("VANITY", vanityData.uses || 0);
				} catch (err) {
					if (this.options?.verbose)
						console.warn(
							`DisVite: Failed to fetch vanity data for guild ${guild.id}`
						);
				}
			}
			this.invites.set(guild.id, inviteCollection);
		} catch (error) {
			if (this.options?.verbose)
				console.error(
					`DisVite: Failed to fetch invites for guild ${guild.id}\n`,
					error
				);

			if (attempt < 3) {
				// Retry fetching invites if it fails, up to 3 attempts.
				if (this.options?.verbose)
					console.warn(
						`DisVite: Retrying to fetch invites for guild ${
							guild.id
						} (Attempt ${attempt + 1})`
					);
				await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds before retrying
				await this.cacheGuildInvitesForGuild(guild, attempt + 1);
			} else {
				if (this.options?.verbose)
					console.error(
						`DisVite: Failed to fetch invites for guild ${guild.id} after 3 attempts`
					);
			}
		}
	}

	protected async cacheGuildInvites() {
		for (const guild of this.client.guilds.cache.values()) {
			await this.cacheGuildInvitesForGuild(guild);
		}
	}

	protected async inviteJoin(member: GuildMember) {
		const { guild } = member;
		const cachedInvites = this.invites.get(guild.id);

		// InviteInfo Object for output.
		const inviteInfo: Types.InviteInfo = {
			joinType: Types.JoinType.Unknown, // Default to unknown
			guildId: guild.id,
			inviteeId: member.id,
			fake: await this.detectFakeInvite(member), // Fake invite detection technology.
			joinedAt: new Date(),
		};

		if (!cachedInvites) {
			await this.cacheGuildInvitesForGuild(guild); // Try to cache for next time
			this.client.emit("inviteJoin", member, inviteInfo);
			return;
		}

		// 1. Fetch current invites to find the one with an increased user count.
		const newInvites = await guild.invites.fetch();
		const usedInvite = newInvites.find(
			(inv) => (inv.uses || 0) > (cachedInvites.get(inv.code) || 0)
		);

		// *. Update cache for synchronization.
		await this.cacheGuildInvitesForGuild(guild);

		// 2. If a used invite is found, emit an event with the invite details.
		if (usedInvite) {
			inviteInfo.inviterId = usedInvite.inviter?.id;
			inviteInfo.inviteCode = usedInvite.code;
			inviteInfo.joinType =
				usedInvite.code === guild.vanityURLCode
					? Types.JoinType.Vanity
					: Types.JoinType.Normal;
		} else if (guild.vanityURLCode) {
			// 3. If no invite was used, but the guild has a vanity URL, treat it as a vanity join.
			const oldVanityUses = cachedInvites.get("VANITY") || 0;
			const newVanityUses = (await guild.fetchVanityData()).uses || 0;

			if (newVanityUses > oldVanityUses) {
				inviteInfo.inviteCode = guild.vanityURLCode;
				inviteInfo.joinType = Types.JoinType.Vanity;
			}
		}

		// *. Update the vanity uses in the cache (always for more accuracy).
		if (guild.vanityURLCode) {
			try {
				const latestVanityData = await guild.fetchVanityData();
				cachedInvites.set("VANITY", latestVanityData.uses || 0);
			} catch (err) {
				if (this.options?.verbose)
					console.warn(
						`DisVite: Failed to fetch vanity data for guild ${guild.id}`
					);
			}
		}
		//cachedInvites.set("VANITY", newVanityUses);

		// 4. Save to Database.
		const inviteData = new this.inviteModel({
			guildId: guild.id,
			inviteeId: member.id,
			inviterId: inviteInfo.inviterId || null,
			inviteCode: inviteInfo.inviteCode || null,
			joinType: inviteInfo.joinType,
			joinedAt: new Date(),
			leftAt: null, // Set to null initially
		});

		await inviteData.save().catch((error) => {
			if (this.options?.verbose)
				console.error(
					`DisVite: Failed to save invite data for ${member.id} in guild ${guild.id}\n`,
					error
				);
		});

		// 5. Emit an event with the invite info.
		this.client.emit("inviteJoin", member, inviteInfo);
	}

	protected async detectFakeInvite(member: GuildMember): Promise<boolean> {
		// Check account age (default is 7 days).
		const accountAgeLimit = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
		const accountAge = Date.now() - member.user.createdAt.getTime();

		if (accountAge < accountAgeLimit) {
			return true;
		}

		// Check if account has re-joined the guild multiple times using leftAt.
		const recentInvites = await this.inviteModel
			.find({
				guildId: member.guild.id,
				inviteeId: member.id,
				leftAt: { $ne: null },
			})
			.sort({ leftAt: -1 });

		// If the user has left and re-joined the guild multiple times, compare his last leftAt.
		if (recentInvites.length > 0) {
			const lastLeftAt = recentInvites[0].leftAt as Date;
			const rejoinThreshold = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
			if (Date.now() - lastLeftAt.getTime() < rejoinThreshold) {
				return true;
			}
		}

		// Otherwise, this is not a fake invite.
		return false;
	}

	protected async inviteLeave(member: GuildMember) {
		// Find the latest join record to update leftAt.
		const joinRecord = await this.inviteModel
			.findOne({
				guildId: member.guild.id,
				inviteeId: member.id,
				leftAt: null, // Only update the latest join record
			})
			.sort({ joinedAt: -1 });

		if (joinRecord) {
			joinRecord.leftAt = new Date(); // Set the leftAt timestamp.
			await joinRecord.save().catch((error) => {
				if (this.options?.verbose)
					console.error(
						`DisVite: Failed to update leftAt for ${member.id} in guild ${member.guild.id}\n`,
						error
					);
			});
		}

		// Finally emit the custom leave event.
		this.client.emit("inviteLeave", member, joinRecord);
	}
}
