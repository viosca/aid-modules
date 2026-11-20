"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const AID = require("../src/aid-modules");
const CSCPClient = require("../src/cscp-client");

console.log("==================================================================");
console.log("  TEST SUITE: CSCP Server & Client (Multi-VM Cross-Slot Protocol)");
console.log("==================================================================");

const SRC_MODULES_PATH = path.resolve(__dirname, "../src/aid-modules.js");
const SRC_CLIENT_PATH = path.resolve(__dirname, "../src/cscp-client.js");
const LIB_MODULES_PATH = path.resolve(__dirname, "../library-aid-modules.js");

const clientCode = fs.readFileSync(SRC_CLIENT_PATH, "utf8");
const serverCode = fs.readFileSync(LIB_MODULES_PATH, "utf8");

// 1. Strict Domain Agnosticism Verification
{
    const modSrc = fs.readFileSync(SRC_MODULES_PATH, "utf8");
    const cliSrc = fs.readFileSync(SRC_CLIENT_PATH, "utf8");
    const forbidden = ["entity-cards", "inner-entity", "Auto-Cards", "Inner Self", "EntityCards", "InnerEntity"];
    for (const term of forbidden) {
        assert(!modSrc.includes(term), `aid-modules.js must be domain-agnostic (found forbidden term: ${term})`);
        assert(!cliSrc.includes(term), `cscp-client.js must be domain-agnostic (found forbidden term: ${term})`);
    }
    console.log("   ✔ Domain-agnostic verification passed (zero hardcoded knowledge of other modules)");
}

// 2. Serialization & Deserialization (Including Unicode & Emoji Safety)
{
    const payload = {
        v: 1,
        t: "42:84",
        p: "context",
        mode: "B",
        meta: "🎭 Unicode & Emoji Safe — αβγ",
        slots: {
            "slot-1a2b": { uid: "slot-1a2b", buildType: "all-in-one", provides: ["cap-a", "cap-b"] }
        }
    };

    const stamped = CSCPClient.serialize(payload);
    assert(stamped.startsWith(CSCPClient.STAMP_START), "Serialized frame must start with STAMP_START");
    assert(stamped.endsWith(CSCPClient.STAMP_END), "Serialized frame must end with STAMP_END");
    assert.strictEqual(CSCPClient.hasStamp("visible-key" + stamped), true);

    // Visible text must remain untouched when stripped
    const carrier = "github.com/viosca/aid-modules" + stamped;
    assert.strictEqual(CSCPClient.strip(carrier), "github.com/viosca/aid-modules");

    // Round-trip decode
    const decoded = CSCPClient.deserialize(carrier);
    assert.deepStrictEqual(decoded, payload);
    console.log("   ✔ CSCP serialize(), deserialize(), strip(), and Unicode round-trip verified");
}

// Helper to run code in an isolated QuickJS-like VM context with per-slot state
function createSlotVM(sharedCards, sharedInfo, sharedHistory, slotState) {
    const sandbox = {
        Math, String, Array, Object, Number, RegExp, Set, Map, JSON,
        parseInt, parseFloat, isNaN, isFinite, Date,
        storyCards: sharedCards,
        info: sharedInfo,
        history: sharedHistory,
        state: slotState,
        text: "",
        stop: false,
        addStoryCard(keys, entry, type, title, description) {
            const card = { keys, entry, type, title, description };
            sharedCards.push(card);
            return card;
        },
        removeStoryCard(index) {
            sharedCards.splice(index, 1);
        }
    };
    sandbox.globalThis = sandbox;
    return { sandbox, ctx: vm.createContext(sandbox) };
}

