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

## 7. Cross-Slot Coordination Protocol (CSCP v1.1.0)

> [!TIP]
> For the dedicated standalone developer specification, 25-line bootstrapper, and wire format guide, see **[CSCP_SPECIFICATION.md](CSCP_SPECIFICATION.md)**.

While intra-VM scripts communicate via `globalThis.AID_MODULES`, multi-script scenarios in AI Dungeon execute across **isolated QuickJS Virtual Machines** where `globalThis` and `state` are siloed per slot. The **Cross-Slot Coordination Protocol (CSCP v1.1.0)** bridges these isolated VMs using a steganographic StoryCard data bus and dynamic DLL hydration.

### 7.1 Architecture: The 16-Variation-Selector StoryCard DLL Wire Format

To provide downstream slots with full CSCP client capabilities without requiring each creator to copy thousands of bytes of boilerplate client code, `aid-modules` compiles a minified, git-hashed client library into a binary **Dynamic Link Library (DLL)** and embeds it invisibly into a dedicated control story card:

1. **Carrier Card Resolution:**
   - Dedicated Carrier: `aid-modules` creates or targets a story card titled `Configure \nSystem Modules`.
   - Shared Fallback: If absent, legacy control cards (`Configure \nAuto-Cards`, `Configure \nEntity Cards`) can carry the packet.
2. **Invisible 16-Variation-Selector Encoding:**
   - The compiled client JavaScript is mapped nibble-by-nibble (4 bits each, values `0x0` through `0xF`) to Unicode Variation Selectors:
     - `0x0` $\to$ `\uFE00` (Variation Selector-1)
     - `0x1` $\to$ `\uFE01` (Variation Selector-2)
     - ...
     - `0xF` $\to$ `\uFE0F` (Variation Selector-16)
   - The payload is wrapped with delimiters: `\u200D\uFE00\u200D` ... `\u200D\uFE0F\u200D`.
   - Because Variation Selectors are invisible zero-width formatting characters, they add zero visible clutter to story cards and never trigger as LLM lore keys.
3. **Hydration via Indirect Eval:**
   - Downstream slots (such as `aid-getopt`, `Entity-Cards`, or `Inner-Entity`) include a lightweight bootstrapper (`loadCSCP()`).
   - `loadCSCP()` scans `storyCards` for the delimiter, unpacks the nibbles into JavaScript source, and evaluates it in global scope using **indirect eval** `(0, eval)(code)`.
   - In QuickJS / `<isolated-vm>` environments, indirect eval guarantees global execution without leaking local lexical scope.
   - The evaluated DLL assigns `globalThis.AID_CSCP` and returns the client instance.

### 7.2 Packet Wire Format & Capability Negotiation

CSCP maintains a synchronized state packet across slots via `storyCards`:

```json
{
  "v": 1,
  "t": "14:28",
  "p": "context",
  "mode": "dedicated",
  "order": ["slot-aid-modules", "slot-entity-cards", "slot-inner-entity"],
  "lastOrder": ["slot-aid-modules", "slot-entity-cards", "slot-inner-entity"],
  "owners": {
    "aid-modules": { "slotUid": "slot-aid-modules", "moduleName": "aid-modules" },
    "aid-getopt": { "slotUid": "slot-aid-modules", "moduleName": "aid-modules" },
    "entity-cards": { "slotUid": "slot-entity-cards", "moduleName": "entity-cards" },
    "inner-entity": { "slotUid": "slot-inner-entity", "moduleName": "inner-entity" }
  },
  "collisions": [],
  "slots": { ... },
  "modules": { ... }
}
```

#### Capability Negotiation Rules:
- **`provides`:** A module declares capabilities it can fulfill (e.g. `["entity-cards"]`, `["inner-entity"]`).
- **First-Slot Claims Ownership:** The first slot in run order declaring a capability is registered as its primary `owner` in `p.owners[capability]`.
- **Downstream Yielding:** If a subsequent slot declares the same capability, CSCP flags a collision in `p.collisions` and assigns the capability to `res.yielded`.
- **Double Engine Prevention:** Downstream modules check `res.yielded`:
  - When `Inner-Entity` yields `"entity-cards"`, it sets `_AID_DOUBLE_ENGINE_DETECTED = true` and bypasses its bundled card engine, but maintains **100% active NPC cognition**.
  - When standalone `Entity-Cards` runs downstream of an All-in-One build, it yields `"entity-cards"` and enters a passive bypass state.
- **Dynamic Reconfiguration:** If a player drags scripts or deletes a slot mid-adventure, `turnKey` resets the ownership table, and capabilities re-bind seamlessly to remaining slots on the next turn.

---

## 8. Reference Implementations

The following open-source repositories provide fully compliant reference implementations:

| Repository | Role | Prefix / Interface | Canonical URL |
| :--- | :--- | :--- | :--- |
| **`aid-modules`** | Core Registry & Standard | `/aid-modules` | [github.com/viosca/aid-modules](https://github.com/viosca/aid-modules) |
| **`aid-getopt`** | CLI Parser & Master `/help` Router | `/aid-getopt`, `/help` | [github.com/viosca/aid-getopt](https://github.com/viosca/aid-getopt) |
| **`Entity-Cards`** | Dynamic NER & Lore Indexing | `/ec`, `/ac` | [github.com/viosca/Entity-Cards](https://github.com/viosca/Entity-Cards) |
| **`Inner-Entity`** | NPC Minds & Reactive State | `/ie` | [github.com/viosca/Inner-Entity](https://github.com/viosca/Inner-Entity) |
| **`aid-testbeds-live`** | Live Automated Verification Suite | Test Runner | [github.com/viosca/aid-testbeds-live](https://github.com/viosca/aid-testbeds-live) |

---

## 9. License

This specification is released under the **MIT License**. It may be freely used, implemented, and extended by any AI Dungeon scenario creator or developer.
