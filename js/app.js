// js/app.js
import { auth, DEFAULT_AVATAR } from "./firebase-init.js";
import { watchAuthState, signUp, logIn, logOut, friendlyAuthError } from "./auth.js";
import { uploadAvatar, updateDisplayName } from "./profile.js";
import {
  ensureGlobalChat,
  subscribeToChatList,
  createPrivateChat,
  createGroupChat,
  chatDisplayName,
  chatAvatar,
  GLOBAL_CHAT_ID
} from "./chats.js";
import { subscribeToMessages, sendMessage } from "./messages.js";

// ---------- element refs ----------
const authScreen = document.getElementById("auth-screen");
const appScreen = document.getElementById("app-screen");

const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const loginError = document.getElementById("login-error");
const signupError = document.getElementById("signup-error");

const chatListEl = document.getElementById("chat-list");
const chatTitleEl = document.getElementById("chat-title");
const chatSubmetaEl = document.getElementById("chat-submeta");
const messageLogEl = document.getElementById("message-log");
const emptyStateEl = document.getElementById("empty-state");
const composerEl = document.getElementById("composer");
const messageInput = document.getElementById("message-input");
const attachBtn = document.getElementById("attach-btn");
const attachmentInput = document.getElementById("attachment-input");
const attachmentPreview = document.getElementById("attachment-preview");

const ownAvatar = document.getElementById("own-avatar");
const ownName = document.getElementById("own-name");
const ownProfileRow = document.getElementById("own-profile-row");
const logoutBtn = document.getElementById("logout-btn");

const newChatBtn = document.getElementById("new-chat-btn");
const newChatModal = document.getElementById("new-chat-modal");
const closeNewChat = document.getElementById("close-new-chat");
const privateChatForm = document.getElementById("private-chat-form");
const groupChatForm = document.getElementById("group-chat-form");
const privateChatError = document.getElementById("private-chat-error");
const groupChatError = document.getElementById("group-chat-error");

const profileModal = document.getElementById("profile-modal");
const closeProfileModal = document.getElementById("close-profile-modal");
const profileModalAvatar = document.getElementById("profile-modal-avatar");
const avatarInput = document.getElementById("avatar-input");
const nameForm = document.getElementById("name-form");
const nameInput = document.getElementById("name-input");
const profileError = document.getElementById("profile-error");

const backBtn = document.getElementById("back-btn");
const sidebarEl = document.querySelector(".sidebar");
const chatMainEl = document.querySelector(".chat-main");

// ---------- state ----------
let currentChatId = null;
let currentChats = [];
let unsubMessages = null;
let pendingFile = null;

// ============ AUTH SCREEN ============
document.querySelectorAll(".auth-tab[data-tab]").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".auth-tab[data-tab]").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    const isLogin = tab.dataset.tab === "login";
    loginForm.classList.toggle("hidden", !isLogin);
    signupForm.classList.toggle("hidden", isLogin);
  });
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.textContent = "";
  try {
    await logIn(
      document.getElementById("login-email").value,
      document.getElementById("login-password").value
    );
  } catch (err) {
    loginError.textContent = friendlyAuthError(err);
  }
});

signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  signupError.textContent = "";
  try {
    await signUp(
      document.getElementById("signup-email").value,
      document.getElementById("signup-password").value,
      document.getElementById("signup-name").value.trim()
    );
  } catch (err) {
    signupError.textContent = friendlyAuthError(err);
  }
});

logoutBtn.addEventListener("click", async (e) => {
  e.stopPropagation();
  await logOut();
});

// ============ AUTH STATE ============
watchAuthState(
  async (user) => {
    authScreen.classList.add("hidden");
    appScreen.classList.remove("hidden");
    ownAvatar.src = user.photoURL || DEFAULT_AVATAR;
    ownName.textContent = user.displayName || user.email;

    await ensureGlobalChat();
    subscribeToChatList((chats) => {
      currentChats = chats;
      renderChatList();
    });
  },
  () => {
    appScreen.classList.add("hidden");
    authScreen.classList.remove("hidden");
    currentChatId = null;
    if (unsubMessages) unsubMessages();
  }
);

