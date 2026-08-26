// js/messages.js
import { db, auth, storage } from "./firebase-init.js";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";

const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024; // 15MB
const MESSAGE_PAGE_SIZE = 100;

export function subscribeToMessages(chatId, onChange) {
  const q = query(
    collection(db, "chats", chatId, "messages"),
    orderBy("createdAt", "asc"),
    limit(MESSAGE_PAGE_SIZE)
  );
  return onSnapshot(q, (snap) => {
    const messages = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    onChange(messages);
  });
}

async function uploadAttachment(chatId, file) {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error("Attachments must be under 15MB.");
  }
  const path = `attachments/${chatId}/${Date.now()}_${file.name}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file);
  const url = await getDownloadURL(fileRef);
  return { url, name: file.name, type: file.type, size: file.size };
}

export async function sendMessage(chatId, text, file) {
  const me = auth.currentUser;
  const trimmed = (text || "").trim();
  if (!trimmed && !file) return;

  let attachment = null;
  if (file) {
    attachment = await uploadAttachment(chatId, file);
  }

  const messageData = {
    senderId: me.uid,
    senderName: me.displayName || "Unknown",
    senderPhoto: me.photoURL || null,
    text: trimmed || null,
    attachmentURL: attachment?.url || null,
    attachmentName: attachment?.name || null,
    attachmentType: attachment?.type || null,
    createdAt: serverTimestamp()
  };

  await addDoc(collection(db, "chats", chatId, "messages"), messageData);

  const preview = trimmed || (file ? `📎 ${file.name}` : "");
  await updateDoc(doc(db, "chats", chatId), {
    lastMessage: {
      text: preview,
      senderId: me.uid,
      senderName: me.displayName || "Unknown",
      createdAt: serverTimestamp()
    }
  }).catch(() => {});
}
