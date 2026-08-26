// js/profile.js
import { auth, db, storage } from "./firebase-init.js";
import { updateProfile } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5MB

export async function uploadAvatar(file) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Profile pictures must be an image file.");
  }
  if (file.size > MAX_AVATAR_BYTES) {
    throw new Error("Please choose an image under 5MB.");
  }
  const uid = auth.currentUser.uid;
  const path = `avatars/${uid}/${Date.now()}_${file.name}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file);
  const url = await getDownloadURL(fileRef);

  await updateProfile(auth.currentUser, { photoURL: url });
  await updateDoc(doc(db, "users", uid), { photoURL: url });
  return url;
}

export async function updateDisplayName(newName) {
  const trimmed = newName.trim();
  if (!trimmed) throw new Error("Display name can't be empty.");
  const uid = auth.currentUser.uid;
  await updateProfile(auth.currentUser, { displayName: trimmed });
  await updateDoc(doc(db, "users", uid), { displayName: trimmed });
  return trimmed;
}
