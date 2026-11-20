# Cross-Slot Coordination Protocol Specification (CSCP v1.1.0) 🌐

> **An open, lightweight standard for cross-VM slot discovery, 16-Variation-Selector StoryCard DLL hydration, capability negotiation, and zero-collision waterfall execution in AI Dungeon Adventure Mode.**

---

## 1. Executive Summary & Architectural Motivation

In AI Dungeon **Adventure Mode**, creators and players can attach multiple QuickJS scripts to an adventure and dynamically reorder, add, or remove them at any time via the Script Manager.

### The QuickJS Isolation Model
AI Dungeon executes each script slot in a **separate, isolated QuickJS Virtual Machine (VM)** instance on every turn lifecycle phase (`onInput`, `onModelContext`, `onOutput`):

- **`globalThis` is ephemeral and isolated:** Each slot begins execution with a fresh global scope on every turn hook. Globals assigned in Slot 1 (e.g. `globalThis.MY_MODULE`) do **not** exist in Slot 2.
- **`state` is siloed per slot:** The AI Dungeon backend namespaces the persistence store per script ID (`gameState.scripts[scriptShortId]`). Slot 1 cannot read or write Slot 2's `state` object.
- **Run order is mutable:** A player can drag Slot 3 above Slot 1 mid-adventure, or remove a duplicate or conflicting slot on the fly.

### The Shared Surface Area
Only four communication conduits cross VM boundaries:

1. **`text` (and `stop`):** Piped sequentially as a waterfall ($Slot_1 \to Slot_2 \to \dots \to Slot_N$).
2. **`storyCards`:** A shared mutable array of card objects passed across all slots and persisted to the adventure database across turns.
3. **`history` & `info`:** Read-only shared turn context (`info.actionCount`, `history.length`).
4. **`state.memory` & `state.message`:** Shared player-facing memory and toast buffers.

Without a structured coordination protocol, multi-slot adventures suffer from:
- **Capability Collisions:** Two scripts attempting to perform the same task (e.g. two card generation engines or two combat parsers) duplicate work, corrupt memory, and pollute story cards.
- **Siloed Command Trees:** Downstream scripts cannot publish their slash commands into an upstream master `/help` router.
- **Client Code Bloat:** Requiring every script author to bundle thousands of bytes of inter-slot networking boilerplate wastes script character limits.

The **Cross-Slot Coordination Protocol (CSCP v1.1.0)** solves these challenges through a lightweight, zero-width steganographic data bus and dynamic StoryCard DLL hydration.

---

## 2. Architecture & Wire Formats

CSCP operates via two steganographic channels embedded invisibly inside AI Dungeon's shared `storyCards` array:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       AI DUNGEON ADVENTURE STATE                            │
│  storyCards: [                                                              │
│    {                                                                        │
│      title: "Configure \nSystem Modules",  // Carrier Card                 │
│      keys: "... \u200D\uFE00\u200D[DLL Nibbles]\u200D\uFE0F\u200D"         │
│            "... \u200D\u200C\u200D[State Bits]\u200D\u200B\u200D",         │
│      entry: "..."                                                           │
│    }                                                                        │
│  ]                                                                          │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
        ┌──────────────────────────────┴──────────────────────────────┐
        ▼                                                             ▼