// ============ CHAT LIST ============
function renderChatList() {
  const sorted = [...currentChats].sort((a, b) => {
    if (a.id === GLOBAL_CHAT_ID) return -1;
    if (b.id === GLOBAL_CHAT_ID) return 1;
    const ta = a.lastMessage?.createdAt?.toMillis?.() || 0;
    const tb = b.lastMessage?.createdAt?.toMillis?.() || 0;
    return tb - ta;
  });

  chatListEl.innerHTML = "";
  for (const chat of sorted) {
    const name = chatDisplayName(chat);
    const avatarUrl = chatAvatar(chat);
    const item = document.createElement("div");
    item.className = "chat-item" + (chat.id === currentChatId ? " active" : "");
    item.innerHTML = `
      <div class="chat-item-icon">${
        avatarUrl ? `<img src="${avatarUrl}" alt="" />` : iconGlyph(chat)
      }</div>
      <div class="chat-item-text">
        <div class="chat-item-name">${escapeHtml(name)}</div>
        <div class="chat-item-preview">${escapeHtml(previewText(chat))}</div>
      </div>
    `;
    item.addEventListener("click", () => openChat(chat.id));
    chatListEl.appendChild(item);
  }
}

function iconGlyph(chat) {
  if (chat.type === "global") return "#";
  if (chat.type === "group") return "☰";
  return "@";
}

function previewText(chat) {
  if (!chat.lastMessage) return chat.type === "global" ? "say hello" : "no messages yet";
  const who = chat.lastMessage.senderId === auth.currentUser.uid ? "you" : chat.lastMessage.senderName;
  return `${who}: ${chat.lastMessage.text}`;
}

// ============ OPEN CHAT ============
function openChat(chatId) {
  currentChatId = chatId;
  renderChatList();

  const chat = currentChats.find((c) => c.id === chatId);
  chatTitleEl.textContent = chat ? chatDisplayName(chat) : "chat";
  chatSubmetaEl.textContent = chat?.type === "global"
    ? "everyone"
    : chat?.type === "group"
    ? `${chat.members.length} members`
    : "";

  emptyStateEl.classList.add("hidden");
  composerEl.classList.remove("hidden");
  messageLogEl.querySelectorAll(".msg-group").forEach((el) => el.remove());

  if (unsubMessages) unsubMessages();
  unsubMessages = subscribeToMessages(chatId, renderMessages);

  // mobile: show chat, hide sidebar
  sidebarEl.classList.add("hidden-mobile");
  chatMainEl.classList.remove("hidden-mobile");
}

backBtn.addEventListener("click", () => {
  sidebarEl.classList.remove("hidden-mobile");
  chatMainEl.classList.add("hidden-mobile");
});

// ============ MESSAGES ============
function renderMessages(messages) {
  messageLogEl.querySelectorAll(".msg-group").forEach((el) => el.remove());

  let lastSenderId = null;
  let lastGroup = null;

  for (const msg of messages) {
    const isOwn = msg.senderId === auth.currentUser.uid;
    const time = msg.createdAt?.toDate
      ? msg.createdAt.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "";

    if (msg.senderId !== lastSenderId) {
      lastGroup = document.createElement("div");
      lastGroup.className = "msg-group";
      const meta = document.createElement("div");
      meta.className = "msg-meta" + (isOwn ? " own" : "");
      meta.innerHTML = `<span class="dot"></span><span>${time}</span><span class="handle">@${escapeHtml(msg.senderName)}</span>`;
      lastGroup.appendChild(meta);
      messageLogEl.appendChild(lastGroup);
      lastSenderId = msg.senderId;
    }

    const row = document.createElement("div");
    row.className = "msg-row" + (isOwn ? " own" : "");
    const bubble = document.createElement("div");
    bubble.className = "bubble";

    let inner = "";
    if (msg.text) inner += `<span>${escapeHtml(msg.text)}</span>`;
    if (msg.attachmentURL) {
      if ((msg.attachmentType || "").startsWith("image/")) {
        inner += `<img class="attachment-img" src="${msg.attachmentURL}" alt="${escapeHtml(msg.attachmentName || "attachment")}" />`;
      } else {
        inner += `<a class="attachment-file" href="${msg.attachmentURL}" target="_blank" rel="noopener">📎 ${escapeHtml(msg.attachmentName || "file")}</a>`;
      }
    }
    bubble.innerHTML = inner;
    row.appendChild(bubble);
    lastGroup.appendChild(row);
  }

  messageLogEl.scrollTop = messageLogEl.scrollHeight;
}

