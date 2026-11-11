# AI Dungeon Module & Multi-Script Specification (AMS v1.1.0) 📜

> **An open, lightweight standard for modular script introspection, SemVer dependency checking, and zero-collision waterfall execution in AI Dungeon and interactive fiction engines.**

---

## 1. Motivation & The Multi-Script Dilemma

AI Dungeon allows scenario creators and players to run multiple community QuickJS scripts simultaneously using the **Script Management Run Order** (*"Scripts run from top to bottom"*). 

In a multi-script scenario, script output from modifier layer $N$ is piped as input into modifier layer $N+1$:

```
Player Action / Slash Command
              │
              ▼
  ┌───────────────────────┐
  │  Script 1 (Upstream)  │  e.g. Router / Utilities
  └───────────┬───────────┘
              │ (text forwarded)
              ▼
  ┌───────────────────────┐
  │  Script 2 (Midstream) │  e.g. Entity-Cards (Lore & World State)
  └───────────┬───────────┘
              │ (text forwarded)
              ▼
  ┌───────────────────────┐
  │ Script 3 (Downstream) │  e.g. Inner-Entity (Character Minds)
  └───────────┬───────────┘
              │
              ▼
       AI Dungeon Engine
```

Without a unified design contract, this sequential waterfall architecture suffers from three critical failure modes:

1. **Downstream Command Starvation (The Collision Problem):**  
   If Script 1 captures generic verbs like `/help`, `/reset`, `/diag`, `/version`, or `/status`, downstream scripts (Script 2, Script 3) are starved—they never receive the player's input.
2. **Conflicting Global Registries:**  
   Different creators invent disparate global tables (`state.modules`, `globalThis.MODS`, `window.plugins`), making it impossible for scripts to introspect peer systems or declare dependencies.
3. **Context Payload Destabilization:**  
   Multiple scripts modifying `onModelContext` may overwrite, truncate, or corrupt model prompts if they do not follow cooperative context-tagging etiquette.

The **AI Dungeon Module Specification (AMS)** provides an open, zero-dependency contract that solves these challenges, ensuring all community scripts can co-exist with **true zero collisions**.

---

## 2. The 3 Golden Rules of Zero-Collision Scripting

To ensure guaranteed interoperability across any combination of creator scripts, participating modules MUST adhere to the following rules:

### Rule 1: Distinct Namespace Prefixes for Gameplay & Story Systems
Player-facing gameplay, world-building, and persona systems MUST reserve and require a unique short prefix (or registered alias) for their slash commands:
- **`Entity-Cards`**: Uses `/ec` (with registered alias `/ac` for Auto-Cards compatibility).
- **`Inner-Entity`**: Uses `/ie`.
- **Strict Prefix Isolation:** A script's command parser **MUST IGNORE** any slash command that does not begin with its designated prefix. Unmatched commands must pass through unaltered to downstream scripts.

### Rule 2: Canonical Package Names for Developer & Infrastructure Tools
Low-level infrastructure libraries, argument parsers, and diagnostic utilities MUST use their canonical kebab-case package name rather than common adventure verbs:
- Use `/aid-modules` (aliases: `/aid-module`), **NOT** `/mods` or `/modules`.
- Use `/aid-getopt` (aliases: `/aid-getopts`), **NOT** `/go`, `/getopt`, `/diag`, or `/test`.
- **Zero Collision Guarantee:** By avoiding common gaming verbs (`/roll`, `/inventory`, `/cast`, `/status`, `/reset`), low-level infrastructure diagnostics can never shadow player narrative actions or game mechanics.

### Rule 3: Cooperative Master Directory for Bare Commands (`/help`)
No individual script owns bare top-level commands like `/help`.
- When an upstream router or command handler intercepts `/help`, it MUST query `globalThis.AID_MODULES` to dynamically compile the **Adventure Command Directory**.
- Every registered module publishes its prefix and a concise `helpSummary`.
- Players see a unified directory listing all active systems in the current adventure, rather than having one script shadow another.

---

