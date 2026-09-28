const STORAGE_KEY = "dailyhabits-demo-v2";
const iso = (date) => date.toISOString().slice(0, 10);
import { auth, db } from "./firebase.js";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
const daysAgo = (amount) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - amount);
  return iso(date);
};
const id = (prefix) =>
  prefix +
  "-" +
  Date.now().toString(36) +
  Math.random().toString(36).slice(2, 6);

function completionMap(pattern, offset = 0) {
  const result = {};
  for (let day = 0; day < 40; day += 1) {
    if (pattern(day + offset)) result[daysAgo(day)] = true;
  }
  return result;
}

function seedData() {
  return {
    profile: { name: "Alex Morgan", weekStart: "monday" },
    habits: [
      {
        id: "coding",
        name: "Practice coding",
        icon: "💻",
        category: "Coding",
        color: "#6558b5",
        frequency: "daily",
        startDate: daysAgo(90),
        goal: 100,
        archived: false,
        completions: completionMap((day) => ![4, 11, 19, 27].includes(day)),
      },
      {
        id: "reading",
        name: "Read 20 pages",
        icon: "📚",
        category: "Study",
        color: "#c8782d",
        frequency: "daily",
        startDate: daysAgo(70),
        goal: 60,
        archived: false,
        completions: completionMap((day) => day % 4 !== 1, 1),
      },
      {
        id: "exercise",
        name: "Morning movement",
        icon: "🏃",
        category: "Fitness",
        color: "#347958",
        frequency: "weekdays",
        startDate: daysAgo(50),
        goal: 40,
        archived: false,
        completions: completionMap((day) => day % 3 !== 0, 2),
      },
      {
        id: "water",
        name: "Drink 8 glasses",
        icon: "💧",
        category: "Health",
        color: "#347aa2",
        frequency: "daily",
        startDate: daysAgo(40),
        goal: 30,
        archived: false,
        completions: completionMap((day) => day % 7 !== 3),
      },
    ],
    notes: [
      {
        id: "note-1",
        date: daysAgo(0),
        text: "A short coding session was enough to keep the momentum going today.",
      },
      {
        id: "note-2",
        date: daysAgo(2),
        text: "Morning movement felt easier after preparing everything the night before.",
      },
      {
        id: "note-3",
        date: daysAgo(5),
        text: "A busy day, but I still made time to read before bed.",
      },
    ],
  };
}

function read() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || seedData();
  } catch {
    return seedData();
  }
}
function write(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  return data;
}
function ensure() {
  if (!localStorage.getItem(STORAGE_KEY)) write(seedData());
}
ensure();

export const demoStore = {
  async getState() {
    return structuredClone(read());
  },
  async saveHabit(input) {
    const data = read();
    const existing = data.habits.find((item) => item.id === input.id);
    if (existing) Object.assign(existing, input);
    else
      data.habits.push({
        ...input,
        id: id("habit"),
        archived: false,
        completions: {},
      });
    write(data);
    return data;
  },
  async toggleCompletion(habitId, date) {
    const data = read();
    const habit = data.habits.find((item) => item.id === habitId);
    if (!habit) throw new Error("Habit not found");
    habit.completions[date]
      ? delete habit.completions[date]
      : (habit.completions[date] = true);
    write(data);
    return data;
  },
  async archiveHabit(habitId, archived = true) {
    const data = read();
    const habit = data.habits.find((item) => item.id === habitId);
    if (habit) habit.archived = archived;
    write(data);
    return data;
  },
  async deleteHabit(habitId) {
    const data = read();
    data.habits = data.habits.filter((item) => item.id !== habitId);
    write(data);
    return data;
  },
  async saveNote(input) {
    const data = read();
    const existing = data.notes.find((item) => item.id === input.id);
    if (existing) Object.assign(existing, input);
    else data.notes.unshift({ ...input, id: id("note") });
    write(data);
    return data;
  },
  async deleteNote(noteId) {
    const data = read();
    data.notes = data.notes.filter((item) => item.id !== noteId);
    write(data);
    return data;
  },
  async updateProfile(profile) {
    const data = read();
    data.profile = { ...data.profile, ...profile };
    write(data);
    return data;
  },
  async reset() {
    localStorage.removeItem(STORAGE_KEY);
    ensure();
    return read();
  },
};

