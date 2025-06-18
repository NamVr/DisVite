import mongoose, { Schema, Document } from "mongoose";
import { InviteSchema } from "./types";

/**
 * Interface representing the schema for an invite in the database.
 */
const InviteSchema: Schema = new Schema({
	/**
	 * The ID of the guild this invite belongs to.
	 * This is used to associate the invite with a specific guild.
	 */
	guildId: {
		type: String,
		required: true,
		index: true,
	},

	/**
	 * The ID of the person who was invited.
	 * This is the user ID of the member who used the invite.
	 */
	inviteeId: {
		type: String,
		required: true,
		index: true,
	},

	/**
	 * The user ID of the user who created the invite.
	 * This can be null if the inviter is unknown or if the invite is a vanity URL.
	 */
	inviterId: {
		type: String,
		index: true,
		default: null, // null if the inviter is unknown.
	},

	/**
	 * The ID of the invite, discord.gg/invite/{inviteCode}.
	 * This can be null if the invite is unknown.
	 */
	inviteCode: {
		type: String,
		default: null, // null if the invite is unknown.
	},

	/**
	 * The type of the invite.
	 * This can be "normal" for regular invites, "vanity" for vanity URLs, or "unknown" for unknown invites.
	 */
	joinType: {
		type: String,
		enum: ["normal", "vanity", "unknown"],
		required: true,
	},

	/**
	 * The timestamp when the user joined the guild.
	 * This is typically the current date and time when the invite was used.
	 */
	joinedAt: {
		type: Date,
		required: true,
	},

	/**
	 * The timestamp when the user left the guild, if applicable.
	 * This is set to null initially and can be updated when the user leaves the guild.
	 */
	leftAt: {
		type: Date,
		default: null, // only if applicable.
	},

	/**
	 * Whether the invite is fake or not (detected by module).
	 * This is set to true if the invite is detected as fake, otherwise false.
	 */
	fake: {
		type: Boolean,
		default: false,
	},
});

export default mongoose.model<InviteSchema>("inviteSchema", InviteSchema);
