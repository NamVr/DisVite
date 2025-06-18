/**
 * @file Types used in discord-invite-tracker.
 * @author Naman Vrati
 * @version 1.0.0
 */

/**
 * Enum representing the type of join for an invite.
 * - Normal: A standard invite join.
 * - Vanity: A join using a vanity URL.
 * - Unknown: An invite join that could not be determined.
 */
export enum JoinType {
	/**
	 * A standard invite join.
	 */
	Normal = "normal",

	/**
	 * A join using a vanity URL.
	 */
	Vanity = "vanity",

	/**
	 * An invite join that could not be determined.
	 */
	Unknown = "unknown",
}

/**
 * Interface representing the information about an invite.
 */
export interface InviteInfo {
	/**
	 * The ID of the guild this invite belongs to.
	 */
	guildId: string;

	/**
	 * The ID of the person who was invited.
	 */
	inviteeId: string;

	/**
	 * The user ID of the user who created the invite.
	 * This can be null if the inviter is unknown/vanity.
	 */
	inviterId?: string;

	/**
	 * The ID of the invite, discord.gg/invite/{inviteCode}.
	 * This can be null if the invite is unknown.
	 */
	inviteCode?: string;

	/**
	 * The type of the invite.
	 */
	joinType: JoinType;

	/**
	 * Whether the invite is fake or not (detected by module).
	 * This is set to true if the invite is detected as fake.
	 */
	fake: boolean;

	/**
	 * The timestamp when the user joined the guild.
	 * This is typically the current date and time when the invite was used.
	 */
	joinedAt: Date;
}

/**
 * Interface representing the schema for an invite in the database.
 */
export interface InviteSchema extends Document {
	/**
	 * The ID of the guild this invite belongs to.
	 * This is used to associate the invite with a specific guild.
	 */
	guildId: string;

	/**
	 * The ID of the person who was invited.
	 * This is the user ID of the member who used the invite.
	 */
	inviteeId: string;

	/**
	 * The user ID of the user who created the invite.
	 * This can be null if the inviter is unknown or if the invite is a vanity URL.
	 */
	inviterId?: string | null;

	/**
	 * The ID of the invite, discord.gg/invite/{inviteCode}.
	 * This can be null if the invite is unknown.
	 */
	inviteCode?: string | null;

	/**
	 * The type of the invite.
	 * This can be "normal" for regular invites, "vanity" for vanity URLs, or "unknown" for unknown invites.
	 */
	joinType: "normal" | "vanity" | "unknown";

	/**
	 * The timestamp when the user joined the guild.
	 * This is typically the current date and time when the invite was used.
	 */
	joinedAt: Date;

	/**
	 * The timestamp when the user left the guild, if applicable.
	 * This is set to null initially and can be updated when the user leaves the guild.
	 */
	leftAt?: Date | null;

	/**
	 * Whether the invite is fake or not (detected by module).
	 * This is set to true if the invite is detected as fake, otherwise false.
	 */
	fake: boolean;
}
