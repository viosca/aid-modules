# AI Dungeon Module Specification (AMS v1.0.0) 📜

> An open, lightweight introspection, discovery, and dependency contract for AI Dungeon scripts and interactive fiction engines.

---

## 1. Motivation

AI Dungeon scenarios and adventures can execute multiple community scripts in sequence via the **Script Management Run Order** (`Scripts run from top to bottom`). However, without a common introspection contract:
- Scripts cannot detect whether their required dependencies are loaded.
- Version and build lineage cannot be verified when players experience bugs.
- Different creators invent conflicting global namespaces (`state.modules`, `globalThis.MODS`, `window.plugins`).

The **AI Dungeon Module Specification (AMS)** defines a standard, zero-dependency contract that allows any script to declare its presence, publish its public API, inspect other loaded libraries, and provide transparent diagnostic reporting.

---

## 2. Module Record Schema

Every participating script publishes a module record adhering to the following schema:

```typescript
interface AIDModuleRecord {
    // ------------------------------------------------------------------------
    // REQUIRED FIELDS
    // ------------------------------------------------------------------------

    /** Canonical unique identifier in kebab-case (e.g. "aid-getopt", "entity-cards") */
    name: string;

    /** Semantic version string (e.g. "1.0.0", "2.8.0") */
    version: string;

    // ------------------------------------------------------------------------
    // RECOMMENDED METADATA
    // ------------------------------------------------------------------------

    /** Git short commit hash (e.g. "f951404") */
    gitHash?: string;

    /** Build generation timestamp (e.g. "2026-11-06 20:17 UTC") */
    buildTime?: string;

    /** Author name or AI Dungeon profile handle (e.g. "Randy Viosca (@Random_Variable)") */
    author?: string;

    /** Concise single-sentence description of the module */
    description?: string;

    /** Canonical repository URL or homepage */
    repository?: string;

    // ------------------------------------------------------------------------
    // INTERFACES & INTROSPECTION
    // ------------------------------------------------------------------------

    /** The public API, class, or object exported by the module for other scripts */
    exports?: any;

    /**
     * Diagnostic function returning a single-line summary string.
     * Example: () => "GetoptAID v1.0.0 (f951404) [2026-11-06 20:17 UTC]"
     */
    diag?: () => string;

    /** Optional dependency declarations with SemVer ranges (e.g. { "aid-getopt": ">=1.0.0" }) */
    dependencies?: Record<string, string>;
}
```

---

## 3. Global Storage & Backward Compatibility

To ensure zero dependencies and complete interoperability:

1. **Global Storage:**  
   The canonical registry dictionary is stored at `globalThis.AID_MODULES`.
2. **Direct Dictionary Fallback:**  
   Any script can register directly by assigning to the dictionary without importing a library:
   ```javascript
   (globalThis.AID_MODULES ??= {})["my-script"] = {
       name: "my-script",
       version: "1.0.0",
       diag: () => "MyScript v1.0.0"
   };
   ```
3. **Registry Manager:**  
   When the `aid-modules` manager is loaded, it attaches to `globalThis.AID`, adopts any pre-existing records in `globalThis.AID_MODULES`, and wraps them with helper accessors (`get`, `has`, `require`, `list`, `report`).

---

## 4. SemVer Resolution & Upgrade Precedence

When multiple copies or versions of the same module are registered (e.g. Script A bundles `aid-getopt v1.0.0` while Script B bundles `aid-getopt v1.1.0`):

1. **Newer Version Wins:**  
   The registry compares semantic versions (`major.minor.patch`). If the incoming module is newer than the existing module, it upgrades the registry record and `exports` reference.
2. **No Downgrades:**  
   If an older version attempts to register over a newer version, the older registration is safely ignored, preserving the newer API for all scripts.
3. **Range Matching:**  
   `AID.has(name, range)` and `AID.require(name, range)` support standard SemVer checks:
   - Exact match: `"1.0.0"`
   - Minimum: `">=1.0.0"`
   - Compatible: `"^1.0.0"`
   - Tilde: `"~1.0.0"`

---

## 5. Standard In-Game Commands

Participating suites should expose module status to players via:
- **`/mods`** (aliases: `/plugins`, `/modules`): Formats a user-facing manifest of all loaded scripts, their versions, and descriptions.
- **Diagnostic integration**: Script-specific diagnostic commands (like `/ec -i` or `/status`) should query `AID.list()` or `AID.report()` to display the active script ecosystem.
