import mongoose, { Schema, Document } from "mongoose";
import { InviteSchema } from "./types";

const InviteSchema: Schema = new Schema({
	// The ID of the guild this invite belongs to.
	guildId: {
		type: String,
		required: true,
		index: true,
	},

	// The ID of the person who was invited.
	inviteeId: {
		type: String,
		required: true,
		index: true,
	},

	// The user ID of the user who created the invite.
	inviterId: {
		type: String,
		index: true,
		default: null, // null if the inviter is unknown.
	},

	// The ID of the invite, discord.gg/invite/{inviteCode}
	inviteCode: {
		type: String,
		default: null, // null if the invite is unknown.
	},

	// The type of the invite.
	// "normal" for regular invites, "vanity" for vanity URLs, "unknown" for unknown invites.
	joinType: {
		type: String,
		enum: ["normal", "vanity", "unknown"],
		required: true,
	},

	// The timestamp when the user joined the guild.
	joinedAt: {
		type: Date,
		required: true,
	},

	// The timestamp when the user left the guild, if applicable.
	leftAt: {
		type: Date,
		default: null, // only if applicable.
	},

	// Whether the invite is fake or not (detected by module).
	fake: {
		type: Boolean,
		default: false,
	},
});

export default mongoose.model<InviteSchema>("inviteSchema", InviteSchema);
