// ============================================================================
//
//                             USE THIS VERSION
//
//                      AID-Modules Registry (Ver. 1.0.0)
//
//   Build Generation: 2026-11-09 16:24:59 UTC
//   Git Commit:       252fabf
//   Repository:       https://github.com/viosca/aid-modules
//   License:          MIT (c) Randy Viosca (@Random_Variable)
//
//   Paste this whole file as your ENTIRE "Library" tab in AI Dungeon.
//
//   If publishing as a standalone script module on AI Dungeon:
//   1. In scenario Details -> Player presentation -> toggle "Mark as Script" ON.
//   2. In Scripts -> Library tab, paste this file.
//   3. In your scenario RUN ORDER, place AID-Modules at the TOP so all downstream
//      scripts can register and inspect modules!
//
// ============================================================================

/**
 * ============================================================================
 * AID-Modules: Standard Module Registry & Introspection Contract for AI Dungeon
 * ============================================================================
 *
 * Implements the AI Dungeon Module Specification (AMS v1.0.0):
 * - Standardized registration, discovery, and SemVer dependency checking.
 * - 100% backward-compatible with direct globalThis.AID_MODULES dictionary access.
 * - Adopts pre-existing module records from earlier scripts in the Run Order.
 * - Lightweight event bus and formatted manifest reporting for in-game /mods.
 *
 * @version 1.0.0
 * @author Randy Viosca (@Random_Variable on AI Dungeon)
 * @license MIT
 */
