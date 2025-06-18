/**
 * @file Types used in discord-invite-tracker.
 * @author Naman Vrati
 * @version 1.0.0
 */

// Enum for join types
export enum JoinType {
	Normal = "normal",
	Vanity = "vanity",
	Unknown = "unknown",
}

// TODO: Type for an invite
export interface InviteInfo {
	inviterId?: string;
	inviteCode?: string;
	joinType: JoinType;
}

export interface InviteSchema extends Document {
	// The ID of the guild this invite belongs to.
	guildId: string;

	// The ID of the person who was invited.
	inviteeId: string;

	// The user ID of the user who created the invite.
	inviterId?: string | null;

	// The ID of the invite, discord.gg/invite/{inviteCode}
	inviteCode?: string | null;

	// The type of the invite.
	joinType: "normal" | "vanity" | "unknown";

	// The timestamp when the user joined the guild.
	joinedAt: Date;

	// The timestamp when the user left the guild, if applicable.
	leftAt?: Date | null;

	// Whether the invite is fake or not (detected by module).
	fake: boolean;
}
