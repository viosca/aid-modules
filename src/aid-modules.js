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
/* __EMBED_CSCP_CLIENT__ */
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
    const GIT_HASH = "dev";
    const BUILD_TIME = "dev";

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
                if (st && st._aid_modules_cmd_out) {
                    return ["", true];
                }
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
        globalThis.AID = registry;
    }

    return registry;
});