// 3. Multi-VM Waterfall Discovery & Option B Dedicated System Modules Card
{
    const sharedCards = [];
    const sharedInfo = { actionCount: 10 };
    const sharedHistory = new Array(20).fill({ text: "action" });

    const stateSlot1 = {}; // Slot 1: aid-modules Server
    const stateSlot2 = {}; // Slot 2: Standalone Module A (uses cscp-client only)
    const stateSlot3 = {}; // Slot 3: Modular Module B (uses cscp-client only)

    // Turn 10 Context Phase: Run Slot 1 -> Slot 2 -> Slot 3 in completely isolated VMs
    {
        const vm1 = createSlotVM(sharedCards, sharedInfo, sharedHistory, stateSlot1);
        vm.runInContext(serverCode, vm1.ctx);
        vm1.sandbox.AID.hook("context", "Story context", false);

        const vm2 = createSlotVM(sharedCards, sharedInfo, sharedHistory, stateSlot2);
        vm.runInContext(clientCode, vm2.ctx);
        vm2.sandbox.AID_CSCP.announce({
            name: "weather-engine",
            version: "2.1.0",
            buildType: "standalone",
            provides: ["weather-sim"],
            prefix: "/weather",
            aliases: ["/wt"],
            description: "Dynamic procedural weather system"
        }, { phase: "context" });

        const vm3 = createSlotVM(sharedCards, sharedInfo, sharedHistory, stateSlot3);
        vm.runInContext(clientCode, vm3.ctx);
        vm3.sandbox.AID_CSCP.announce({
            name: "quest-journal",
            version: "1.4.2",
            buildType: "modular",
            provides: ["quest-tracking"],
            prefix: "/quest",
            description: "Autonomous quest log tracker"
        }, { phase: "context" });
    }

    // Verify Option B created exactly 1 "Configure \nSystem Modules" card
    const dedCards = sharedCards.filter(c => c.title === "Configure \nSystem Modules");
    assert.strictEqual(dedCards.length, 1, "Option B must create exactly 1 Dedicated System Modules card");
    const dedCard = dedCards[0];
    assert(CSCPClient.hasStamp(dedCard.keys), "Dedicated card keys must hold the zero-width CSCP stamp");
    assert(dedCard.entry.includes("Active Script Slots (3 detected)"), "Dashboard entry must list all 3 slots");
    assert(dedCard.entry.includes("aid-modules v1.1.0"), "Dashboard must show Slot 1 aid-modules");
    assert(dedCard.entry.includes("weather-engine v2.1.0 -> /weather, /wt"), "Dashboard must show Slot 2 weather-engine");
    assert(dedCard.entry.includes("quest-journal v1.4.2 -> /quest"), "Dashboard must show Slot 3 quest-journal");
    assert(dedCard.entry.includes("Status: Healthy (0 collisions)"), "Dashboard must report 0 collisions");

    // Next Turn Input Phase: Slot 1 (aid-modules) runs FIRST and inspects registry via report()
    sharedInfo.actionCount = 11;
    {
        const vm1 = createSlotVM(sharedCards, sharedInfo, sharedHistory, stateSlot1);
        vm.runInContext(serverCode, vm1.ctx);
        vm1.sandbox.AID.hook("input", "/aid-modules -v");

        assert.strictEqual(vm1.sandbox.AID.has("weather-engine", "^2.0.0"), true, "Slot 1 must discover Slot 2 across VMs");
        assert.strictEqual(vm1.sandbox.AID.has("quest-journal", ">=1.4.0"), true, "Slot 1 must discover Slot 3 across VMs");

        const report = vm1.sandbox.AID.report({ verbose: true });
        assert(report.includes("Active AI Dungeon Modules (3 loaded)"));
        assert(report.includes("Option B (Dedicated System Modules Card)"));
        assert(report.includes("weather-engine v2.1.0"));
        assert(report.includes("quest-journal v1.4.2"));
    }

    console.log("   ✔ Multi-VM discovery & Option B Dedicated System Modules dashboard verified");
}

// 4. Transition from Option B (Dedicated Card) to Option C (Piggyback Mode)
{
    const existingConfigCard = {
        title: "Configure \nCustom Engine",
        type: "class",
        keys: "custom-engine-key",
        entry: "> Enable Custom Engine: true",
        description: "Settings for Custom Engine"
    };
    const sharedCards = [existingConfigCard];
    const sharedInfo = { actionCount: 1 };
    const sharedHistory = [];
    const stateSlot1 = {};

    // Start in Option B (default)
    const vm1 = createSlotVM(sharedCards, sharedInfo, sharedHistory, stateSlot1);
    vm.runInContext(serverCode, vm1.ctx);
    vm1.sandbox.AID.hook("context", "Context", false);

    assert.strictEqual(sharedCards.some(c => c.title === "Configure \nSystem Modules"), true, "Dedicated card initially present");

    // Player edits the dedicated card in-game: sets "Dedicated System Modules card: false"
    const dedCard = sharedCards.find(c => c.title === "Configure \nSystem Modules");
    dedCard.entry = dedCard.entry.replace("Dedicated System Modules card: true", "Dedicated System Modules card: false");

    // Next hook invocation detects the toggle, removes the dedicated card, and piggybacks onto "Configure \nCustom Engine"
    vm1.sandbox.AID.hook("output", "Output");

    assert.strictEqual(sharedCards.some(c => c.title === "Configure \nSystem Modules"), false, "Dedicated card must be removed when switched to Option C");
    assert.strictEqual(CSCPClient.hasStamp(existingConfigCard.keys), true, "Stamp must be transferred to existing Configure card in Option C");
    assert.strictEqual(CSCPClient.strip(existingConfigCard.keys), "custom-engine-key", "Original visible keys on carrier card must remain intact");

    const pkt = CSCPClient.deserialize(existingConfigCard.keys);
    assert.strictEqual(pkt.mode, "C");
    console.log("   ✔ Option B -> Option C live toggle and zero-extra-card piggybacking verified");
}