┌─────────────────────────────────┐           ┌──────────────────────────────────┐
│ Channel A: 16-VS Binary DLL     │           │ Channel B: Real-Time State Bus   │
│ - 4-bit nibble encoding         │           │ - 1-bit zero-width encoding      │
│ - \uFE00..\uFE0F selectors      │           │ - \u200B (0) / \u200C (1) bits   │
│ - Minified CSCP client library  │           │ - Shared JSON packet             │
│ - Evaluated via (0, eval)       │           │ - Capability ownership & order   │
└─────────────────────────────────┘           └──────────────────────────────────┘
```

### 2.1 Carrier Card Resolution
CSCP targets a control card to carry protocol frames:
1. **Dedicated Carrier Card (Default):** A card titled `Configure \nSystem Modules`. Created or updated automatically by the CSCP host (`aid-modules`).
2. **Shared Fallback Mode:** If dedicated cards are disabled or absent, CSCP can piggyback onto existing control cards (such as `Configure \nAuto-Cards` or `Configure \nEntity Cards`) without overwriting user lore.

### 2.2 Channel A: 16-Variation-Selector Binary DLL
To provide downstream slots with full client capabilities without copying large libraries, the host compresses the client JavaScript into a binary **Dynamic Link Library (DLL)** using Unicode Variation Selectors:

- **Delimiters:**
  - Start: `\u200D\uFE00\u200D` (ZWJ + VS1 + ZWJ)
  - End: `\u200D\uFE0F\u200D` (ZWJ + VS16 + ZWJ)
- **Nibble Encoding:** Each ASCII byte (0–255) of the minified client code is split into two 4-bit nibbles ($high = \text{byte} \gg 4$, $low = \text{byte} \& 0x0F$):
  $$\text{char}_1 = \text{String.fromCharCode}(0xFE00 + high)$$
  $$\text{char}_2 = \text{String.fromCharCode}(0xFE00 + low)$$
- **Properties:**
  - **Zero Visual Clutter:** Variation Selectors are non-rendering format control characters.
  - **Zero LLM Churn:** Because carrier cards are control cards, these invisible sequences are never matched or injected into LLM story context.

### 2.3 Channel B: Zero-Width Binary State Packet
Runtime telemetry, capability ownership, and execution order are synchronized via a compact JSON packet serialized into zero-width characters:

- **Delimiters:**
  - Start: `\u200D\u200C\u200D` (ZWJ + ZWNJ + ZWJ)
  - End: `\u200D\u200B\u200D` (ZWJ + ZWSP + ZWJ)
- **Bit Encoding:** Each byte of UTF-8 JSON is emitted MSB-first:
  - Bit `0` $\to$ `\u200B` (Zero-Width Space)
  - Bit `1` $\to$ `\u200C` (Zero-Width Non-Joiner)

---

## 3. Developer Integration: The 25-Line Bootstrapper

Any third-party script can participate in CSCP by embedding this self-contained, 25-line bootstrapper:

```javascript
/**
 * Discovers and hydrates the CSCP client DLL exported by aid-modules into storyCards.
 * Uses indirect (0, eval) for safe global execution in QuickJS / <isolated-vm>.
 * @returns {Object|null} Hydrated CSCP client instance, or null if not yet present.
 */
function loadCSCP() {
    const root = typeof globalThis !== "undefined" ? globalThis : this;
    if (root.AID_CSCP) return root.AID_CSCP;
    const sc = (typeof storyCards !== "undefined" && Array.isArray(storyCards))
        ? storyCards
        : (Array.isArray(root.storyCards) ? root.storyCards : null);
    if (sc) {
        for (const c of sc) {
            const k = c && c.keys;
            const s = typeof k === "string" ? k.indexOf("\u200D\uFE00\u200D") : -1;
            if (s !== -1) {
                const e = k.indexOf("\u200D\uFE0F\u200D", s + 3);
                if (e !== -1 && ((e - (s + 3)) % 2 === 0)) {
                    let js = "";
                    for (let i = s + 3; i < e; i += 2) {
                        js += String.fromCharCode(((k.charCodeAt(i) & 15) << 4) | (k.charCodeAt(i + 1) & 15));
                    }
                    return (0, eval)(js + ";globalThis.AID_CSCP;");
                }
            }
        }
    }
    return null;
}
```

> [!IMPORTANT]
> **Why Indirect `(0, eval)` is Mandatory:**  
> AI Dungeon's QuickJS sandbox restricts dynamic code evaluation. Calling `new Function(...)` throws `TypeError: Function is not a constructor`. Indirect eval `(0, eval)(...)` executes cleanly in global scope without lexical leakage.

---

## 4. Module Lifecycle & Capability Announcement

Every participating script calls `announce()` on startup and at the head of turn hooks:

```javascript
// On turn hook entry (input, context, or output):
const cscp = typeof loadCSCP === "function" ? loadCSCP() : null;

