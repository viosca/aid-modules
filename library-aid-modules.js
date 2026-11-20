// ============================================================================
//
//                             USE THIS VERSION
//
//                  AID-Modules & CSCP Server (Ver. 1.1.0)
//
//   Build Generation: 2026-11-20 05:49:53 UTC
//   Git Commit:       20f60bb
//   Repository:       https://github.com/viosca/aid-modules
//   License:          MIT (c) Randy Viosca (@Random_Variable)
//
//   Paste this whole file as your ENTIRE "Library" tab in AI Dungeon.
//
//   Exports the CSCP Client DLL into storyCards using 16 invisible Unicode
//   Variation Selectors (\uFE00..\uFE0F) so downstream script slots can
//   dynamically load the CSCP client at runtime via loadCSCP()!
//
// ============================================================================

/**
 * ============================================================================
 * AID-Modules: Standard Module Registry & CSCP Server for AI Dungeon
 * ============================================================================
 *
 * Implements the AI Dungeon Module Specification (AMS v1.1.0) &
 * Cross-Slot Coordination Protocol (CSCP v1.1.0):
 * - Standardized registration, discovery, and SemVer dependency checking.
 * - Cross-VM / Cross-Slot coordination via zero-width storyCard steganography.
 * - Exports the minified CSCP Client DLL into storyCards using 16 invisible
 *   Unicode Variation Selectors (\uFE00..\uFE0F) for downstream slot loaders.
 * - Supports "dedicated" mode (Dedicated "Configure \nSystem Modules" dashboard card)
 *   and configurable "shared" mode (shares/piggybacks on existing config cards).
 * - Seamless unification of Multi-Slot Waterfalls and All-in-One Monoliths.
 * - 100% domain-agnostic: zero hardcoded knowledge of external gameplay modules.
 *
 * @version 1.1.0
 * @author Randy Viosca (@Random_Variable on AI Dungeon)
 * @license MIT
 */
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
    const GIT_HASH = "20f60bb";
    const BUILD_TIME = "2026-11-20 05:49:53 UTC";

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
         * Builds (or caches) the compact Variation-Selector (\uFE00..\uFE0F) DLL frame (~3.6K chars,
         * well within AI Dungeon's storyCard keys length limit) with stamped gitHash and buildTime.
         */
        buildSelfDLLFrame() {
            if (!this._dllFrame) {
                const compactClientJs = `globalThis.AID_CSCP=(function(){const V=${CSCP_VERSION},GH=${JSON.stringify(GIT_HASH)},BT=${JSON.stringify(BUILD_TIME)},S="\\u200D\\u200C\\u200D",E="\\u200D\\u200B\\u200D",DS="\\u200D\\uFE00\\u200D",DE="\\u200D\\uFE0F\\u200D",DT="Configure \\nSystem Modules";function ser(o){const j=JSON.stringify(o).replace(/[\\u0080-\\uFFFF]/g,c=>"\\\\u"+c.charCodeAt(0).toString(16).padStart(4,"0"));let b="";for(let i=0;i<j.length;i++){const c=j.charCodeAt(i)&255;for(let k=7;k>=0;k--)b+=((c>>k)&1)?"\\u200C":"\\u200B";}return S+b+E;}function des(s){if(typeof s!=="string")return null;const i=s.indexOf(S);if(i===-1)return null;const e=s.indexOf(E,i+3);if(e===-1)return null;const b=s.slice(i+3,e);if(!b.length||b.length%8)return null;let j="";for(let k=0;k<b.length;k+=8){let v=0;for(let m=0;m<8;m++)v=(v<<1)|(b[k+m]==="\\u200C"?1:0);j+=String.fromCharCode(v);}return JSON.parse(j);}function stripStamp(s){if(typeof s!=="string")return"";const i=s.indexOf(S);if(i===-1)return s;const e=s.indexOf(E,i+3);return e===-1?s.slice(0,i):s.slice(0,i)+s.slice(e+3);}function getSC(){return typeof storyCards!=="undefined"&&Array.isArray(storyCards)?storyCards:(Array.isArray(globalThis.storyCards)?globalThis.storyCards:null);}function getSt(){return typeof state!=="undefined"&&state&&typeof state==="object"?state:(globalThis.state&&typeof globalThis.state==="object"?globalThis.state:null);}function getTK(){const inf=typeof info!=="undefined"&&info?info:globalThis.info;const h=typeof history!=="undefined"&&Array.isArray(history)?history:globalThis.history;return((inf&&inf.actionCount)||0)+":"+((h&&h.length)||0);}const vmUid="slot-"+Math.random().toString(36).slice(2,8);return{version:V,gitHash:GH,buildTime:BT,fromDLL:true,serialize:ser,deserialize:des,stripStamp,getSlotUid(){const st=getSt();return st?(st._aid_slot_uid??=vmUid):vmUid;},read(){const sc=getSC();if(sc){for(const c of sc){if(c&&c.title===DT&&typeof c.keys==="string"&&c.keys.includes(S)){const d=des(c.keys);if(d&&d.v===V)return d;}}for(const c of sc){if(c&&typeof c.keys==="string"&&c.keys.includes(S)){const d=des(c.keys);if(d&&d.v===V)return d;}}}return globalThis._AID_CSCP_PACKET||null;},write(p){globalThis._AID_CSCP_PACKET=p;const sc=getSC();if(!sc)return p;const enc=ser(p);let tc=null;for(const c of sc){if(c&&c.title===DT){tc=c;break;}}if(!tc){for(const c of sc){if(c&&typeof c.keys==="string"&&c.keys.includes(S)){tc=c;break;}}}if(tc){tc.keys=stripStamp(tc.keys)+enc;return p;}return p;},announce(spec,opts={}){if(!spec||!spec.name)throw new Error("name required");const u=opts.slotUid||this.getSlotUid(),tk=getTK(),ph=opts.phase||"init",nm=String(spec.name).toLowerCase().trim(),ver=String(spec.version||"1.0.0").trim(),bt=String(spec.buildType||"modular").toLowerCase().trim(),prov=Array.isArray(spec.provides)&&spec.provides.length?spec.provides.map(x=>String(x).toLowerCase().trim()):[nm],inst=spec.instanceId||u,cmds=[];if(spec.prefix)cmds.push(spec.prefix);if(Array.isArray(spec.aliases))cmds.push(...spec.aliases);let p=this.read()||{v:V,t:tk,p:ph,mode:"dedicated",order:[],lastOrder:[],owners:{},collisions:[],slots:{},modules:{}};p.slots??={};p.modules??={};p.order??=[];p.lastOrder??=[];p.owners??={};p.collisions??=[];if((ph==="input"||ph==="context"||ph==="output")&&(p.t!==tk||p.p!==ph)){if(p.order.length)p.lastOrder=[...p.order];p.t=tk;p.p=ph;p.order=[];p.owners={};p.collisions=[];}if(!p.order.includes(u))p.order.push(u);const sr=p.slots[u]??={uid:u,name:nm,buildType:bt,modules:[],provides:[],active:[],yielded:[],cmds:[],lastSeenTurn:tk};sr.lastSeenTurn=tk;if(!sr.modules.includes(nm))sr.modules.push(nm);for(const c of cmds)if(!sr.cmds.includes(c))sr.cmds.push(c);const act=[],yld=[];for(const cap of prov){const own=p.owners[cap];if(own&&(own.slotUid!==u||(spec.instanceId&&own.instanceId!==inst))){yld.push(cap);if(!sr.yielded.includes(cap))sr.yielded.push(cap);p.collisions.push({capability:cap,primarySlot:own.slotUid,primaryModule:own.moduleName,yieldedSlot:u,yieldedModule:nm});}else{p.owners[cap]={slotUid:u,moduleName:nm,instanceId:inst};act.push(cap);if(!sr.active.includes(cap))sr.active.push(cap);}}p.modules[nm]={name:nm,version:ver,buildType:bt,slotUid:u,prefix:spec.prefix||null,aliases:spec.aliases||[],description:spec.description||null,provides:prov,diagText:spec.diagText||(nm+" v"+ver+" ["+bt+"]")};this.write(p);return{slotUid:u,slotOrder:p.order.indexOf(u)+1,active:act,yielded:yld,isColliding:yld.length>0,collisions:p.collisions,packet:p};}};})();`;
                this._dllFrame = encodeDLL(compactClientJs);
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

(function(root, factory) {
    if (typeof module === "object" && module.exports) {
        const cscp = require("./cscp-client");
        module.exports = factory(cscp);
    } else {
        root.AID = factory(root.AID_CSCP);
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function(cscpInstance) {
    "use strict";

    const VERSION = "1.1.0";
    const GIT_HASH = "20f60bb";
    const BUILD_TIME = "2026-11-20 05:49:53 UTC";

    if (!cscpInstance) {
        throw new Error("[AID-Modules] CSCP engine not initialized.");
    }

    // Pre-build the 16-Variation-Selector (\uFE00..\uFE0F) DLL frame from cscpFactory.toString()
    // so the server exports the client DLL onto the carrier storyCard automatically.
    if (typeof cscpInstance.buildSelfDLLFrame === "function") {
        cscpInstance.buildSelfDLLFrame();
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

    // ========================================================================
    // SemVer Utilities
    // ========================================================================

    function parseSemver(str) {
        if (!str || typeof str !== "string") return [0, 0, 0];
        const clean = str.replace(/^v/i, "").trim();
        const m = clean.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
        if (!m) return [0, 0, 0];
        return [
            parseInt(m[1] || "0", 10),
            parseInt(m[2] || "0", 10),
            parseInt(m[3] || "0", 10)
        ];
    }

    function compareSemver(v1, v2) {
        const [maj1, min1, pat1] = parseSemver(v1);
        const [maj2, min2, pat2] = parseSemver(v2);
        if (maj1 !== maj2) return maj1 > maj2 ? 1 : -1;
        if (min1 !== min2) return min1 > min2 ? 1 : -1;
        if (pat1 !== pat2) return pat1 > pat2 ? 1 : -1;
        return 0;
    }

    function satisfies(version, range) {
        if (!range || range === "*" || range === "latest") return true;
        const r = range.trim();
        const [vMaj, vMin, vPat] = parseSemver(version);

        if (r.startsWith(">=")) return compareSemver(version, r.slice(2)) >= 0;
        if (r.startsWith(">")) return compareSemver(version, r.slice(1)) > 0;
        if (r.startsWith("<=")) return compareSemver(version, r.slice(2)) <= 0;
        if (r.startsWith("<")) return compareSemver(version, r.slice(1)) < 0;
        if (r.startsWith("=")) return compareSemver(version, r.slice(1)) === 0;

        if (r.startsWith("^")) {
            const [tMaj] = parseSemver(r.slice(1));
            if (vMaj !== tMaj) return false;
            return compareSemver(version, r.slice(1)) >= 0;
        }

        if (r.startsWith("~")) {
            const [tMaj, tMin, tPat] = parseSemver(r.slice(1));
            if (vMaj !== tMaj || vMin !== tMin) return false;
            return vPat >= tPat;
        }

        return compareSemver(version, r) === 0;
    }

    // ========================================================================
    // AID-Modules Registry & CSCP Server
    // ========================================================================

    class Registry {
        constructor() {
            this.modules = new Map();
            this.listeners = new Map();
            this.version = VERSION;
            this.gitHash = GIT_HASH;
            this.buildTime = BUILD_TIME;
            this.cscp = cscpInstance;

            if (typeof globalThis !== "undefined") {
                globalThis.AID_MODULES ??= {};
                for (const [key, rawRec] of Object.entries(globalThis.AID_MODULES)) {
                    if (rawRec && typeof rawRec === "object") {
                        this.register(rawRec, { skipCSCP: true });
                    }
                }
            }
        }

        /**
         * Exports the CSCP client JS code as a 16-Variation-Selector (\uFE00..\uFE0F) DLL frame.
         * @param {string} [customClientJs] Optional JS source override
         * @returns {string}
         */
        exportClientDLL(customClientJs) {
            if (customClientJs) {
                const frame = this.cscp.encodeDLL(customClientJs);
                this.cscp.setDLLFrame(frame);
                return frame;
            }
            return typeof this.cscp.buildSelfDLLFrame === "function"
                ? this.cscp.buildSelfDLLFrame()
                : (this.cscp._dllFrame || "");
        }

        register(spec, options = {}) {
            if (!spec || typeof spec !== "object") {
                throw new Error("[AID-Modules] Module spec must be an object");
            }
            if (!spec.name || typeof spec.name !== "string") {
                throw new Error("[AID-Modules] Module spec requires a string 'name'");
            }

            const name = spec.name.toLowerCase().trim();
            const version = spec.version ? String(spec.version).trim() : "1.0.0";
            const buildType = spec.buildType ? String(spec.buildType).toLowerCase().trim() : "modular";
            const provides = Array.isArray(spec.provides) && spec.provides.length > 0
                ? spec.provides.map(p => String(p).toLowerCase().trim())
                : [name];

            if (this.modules.has(name)) {
                const existing = this.modules.get(name);
                const cmp = compareSemver(version, existing.version);
                if (cmp < 0) {
                    return existing;
                }
            }

            const slotUid = spec.slotUid || this.cscp.getSlotUid();

            const record = {
                name,
                version,
                buildType,
                provides,
                slotUid,
                gitHash: spec.gitHash ? String(spec.gitHash).trim() : null,
                buildTime: spec.buildTime ? String(spec.buildTime).trim() : null,
                author: spec.author ? String(spec.author).trim() : null,
                description: spec.description ? String(spec.description).trim() : null,
                repository: spec.repository ? String(spec.repository).trim() : null,
                prefix: spec.prefix ? String(spec.prefix).trim() : null,
                aliases: Array.isArray(spec.aliases) ? spec.aliases.map(String) : [],
                helpSummary: spec.helpSummary ? String(spec.helpSummary).trim() : null,
                help: (typeof spec.help === "function" || typeof spec.help === "string") ? spec.help : null,
                exports: spec.exports ?? spec.api ?? null,
                dependencies: (typeof spec.dependencies === "object" && spec.dependencies !== null)
                    ? Object.assign({}, spec.dependencies)
                    : {},
                diag: (typeof spec.diag === "function")
                    ? spec.diag
                    : () => `${spec.name} v${version}${spec.gitHash ? ` (${spec.gitHash})` : ""} [${buildType}]`
            };

            this.modules.set(name, record);

            if (typeof globalThis !== "undefined") {
                globalThis.AID_MODULES ??= {};
                globalThis.AID_MODULES[name] = record;
            }
            const st = getState();
            if (st) {
                st._aid_modules ??= {};
                st._aid_modules[name] = {
                    name: record.name,
                    version: record.version,
                    buildType: record.buildType,
                    provides: record.provides,
                    slotUid: record.slotUid,
                    gitHash: record.gitHash,
                    buildTime: record.buildTime,
                    author: record.author,
                    description: record.description,
                    repository: record.repository,
                    prefix: record.prefix,
                    aliases: record.aliases,
                    helpSummary: record.helpSummary,
                    diagText: typeof record.diag === "function" ? record.diag() : `${record.name} v${record.version}`
                };
            }

            if (!options.skipCSCP && getStoryCards()) {
                this.cscp.announce(record, {
                    phase: options.phase || "init",
                    slotUid: record.slotUid,
                    createCard: options.createCard
                });
            }

            this.emit("register", record);
            return record;
        }

        sync(phase) {
            if (typeof globalThis !== "undefined" && globalThis.AID_MODULES) {
                for (const [key, rawRec] of Object.entries(globalThis.AID_MODULES)) {
                    if (rawRec && typeof rawRec === "object") {
                        const recKey = (rawRec.name || key).toLowerCase().trim();
                        if (!this.modules.has(recKey)) {
                            this.register(rawRec, { skipCSCP: true });
                        }
                    }
                }
            }

            const st = getState();
            if (st && st._aid_modules && typeof st._aid_modules === "object") {
                for (const [key, rawRec] of Object.entries(st._aid_modules)) {
                    if (rawRec && typeof rawRec === "object") {
                        const recKey = (rawRec.name || key).toLowerCase().trim();
                        if (!this.modules.has(recKey)) {
                            const spec = Object.assign({}, rawRec);
                            if (spec.diagText && !spec.diag) {
                                spec.diag = () => spec.diagText;
                            }
                            this.register(spec, { skipCSCP: true });
                        }
                    }
                }
            }

            const packet = this.cscp.read();
            if (packet && packet.modules && typeof packet.modules === "object") {
                for (const [key, rawRec] of Object.entries(packet.modules)) {
                    if (rawRec && typeof rawRec === "object") {
                        const recKey = (rawRec.name || key).toLowerCase().trim();
                        if (!this.modules.has(recKey)) {
                            const spec = Object.assign({}, rawRec);
                            if (spec.diagText && !spec.diag) {
                                spec.diag = () => spec.diagText;
                            }
                            this.register(spec, { skipCSCP: true });
                        } else {
                            const existing = this.modules.get(recKey);
                            if (rawRec.slotUid) existing.slotUid = rawRec.slotUid;
                            if (rawRec.buildType) existing.buildType = rawRec.buildType;
                        }
                    }
                }
            }

            if (phase && getStoryCards()) {
                const selfMod = this.modules.get("aid-modules");
                if (selfMod) {
                    this.cscp.announce(selfMod, { phase });
                }
            }

            return this;
        }

        /**
         * Handles standalone `/aid-modules` commands when AID-Modules runs in its own slot.
         */
        executeCommandString(rawInput) {
            if (typeof rawInput !== "string") return null;
            const trimmed = rawInput.trim().replace(/^>\s*(?:You\s+(?:say,?\s*["“]?)?)?/i, "").replace(/["”.!?\s]+$/, "");
            if (!/^\/aid-modules?(?:\s|$)/i.test(trimmed)) return null;

            const tokens = trimmed.split(/\s+/).slice(1);
            const flags = { verbose: false, cscp: false, version: false, help: false, "card-mode": "" };
            const operands = [];

            for (let i = 0; i < tokens.length; i++) {
                const t = tokens[i];
                if (t === "-v" || t === "--verbose") flags.verbose = true;
                else if (t === "--cscp") flags.cscp = true;
                else if (t === "--version") flags.version = true;
                else if (t === "-h" || t === "--help" || t === "-?") flags.help = true;
                else if ((t === "-m" || t === "--card-mode") && tokens[i + 1]) {
                    flags["card-mode"] = tokens[++i];
                } else if (t.startsWith("--card-mode=")) {
                    flags["card-mode"] = t.slice("--card-mode=".length);
                } else {
                    operands.push(t);
                }
            }

            return this._runCliAction(flags, operands);
        }

        _runCliAction(flags, operands) {
            const sub = (operands[0] || "").toLowerCase();
            if (flags.help || sub === "help") {
                return [
                    "==================================================================",
                    "  📦 AID-Modules & CSCP Command Reference",
                    "==================================================================",
                    "Usage: /aid-modules [-v, --verbose] [--cscp] [--card-mode <dedicated|shared>] [--version]",
                    "Aliases: /aid-module",
                    "Options:",
                    "  -v, --verbose        Display full module metadata and CSCP slot waterfall",
                    "  --cscp               Display CSCP cross-slot bus and carrier status",
                    "  -m, --card-mode <m>  Set CSCP carrier mode: 'dedicated' (aliases: dashboard, visible)",
                    "                       or 'shared' (aliases: piggyback, stealth, headless)",
                    "  --version            Display aid-modules registry version and build timestamp",
                    "  -h, --help           Display this manual",
                    "Displays all active AMS & CSCP-compliant modules across all adventure slots.",
                    "=================================================================="
                ].join("\n");
            }
            if (flags.version || sub === "version") {
                return `📦 aid-modules v${VERSION}${GIT_HASH !== "dev" ? ` (${GIT_HASH})` : ""} [${BUILD_TIME}] (CSCP v${this.cscp.version}.0)`;
            }
            if (flags["card-mode"]) {
                const targetMode = String(flags["card-mode"]).toLowerCase().trim();
                this.cscp.configure({ cardMode: targetMode });
                const pkt = this.cscp.read() || this.cscp.createEmptyPacket();
                pkt.mode = this.cscp._config.cardMode || "dedicated";
                this.cscp.write(pkt, { createCard: pkt.mode === "dedicated" });
                const desc = pkt.mode === "shared"
                    ? "shared (Piggyback Zero-Width Stamp on existing configuration card)"
                    : "dedicated (Dedicated 'Configure System Modules' dashboard card)";
                return `📦 [AID-Modules CSCP]: Carrier mode switched to ${desc}.`;
            }
            return this.report({ verbose: Boolean(flags.verbose || flags.cscp) });
        }

        hook(phase, inText, inStop) {
            this.sync(phase);
            const st = getState();
            if (phase === "input") {
                if (st) delete st._aid_modules_cmd_out;
                const cmdOut = this.executeCommandString(inText);
                if (cmdOut !== null) {
                    if (st) st._aid_modules_cmd_out = cmdOut;
                    return inText;
                }
                return inText;
            }
            if (phase === "context") {
                return [inText, inStop];
            }
            if (phase === "output") {
                if (st && st._aid_modules_cmd_out) {
                    const out = st._aid_modules_cmd_out;
                    delete st._aid_modules_cmd_out;
                    return `${out.trim()}\n`;
                }
                return inText;
            }
            return inText;
        }

        input(inText) {
            return this.hook("input", inText);
        }

        context(inText, inStop) {
            return this.hook("context", inText, inStop);
        }

        output(inText) {
            return this.hook("output", inText);
        }

        unregister(name) {
            const key = String(name || "").toLowerCase().trim();
            const removed = this.modules.delete(key);
            if (typeof globalThis !== "undefined" && globalThis.AID_MODULES) {
                delete globalThis.AID_MODULES[key];
            }
            const st = getState();
            if (st && st._aid_modules) {
                delete st._aid_modules[key];
            }
            const packet = this.cscp.read();
            if (packet && packet.modules && packet.modules[key]) {
                delete packet.modules[key];
                this.cscp.write(packet, { createCard: false });
            }
            if (removed) this.emit("unregister", key);
            return removed;
        }

        get(name) {
            this.sync();
            const key = String(name || "").toLowerCase().trim();
            return this.modules.get(key) || null;
        }

        has(name, range) {
            this.sync();
            const rec = this.get(name);
            if (!rec) return false;
            if (!range) return true;
            return satisfies(rec.version, range);
        }

        require(name, range) {
            this.sync();
            const key = String(name || "").toLowerCase().trim();
            const rec = this.get(key);
            if (!rec) {
                throw new Error(`[AID-Modules] Missing required module "${key}". Ensure it is added to your AI Dungeon RUN ORDER.`);
            }
            if (range && !satisfies(rec.version, range)) {
                throw new Error(`[AID-Modules] Module "${key}" version mismatch: found v${rec.version}, required ${range}.`);
            }
            return rec.exports !== null ? rec.exports : rec;
        }

        list() {
            this.sync();
            return Array.from(this.modules.values());
        }

        names() {
            this.sync();
            return Array.from(this.modules.keys());
        }

        report(options = {}) {
            this.sync();
            const isVerbose = Boolean(options.verbose);
            const list = this.list();
            const packet = this.cscp.read();

            if (list.length === 0) {
                return "📦 No AI Dungeon modules currently registered.";
            }

            const lines = [
                "==================================================================",
                `  📦 Active AI Dungeon Modules (${list.length} loaded)`,
                "=================================================================="
            ];

            for (const mod of list) {
                const diagStr = typeof mod.diag === "function"
                    ? mod.diag()
                    : `${mod.name} v${mod.version}${mod.gitHash ? ` (${mod.gitHash})` : ""}`;
                const slotTag = (isVerbose && mod.slotUid) ? ` {${mod.slotUid}}` : "";
                lines.push(`• ${diagStr}${slotTag}`);
                if (isVerbose && mod.description) {
                    lines.push(`  ${mod.description}`);
                }
            }

            if (packet) {
                const collisions = Array.isArray(packet.collisions) ? packet.collisions : [];
                if (isVerbose) {
                    const modeLabel = packet.mode === "shared"
                        ? "shared (Piggyback Zero-Width Stamp)"
                        : "dedicated (Dedicated System Modules Card)";
                    const orderedUids = (Array.isArray(packet.lastOrder) && packet.lastOrder.length >= (packet.order || []).length)
                        ? packet.lastOrder
                        : (packet.order || []);
                    const allSlotUids = [...new Set([...orderedUids, ...Object.keys(packet.slots || {})])];
                    lines.push("------------------------------------------------------------------");
                    lines.push(`  🔗 CSCP Bus: v${packet.v}.0 | Carrier: ${modeLabel} | DLL Exported: ${Boolean(this.cscp._dllFrame) ? "Yes" : "No"}`);
                    lines.push(`  🌊 Slot Waterfall (${allSlotUids.length} slot${allSlotUids.length === 1 ? "" : "s"}):`);
                    allSlotUids.forEach((uid, idx) => {
                        const s = packet.slots && packet.slots[uid];
                        if (!s) return;
                        const mods = Array.isArray(s.modules) ? s.modules.join(", ") : s.name;
                        const yieldNote = Array.isArray(s.yielded) && s.yielded.length > 0
                            ? ` [YIELDED: ${s.yielded.join(", ")}]`
                            : "";
                        lines.push(`     ${idx + 1}. ${uid} [${s.buildType || "modular"}]: ${mods}${yieldNote}`);
                    });
                }

                if (collisions.length > 0) {
                    lines.push("------------------------------------------------------------------");
                    for (const col of collisions) {
                        lines.push(`  ⚠️ [CAPABILITY COLLISION]: "${col.capability}" claimed by ${col.primarySlot} (${col.primaryModule}); duplicate in ${col.yieldedSlot} (${col.yieldedModule}) automatically bypassed.`);
                    }
                }
            }

            lines.push("==================================================================");
            return lines.join("\n");
        }

        on(event, handler) {
            if (typeof handler !== "function") return;
            if (!this.listeners.has(event)) {
                this.listeners.set(event, new Set());
            }
            this.listeners.get(event).add(handler);
        }

        off(event, handler) {
            if (this.listeners.has(event)) {
                this.listeners.get(event).delete(handler);
            }
        }

        emit(event, data) {
            if (this.listeners.has(event)) {
                for (const handler of this.listeners.get(event)) {
                    try { handler(data); } catch (_) { /* ignore listener error */ }
                }
            }
        }

        slashCommand(app) {
            if (!app || typeof app.command !== "function") return;
            const registry = this;
            app.command("aid-modules", {
                aliases: ["aid-module"],
                description: "Display registered AI Dungeon modules, CSCP waterfall slots, and versions",
                options: {
                    "verbose|v": false,
                    "cscp": false,
                    "card-mode|m=s": "",
                    "version": false,
                    "help|h|?": false
                },
                action: (flags, operands) => registry._runCliAction(flags, operands)
            });
        }
    }

    const registry = new Registry();

    registry.register({
        name: "aid-modules",
        version: VERSION,
        buildType: "modular",
        provides: ["aid-modules"],
        gitHash: GIT_HASH,
        buildTime: BUILD_TIME,
        author: "Randy Viosca (@Random_Variable)",
        description: "Standard module registry and Cross-Slot Coordination Protocol (CSCP) server for AI Dungeon",
        repository: "https://github.com/viosca/aid-modules",
        prefix: "/aid-modules",
        aliases: ["/aid-module"],
        helpSummary: "Display registered AI Dungeon modules and CSCP slot waterfall (/aid-modules -v)",
        exports: registry,
        diag: () => `aid-modules v${VERSION}${GIT_HASH !== "dev" ? ` (${GIT_HASH})` : ""} [${BUILD_TIME}]`
    }, { skipCSCP: true });

    if (typeof globalThis !== "undefined") {
        globalThis.stop ??= false;
        globalThis.AID = registry;
    }

    return registry;
});
