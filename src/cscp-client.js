/**
 * ============================================================================
 * AID-CSCP Client: Cross-Slot Coordination Protocol for AI Dungeon
 * ============================================================================
 *
 * Lightweight, zero-dependency client and codec for cross-VM slot discovery,
 * waterfall order tracking, capability collision resolution, and zero-width
 * storyCard steganography in AI Dungeon's isolated QuickJS multi-script environment.
 *
 * Supports:
 * - Option B (Default): Dedicated "Configure \nSystem Modules" dashboard story card
 * - Option C (Configurable): Piggyback zero-width binary stamp on any existing
 *   configuration story card with zero extra cards added to the adventure.
 * - Both Multi-Slot Modular Waterfalls and Single-Slot All-in-One Monoliths.
 *
 * @version 1.0.0
 * @author Randy Viosca (@Random_Variable on AI Dungeon)
 * @license MIT
 */
(function(root, factory) {
    if (typeof module === "object" && module.exports) {
        module.exports = factory();
    } else {
        root.AID_CSCP = factory();
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function() {
    "use strict";

    const CSCP_VERSION = 1;
    const STAMP_START = "\u200D\u200C\u200D";
    const STAMP_END = "\u200D\u200B\u200D";
    const HANDSHAKE_TOKEN = "\u200D\u200B\u200C\u200B\u200D";
    const DEDICATED_CARD_TITLE = "Configure \nSystem Modules";
    const DEFAULT_CARD_KEYS = "github.com/viosca/aid-modules";

    /**
     * Serializes any JSON-compatible object into an invisible zero-width binary frame.
     * Escapes non-ASCII characters to \uXXXX before bit-encoding so multi-byte UTF-8
     * characters and emojis are preserved 100% losslessly.
     *
     * @param {Object} obj Payload to serialize
     * @returns {string} Zero-width encoded frame bounded by STAMP_START and STAMP_END
     */
    function serialize(obj) {
        try {
            if (!obj || typeof obj !== "object") return "";
            const json = JSON.stringify(obj).replace(/[\u0080-\uFFFF]/g, (ch) => {
                return "\\u" + ch.charCodeAt(0).toString(16).padStart(4, "0");
            });
            let bits = "";
            for (let i = 0; i < json.length; i++) {
                const code = json.charCodeAt(i) & 0xFF;
                for (let b = 7; b >= 0; b--) {
                    bits += ((code >> b) & 1) ? "\u200C" : "\u200B";
                }
            }
            return STAMP_START + bits + STAMP_END;
        } catch (_) {
            return "";
        }
    }

    /**
     * Deserializes a zero-width binary frame from any carrier string back into a JS object.
     *
     * @param {string} str Carrier string containing a CSCP frame
     * @returns {Object|null} Decoded object or null if absent/invalid
     */
    function deserialize(str) {
        try {
            if (typeof str !== "string") return null;
            const sIdx = str.indexOf(STAMP_START);
            if (sIdx === -1) return null;
            const eIdx = str.indexOf(STAMP_END, sIdx + STAMP_START.length);
            if (eIdx === -1) return null;
            const bits = str.slice(sIdx + STAMP_START.length, eIdx);
            if (bits.length === 0 || (bits.length % 8) !== 0) return null;
            let json = "";
            for (let i = 0; i < bits.length; i += 8) {
                let byte = 0;
                for (let b = 0; b < 8; b++) {
                    byte = (byte << 1) | (bits[i + b] === "\u200C" ? 1 : 0);
                }
                json += String.fromCharCode(byte);
            }
            const parsed = JSON.parse(json);
            return (parsed && typeof parsed === "object") ? parsed : null;
        } catch (_) {
            return null;
        }
    }

    /**
     * Strips any CSCP zero-width binary frame from a string while preserving visible content.
     *
     * @param {string} str Input string
     * @returns {string} Clean string without CSCP stamp
     */
    function strip(str) {
        if (typeof str !== "string") return "";
        const sIdx = str.indexOf(STAMP_START);
        if (sIdx === -1) return str;
        const eIdx = str.indexOf(STAMP_END, sIdx + STAMP_START.length);
        if (eIdx === -1) return str.slice(0, sIdx);
        return str.slice(0, sIdx) + str.slice(eIdx + STAMP_END.length);
    }

    /**
     * Checks whether a string contains a CSCP zero-width binary frame.
     *
     * @param {string} str Input string
     * @returns {boolean}
     */
    function hasStamp(str) {
        if (typeof str !== "string") return false;
        const sIdx = str.indexOf(STAMP_START);
        if (sIdx === -1) return false;
        return str.indexOf(STAMP_END, sIdx + STAMP_START.length) !== -1;
    }

    /**
     * Resolves the current AI Dungeon storyCards array from global or lexical scope.
     * @returns {Array|null}
     */
    function getStoryCards() {
        if (typeof storyCards !== "undefined" && Array.isArray(storyCards)) return storyCards;
        if (typeof globalThis !== "undefined" && Array.isArray(globalThis.storyCards)) return globalThis.storyCards;
        return null;
    }

    /**
     * Resolves the current AI Dungeon per-slot state object.
     * @returns {Object|null}
     */
    function getState() {
        if (typeof state !== "undefined" && state && typeof state === "object" && !Array.isArray(state)) return state;
        if (typeof globalThis !== "undefined" && globalThis.state && typeof globalThis.state === "object" && !Array.isArray(globalThis.state)) return globalThis.state;
        return null;
    }

    /**
     * Resolves the current turnKey ("actionCount:historyLength").
     * @returns {string}
     */
    function getTurnKey() {
        const inf = (typeof info !== "undefined" && info && typeof info === "object")
            ? info
            : (typeof globalThis !== "undefined" && globalThis.info && typeof globalThis.info === "object" ? globalThis.info : null);
        const hist = (typeof history !== "undefined" && Array.isArray(history))
            ? history
            : (typeof globalThis !== "undefined" && Array.isArray(globalThis.history) ? globalThis.history : null);
        const act = inf && typeof inf.actionCount === "number" ? inf.actionCount : 0;
        const hLen = hist ? hist.length : 0;
        return `${act}:${hLen}`;
    }

    class CSCPBus {
        constructor() {
            this.version = CSCP_VERSION;
            this.STAMP_START = STAMP_START;
            this.STAMP_END = STAMP_END;
            this.HANDSHAKE_TOKEN = HANDSHAKE_TOKEN;
            this.DEDICATED_CARD_TITLE = DEDICATED_CARD_TITLE;
            this._vmSlotUid = "slot-" + Math.random().toString(36).slice(2, 8);
            this._config = {
                cardMode: null, // null = auto ("B" default unless overridden by card/MainSettings)
                pinCard: false,
                autoCreateCard: true
            };
        }

        /**
         * Configures CSCP behavior for this VM.
         * @param {Object} opts
         * @param {"B"|"C"|"dedicated"|"piggyback"} [opts.cardMode] Option B (dedicated card) or Option C (piggyback)
         * @param {boolean} [opts.pinCard] Pin the dedicated System Modules card
         * @param {boolean} [opts.autoCreateCard] Whether to auto-create the dedicated card when in Mode B
         */
        configure(opts = {}) {
            if (!opts || typeof opts !== "object") return this;
            if (opts.cardMode) {
                const m = String(opts.cardMode).toLowerCase().trim();
                if (m === "c" || m === "piggyback" || m === "false") {
                    this._config.cardMode = "C";
                } else if (m === "b" || m === "dedicated" || m === "true") {
                    this._config.cardMode = "B";
                }
            }
            if (typeof opts.pinCard === "boolean") {
                this._config.pinCard = opts.pinCard;
            }
            if (typeof opts.autoCreateCard === "boolean") {
                this._config.autoCreateCard = opts.autoCreateCard;
            }
            return this;
        }

        /**
         * Returns the persistent unique identifier for this script slot.
         * Persisted in per-slot `state._aid_slot_uid` so it survives across turns.
         * @returns {string}
         */
        getSlotUid() {
            const st = getState();
            if (st) {
                if (!st._aid_slot_uid || typeof st._aid_slot_uid !== "string") {
                    st._aid_slot_uid = this._vmSlotUid;
                }
                return st._aid_slot_uid;
            }
            return this._vmSlotUid;
        }

        /**
         * Creates an empty v1 CSCP registry packet.
         * @param {string} [mode="B"]
         * @returns {Object}
         */
        createEmptyPacket(mode = "B") {
            return {
                v: CSCP_VERSION,
                t: getTurnKey(),
                p: "init",
                mode: mode === "C" ? "C" : "B",
                order: [],
                lastOrder: [],
                owners: {},
                collisions: [],
                slots: {},
                modules: {}
            };
        }

        /**
         * Parses user-editable settings from the dedicated "Configure \nSystem Modules" card entry.
         * @param {Object} card
         * @returns {{ dedicated: boolean, pin: boolean }}
         */
        parseDedicatedCardEntry(card) {
            const result = { dedicated: true, pin: this._config.pinCard };
            if (!card || typeof card.entry !== "string") return result;
            const dedMatch = card.entry.match(/Dedicated\s+System\s+Modules\s+card\s*:\s*([^\n\r]+)/i);
            if (dedMatch) {
                const val = dedMatch[1].toLowerCase().replace(/[^a-z0-9]/g, "");
                if (["false", "f", "no", "n", "0", "off", "piggyback", "c"].includes(val)) {
                    result.dedicated = false;
                } else if (["true", "t", "yes", "y", "1", "on", "dedicated", "b"].includes(val)) {
                    result.dedicated = true;
                }
            }
            const pinMatch = card.entry.match(/Pin\s+this\s+config\s+card\s*:\s*([^\n\r]+)/i);
            if (pinMatch) {
                const val = pinMatch[1].toLowerCase().replace(/[^a-z0-9]/g, "");
                if (["true", "t", "yes", "y", "1", "on"].includes(val)) {
                    result.pin = true;
                } else if (["false", "f", "no", "n", "0", "off"].includes(val)) {
                    result.pin = false;
                }
            }
            return result;
        }

        /**
         * Determines the effective card carrier mode: "B" (Dedicated card) or "C" (Piggyback).
         * @param {Object|null} existingPacket
         * @returns {"B"|"C"}
         */
        resolveCardMode(existingPacket = null) {
            const cards = getStoryCards();
            if (cards) {
                const dedCard = cards.find(c => c && c.title === DEDICATED_CARD_TITLE);
                if (dedCard) {
                    const parsed = this.parseDedicatedCardEntry(dedCard);
                    this._config.pinCard = parsed.pin;
                    if (!parsed.dedicated) {
                        return "C";
                    }
                    return "B";
                }
            }
            if (this._config.cardMode === "C" || this._config.cardMode === "B") {
                return this._config.cardMode;
            }
            if (typeof globalThis !== "undefined" && globalThis.MainSettings && globalThis.MainSettings.SystemModules) {
                const sm = globalThis.MainSettings.SystemModules;
                if (sm.DEDICATED_CARD === false || sm.CARD_MODE === "C" || sm.CARD_MODE === "piggyback") {
                    return "C";
                }
                if (sm.DEDICATED_CARD === true || sm.CARD_MODE === "B" || sm.CARD_MODE === "dedicated") {
                    return "B";
                }
            }
            if (existingPacket && (existingPacket.mode === "C" || existingPacket.mode === "B")) {
                return existingPacket.mode;
            }
            return "B";
        }

        /**
         * Reads and deserializes the CSCP registry packet from storyCards (L2) or global cache (L1).
         * Completely card-title agnostic: scans all cards for the STAMP_START magic header.
         *
         * @returns {Object|null}
         */
        read() {
            const cards = getStoryCards();
            if (cards) {
                for (const c of cards) {
                    if (c && typeof c === "object" && typeof c.keys === "string" && c.keys.includes(STAMP_START)) {
                        const decoded = deserialize(c.keys);
                        if (decoded && typeof decoded === "object" && decoded.v === CSCP_VERSION) {
                            if (typeof globalThis !== "undefined") {
                                globalThis._AID_CSCP_PACKET = decoded;
                            }
                            return decoded;
                        }
                    }
                }
            }
            if (typeof globalThis !== "undefined" && globalThis._AID_CSCP_PACKET) {
                return globalThis._AID_CSCP_PACKET;
            }
            return null;
        }

        /**
         * Formats the human-readable dashboard for the Option B "Configure \nSystem Modules" card.
         *
         * @param {Object} packet CSCP registry packet
         * @returns {{ entry: string, description: string }}
         */
        formatDashboardCard(packet) {
            const orderedUids = (Array.isArray(packet.lastOrder) && packet.lastOrder.length >= (packet.order || []).length)
                ? packet.lastOrder
                : (packet.order || []);
            const allSlotUids = [...new Set([...orderedUids, ...Object.keys(packet.slots || {})])];
            const lines = [
                `=== AID-Modules System Bus (CSCP v${CSCP_VERSION}.0) ===`,
                `> Dedicated System Modules card: ${packet.mode !== "C"}`,
                `> Pin this config card: ${Boolean(this._config.pinCard)}`,
                `> Turn Key: ${packet.t || "0:0"} (Phase: ${packet.p || "init"})`,
                `> Active Script Slots (${allSlotUids.length} detected):`
            ];

            if (allSlotUids.length === 0) {
                lines.push("  (No active slots announced yet)");
            } else {
                allSlotUids.forEach((uid, idx) => {
                    const slot = packet.slots && packet.slots[uid];
                    if (!slot) return;
                    const modList = Array.isArray(slot.modules) && slot.modules.length > 0
                        ? slot.modules.map(mName => {
                            const m = packet.modules && packet.modules[mName];
                            return m ? `${m.name} v${m.version}` : mName;
                        }).join(", ")
                        : (slot.name || uid);
                    const buildTag = slot.buildType ? ` [${slot.buildType}]` : "";
                    const cmdTag = Array.isArray(slot.cmds) && slot.cmds.length > 0
                        ? ` -> ${slot.cmds.join(", ")}`
                        : "";
                    const yieldTag = Array.isArray(slot.yielded) && slot.yielded.length > 0
                        ? ` (YIELDED: ${slot.yielded.join(", ")})`
                        : "";
                    lines.push(`  Slot ${idx + 1} (${uid})${buildTag}: ${modList}${cmdTag}${yieldTag}`);
                });
            }

            const collisions = Array.isArray(packet.collisions) ? packet.collisions : [];
            if (collisions.length > 0) {
                lines.push(`> ⚠️ Collisions Detected (${collisions.length}):`);
                for (const col of collisions) {
                    lines.push(`  - Capability "${col.capability}" active in ${col.primarySlot} (${col.primaryModule}); bypassed in ${col.yieldedSlot} (${col.yieldedModule})`);
                }
            } else {
                lines.push(`> Status: Healthy (0 collisions)`);
            }

            const description = [
                "Cross-Slot Coordination Protocol (CSCP) active.",
                "Scripts run in waterfall order from Slot 1 downward.",
                "To hide this card and piggyback on an existing configuration card (Option C), change 'Dedicated System Modules card: true' to 'false' above."
            ].join("\n");

            return {
                entry: lines.join("\n"),
                description
            };
        }

        /**
         * Finds a generic carrier card for Option C (Piggyback mode) without hardcoded module names.
         * @param {Array} cards
         * @returns {Object|null}
         */
        findPiggybackCarrier(cards) {
            if (!Array.isArray(cards) || cards.length === 0) return null;
            // 1. Any non-dedicated card that already carries a CSCP stamp
            for (const c of cards) {
                if (c && c.title !== DEDICATED_CARD_TITLE && typeof c.keys === "string" && c.keys.includes(STAMP_START)) {
                    return c;
                }
            }
            // 2. Any non-dedicated card with "Configure" in its title
            for (const c of cards) {
                if (c && c.title !== DEDICATED_CARD_TITLE && typeof c.title === "string" && c.title.includes("Configure")) {
                    return c;
                }
            }
            // 3. First available non-dedicated card
            for (const c of cards) {
                if (c && c.title !== DEDICATED_CARD_TITLE) {
                    return c;
                }
            }
            return null;
        }

        /**
         * Writes the CSCP registry packet to storyCards (using Option B or Option C) and updates L1 cache.
         *
         * @param {Object} packet CSCP registry packet
         * @param {Object} [options]
         * @param {boolean} [options.createCard] Override whether to create the dedicated card if missing
         * @returns {Object} The written packet
         */
        write(packet, options = {}) {
            if (!packet || typeof packet !== "object") return packet;
            const mode = this.resolveCardMode(packet);
            packet.mode = mode;

            if (typeof globalThis !== "undefined") {
                globalThis._AID_CSCP_PACKET = packet;
            }

            const cards = getStoryCards();
            if (!cards) return packet;

            const encoded = serialize(packet);
            if (!encoded) return packet;

            const addCardFn = (typeof addStoryCard === "function")
                ? addStoryCard
                : (typeof globalThis !== "undefined" && typeof globalThis.addStoryCard === "function" ? globalThis.addStoryCard : null);
            const removeCardFn = (typeof removeStoryCard === "function")
                ? removeStoryCard
                : (typeof globalThis !== "undefined" && typeof globalThis.removeStoryCard === "function" ? globalThis.removeStoryCard : null);

            if (mode === "B") {
                let dedIdx = cards.findIndex(c => c && c.title === DEDICATED_CARD_TITLE);
                let dedCard = dedIdx !== -1 ? cards[dedIdx] : null;
                const allowCreate = options.createCard !== undefined ? options.createCard : this._config.autoCreateCard;

                if (!dedCard && allowCreate && addCardFn) {
                    const fmt = this.formatDashboardCard(packet);
                    addCardFn(DEFAULT_CARD_KEYS + encoded, fmt.entry, "class", DEDICATED_CARD_TITLE, fmt.description);
                    dedIdx = cards.findIndex(c => c && c.title === DEDICATED_CARD_TITLE);
                    dedCard = dedIdx !== -1 ? cards[dedIdx] : cards[cards.length - 1];
                    if (dedCard) {
                        dedCard.title = DEDICATED_CARD_TITLE;
                        dedCard.type = "class";
                        dedCard.keys = DEFAULT_CARD_KEYS + encoded;
                        dedCard.entry = fmt.entry;
                        dedCard.description = fmt.description;
                    }
                } else if (dedCard) {
                    const fmt = this.formatDashboardCard(packet);
                    const baseKeys = strip(dedCard.keys || "").trim() || DEFAULT_CARD_KEYS;
                    dedCard.keys = baseKeys + encoded;
                    dedCard.entry = fmt.entry;
                    dedCard.description = fmt.description;
                }

                // Optional pinning for Dedicated Card
                if (dedCard && this._config.pinCard && dedIdx > 0) {
                    cards.splice(dedIdx, 1);
                    cards.unshift(dedCard);
                }

                // If dedicated card exists, clean stale stamps off other cards
                if (dedCard) {
                    for (const c of cards) {
                        if (c && c !== dedCard && typeof c.keys === "string" && c.keys.includes(STAMP_START)) {
                            c.keys = strip(c.keys);
                        }
                    }
                } else {
                    // Fallback to piggyback carrier if addStoryCard was not available
                    const carrier = this.findPiggybackCarrier(cards);
                    if (carrier) {
                        carrier.keys = strip(carrier.keys || "") + encoded;
                    }
                }
            } else {
                // Option C: Piggyback mode
                // Remove dedicated card if it was previously present
                const dedIdx = cards.findIndex(c => c && c.title === DEDICATED_CARD_TITLE);
                if (dedIdx !== -1) {
                    if (removeCardFn) {
                        removeCardFn(dedIdx);
                    } else {
                        cards.splice(dedIdx, 1);
                    }
                }
                const carrier = this.findPiggybackCarrier(cards);
                if (carrier) {
                    for (const c of cards) {
                        if (c && c !== carrier && typeof c.keys === "string" && c.keys.includes(STAMP_START)) {
                            c.keys = strip(c.keys);
                        }
                    }
                    carrier.keys = strip(carrier.keys || "") + encoded;
                }
            }

            return packet;
        }

        /**
         * Announces a module or slot capability into the CSCP registry and checks for cross-slot
         * or intra-slot capability collisions.
         *
         * @param {Object} spec Module / slot specification
         * @param {string} spec.name Canonical module name (e.g. "aid-modules")
         * @param {string} [spec.version="1.0.0"] SemVer string
         * @param {string} [spec.buildType="modular"] "modular" | "standalone" | "all-in-one"
         * @param {Array<string>} [spec.provides] Capabilities claimed by this module (defaults to [spec.name])
         * @param {string} [spec.prefix] Primary slash command prefix (e.g. "/aid-modules")
         * @param {Array<string>} [spec.aliases] Command aliases
         * @param {string} [spec.instanceId] Optional per-instance identifier for intra-VM collision detection
         * @param {Object} [options]
         * @param {string} [options.phase] Current hook phase ("init", "input", "context", "output")
         * @param {boolean} [options.createCard] Whether to auto-create the Option B card on this call
         * @returns {{ slotUid: string, slotOrder: number, active: Array<string>, yielded: Array<string>, isColliding: boolean, collisions: Array<Object>, packet: Object }}
         */
        announce(spec, options = {}) {
            if (!spec || typeof spec !== "object" || !spec.name) {
                throw new Error("[AID-CSCP] announce() requires a spec object with a 'name' property");
            }

            const slotUid = options.slotUid || this.getSlotUid();
            const turnKey = getTurnKey();
            const phase = options.phase || "init";
            const name = String(spec.name).toLowerCase().trim();
            const version = spec.version ? String(spec.version).trim() : "1.0.0";
            const buildType = spec.buildType ? String(spec.buildType).toLowerCase().trim() : "modular";
            const provides = Array.isArray(spec.provides) && spec.provides.length > 0
                ? spec.provides.map(p => String(p).toLowerCase().trim())
                : [name];
            const instanceId = spec.instanceId || slotUid;

            const cmds = [];
            if (spec.prefix) cmds.push(String(spec.prefix).trim());
            if (Array.isArray(spec.aliases)) {
                for (const al of spec.aliases) {
                    const cleanAl = String(al).trim();
                    if (cleanAl && !cmds.includes(cleanAl)) cmds.push(cleanAl);
                }
            }
            if (Array.isArray(spec.commands)) {
                for (const c of spec.commands) {
                    const cleanC = String(c).trim();
                    if (cleanC && !cmds.includes(cleanC)) cmds.push(cleanC);
                }
            }

            let packet = this.read() || this.createEmptyPacket();
            packet.slots ??= {};
            packet.modules ??= {};
            packet.order ??= [];
            packet.lastOrder ??= [];
            packet.owners ??= {};
            packet.collisions ??= [];

            const isRealHookPhase = (phase === "input" || phase === "context" || phase === "output");

            if (isRealHookPhase && (packet.t !== turnKey || packet.p !== phase)) {
                // Save completed phase order before resetting for the new (turnKey, phase)
                if ((packet.p === "input" || packet.p === "context" || packet.p === "output") && packet.order.length > 0) {
                    packet.lastOrder = [...packet.order];
                    // If advancing to a brand-new turn, prune removed slots that did not execute in the completed phase
                    if (packet.t !== turnKey) {
                        const surviving = new Set(packet.lastOrder);
                        for (const oldUid of Object.keys(packet.slots)) {
                            if (!surviving.has(oldUid) && packet.slots[oldUid].lastSeenTurn !== turnKey) {
                                delete packet.slots[oldUid];
                            }
                        }
                        for (const [mKey, mVal] of Object.entries(packet.modules)) {
                            if (mVal && mVal.slotUid && !packet.slots[mVal.slotUid]) {
                                delete packet.modules[mKey];
                            }
                        }
                    }
                }
                packet.t = turnKey;
                packet.p = phase;
                packet.order = [];
                packet.owners = {};
                packet.collisions = [];
                // Clear per-slot active/yielded lists for the new phase
                for (const s of Object.values(packet.slots)) {
                    s.active = [];
                    s.yielded = [];
                }
            }

            if (!packet.order.includes(slotUid)) {
                packet.order.push(slotUid);
            }

            // Ensure slot record exists
            const slotRec = packet.slots[slotUid] ??= {
                uid: slotUid,
                name,
                buildType,
                modules: [],
                provides: [],
                active: [],
                yielded: [],
                cmds: [],
                lastSeenTurn: turnKey
            };
            slotRec.lastSeenTurn = turnKey;
            if (buildType === "all-in-one" || slotRec.buildType === "modular") {
                slotRec.buildType = buildType;
            }
            if (!slotRec.modules.includes(name)) {
                slotRec.modules.push(name);
            }
            for (const c of cmds) {
                if (!slotRec.cmds.includes(c)) slotRec.cmds.push(c);
            }
            for (const cap of provides) {
                if (!slotRec.provides.includes(cap)) slotRec.provides.push(cap);
            }

            // Evaluate capability claims & collisions
            const active = [];
            const yielded = [];

            for (const cap of provides) {
                const existingOwner = packet.owners[cap];
                const isConflict = existingOwner && (
                    existingOwner.slotUid !== slotUid ||
                    (spec.instanceId && existingOwner.instanceId !== instanceId)
                );

                if (isConflict) {
                    yielded.push(cap);
                    if (!slotRec.yielded.includes(cap)) slotRec.yielded.push(cap);
                    const alreadyLogged = packet.collisions.some(
                        c => c.capability === cap && c.primarySlot === existingOwner.slotUid && c.yieldedSlot === slotUid
                    );
                    if (!alreadyLogged) {
                        packet.collisions.push({
                            capability: cap,
                            primarySlot: existingOwner.slotUid,
                            primaryModule: existingOwner.moduleName,
                            yieldedSlot: slotUid,
                            yieldedModule: name
                        });
                    }
                } else {
                    packet.owners[cap] = {
                        slotUid,
                        moduleName: name,
                        instanceId
                    };
                    active.push(cap);
                    if (!slotRec.active.includes(cap)) slotRec.active.push(cap);
                }
            }

            // Store/update module metadata in packet.modules
            packet.modules[name] = {
                name,
                version,
                buildType,
                slotUid,
                gitHash: spec.gitHash || null,
                buildTime: spec.buildTime || null,
                author: spec.author || null,
                description: spec.description || null,
                repository: spec.repository || null,
                prefix: spec.prefix || null,
                aliases: Array.isArray(spec.aliases) ? spec.aliases : [],
                helpSummary: spec.helpSummary || null,
                provides,
                diagText: typeof spec.diag === "function"
                    ? spec.diag()
                    : (spec.diagText || `${name} v${version}${spec.gitHash && spec.gitHash !== "dev" ? ` (${spec.gitHash})` : ""} [${buildType}]`)
            };

            this.write(packet, { createCard: options.createCard });

            const effectiveOrderList = (packet.lastOrder && packet.lastOrder.length > packet.order.length && packet.lastOrder.includes(slotUid))
                ? packet.lastOrder
                : packet.order;

            return {
                slotUid,
                slotOrder: effectiveOrderList.indexOf(slotUid) + 1,
                active,
                yielded,
                isColliding: yielded.length > 0 || packet.collisions.some(c => c.primarySlot === slotUid || c.yieldedSlot === slotUid),
                collisions: packet.collisions,
                packet
            };
        }
    }

    const cscp = new CSCPBus();
    cscp.CSCPBus = CSCPBus;
    cscp.serialize = serialize;
    cscp.deserialize = deserialize;
    cscp.strip = strip;
    cscp.hasStamp = hasStamp;
    cscp.getTurnKey = getTurnKey;

    if (typeof globalThis !== "undefined") {
        globalThis.AID_CSCP = cscp;
    }

    return cscp;
});
