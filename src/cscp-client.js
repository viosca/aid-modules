/**
 * ============================================================================
 * AID-CSCP Client: Cross-Slot Coordination Protocol for AI Dungeon
 * ============================================================================
 *
 * Lightweight, zero-dependency client and codec for cross-VM slot discovery,
 * waterfall order tracking, capability collision resolution, Variation-Selector
 * DLL export/import, and zero-width storyCard steganography in AI Dungeon's
 * isolated QuickJS multi-script environment.
 *
 * @version 1.1.0
 * @author Randy Viosca (@Random_Variable on AI Dungeon)
 * @license MIT
 */
(function(root, factory) {
    if (typeof module === "object" && module.exports) {
        module.exports = factory();
    } else {
        root.AID_CSCP = factory();
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function cscpFactory() {
    "use strict";

    const CSCP_VERSION = 1;
    const GIT_HASH = "dev";
    const BUILD_TIME = "dev";

    const STAMP_START = "\u200D\u200C\u200D";
    const STAMP_END = "\u200D\u200B\u200D";
    const DLL_START = "\u200D\uFE00\u200D";
    const DLL_END = "\u200D\uFE0F\u200D";
    const HANDSHAKE_TOKEN = "\u200D\u200B\u200C\u200B\u200D";
    const DEDICATED_CARD_TITLE = "Configure \nSystem Modules";
    const DEFAULT_CARD_KEYS = "github.com/viosca/aid-modules";

    const DEDICATED_ALIASES = ["dedicated", "dashboard", "visible", "true", "t", "yes", "y", "1", "on", "d"];
    const SHARED_ALIASES = ["shared", "piggyback", "stealth", "headless", "false", "f", "no", "n", "0", "off", "s"];

    function normalizeCardMode(val) {
        if (typeof val === "boolean") return val ? "dedicated" : "shared";
        if (val === null || val === undefined) return null;
        const clean = String(val).toLowerCase().replace(/[^a-z0-9]/g, "");
        if (SHARED_ALIASES.includes(clean)) return "shared";
        if (DEDICATED_ALIASES.includes(clean)) return "dedicated";
        return null;
    }

    function minifyClientSource(src) {
        return src
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .split(/\r?\n/)
            .map(l => l.trim())
            .filter(l => l.length > 0 && !l.startsWith("//"))
            .join("\n");
    }

    /**
     * Encodes a JavaScript source string into a 16-Variation-Selector (\uFE00..\uFE0F)
     * invisible DLL frame (2 chars per byte, 4 bits per nibble).
     */
    function encodeDLL(jsCode) {
        if (typeof jsCode !== "string" || !jsCode) return "";
        const ascii = jsCode.replace(/[\u0080-\uFFFF]/g, (ch) => {
            return "\\u" + ch.charCodeAt(0).toString(16).padStart(4, "0");
        });
        let out = "";
        for (let i = 0; i < ascii.length; i++) {
            const b = ascii.charCodeAt(i) & 0xFF;
            out += String.fromCharCode(0xFE00 + ((b >> 4) & 0x0F))
                 + String.fromCharCode(0xFE00 + (b & 0x0F));
        }
        return DLL_START + out + DLL_END;
    }

    /**
     * Decodes a 16-Variation-Selector (\uFE00..\uFE0F) invisible DLL frame back into JS source code.
     */
    function decodeDLL(str) {
        if (typeof str !== "string") return null;
        const s = str.indexOf(DLL_START);
        if (s === -1) return null;
        const e = str.indexOf(DLL_END, s + DLL_START.length);
        if (e === -1) return null;
        const start = s + DLL_START.length;
        if (((e - start) % 2) !== 0) return null;
        let js = "";
        for (let i = start; i < e; i += 2) {
            js += String.fromCharCode(((str.charCodeAt(i) & 15) << 4) | (str.charCodeAt(i + 1) & 15));
        }
        return js;
    }

    function extractDLLFrame(str) {
        if (typeof str !== "string") return "";
        const s = str.indexOf(DLL_START);
        if (s === -1) return "";
        const e = str.indexOf(DLL_END, s + DLL_START.length);
        if (e === -1) return "";
        return str.slice(s, e + DLL_END.length);
    }

    function stripDLL(str) {
        if (typeof str !== "string") return "";
        const s = str.indexOf(DLL_START);
        if (s === -1) return str;
        const e = str.indexOf(DLL_END, s + DLL_START.length);
        if (e === -1) return str.slice(0, s);
        return str.slice(0, s) + str.slice(e + DLL_END.length);
    }

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

    function stripStamp(str) {
        if (typeof str !== "string") return "";
        const sIdx = str.indexOf(STAMP_START);
        if (sIdx === -1) return str;
        const eIdx = str.indexOf(STAMP_END, sIdx + STAMP_START.length);
        if (eIdx === -1) return str.slice(0, sIdx);
        return str.slice(0, sIdx) + str.slice(eIdx + STAMP_END.length);
    }

    /**
     * Strips all invisible CSCP frames (both DLL and Data Stamp), returning pure visible keys.
     */
    function strip(str) {
        return stripDLL(stripStamp(str));
    }

    function hasStamp(str) {
        if (typeof str !== "string") return false;
        const sIdx = str.indexOf(STAMP_START);
        if (sIdx === -1) return false;
        return str.indexOf(STAMP_END, sIdx + STAMP_START.length) !== -1;
    }

    function hasDLL(str) {
        if (typeof str !== "string") return false;
        const sIdx = str.indexOf(DLL_START);
        if (sIdx === -1) return false;
        return str.indexOf(DLL_END, sIdx + DLL_START.length) !== -1;
    }

    function getStoryCards() {
        if (typeof storyCards !== "undefined" && Array.isArray(storyCards)) return storyCards;
        if (typeof globalThis !== "undefined" && Array.isArray(globalThis.storyCards)) return globalThis.storyCards;
        return null;
    }

    function getState() {
        if (typeof state !== "undefined" && state && typeof state === "object" && !Array.isArray(state)) return state;
        if (typeof globalThis !== "undefined" && globalThis.state && typeof globalThis.state === "object" && !Array.isArray(globalThis.state)) return globalThis.state;
        return null;
    }

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
            this.gitHash = GIT_HASH;
            this.buildTime = BUILD_TIME;
            this.STAMP_START = STAMP_START;
            this.STAMP_END = STAMP_END;
            this.DLL_START = DLL_START;
            this.DLL_END = DLL_END;
            this.HANDSHAKE_TOKEN = HANDSHAKE_TOKEN;
            this.DEDICATED_CARD_TITLE = DEDICATED_CARD_TITLE;
            this._vmSlotUid = "slot-" + Math.random().toString(36).slice(2, 8);
            this._dllFrame = "";
            this._config = {
                cardMode: null,
                pinCard: false,
                autoCreateCard: true
            };
        }

        /**
         * Builds (or caches) the Variation-Selector (\uFE00..\uFE0F) DLL frame directly from
         * `cscpFactory.toString()` so zero duplicate JS string literal is needed in the bundle!
         */
        buildSelfDLLFrame() {
            if (!this._dllFrame) {
                const rawSelf = "globalThis.AID_CSCP=(" + cscpFactory.toString() + ")();";
                this._dllFrame = encodeDLL(minifyClientSource(rawSelf));
            }
            return this._dllFrame;
        }

        setDLLFrame(dllFrame) {
            if (typeof dllFrame === "string" && dllFrame.startsWith(DLL_START)) {
                this._dllFrame = dllFrame;
            }
            return this;
        }

        findActiveDLLFrame(cards) {
            if (this._dllFrame) return this._dllFrame;
            if (Array.isArray(cards)) {
                for (const c of cards) {
                    if (c && typeof c.keys === "string" && c.keys.includes(DLL_START)) {
                        const extracted = extractDLLFrame(c.keys);
                        if (extracted) {
                            this._dllFrame = extracted;
                            return extracted;
                        }
                    }
                }
            }
            return this.buildSelfDLLFrame();
        }

        configure(opts = {}) {
            if (!opts || typeof opts !== "object") return this;
            if (opts.cardMode !== undefined) {
                const norm = normalizeCardMode(opts.cardMode);
                if (norm) this._config.cardMode = norm;
            }
            if (typeof opts.pinCard === "boolean") {
                this._config.pinCard = opts.pinCard;
            }
            if (typeof opts.autoCreateCard === "boolean") {
                this._config.autoCreateCard = opts.autoCreateCard;
            }
            return this;
        }

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

        createEmptyPacket(mode = "dedicated") {
            return {
                v: CSCP_VERSION,
                t: getTurnKey(),
                p: "init",
                mode: normalizeCardMode(mode) || "dedicated",
                order: [],
                lastOrder: [],
                owners: {},
                collisions: [],
                slots: {},
                modules: {}
            };
        }

        parseDedicatedCardEntry(card) {
            const result = { mode: "dedicated", pin: this._config.pinCard };
            if (!card || typeof card.entry !== "string") return result;

            const modeMatch = card.entry.match(/(?:Carrier\s+card\s+mode|(?:Show|Dedicated)\s+System\s+Modules\s+card)\s*:\s*([^\n\r]+)/i);
            if (modeMatch) {
                const norm = normalizeCardMode(modeMatch[1]);
                if (norm) result.mode = norm;
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

        resolveCardMode(existingPacket = null) {
            const cards = getStoryCards();
            if (cards) {
                const dedCard = cards.find(c => c && c.title === DEDICATED_CARD_TITLE);
                if (dedCard) {
                    const parsed = this.parseDedicatedCardEntry(dedCard);
                    this._config.pinCard = parsed.pin;
                    if (parsed.mode === "shared") {
                        this._config.cardMode = "shared";
                        return "shared";
                    }
                    if (this._config.cardMode === "shared") {
                        return "shared";
                    }
                    return "dedicated";
                }
            }
            if (this._config.cardMode === "shared" || this._config.cardMode === "dedicated") {
                return this._config.cardMode;
            }
            if (typeof globalThis !== "undefined" && globalThis.MainSettings && globalThis.MainSettings.SystemModules) {
                const sm = globalThis.MainSettings.SystemModules;
                const norm = normalizeCardMode(sm.CARD_MODE ?? sm.DEDICATED_CARD);
                if (norm) return norm;
            }
            if (existingPacket && existingPacket.mode) {
                const norm = normalizeCardMode(existingPacket.mode);
                if (norm) return norm;
            }
            return "dedicated";
        }

        read() {
            const cards = getStoryCards();
            if (cards) {
                for (const c of cards) {
                    if (c && typeof c === "object" && typeof c.keys === "string" && c.keys.includes(STAMP_START)) {
                        if (c.keys.includes(DLL_START) && !this._dllFrame) {
                            this._dllFrame = extractDLLFrame(c.keys);
                        }
                        const decoded = deserialize(c.keys);
                        if (decoded && typeof decoded === "object" && decoded.v === CSCP_VERSION) {
                            decoded.mode = normalizeCardMode(decoded.mode) || "dedicated";
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

        formatDashboardCard(packet) {
            const orderedUids = (Array.isArray(packet.lastOrder) && packet.lastOrder.length >= (packet.order || []).length)
                ? packet.lastOrder
                : (packet.order || []);
            const allSlotUids = [...new Set([...orderedUids, ...Object.keys(packet.slots || {})])];
            const dllLoaded = Boolean(this._dllFrame);
            const lines = [
                `=== AID-Modules System Bus (CSCP v${CSCP_VERSION}.0${GIT_HASH !== "dev" ? ` / ${GIT_HASH}` : ""}) ===`,
                `> Carrier card mode: ${packet.mode === "shared" ? "shared" : "dedicated"}`,
                `> Pin this config card: ${Boolean(this._config.pinCard)}`,
                `> Client DLL Exported: ${dllLoaded ? "Yes (Variation-Selector FE00..FE0F)" : "No"}`,
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
                "To hide this card and share/piggyback the registry stamp on an existing configuration card, change 'Carrier card mode: dedicated' to 'shared' (or 'piggyback' / 'stealth') above."
            ].join("\n");

            return {
                entry: lines.join("\n"),
                description
            };
        }

        findSharedCarrier(cards) {
            if (!Array.isArray(cards) || cards.length === 0) return null;
            for (const c of cards) {
                if (c && c.title !== DEDICATED_CARD_TITLE && typeof c.keys === "string" && (c.keys.includes(STAMP_START) || c.keys.includes(DLL_START))) {
                    return c;
                }
            }
            for (const c of cards) {
                if (c && c.title !== DEDICATED_CARD_TITLE && typeof c.title === "string" && c.title.includes("Configure")) {
                    return c;
                }
            }
            for (const c of cards) {
                if (c && c.title !== DEDICATED_CARD_TITLE) {
                    return c;
                }
            }
            return null;
        }

        write(packet, options = {}) {
            if (!packet || typeof packet !== "object") return packet;
            const mode = this.resolveCardMode(packet);
            packet.mode = mode;

            if (typeof globalThis !== "undefined") {
                globalThis._AID_CSCP_PACKET = packet;
            }

            const cards = getStoryCards();
            if (!cards) return packet;

            const dllFrame = this.findActiveDLLFrame(cards);
            const encoded = serialize(packet);
            if (!encoded) return packet;

            const addCardFn = (typeof addStoryCard === "function")
                ? addStoryCard
                : (typeof globalThis !== "undefined" && typeof globalThis.addStoryCard === "function" ? globalThis.addStoryCard : null);
            const removeCardFn = (typeof removeStoryCard === "function")
                ? removeStoryCard
                : (typeof globalThis !== "undefined" && typeof globalThis.removeStoryCard === "function" ? globalThis.removeStoryCard : null);

            if (mode === "dedicated") {
                let dedIdx = cards.findIndex(c => c && c.title === DEDICATED_CARD_TITLE);
                let dedCard = dedIdx !== -1 ? cards[dedIdx] : null;
                const allowCreate = options.createCard !== undefined ? options.createCard : this._config.autoCreateCard;

                if (!dedCard && allowCreate && addCardFn) {
                    const fmt = this.formatDashboardCard(packet);
                    const fullKeys = DEFAULT_CARD_KEYS + dllFrame + encoded;
                    addCardFn(fullKeys, fmt.entry, "class", DEDICATED_CARD_TITLE, fmt.description);
                    dedIdx = cards.findIndex(c => c && c.title === DEDICATED_CARD_TITLE);
                    dedCard = dedIdx !== -1 ? cards[dedIdx] : cards[cards.length - 1];
                    if (dedCard) {
                        dedCard.title = DEDICATED_CARD_TITLE;
                        dedCard.type = "class";
                        dedCard.keys = fullKeys;
                        dedCard.entry = fmt.entry;
                        dedCard.description = fmt.description;
                    }
                } else if (dedCard) {
                    const fmt = this.formatDashboardCard(packet);
                    const baseKeys = strip(dedCard.keys || "").trim() || DEFAULT_CARD_KEYS;
                    dedCard.keys = baseKeys + dllFrame + encoded;
                    dedCard.entry = fmt.entry;
                    dedCard.description = fmt.description;
                }

                if (dedCard && this._config.pinCard && dedIdx > 0) {
                    cards.splice(dedIdx, 1);
                    cards.unshift(dedCard);
                }

                if (dedCard) {
                    for (const c of cards) {
                        if (c && c !== dedCard && typeof c.keys === "string" && (c.keys.includes(STAMP_START) || c.keys.includes(DLL_START))) {
                            c.keys = strip(c.keys);
                        }
                    }
                } else {
                    const carrier = this.findSharedCarrier(cards);
                    if (carrier) {
                        carrier.keys = strip(carrier.keys || "") + dllFrame + encoded;
                    }
                }
            } else {
                const dedIdx = cards.findIndex(c => c && c.title === DEDICATED_CARD_TITLE);
                if (dedIdx !== -1) {
                    if (removeCardFn) {
                        removeCardFn(dedIdx);
                    } else {
                        cards.splice(dedIdx, 1);
                    }
                }
                const carrier = this.findSharedCarrier(cards);
                if (carrier) {
                    for (const c of cards) {
                        if (c && c !== carrier && typeof c.keys === "string" && (c.keys.includes(STAMP_START) || c.keys.includes(DLL_START))) {
                            c.keys = strip(c.keys);
                        }
                    }
                    carrier.keys = strip(carrier.keys || "") + dllFrame + encoded;
                }
            }

            return packet;
        }

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
                if ((packet.p === "input" || packet.p === "context" || packet.p === "output") && packet.order.length > 0) {
                    packet.lastOrder = [...packet.order];
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
                for (const s of Object.values(packet.slots)) {
                    s.active = [];
                    s.yielded = [];
                }
            }

            if (!packet.order.includes(slotUid)) {
                packet.order.push(slotUid);
            }

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
    cscp.stripStamp = stripStamp;
    cscp.hasStamp = hasStamp;
    cscp.encodeDLL = encodeDLL;
    cscp.decodeDLL = decodeDLL;
    cscp.extractDLLFrame = extractDLLFrame;
    cscp.stripDLL = stripDLL;
    cscp.hasDLL = hasDLL;
    cscp.getTurnKey = getTurnKey;
    cscp.normalizeCardMode = normalizeCardMode;

    if (typeof globalThis !== "undefined") {
        globalThis.AID_CSCP = cscp;
    }

    return cscp;
});
