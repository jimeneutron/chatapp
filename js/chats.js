// js/chats.js
import { db, auth } from "./firebase-init.js";
import {
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

export const GLOBAL_CHAT_ID = "global";

// Make sure the global room document exists. Safe to call every load —
// it only writes if the doc is missing.
export async function ensureGlobalChat() {
  const ref = doc(db, "chats", GLOBAL_CHAT_ID);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      type: "global",
      name: "global",
      members: [],
      createdAt: serverTimestamp(),
      lastMessage: null
    });
  }
}

// Look up a user document by email. Returns null if not found.
export async function findUserByEmail(email) {
  const q = query(collection(db, "users"), where("email", "==", email.trim().toLowerCase()));
  const { getDocs } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { uid: d.id, ...d.data() };
}

function sortedPrivateChatId(uidA, uidB) {
  return "private_" + [uidA, uidB].sort().join("_");
}

// Create (or reuse) a 1:1 private chat with another user, found by email.
export async function createPrivateChat(otherEmail) {
  const me = auth.currentUser;
  if (otherEmail.trim().toLowerCase() === me.email.toLowerCase()) {
    throw new Error("You can't start a chat with yourself.");
  }
  const other = await findUserByEmail(otherEmail);
  if (!other) throw new Error("No user found with that email.");

  const chatId = sortedPrivateChatId(me.uid, other.uid);
  const ref = doc(db, "chats", chatId);
  const existing = await getDoc(ref);
  if (!existing.exists()) {
    await setDoc(ref, {
      type: "private",
      members: [me.uid, other.uid],
      memberInfo: {
        [me.uid]: { displayName: me.displayName, photoURL: me.photoURL },
        [other.uid]: { displayName: other.displayName, photoURL: other.photoURL }
      },
      createdAt: serverTimestamp(),
      createdBy: me.uid,
      lastMessage: null
    });
  }
  return chatId;
}

// Create a group chat. memberEmails is an array of email strings (not including self).
export async function createGroupChat(name, memberEmails) {
  const me = auth.currentUser;
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error("Give the group a name.");

  const resolved = [];
  for (const email of memberEmails) {
    const clean = email.trim();
    if (!clean) continue;
    const user = await findUserByEmail(clean);
    if (!user) throw new Error(`No user found with email: ${clean}`);
    resolved.push(user);
  }
  if (resolved.length === 0) throw new Error("Add at least one other member.");

  const memberInfo = {
    [me.uid]: { displayName: me.displayName, photoURL: me.photoURL }
  };
  const members = [me.uid];
  for (const u of resolved) {
    members.push(u.uid);
    memberInfo[u.uid] = { displayName: u.displayName, photoURL: u.photoURL };
  }

  const ref = await addDoc(collection(db, "chats"), {
    type: "group",
    name: trimmedName,
    members,
    memberInfo,
    createdAt: serverTimestamp(),
    createdBy: me.uid,
    lastMessage: null
  });
  return ref.id;
}

// Subscribe to the chat list for the current user: the global room plus
// any private/group chats they're a member of. Calls onChange with a
// merged, de-duplicated array every time either source updates.
export function subscribeToChatList(onChange) {
  const me = auth.currentUser;
  let globalChat = null;
  let myChats = [];

  const emit = () => {
    const all = [...(globalChat ? [globalChat] : []), ...myChats];
    onChange(all);
  };

  const unsubGlobal = onSnapshot(doc(db, "chats", GLOBAL_CHAT_ID), (snap) => {
    if (snap.exists()) globalChat = { id: snap.id, ...snap.data() };
    emit();
  });

  const q = query(collection(db, "chats"), where("members", "array-contains", me.uid));
  const unsubMine = onSnapshot(q, (snap) => {
    myChats = snap.docs
      .filter((d) => d.id !== GLOBAL_CHAT_ID)
      .map((d) => ({ id: d.id, ...d.data() }));
    emit();
  });

  return () => {
    unsubGlobal();
    unsubMine();
  };
}

// Human-friendly name for a chat, from the perspective of the current user.
export function chatDisplayName(chat) {
  const me = auth.currentUser;
  if (chat.type === "global") return "global";
  if (chat.type === "group") return chat.name || "Unnamed group";
  if (chat.type === "private") {
    const otherUid = chat.members.find((uid) => uid !== me.uid);
    return chat.memberInfo?.[otherUid]?.displayName || "Direct message";
  }
  return "Chat";
}

export function chatAvatar(chat) {
  const me = auth.currentUser;
  if (chat.type === "private") {
    const otherUid = chat.members.find((uid) => uid !== me.uid);
    return chat.memberInfo?.[otherUid]?.photoURL || null;
  }
  return null;
}
