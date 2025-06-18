"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
/**
 * Interface representing the schema for an invite in the database.
 */
const InviteSchema = new mongoose_1.Schema({
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
exports.default = mongoose_1.default.model("inviteSchema", InviteSchema);