// ============ COMPOSER ============
attachBtn.addEventListener("click", () => attachmentInput.click());

attachmentInput.addEventListener("change", () => {
  pendingFile = attachmentInput.files[0] || null;
  if (pendingFile) {
    attachmentPreview.textContent = pendingFile.name;
    attachmentPreview.classList.remove("hidden");
  } else {
    attachmentPreview.classList.add("hidden");
  }
});

composerEl.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentChatId) return;
  const text = messageInput.value;
  const file = pendingFile;
  messageInput.value = "";
  attachmentInput.value = "";
  pendingFile = null;
  attachmentPreview.classList.add("hidden");
  try {
    await sendMessage(currentChatId, text, file);
  } catch (err) {
    alert(err.message || "Couldn't send that message.");
  }
});

// ============ NEW CHAT MODAL ============
newChatBtn.addEventListener("click", () => newChatModal.classList.remove("hidden"));
closeNewChat.addEventListener("click", () => newChatModal.classList.add("hidden"));
newChatModal.addEventListener("click", (e) => {
  if (e.target === newChatModal) newChatModal.classList.add("hidden");
});

document.querySelectorAll(".auth-tab[data-newchat-tab]").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".auth-tab[data-newchat-tab]").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    const isPrivate = tab.dataset.newchatTab === "private";
    privateChatForm.classList.toggle("hidden", !isPrivate);
    groupChatForm.classList.toggle("hidden", isPrivate);
  });
});

privateChatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  privateChatError.textContent = "";
  const email = document.getElementById("private-email").value;
  try {
    const chatId = await createPrivateChat(email);
    newChatModal.classList.add("hidden");
    privateChatForm.reset();
    openChat(chatId);
  } catch (err) {
    privateChatError.textContent = err.message;
  }
});

groupChatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  groupChatError.textContent = "";
  const name = document.getElementById("group-name").value;
  const emails = document.getElementById("group-emails").value.split(",");
  try {
    const chatId = await createGroupChat(name, emails);
    newChatModal.classList.add("hidden");
    groupChatForm.reset();
    openChat(chatId);
  } catch (err) {
    groupChatError.textContent = err.message;
  }
});

// ============ PROFILE MODAL ============
ownProfileRow.addEventListener("click", () => {
  profileModalAvatar.src = auth.currentUser.photoURL || DEFAULT_AVATAR;
  nameInput.value = auth.currentUser.displayName || "";
  profileError.textContent = "";
  profileModal.classList.remove("hidden");
});
closeProfileModal.addEventListener("click", () => profileModal.classList.add("hidden"));
profileModal.addEventListener("click", (e) => {
  if (e.target === profileModal) profileModal.classList.add("hidden");
});

avatarInput.addEventListener("change", async () => {
  const file = avatarInput.files[0];
  if (!file) return;
  profileError.textContent = "";
  try {
    const url = await uploadAvatar(file);
    profileModalAvatar.src = url;
    ownAvatar.src = url;
  } catch (err) {
    profileError.textContent = err.message;
  }
});

nameForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  profileError.textContent = "";
  try {
    const name = await updateDisplayName(nameInput.value);
    ownName.textContent = name;
    profileModal.classList.add("hidden");
  } catch (err) {
    profileError.textContent = err.message;
  }
});

// ============ UTIL ============
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}
