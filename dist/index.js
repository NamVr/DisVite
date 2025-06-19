"use strict";
var __createBinding =
	(this && this.__createBinding) ||
	(Object.create
		? function (o, m, k, k2) {
				if (k2 === undefined) k2 = k;
				var desc = Object.getOwnPropertyDescriptor(m, k);
				if (
					!desc ||
					("get" in desc
						? !m.__esModule
						: desc.writable || desc.configurable)
				) {
					desc = {
						enumerable: true,
						get: function () {
							return m[k];
						},
					};
				}
				Object.defineProperty(o, k2, desc);
		  }
		: function (o, m, k, k2) {
				if (k2 === undefined) k2 = k;
				o[k2] = m[k];
		  });
var __setModuleDefault =
	(this && this.__setModuleDefault) ||
	(Object.create
		? function (o, v) {
				Object.defineProperty(o, "default", {
					enumerable: true,
					value: v,
				});
		  }
		: function (o, v) {
				o["default"] = v;
		  });
var __importStar =
	(this && this.__importStar) ||
	(function () {
		var ownKeys = function (o) {
			ownKeys =
				Object.getOwnPropertyNames ||
				function (o) {
					var ar = [];
					for (var k in o)
						if (Object.prototype.hasOwnProperty.call(o, k))
							ar[ar.length] = k;
					return ar;
				};
			return ownKeys(o);
		};
		return function (mod) {
			if (mod && mod.__esModule) return mod;
			var result = {};
			if (mod != null)
				for (var k = ownKeys(mod), i = 0; i < k.length; i++)
					if (k[i] !== "default") __createBinding(result, mod, k[i]);
			__setModuleDefault(result, mod);
			return result;
		};
	})();
var __importDefault =
	(this && this.__importDefault) ||
	function (mod) {
		return mod && mod.__esModule ? mod : { default: mod };
	};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InviteTracker =
	exports.InviteTrackerSchema =
	exports.InviteTrackerTypes =
		void 0;
const events_1 = require("events");
const mongoose_1 = __importDefault(require("mongoose"));
const discord_js_1 = require("discord.js");
const Types = __importStar(require("./types"));
const inviteSchema_1 = require("./inviteSchema");
// Export types and schema for external use.
exports.InviteTrackerTypes = __importStar(require("./types"));
exports.InviteTrackerSchema = __importStar(require("./inviteSchema"));
class InviteTracker extends events_1.EventEmitter {
	// TODO: Add queue system to handle invite tracking in case of high traffic.
	constructor(client, mongoURI, options) {
		super();
		this.invites = new Map();
		this.client = client;
		this.options = {
			modelName: "inviteSchema",
			verbose: false,
			...options,
		};
		this.inviteModel = (0, inviteSchema_1.getInviteModel)(
			options?.modelName
		);
		this.connectToDatabase(mongoURI);
		this.initialize();
	}
	async connectToDatabase(mongoURI, attempt = 1) {
		try {
			await mongoose_1.default.connect(mongoURI);
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
	initialize() {
		this.client.once("ready", () => {
			this.cacheGuildInvites();
			if (this.options?.verbose)
				console.info(`DisVite: Logged in as ${this.client.user?.tag}`);
		});
		this.client.on("guildMemberAdd", (member) => this.inviteJoin(member));
		this.client.on("guildMemberRemove", (member) =>
			this.inviteLeave(member)
		);
		// Cache invites on each invite update.
		this.client.on("inviteCreate", (invite) => {
			if (invite.guild && invite.guild instanceof discord_js_1.Guild) {
				this.cacheGuildInvitesForGuild(invite.guild);
			}
		});
		this.client.on("inviteDelete", (invite) => {
			if (invite.guild && invite.guild instanceof discord_js_1.Guild) {
				this.cacheGuildInvitesForGuild(invite.guild);
			}
		});
	}
	// Cache invites for a single guild, including vanity.
	async cacheGuildInvitesForGuild(guild, attempt = 1) {
		try {
			const fetchedInvites = await guild.invites.fetch();
			const inviteCollection = new discord_js_1.Collection();
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
	async cacheGuildInvites() {
		for (const guild of this.client.guilds.cache.values()) {
			await this.cacheGuildInvitesForGuild(guild);
		}
	}
	async inviteJoin(member) {
		const { guild } = member;
		const cachedInvites = this.invites.get(guild.id);
		// InviteInfo Object for output.
		const inviteInfo = {
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
	async detectFakeInvite(member) {
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
			const lastLeftAt = recentInvites[0].leftAt;
			const rejoinThreshold = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
			if (Date.now() - lastLeftAt.getTime() < rejoinThreshold) {
				return true;
			}
		}
		// Otherwise, this is not a fake invite.
		return false;
	}
	async inviteLeave(member) {
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
exports.InviteTracker = InviteTracker;
