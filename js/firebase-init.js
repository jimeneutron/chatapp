// js/firebase-init.js
//
// 1. Go to https://console.firebase.google.com, create a project.
// 2. In Project settings > General, scroll to "Your apps", click the </> (web) icon,
//    register the app, and copy the config object it gives you into firebaseConfig below.
// 3. See README.md in this project for the full step-by-step setup.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// A small built-in placeholder avatar (data URI) used until a user uploads their own.
export const DEFAULT_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80">
      <rect width="80" height="80" fill="#1A1E27"/>
      <circle cx="40" cy="31" r="14" fill="#8B93A3"/>
      <path d="M14 70c4-16 18-24 26-24s22 8 26 24" fill="#8B93A3"/>
    </svg>
  `);