if (cscp && typeof cscp.announce === "function") {
    const res = cscp.announce({
        name: "my-module",           // Canonical kebab-case identifier
        version: "1.0.0",            // SemVer string
        provides: ["inventory"],     // Array of capability tokens claimed
        prefix: "/inv",              // Primary command prefix
        aliases: ["/inventory"],     // Optional alternative prefixes
        commands: ["/inv", "/gold"], // All commands exposed
        description: "Player inventory and item weight tracker",
        helpSummary: "Manage inventory, equipped gear, and currency"
    }, {
        phase: hookPhase             // "input" | "context" | "output"
    });

    // Check capability negotiation result:
    if (res && res.yielded.includes("inventory")) {
        // An upstream slot already claimed "inventory"!
        // Bypass or disable local inventory logic to avoid duplication:
        myModule._isBypassed = true;
    }
}
```

### Module Announcement Schema (`spec`)

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| **`name`** | `string` | **Yes** | Canonical module identifier in kebab-case (`"quest-engine"`, `"dice-roller"`). |
| **`version`** | `string` | No | Semantic version string (`"1.2.0"`). Defaults to `"1.0.0"`. |
| **`provides`** | `string[]` | No | List of capability tokens this module can satisfy. Defaults to `[name]`. |
| **`buildType`** | `string` | No | `"modular"` (standalone) or `"all-in-one"` (monolith bundle). Defaults to `"modular"`. |
| **`prefix`** | `string` | No | Primary slash command prefix (`"/quest"`). |
| **`aliases`** | `string[]` | No | Alternative command prefixes (`["/q"]`). |
| **`commands`** | `string[]` | No | Full list of commands handled by this slot (`["/quest", "/journal"]`). |
| **`description`** | `string` | No | Full description for developer diagnostics. |
| **`helpSummary`** | `string` | No | Concise single-line summary for user-facing `/help` directories. |

---

## 5. Capability Negotiation & Collision Resolution

The primary hazard of multi-script adventures is **Capability Collision**—multiple scripts executing the same domain logic simultaneously.

### 5.1 First-Slot Precedence Rule
- Execution order in AI Dungeon is sequential ($Slot_1 \to Slot_2 \to \dots$).
- When Slot 1 announces `provides: ["combat"]`, CSCP assigns ownership:
  $$\text{owners}["\text{combat}"] = \{ \text{slotUid}: Slot_1, \text{moduleName}: "\text{combat-core}" \}$$
- When Slot 2 subsequently announces `provides: ["combat"]`, CSCP detects that `owners["combat"]` is already occupied by $Slot_1$.
- CSCP registers a collision event in `packet.collisions` and places `"combat"` into Slot 2's `yielded` list (`res.yielded = ["combat"]`).

### 5.2 Graceful Capability Yielding
Scripts that declare multi-faceted capabilities (e.g. an All-in-One script providing both `quest-tracker` and `inventory`) must inspect `res.yielded`:

```javascript
if (res.yielded.includes("inventory")) {
    // Upstream slot owns inventory.
    // Defer inventory management to upstream slot:
    this.disableInventorySubsystem();
}

if (res.active.includes("quest-tracker")) {
    // We own quest tracking!
    // Run quest logic normally:
    this.runQuestTracking();
}
```

This guarantees that:
1. No duplicate game mechanics run simultaneously.
2. The user can mix and match specialized modular scripts with bundled monoliths seamlessly.
3. If an upstream script is removed or dragged below, capabilities automatically re-bind to the remaining scripts on the very next turn.

---

## 6. Real-Time Packet Schema (Wire Format)

The serialized JSON packet on Channel B follows this schema:

```typescript
interface CSCPPacket {
    /** Protocol version (integer, current = 1) */
    v: number;

    /** Composite turn key "${info.actionCount}:${history.length}" */
    t: string;

    /** Current execution phase ("init" | "input" | "context" | "output") */
    p: string;

    /** Carrier card mode ("dedicated" | "shared") */
    mode: "dedicated" | "shared";

