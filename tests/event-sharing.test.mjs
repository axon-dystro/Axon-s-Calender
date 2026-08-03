import test from "node:test";
import assert from "node:assert/strict";

import { ILLIDOR_PRESET } from "../scripts/calendar-config.js";
import { MODULE_ID, SETTINGS, VISIBILITY } from "../scripts/constants.js";

function makeUser(id, { isGM = false, notes = [] } = {}) {
  let storedNotes = structuredClone(notes);
  return {
    id,
    isGM,
    getFlag(moduleId, key) {
      assert.equal(moduleId, MODULE_ID);
      assert.equal(key, "personalNotes");
      return storedNotes;
    },
    async setFlag(moduleId, key, value) {
      assert.equal(moduleId, MODULE_ID);
      assert.equal(key, "personalNotes");
      storedNotes = structuredClone(value);
    }
  };
}

const player = makeUser("player-1", {
  notes: [{ id: "private", title: "Nur ich", visibility: VISIBILITY.PRIVATE, ownerId: "player-1" }]
});
const otherPlayer = makeUser("player-2", {
  notes: [{ id: "shared-other", title: "Für alle", visibility: VISIBILITY.PUBLIC, ownerId: "player-2" }]
});
const users = [player, otherPlayer];
users.get = (id) => users.find((user) => user.id === id);
users.contents = users;

globalThis.foundry = { utils: { randomID: () => "generated-note" } };
globalThis.Hooks = { callAll() {} };
globalThis.ui = { notifications: { info() {}, warn() {} } };
globalThis.game = {
  user: player,
  users,
  settings: {
    get(moduleId, key) {
      assert.equal(moduleId, MODULE_ID);
      if (key === SETTINGS.CALENDAR_CONFIG) return ILLIDOR_PRESET;
      if (key === SETTINGS.PUBLIC_EVENTS) return [];
      if (key === SETTINGS.FEATURE_PUBLIC_EVENTS || key === SETTINGS.FEATURE_PERSONAL_NOTES) return true;
      return false;
    }
  }
};

const { CalendarStore, canUserEditEvent } = await import("../scripts/store.js");

test("Spieler können eine eigene Notiz öffentlich teilen", async () => {
  const saved = await CalendarStore.saveEvent({
    title: "Gruppennotiz",
    description: "Treffpunkt am Nordtor",
    visibility: VISIBILITY.PUBLIC,
    ownerId: "spoofed-owner",
    category: "note",
    start: { year: 278, season: 5, month: 2, day: 11 },
    end: { year: 278, season: 5, month: 2, day: 11 }
  });

  assert.equal(saved.ownerId, player.id);
  assert.equal(saved.visibility, VISIBILITY.PUBLIC);
  assert.equal(saved.storage, "user");
  assert.equal(CalendarStore.getPersonalNotes(player).some((event) => event.id === saved.id), true);
  assert.equal(CalendarStore.getSharedPlayerNotes().some((event) => event.id === saved.id), true);
});

test("private Notizen werden beim Zusammenlesen nicht veröffentlicht", () => {
  const shared = CalendarStore.getSharedPlayerNotes();
  assert.equal(shared.some((event) => event.id === "private"), false);
  assert.equal(shared.some((event) => event.id === "shared-other"), true);
});

test("nur Besitzer und GM dürfen eine geteilte Spielernotiz bearbeiten", () => {
  const event = { visibility: VISIBILITY.PUBLIC, ownerId: player.id };
  assert.equal(canUserEditEvent(event, player), true);
  assert.equal(canUserEditEvent(event, otherPlayer), false);
  assert.equal(canUserEditEvent(event, { id: "gm", isGM: true }), true);
});