function requireUser() {
  const user = auth.currentUser;
  if (!user) throw new Error("AUTH_REQUIRED");
  return user;
}

function habitPayload(input) {
  return {
    name: input.name,
    icon: input.icon,
    category: input.category,
    color: input.color,
    frequency: input.frequency,
    startDate: input.startDate,
    goal: input.goal ?? null,
    archived: Boolean(input.archived),
    updatedAt: serverTimestamp(),
  };
}

export const cloudStore = {
  async getState() {
    const user = requireUser();
    const profileRef = doc(db, "users", user.uid, "profile", "account");
    let profileSnapshot = await getDoc(profileRef);
    if (!profileSnapshot.exists()) {
      await setDoc(profileRef, {
        name:
          user.displayName || user.email?.split("@")[0] || "DailyHabits member",
        email: user.email || "",
        weekStart: "monday",
        updatedAt: serverTimestamp(),
      });
      profileSnapshot = await getDoc(profileRef);
    }

    const habitsSnapshot = await getDocs(
      collection(db, "users", user.uid, "habits"),
    );
    const habits = await Promise.all(
      habitsSnapshot.docs.map(async (habitDocument) => {
        const completionsSnapshot = await getDocs(
          collection(habitDocument.ref, "completions"),
        );
        const completions = {};
        completionsSnapshot.forEach((item) => {
          if (item.data().completed) completions[item.id] = true;
        });
        return { id: habitDocument.id, ...habitDocument.data(), completions };
      }),
    );

    const notesSnapshot = await getDocs(
      collection(db, "users", user.uid, "notes"),
    );
    const notes = notesSnapshot.docs.map((noteDocument) => ({
      id: noteDocument.id,
      ...noteDocument.data(),
    }));
    const profile = profileSnapshot.data();
    return {
      profile: {
        name: profile.name,
        email: profile.email,
        weekStart: profile.weekStart,
      },
      habits,
      notes,
    };
  },

  async saveHabit(input) {
    const user = requireUser();
    const habitRef = input.id
      ? doc(db, "users", user.uid, "habits", input.id)
      : doc(collection(db, "users", user.uid, "habits"));
    const payload = habitPayload(input);
    if (!input.id) payload.createdAt = serverTimestamp();
    await setDoc(habitRef, payload, { merge: Boolean(input.id) });
    return this.getState();
  },

  async toggleCompletion(habitId, date) {
    const user = requireUser();
    const completionRef = doc(
      db,
      "users",
      user.uid,
      "habits",
      habitId,
      "completions",
      date,
    );
    const snapshot = await getDoc(completionRef);
    if (snapshot.exists()) await deleteDoc(completionRef);
    else
      await setDoc(completionRef, {
        completed: true,
        completedAt: serverTimestamp(),
      });
    return this.getState();
  },

  async archiveHabit(habitId, archived = true) {
    const user = requireUser();
    await updateDoc(doc(db, "users", user.uid, "habits", habitId), {
      archived,
      updatedAt: serverTimestamp(),
    });
    return this.getState();
  },

  async deleteHabit(habitId) {
    const user = requireUser();
    const habitRef = doc(db, "users", user.uid, "habits", habitId);
    const completions = await getDocs(collection(habitRef, "completions"));
    const batch = writeBatch(db);
    completions.forEach((item) => batch.delete(item.ref));
    batch.delete(habitRef);
    await batch.commit();
    return this.getState();
  },

  async saveNote(input) {
    const user = requireUser();
    const noteRef = input.id
      ? doc(db, "users", user.uid, "notes", input.id)
      : doc(collection(db, "users", user.uid, "notes"));
    const payload = {
      text: input.text,
      date: input.date,
      updatedAt: serverTimestamp(),
    };
    if (!input.id) payload.createdAt = serverTimestamp();
    await setDoc(noteRef, payload, { merge: Boolean(input.id) });
    return this.getState();
  },

  async deleteNote(noteId) {
    const user = requireUser();
    await deleteDoc(doc(db, "users", user.uid, "notes", noteId));
    return this.getState();
  },

  async updateProfile(profile) {
    const user = requireUser();
    await setDoc(
      doc(db, "users", user.uid, "profile", "account"),
      {
        name: profile.name || user.displayName || "DailyHabits member",
        email: user.email || "",
        weekStart: profile.weekStart || "monday",
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    return this.getState();
  },
};

export { iso };