    /** Active slot execution order for current turn [slotUid_1, slotUid_2, ...] */
    order: string[];

    /** Previous turn's complete slot execution order */
    lastOrder: string[];

    /** Capability ownership registry: capability token -> owner details */
    owners: {
        [capability: string]: {
            slotUid: string;
            moduleName: string;
            instanceId?: string;
        };
    };

    /** Recorded collision events for diagnostic reporting */
    collisions: Array<{
        capability: string;
        primarySlot: string;
        primaryModule: string;
        yieldedSlot: string;
        yieldedModule: string;
    }>;

    /** Per-slot descriptors indexed by slotUid */
    slots: {
        [slotUid: string]: {
            uid: string;
            name: string;
            buildType: string;
            modules: string[];
            provides: string[];
            active: string[];
            yielded: string[];
            cmds: string[];
            lastSeenTurn: string;
        };
    };

    /** Module catalog indexed by canonical module name */
    modules: {
        [moduleName: string]: {
            name: string;
            version: string;
            buildType: string;
            slotUid: string;
            prefix: string | null;
            aliases: string[];
            description: string | null;
            helpSummary?: string;
            provides: string[];
            diagText?: string;
        };
    };
}
```

---

## 7. Master `/help` Aggregation & Ecosystem Discovery

Upstream command routers (such as [`aid-getopt`](https://github.com/viosca/aid-getopt)) use CSCP to provide a unified player directory:

```javascript
// Reading the dynamic cross-slot directory:
const cscp = typeof loadCSCP === "function" ? loadCSCP() : null;
const packet = cscp ? cscp.read() : null;

if (packet && packet.modules) {
    for (const [modName, mod] of Object.entries(packet.modules)) {
        console.log(`Command: ${mod.prefix} - ${mod.helpSummary || mod.description}`);
    }
}
```

When a player enters `/help`, they see all active tools from all slots unified in a single menu:

```text
Commands:
  /help        - Display adventure command directory

Cross-Slot Commands (CSCP):
  /aid-modules - Display registered modules and slot waterfall
  /aid-getopt  - POSIX option parser & command router
  /roll        - Polyhedral dice roller for tabletop checks
  /ec          - Autonomous story cards and lore generation
  /ie          - NPC mind simulation and internal dialogue
```

---

## 8. Author Conformance Checklist

To ensure your script operates seamlessly with other community modules in AI Dungeon:

- [ ] **Unique Prefix:** Your slash commands use a distinct, registered prefix (e.g. `/mytool`).
- [ ] **Embed `loadCSCP()`:** Include the standard 25-line bootstrapper using indirect `(0, eval)`.
- [ ] **Call `announce()`:** Announce during turn hooks with your module metadata, declared capabilities, and `/help` summary.
- [ ] **Respect `yielded`:** If another slot claimed a capability you provide, disable or bypass that specific subsystem to protect the player's game state.
- [ ] **Waterfall Passthrough:** If an input does not match your command prefix, pass `text` through unmodified to downstream scripts.

---

## 9. Reference Implementations

The following open-source repositories provide fully compliant reference implementations:

| Repository | Role | Prefix / Interface | Canonical URL |
| :--- | :--- | :--- | :--- |
| **`aid-modules`** | Core Registry & CSCP Server / DLL Host | `/aid-modules` | [github.com/viosca/aid-modules](https://github.com/viosca/aid-modules) |
| **`aid-getopt`** | CLI Parser & Master `/help` Router | `/aid-getopt`, `/help` | [github.com/viosca/aid-getopt](https://github.com/viosca/aid-getopt) |
| **`Entity-Cards`** | Dynamic NER & Lore Indexing | `/ec`, `/ac` | [github.com/viosca/Entity-Cards](https://github.com/viosca/Entity-Cards) |
| **`Inner-Entity`** | NPC Minds & Reactive State | `/ie` | [github.com/viosca/Inner-Entity](https://github.com/viosca/Inner-Entity) |

---

## 10. License

This specification is released under the **MIT License**. It may be freely implemented, extended, and bundled by any AI Dungeon scenario creator or tool author.