// 5. Monolith (All-in-One) vs. Standalone Capability Collision, Live Slot Reordering, and Slot Removal
{
    const sharedCards = [];
    const sharedInfo = { actionCount: 20 };
    const sharedHistory = new Array(40).fill({ text: "turn" });

    const stateStandalone = {}; // Standalone "lore-engine" providing ["lore-indexer"]
    const stateMonolith = {};   // All-in-One "mega-suite" providing ["mind-sim", "lore-indexer", "cli-router"]

    function runStandaloneSlot(phase) {
        const v = createSlotVM(sharedCards, sharedInfo, sharedHistory, stateStandalone);
        vm.runInContext(clientCode, v.ctx);
        return v.sandbox.AID_CSCP.announce({
            name: "lore-engine",
            version: "3.0.0",
            buildType: "standalone",
            provides: ["lore-indexer"],
            prefix: "/lore"
        }, { phase });
    }

    function runMonolithSlot(phase) {
        const v = createSlotVM(sharedCards, sharedInfo, sharedHistory, stateMonolith);
        vm.runInContext(serverCode, v.ctx);
        return v.sandbox.AID.cscp.announce({
            name: "mega-suite",
            version: "3.0.0",
            buildType: "all-in-one",
            provides: ["mind-sim", "lore-indexer", "cli-router"],
            prefix: "/mega"
        }, { phase });
    }

    // Turn 20: Slot 1 = Standalone, Slot 2 = Monolith
    let res1 = runStandaloneSlot("context");
    let res2 = runMonolithSlot("context");

    assert.strictEqual(res1.isColliding, false);
    assert.deepStrictEqual(Array.from(res1.active), ["lore-indexer"]);
    assert.strictEqual(res2.isColliding, true, "Downstream monolith must detect collision on lore-indexer");
    assert.deepStrictEqual(Array.from(res2.active), ["mind-sim", "cli-router"], "Monolith keeps non-colliding capabilities active");
    assert.deepStrictEqual(Array.from(res2.yielded), ["lore-indexer"], "Monolith yields only the colliding capability");

    // Turn 21: Player drags Monolith (Slot 2) ABOVE Standalone (Slot 1) in Adventure Mode!
    sharedInfo.actionCount = 21;
    let rev1 = runMonolithSlot("context");
    let rev2 = runStandaloneSlot("context");

    assert.deepStrictEqual(Array.from(rev1.active), ["mind-sim", "lore-indexer", "cli-router"], "Upstream monolith now claims all 3 capabilities");
    assert.deepStrictEqual(Array.from(rev1.yielded), []);
    assert.strictEqual(rev2.isColliding, true, "Downstream standalone now yields lore-indexer");
    assert.deepStrictEqual(Array.from(rev2.yielded), ["lore-indexer"]);

    // Turn 22: Player deletes the redundant Standalone slot, leaving only the Monolith
    sharedInfo.actionCount = 22;
    let solo = runMonolithSlot("context");
    // Advance to Turn 23 to trigger turn-boundary pruning of unexecuted slots
    sharedInfo.actionCount = 23;
    solo = runMonolithSlot("context");

    assert.strictEqual(solo.isColliding, false, "Collision must self-heal when duplicate slot is removed");
    assert.strictEqual(solo.collisions.length, 0);
    assert.strictEqual(Object.keys(solo.packet.slots).length, 1, "Deleted slot must be pruned from registry");

    console.log("   ✔ Monolith partial-capability yielding, live slot reordering, and slot removal self-healing verified");
}

console.log("==================================================================");
console.log("  🎉 ALL CSCP SERVER & CLIENT TESTS PASSED (100% SUCCESS)");
console.log("==================================================================");