## 3. Module Record Schema

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

    /** Build generation timestamp in UTC (e.g. "2026-11-11 05:12 UTC") */
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

    /** The public API, class, or object exported by the module for peer scripts */
    exports?: any;

    /**
     * Diagnostic function returning a single-line summary string.
     * Example: () => "GetoptAID v1.0.0 (f4e216f) [2026-11-11 05:12 UTC]"
     */
    diag?: () => string;

    /** Optional dependency declarations with SemVer ranges (e.g. { "aid-getopt": ">=1.0.0" }) */
    dependencies?: Record<string, string>;

    // ------------------------------------------------------------------------
    // SLASH COMMANDS & HELP DIRECTORY
    // ------------------------------------------------------------------------

    /** Canonical slash command prefix (e.g. "/ec", "/aid-modules") */
    prefix?: string;

    /** Permitted command aliases (e.g. ["/ac"]) */
    aliases?: string[];

    /** Concise single-line summary shown in the master /help directory */
    helpSummary?: string;

    /** Function returning detailed module-specific help text */
    help?: () => string;
}
```

---

## 4. Zero-Dependency Storage & Global Contract

To ensure scripts never require external bundling or rigid load orders:

### 1. Global Storage
The canonical registry dictionary is stored at:
```javascript
globalThis.AID_MODULES
```

### 2. Standalone One-Line Registration
Any community script can participate with zero dependencies by assigning directly to the dictionary in its Shared Library or header:

```javascript
// Standalone registration (no library required)
(globalThis.AID_MODULES ??= {})["my-custom-script"] = {
    name: "my-custom-script",
    version: "1.0.0",
    author: "YourName (@Handle)",
    description: "Dynamic weather simulation",
    prefix: "/weather",
    aliases: ["/wt"],
    helpSummary: "Simulates regional weather patterns and environmental effects",
    diag: () => "WeatherSim v1.0.0 [Active]"
};
```

### 3. Registry Manager (`aid-modules`)
When the `aid-modules` manager library is loaded, it attaches helper methods to `globalThis.AID`, automatically inherits any existing records in `globalThis.AID_MODULES`, and provides:
- `AID.get(name)`: Retrieves a module record.
- `AID.has(name, range)`: Checks if a module is loaded matching an optional SemVer range.
- `AID.require(name, range)`: Asserts a dependency is loaded, throwing a structured diagnostic error if missing.
- `AID.list()`: Returns all registered module records.
- `AID.report()`: Generates a formatted ASCII status banner.

---

## 5. SemVer Resolution & Upgrade Precedence

When multiple copies or bundled versions of the same module exist across different scripts in a scenario:

1. **Newer Version Wins:**  
   The registry compares semantic versions (`major.minor.patch`). If the incoming registration has a higher version than the existing record, it upgrades the record and updates the `exports` reference.
2. **No Downgrades:**  
   If an older version attempts to register over a newer version, the registration is safely ignored, preserving the newer API for all scripts.
3. **Range Matching:**  
   `AID.has(name, range)` and `AID.require(name, range)` support standard SemVer patterns:
   - Exact: `"1.0.0"`
   - Caret (compatible): `"^1.0.0"`
   - Tilde (patch updates): `"~1.0.0"`
   - Inequalities: `">=1.0.0"`, `"<2.0.0"`

---

## 6. Modifier Waterfall Lifecycle Etiquette

Participating scripts must respect AI Dungeon's three-phase modifier execution cycle:

```
Input Turn:     onInput (Script 1)        ──> onInput (Script 2)        ──> Engine
Model Context:  onModelContext (Script 1) ──> onModelContext (Script 2) ──> LLM Prompt
Output Turn:    onOutput (Script 1)       ──> onOutput (Script 2)       ──> Player Screen
```

### 6.1 `onInput` Etiquette
- **Command Handling:** When handling a command targeted at your script, consume the input and set `{ text: "" }` (or provide early-halting diagnostic output via `message`).
- **Passthrough Guarantee:** If an input does not match your command prefix, you **MUST return the input text unmodified**:
  ```javascript
  const modifier = (text) => {
      if (text.startsWith("/myscript")) {
          return handleMyCommand(text);
      }
      // Pass through untouched to downstream scripts!
      return { text };
  };
  ```

### 6.2 `onModelContext` Etiquette
- **Preserve Peer Contributions:** Do not blindly wipe or overwrite `text`.
- **Section Tagging:** Insert story context under recognizable, standard sections (such as `World Lore:`, `Named Entities:`, or `Character Persona:`).
- **Graceful Token Budgeting:** Bound your injected context to reasonable limits (e.g., $\le$ 300–500 tokens) so downstream scripts have room within the model context window.

### 6.3 `onOutput` Etiquette
- **Prose Preservation:** Do not alter core story prose generated by the LLM unless your script explicitly performs stylistic formatting or content transformation.
- **Sentinel Stripping:** If your script uses background control markers (e.g., `ENTITY_BEGIN`, `[THOUGHT_CYCLE]`), strip them cleanly before presenting text to the player.

---

## 7. Reference Implementations

The following open-source repositories provide fully compliant reference implementations:

| Repository | Role | Prefix / Interface | Canonical URL |
| :--- | :--- | :--- | :--- |
| **`aid-modules`** | Core Registry & Standard | `/aid-modules` | [github.com/viosca/aid-modules](https://github.com/viosca/aid-modules) |
| **`aid-getopt`** | CLI Parser & Master `/help` Router | `/aid-getopt`, `/help` | [github.com/viosca/aid-getopt](https://github.com/viosca/aid-getopt) |
| **`Entity-Cards`** | Dynamic NER & Lore Indexing | `/ec`, `/ac` | [github.com/viosca/Entity-Cards](https://github.com/viosca/Entity-Cards) |
| **`Inner-Entity`** | NPC Minds & Reactive State | `/ie` | [github.com/viosca/Inner-Entity](https://github.com/viosca/Inner-Entity) |
| **`aid-testbeds-live`** | Live Automated Verification Suite | Test Runner | [github.com/viosca/aid-testbeds-live](https://github.com/viosca/aid-testbeds-live) |

---

## 8. License

This specification is released under the **MIT License**. It may be freely used, implemented, and extended by any AI Dungeon scenario creator or developer.