(function(root, factory) {
    if (typeof module === "object" && module.exports) {
        module.exports = factory();
    } else {
        root.AID = factory();
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function() {
    "use strict";

    const VERSION = "1.0.0";
    const GIT_HASH = "252fabf";
    const BUILD_TIME = "2026-11-09 16:24:59 UTC";

    /**
     * Parses a semantic version string into numeric [major, minor, patch].
     * @param {string} str SemVer string
     * @returns {[number, number, number]}
     */
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

    /**
     * Compares two semantic versions.
     * @returns {number} 1 if v1 > v2, -1 if v1 < v2, 0 if v1 === v2
     */
    function compareSemver(v1, v2) {
        const [maj1, min1, pat1] = parseSemver(v1);
        const [maj2, min2, pat2] = parseSemver(v2);
        if (maj1 !== maj2) return maj1 > maj2 ? 1 : -1;
        if (min1 !== min2) return min1 > min2 ? 1 : -1;
        if (pat1 !== pat2) return pat1 > pat2 ? 1 : -1;
        return 0;
    }

    /**
     * Checks if a version satisfies a SemVer range.
     * Supports: "*", "x.y.z", ">=x.y.z", ">x.y.z", "<=x.y.z", "<x.y.z", "^x.y.z", "~x.y.z"
     * @param {string} version Version to test
     * @param {string} range Target range
     * @returns {boolean}
     */
    function satisfies(version, range) {
        if (!range || range === "*" || range === "latest") return true;
        const r = range.trim();
        const [vMaj, vMin, vPat] = parseSemver(version);

        if (r.startsWith(">=")) return compareSemver(version, r.slice(2)) >= 0;
        if (r.startsWith(">")) return compareSemver(version, r.slice(1)) > 0;
        if (r.startsWith("<=")) return compareSemver(version, r.slice(2)) <= 0;
        if (r.startsWith("<")) return compareSemver(version, r.slice(1)) < 0;
        if (r.startsWith("=")) return compareSemver(version, r.slice(1)) === 0;

        // Caret ^: same major, min version >= target
        if (r.startsWith("^")) {
            const [tMaj, tMin, tPat] = parseSemver(r.slice(1));
            if (vMaj !== tMaj) return false;
            return compareSemver(version, r.slice(1)) >= 0;
        }

        // Tilde ~: same major and minor, patch >= target
        if (r.startsWith("~")) {
            const [tMaj, tMin, tPat] = parseSemver(r.slice(1));
            if (vMaj !== tMaj || vMin !== tMin) return false;
            return vPat >= tPat;
        }

        return compareSemver(version, r) === 0;
    }

    class Registry {
        constructor() {
            this.modules = new Map();
            this.listeners = new Map();
            this.version = VERSION;
            this.gitHash = GIT_HASH;
            this.buildTime = BUILD_TIME;

            // Ensure global dictionary exists and adopt pre-existing records
            if (typeof globalThis !== "undefined") {
                globalThis.AID_MODULES ??= {};
                for (const [key, rawRec] of Object.entries(globalThis.AID_MODULES)) {
                    if (rawRec && typeof rawRec === "object") {
                        this.register(rawRec);
                    }
                }
            }
        }

        /**
         * Registers a module adhering to AMS v1.0.0.
         * If a newer version is registered, it upgrades the record.
         * If an older version is registered, the upgrade is ignored.
         *
         * @param {Object} spec Module specification
         * @returns {Object} Stored module record
         */
        register(spec) {
            if (!spec || typeof spec !== "object") {
                throw new Error("[AID-Modules] Module spec must be an object");
            }
            if (!spec.name || typeof spec.name !== "string") {
                throw new Error("[AID-Modules] Module spec requires a string 'name'");
            }

            const name = spec.name.toLowerCase().trim();
            const version = spec.version ? String(spec.version).trim() : "1.0.0";

            if (this.modules.has(name)) {
                const existing = this.modules.get(name);
                const cmp = compareSemver(version, existing.version);
                if (cmp < 0) {
                    // Older version attempted to overwrite newer: preserve newer!
                    return existing;
                }
            }

            const record = {
                name,
                version,
                gitHash: spec.gitHash ? String(spec.gitHash).trim() : null,
                buildTime: spec.buildTime ? String(spec.buildTime).trim() : null,
                author: spec.author ? String(spec.author).trim() : null,
                description: spec.description ? String(spec.description).trim() : null,
                repository: spec.repository ? String(spec.repository).trim() : null,
                exports: spec.exports ?? spec.api ?? null,
                dependencies: (typeof spec.dependencies === "object" && spec.dependencies !== null)
                    ? Object.assign({}, spec.dependencies)
                    : {},
                diag: (typeof spec.diag === "function")
                    ? spec.diag
                    : () => `${spec.name} v${version}${spec.gitHash ? ` (${spec.gitHash})` : ""}`
            };

            this.modules.set(name, record);

            // Backward compatibility: keep globalThis.AID_MODULES dictionary in sync
            if (typeof globalThis !== "undefined") {
                globalThis.AID_MODULES ??= {};
                globalThis.AID_MODULES[name] = record;
            }

            this.emit("register", record);
            return record;
        }

        /**
         * Unregisters a module.
         * @param {string} name Module name
         * @returns {boolean} True if removed
         */
        unregister(name) {
            const key = String(name || "").toLowerCase().trim();
            const removed = this.modules.delete(key);
            if (typeof globalThis !== "undefined" && globalThis.AID_MODULES) {
                delete globalThis.AID_MODULES[key];
            }
            if (removed) this.emit("unregister", key);
            return removed;
        }

        /**
         * Retrieves a registered module record by name.
         * @param {string} name Module name
         * @returns {Object|null}
         */
        get(name) {
            const key = String(name || "").toLowerCase().trim();
            return this.modules.get(key) || null;
        }

        /**
         * Checks if a module is registered, with optional SemVer range matching.
         * @param {string} name Module name
         * @param {string} [range] Optional SemVer range (e.g. ">=1.0.0", "^2.0.0")
         * @returns {boolean}
         */
        has(name, range) {
            const rec = this.get(name);
            if (!rec) return false;
            if (!range) return true;
            return satisfies(rec.version, range);
        }

        /**
         * Requires a module, returning its exports or throwing a descriptive error.
         * @param {string} name Module name
         * @param {string} [range] Optional SemVer range
         * @returns {*} Module exports
         */
        require(name, range) {
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

        /**
         * Returns an array of all registered module records.
         * @returns {Array<Object>}
         */
        list() {
            return Array.from(this.modules.values());
        }

        /**
         * Returns an array of all registered module names.
         * @returns {Array<string>}
         */
        names() {
            return Array.from(this.modules.keys());
        }

        /**
         * Generates a formatted summary report of all registered modules.
         * @param {Object} [options]
         * @param {boolean} [options.verbose=false] Include descriptions and repository links
         * @returns {string} Formatted multiline report
         */
        report(options = {}) {
            const isVerbose = Boolean(options.verbose);
            const list = this.list();

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
                lines.push(`• ${diagStr}`);
                if (isVerbose && mod.description) {
                    lines.push(`  ${mod.description}`);
                }
            }

            lines.push("==================================================================");
            return lines.join("\n");
        }

        /**
         * Attaches an event listener.
         * @param {string} event Event name ("register", "unregister")
         * @param {Function} handler Callback function
         */
        on(event, handler) {
            if (typeof handler !== "function") return;
            if (!this.listeners.has(event)) {
                this.listeners.set(event, new Set());
            }
            this.listeners.get(event).add(handler);
        }

        /**
         * Removes an event listener.
         */
        off(event, handler) {
            if (this.listeners.has(event)) {
                this.listeners.get(event).delete(handler);
            }
        }

        /**
         * Emits an event to registered listeners.
         */
        emit(event, data) {
            if (this.listeners.has(event)) {
                for (const handler of this.listeners.get(event)) {
                    try { handler(data); } catch (e) { /* ignore listener error */ }
                }
            }
        }

        /**
         * Binds an in-game /mods slash command to a GetoptAID router instance.
         * @param {Object} app GetoptAID router instance
         */
        slashCommand(app) {
            if (!app || typeof app.command !== "function") return;
            const registry = this;
            app.command("mods", {
                aliases: ["plugins", "modules"],
                description: "Display registered AI Dungeon modules and versions",
                options: {
                    "verbose|v": false,
                    "help|h|?": false
                },
                action: (flags) => {
                    if (flags.help) {
                        return "📦 Usage: /mods [-v (verbose descriptions)]";
                    }
                    return registry.report({ verbose: flags.verbose });
                }
            });
        }
    }

    // Singleton instance
    const registry = new Registry();

    // Register self
    registry.register({
        name: "aid-modules",
        version: VERSION,
        gitHash: GIT_HASH,
        buildTime: BUILD_TIME,
        author: "Randy Viosca (@Random_Variable)",
        description: "Standard module registry and introspection contract for AI Dungeon",
        repository: "https://github.com/viosca/aid-modules",
        exports: registry,
        diag: () => `aid-modules v${VERSION}${GIT_HASH !== "dev" ? ` (${GIT_HASH})` : ""} [${BUILD_TIME}]`
    });

    // Global registration
    if (typeof globalThis !== "undefined") {
        globalThis.AID = registry;
    }

    return registry;
});
