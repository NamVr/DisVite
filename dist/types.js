"use strict";
/**
 * @file Types used in DisVite.
 * @author Naman Vrati
 * @version 1.0.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.JoinType = void 0;
/**
 * Enum representing the type of join for an invite.
 * - Normal: A standard invite join.
 * - Vanity: A join using a vanity URL.
 * - Unknown: An invite join that could not be determined.
 */
var JoinType;
(function (JoinType) {
    /**
     * A standard invite join.
     */
    JoinType["Normal"] = "normal";
    /**
     * A join using a vanity URL.
     */
    JoinType["Vanity"] = "vanity";
    /**
     * An invite join that could not be determined.
     */
    JoinType["Unknown"] = "unknown";
})(JoinType || (exports.JoinType = JoinType = {}));
