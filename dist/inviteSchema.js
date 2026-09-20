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
exports.BonusMongooseSchema = exports.InviteMongooseSchema = void 0;
exports.getInviteModel = getInviteModel;
exports.getBonusInviteModel = getBonusInviteModel;
const mongoose_1 = __importStar(require("mongoose"));
/**
 * Schema for member invite records in MongoDB.
 */
exports.InviteMongooseSchema = new mongoose_1.Schema({
    guildId: {
        type: String,
        required: true,
        index: true,
    },
    inviteeId: {
        type: String,
        required: true,
        index: true,
    },
    inviterId: {
        type: String,
        index: true,
        default: null,
    },
    inviteCode: {
        type: String,
        default: null,
    },
    joinType: {
        type: String,
        enum: ["normal", "vanity", "unknown", "bot"],
        required: true,
    },
    joinedAt: {
        type: Date,
        required: true,
        index: true,
    },
    leftAt: {
        type: Date,
        default: null,
        index: true,
    },
    fake: {
        type: Boolean,
        default: false,
        index: true,
    },
});
// Compound indexes for optimized query performance in large guilds
exports.InviteMongooseSchema.index({ guildId: 1, inviterId: 1, leftAt: 1, fake: 1 });
exports.InviteMongooseSchema.index({ guildId: 1, inviteeId: 1, leftAt: 1, joinedAt: -1 });
/**
 * Schema for manual bonus / penalty invite counts.
 */
exports.BonusMongooseSchema = new mongoose_1.Schema({
    guildId: {
        type: String,
        required: true,
        index: true,
    },
    userId: {
        type: String,
        required: true,
        index: true,
    },
    bonus: {
        type: Number,
        default: 0,
    },
});
exports.BonusMongooseSchema.index({ guildId: 1, userId: 1 }, { unique: true });
/**
 * Safely retrieve or compile the Mongoose model for invites, preventing OverwriteModelError.
 */
function getInviteModel(modelName = "inviteSchema", connection) {
    if (connection) {
        return (connection.models[modelName] ||
            connection.model(modelName, exports.InviteMongooseSchema));
    }
    return (mongoose_1.default.models[modelName] ||
        mongoose_1.default.model(modelName, exports.InviteMongooseSchema));
}
/**
 * Safely retrieve or compile the Mongoose model for bonus invites.
 */
function getBonusInviteModel(modelName = "bonusInviteSchema", connection) {
    if (connection) {
        return (connection.models[modelName] ||
            connection.model(modelName, exports.BonusMongooseSchema));
    }
    return (mongoose_1.default.models[modelName] ||
        mongoose_1.default.model(modelName, exports.BonusMongooseSchema));
}
