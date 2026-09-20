"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JoinType = void 0;
/**
 * Enum representing the type of join for an invite.
 */
var JoinType;
(function (JoinType) {
    /**
     * A standard invite join created by a user.
     */
    JoinType["Normal"] = "normal";
    /**
     * A join using the server's vanity URL.
     */
    JoinType["Vanity"] = "vanity";
    /**
     * A bot account joined via OAuth2 bot authorization URL.
     */
    JoinType["Bot"] = "bot";
    /**
     * An invite join that could not be determined (e.g., deleted single-use invite, missing permissions).
     */
    JoinType["Unknown"] = "unknown";
})(JoinType || (exports.JoinType = JoinType = {}));
