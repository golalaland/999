/* ==============================================
   Firebase Modular SDK v10+ (January 2026)
   Includes: App, Auth, Firestore, Realtime DB, Storage, ReCaptcha
   ============================================== */

// ── Core & Shared ──
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

// ── Firestore ──
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
limitToLast,    
  deleteDoc,
  collection,
  addDoc,
  serverTimestamp,
  onSnapshot,
  query,
  startAfter,
  limit,
  orderBy,
  increment,
  getDocs,
  where,
  runTransaction,
  arrayUnion,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ── Storage (added for file/video uploads) ──
import {
  getStorage,
  ref,
  uploadBytes,
  uploadBytesResumable,     // optional: for progress tracking
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// ── Realtime Database ──
import {
  getDatabase,
  ref as rtdbRef,
  set as rtdbSet,
  onDisconnect,
  onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// ── Authentication ──
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";



/* ── Firebase Configuration ── */
const firebaseConfig = {
  apiKey: "AIzaSyD_GjkTox5tum9o4AupO0LeWzjTocJg8RI",
  authDomain: "dettyverse.firebaseapp.com",
  projectId: "dettyverse",
  storageBucket: "dettyverse.firebasestorage.app",
  messagingSenderId: "1036459652488",
  appId: "1:1036452488:web:e8910172ed16e9cac9b63d",
  measurementId: "G-NX2KWZW85V",
  databaseURL: "https://dettyverse-default-rtdb.firebaseio.com/"
};

/* ── Initialize Services ── */
const app = initializeApp(firebaseConfig);
console.log("🔥 Firebase Project:", firebaseConfig.projectId);

// 🔐 Firebase App Check (reCAPTCHA v3)
//const appCheck = initializeAppCheck(app, {
//  provider: new ReCaptchaV3Provider('6LfWf0gsAAAAADq5q_4nrqJY642-udsAOpUX8Qzs'),
 // isTokenAutoRefreshEnabled: true
//});

const db     = getFirestore(app);
const auth   = getAuth(app);
const rtdb   = getDatabase(app);
const storage = getStorage(app);           // ← Now initialized!

console.log("☁️ Storage ready:", firebaseConfig.storageBucket);

//import { initializeAppCheck, ReCaptchaV3Provider } 
 // from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-check.js";



/* ── Exports for other modules/scripts ── */
export {
  app,
  db,
  auth,
  rtdb,
  storage,                // ← Important: export storage
  // Storage functions (optional - can import directly where needed)
  ref,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL
};


/* ---------- Global State ---------- */
const ROOM_ID = "room1111";
const CHAT_COLLECTION = "messages_room1111";
const BUZZ_COST = 500;
const SEND_COST = 1;
let lastMessagesArray = [];
let starInterval = null;
let refs = {};  



// Make Firebase objects available globally (for debugging or reuse)
window.app = app;
window.db = db;
window.auth = auth;

// Optional: Add this at the top of your JS file to detect "just logged out" on login page
if (sessionStorage.getItem("justLoggedOut") === "true") {
  sessionStorage.removeItem("justLoggedOut");
  showStarPopup("Welcome back, legend!");
}

/* ---------- Presence (Realtime) ---------- */
function setupPresence(user) {
  try {
    if (!rtdb || !user || !user.uid) return;

   const safeUid = user.uid; // already sanitized (example_yahoo_com)
const pRef = rtdbRef(rtdb, `presence/${ROOM_ID}/${safeUid}`);

    rtdbSet(pRef, {
      online: true,
      chatId: user.chatId || "",
      email: user.email || "",
      lastSeen: Date.now()
    }).catch(() => {});

    // Auto-remove presence when user closes tab
    onDisconnect(pRef)
      .remove()
      .catch(() => {});

  } catch (err) {
    console.error("Presence error:", err);
  }
}


// Add this once at the top of your script (after consts)
const style = document.createElement('style');
style.textContent = `
  @media (max-width: 768px) {
    #livePlayerContainer {
      font-size: 14px !important; /* fallback base size */
    }
    #livePlayerContainer img {
      max-height: 65vh !important;
    }
  }
`;
document.head.appendChild(style);


// SYNC UNLOCKED VIDEOS — 100% Secure & Reliable
async function syncUserUnlocks() {
  if (!currentUser?.email) {
    console.log("No user email — skipping unlock sync");
    return JSON.parse(localStorage.getItem("userUnlockedVideos") || "[]");
  }

  const userId = getUserId(currentUser.email);  // ← CRITICAL: use sanitized ID
  const userRef = doc(db, "users", userId);
  const localKey = "userUnlockedVideos"; // consistent key

  try {
    const snap = await getDoc(userRef);
    
    // Get unlocks from Firestore (default empty array)
    const firestoreUnlocks = snap.exists() 
      ? (snap.data()?.unlockedVideos || []) 
      : [];

    // Get local unlocks
    const localUnlocks = JSON.parse(localStorage.getItem(localKey) || "[]");

    // Merge & deduplicate (local wins if conflict)
    const merged = [...new Set([...localUnlocks, ...firestoreUnlocks])];

    // Only update Firestore if local has new ones
    const hasNew = merged.some(id => !firestoreUnlocks.includes(id));
    if (hasNew && merged.length > firestoreUnlocks.length) {
      await updateDoc(userRef, {
        unlockedVideos: merged,
        lastUnlockSync: serverTimestamp()
      });
      console.log("Firestore unlocks updated:", merged);
    }

    // Always sync localStorage to latest truth
    localStorage.setItem(localKey, JSON.stringify(merged));
    currentUser.unlockedVideos = merged; // ← keep currentUser in sync too!

    console.log("Unlocks synced successfully:", merged.length, "videos");
    return merged;

  } catch (err) {
    console.error("Unlock sync failed:", err.message || err);

    // On error: trust localStorage as source of truth
    const fallback = JSON.parse(localStorage.getItem(localKey) || "[]");
    showStarPopup("Sync failed. Using local unlocks.");
    return fallback;
  }
}

if (rtdb) {
  onValue(
    rtdbRef(rtdb, `presence/${ROOM_ID}`),
    snap => {
      const users = snap.val() || {};
      if (refs?.onlineCountEl) {
        refs.onlineCountEl.innerText = `(${Object.keys(users).length} online)`;
      }
    }
  );
}


/* ===============================
   GLOBAL DOM REFERENCES — POPULATE THE refs OBJECT (ONLY ONCE!)
   THIS RUNS IMMEDIATELY — NO DUPLICATE DECLARATION
================================= */
Object.assign(refs, {
  // Core
  authBox: document.getElementById("authBox"),
  messagesEl: document.getElementById("messages"),
  sendAreaEl: document.getElementById("sendArea"),
  messageInputEl: document.getElementById("messageInput"),
  sendBtn: document.getElementById("sendBtn"),
  buzzBtn: document.getElementById("buzzBtn"),

  // Profile
  profileBoxEl: document.getElementById("profileBox"),
  profileNameEl: document.getElementById("profileName"),
  starCountEl: document.getElementById("starCount"),
  cashCountEl: document.getElementById("cashCount"),
  onlineCountEl: document.getElementById("onlineCount"),

  // Buttons & Links
  redeemBtn: document.getElementById("redeemBtn"),
  tipBtn: document.getElementById("tipBtn"),

  // Admin
  adminControlsEl: document.getElementById("adminControls"),
  adminClearMessagesBtn: document.getElementById("adminClearMessagesBtn"),

  // Modals
  chatIDModal: document.getElementById("chatIDModal"),
  chatIDInput: document.getElementById("chatIDInput"),
  chatIDConfirmBtn: document.getElementById("chatIDConfirmBtn"),
  giftModal: document.getElementById("giftModal"),
  giftModalTitle: document.getElementById("giftModalTitle"),
  giftAmountInput: document.getElementById("giftAmountInput"),
  giftConfirmBtn: document.getElementById("giftConfirmBtn"),
  giftModalClose: document.getElementById("giftModalClose"),
  giftAlert: document.getElementById("giftAlert"),

  // Popups & Notifications
  starPopup: document.getElementById("starPopup"),
  starText: document.getElementById("starText"),
  notificationBell: document.getElementById("notificationBell"),
  notificationsList: document.getElementById("notificationsList"),
  markAllRead: document.getElementById("markAllRead")
});

// Optional: Limit input length
if (refs.chatIDInput) refs.chatIDInput.maxLength = 12;


function revealHostTabs() {
  if (!currentUser || currentUser.isHost !== true) return;

  const hostEls = document.querySelectorAll(".host-only");
  if (!hostEls.length) return;

  hostEls.forEach(el => {
    // buttons need inline-flex, panels need block
    el.style.display = el.tagName === "BUTTON" ? "inline-flex" : "block";
  });

  console.log("[HOST UI] revealed");
}

// =============================
// CHAT REPLY STATE — GLOBAL VARIABLES
// =============================  
let currentReplyData = null;       // Optional: extra data if needed (replyTo, etc.)
let tapModalEl = null;
let currentReplyTarget = null;

/* ===============================
   FINAL 2025 BULLETPROOF AUTH + NOTIFICATIONS + UTILS
   NO ERRORS — NO RANDOM MODALS — NO MISSING BUTTONS
================================= */

let currentUser = null;
let currentAdmin = null;


// UNIVERSAL ID SANITIZER — RESTORED & FINAL
const sanitizeId = (input) => {
  if (!input) return "";
  return String(input).trim().toLowerCase().replace(/[@.\s]/g, "_");
};

// RESTORED: getUserId — USED BY OLD CODE (syncUserUnlocks, etc.)
const getUserId = sanitizeId;  // ← This fixes "getUserId is not defined"

// NOTIFICATION HELPER — CLEAN & ETERNAL
async function pushNotification(userId, message) {
  if (!userId || !message) return;
  try {
    await addDoc(collection(db, "notifications"), {
      userId,
      message,
      timestamp: serverTimestamp(),
      read: false
    });
  } catch (err) {
    console.warn("Failed to send notification:", err);
  }
}

// ON AUTH STATE CHANGED — FINAL 2025 ETERNAL EDITION (WITH ADMIN + HOST SUPPORT)
onAuthStateChanged(auth, async (firebaseUser) => {
  // ——— CLEANUP PREVIOUS LISTENERS ———
  if (typeof notificationsUnsubscribe === "function") {
    notificationsUnsubscribe();
    notificationsUnsubscribe = null;
  }

  // Reset globals
  currentUser = null;
  currentAdmin = null;

  // ——— USER LOGGED OUT ———
  if (!firebaseUser) {
    localStorage.removeItem("userId");
    localStorage.removeItem("lastVipEmail");

    document.querySelectorAll(".after-login-only").forEach(el => el.style.display = "none");
    document.querySelectorAll(".before-login-only").forEach(el => el.style.display = "block");

    if (typeof showLoginUI === "function") showLoginUI();

    console.log("User logged out");

    // Clear clips grid
    const grid = document.getElementById("myClipsGrid");
    const noMsg = document.getElementById("noClipsMessage");
    if (grid) grid.innerHTML = "";
    if (noMsg) noMsg.style.display = "none";

    // Hide host-only fields
    const hostFields = document.getElementById("hostOnlyFields");
    if (hostFields) hostFields.style.display = "none";

    return;
  }

  // ——— USER LOGGED IN ———
  const email = firebaseUser.email.toLowerCase().trim();
  const uid = sanitizeKey(email);
  const userRef = doc(db, "users", uid);

  try {
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      console.error("Profile not found for:", uid);
      showStarPopup("Profile missing — contact support");
      await signOut(auth);
      return;
    }

    const data = userSnap.data();

    // BUILD CURRENT USER OBJECT
    currentUser = {
      uid,
      email,
      firebaseUid: firebaseUser.uid,
      chatId: data.chatId || email.split("@")[0],
      chatIdLower: (data.chatId || email.split("@")[0]).toLowerCase(),
      fullName: data.fullName || "VIP",
      gender: data.gender || "person",
      isVIP: !!data.isVIP,
      isHost: !!data.isHost,
      isAdmin: !!data.isAdmin,
      hasPaid: !!data.hasPaid,
      stars: data.stars || 0,
      cash: data.cash || 0,
      starsGifted: data.starsGifted || 0,
      starsToday: data.starsToday || 0,
      usernameColor: data.usernameColor || "#ff69b4",
      subscriptionActive: !!data.subscriptionActive,
      subscriptionCount: data.subscriptionCount || 0,
      lastStarDate: data.lastStarDate || todayDate(),
      unlockedVideos: data.unlockedVideos || [],
      invitedBy: data.invitedBy || null,
      inviteeGiftShown: !!data.inviteeGiftShown,
      hostLink: data.hostLink || null
    };

    // ADMIN MODE ACTIVATION
    if (currentUser.isAdmin) {
      currentAdmin = {
        uid: currentUser.uid,
        email: currentUser.email,
        chatId: currentUser.chatId
      };
      console.log("%cADMIN MODE ACTIVATED", "color:#0f9;font-size:18px;font-weight:bold");

      const pollSection = document.getElementById("polls");
      if (pollSection) pollSection.style.display = "block";
    }

    console.log("WELCOME BACK:", currentUser.chatId.toUpperCase());
    console.log("[USER STATUS]", currentUser);

    // ——— POST-LOGIN UI & FUNCTION SETUP ———
    revealHostTabs();
    updateInfoTab();

    document.querySelectorAll(".after-login-only").forEach(el => el.style.display = "block");
    document.querySelectorAll(".before-login-only").forEach(el => el.style.display = "none");

    localStorage.setItem("userId", uid);
    localStorage.setItem("lastVipEmail", email);

    setupUsersListener();
    showChatUI(currentUser);
    attachMessagesListener();
    startStarEarning(uid);
    setupPresence(currentUser);
    setupNotificationsListener(uid);
    updateRedeemLink();
    updateTipLink();

    // Delayed loads to avoid blocking
    setTimeout(() => {
      syncUserUnlocks?.();
      loadNotifications?.();
    }, 600);

    if (document.getElementById("myClipsPanel") && typeof loadMyClips === "function") {
      setTimeout(loadMyClips, 1000);
    }

    if (currentUser.chatId.startsWith("GUEST")) {
      setTimeout(() => {
        promptForChatID?.(userRef, data);
      }, 2000);
    }

    // ——— SHOW HOST-ONLY FIELDS (Nature Pick & Fruit Pick) ———
    const hostFields = document.getElementById("hostOnlyFields");
    if (hostFields) {
      hostFields.style.display = currentUser.isHost ? "block" : "none";
    }

    // ——— DIVINE WELCOME POPUP ———
    const holyColors = ["#FF1493", "#FFD700", "#00FFFF", "#FF4500", "#DA70D6", "#FF69B4", "#32CD32", "#FFA500", "#FF00FF"];
    const glow = holyColors[Math.floor(Math.random() * holyColors.length)];

    showStarPopup(`
      <div style="text-align:center;font-size:13px;">
        Welcome back,
        <b style="font-size:13px;color:${glow};text-shadow:0 0 20px ${glow}88;">
          ${currentUser.chatId.toUpperCase()}
        </b>
        ${currentUser.isAdmin ? "<br><span style='color:#0f9;font-size:16px;'>ADMIN MODE</span>" : ""}
      </div>
    `);

    console.log("YOU HAVE ENTERED THE ETERNAL CUBE");

  } catch (error) {
    console.error("Error during login process:", error);
    showStarPopup("Failed to load profile — please try again");
    await signOut(auth);
  }
});

function setupNotificationsListener(userId) {
  if (!userId) return;
  const list = document.getElementById("notificationsList");
  if (!list) {
    setTimeout(() => setupNotificationsListener(userId), 500);
    return;
  }

  const q = query(
    collection(db, "notifications"),
    where("userId", "==", userId),
    orderBy("timestamp", "desc")
  );

  notificationsUnsubscribe = onSnapshot(q, (snap) => {
    if (snap.empty) {
      list.innerHTML = `<p style="opacity:0.6;text-align:center;padding:20px;">No notifications yet</p>`;
      return;
    }

    list.innerHTML = snap.docs.map(doc => {
      const n = doc.data();
      const time = n.timestamp?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || "--:--";

      // Normalize line breaks in message
      const formattedMessage = (n.message || "").replace(/\n/g, "<br>");

      return `
        <div class="notification-item ${n.read ? '' : 'unread'}" data-type="${n.type || ''}">
          ${n.icon ? `<div class="notif-icon">${n.icon}</div>` : ''}
          ${n.title ? `<div class="notif-title">${n.title}</div>` : ''}
          <div class="notif-message">${formattedMessage}</div>
          <small class="notif-time">${time}</small>
        </div>
      `;
    }).join("");
  });
}

// MARK ALL READ
document.getElementById("markAllRead")?.addEventListener("click", async () => {
  const userId = localStorage.getItem("userId");
  if (!userId) return;
  const q = query(collection(db, "notifications"), where("userId", "==", userId));
  const snap = await getDocs(q);
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.update(d.ref, { read: true }));
  await batch.commit();
  showStarPopup("Marked as read");
});



function showStarPopup(text) {
  const popup = document.getElementById("starPopup");
  const starText = document.getElementById("starText");
  if (!popup || !starText) return;

  starText.innerHTML = text;
  
  // Remove any previous classes/timers
  popup.classList.remove("show");
  popup.style.display = "none";
  void popup.offsetWidth; // force reflow

  // Show it
  popup.style.display = "flex";
  popup.classList.add("show");

  // Auto-hide after 2 seconds
  clearTimeout(popup._hideTimeout);
  popup._hideTimeout = setTimeout(() => {
    popup.style.display = "none";
    popup.classList.remove("show");
  }, 2000);
}
function formatNumberWithCommas(n) {
  return new Intl.NumberFormat('en-NG').format(n || 0);
}

function randomColor() {
  const p = ["#FFD700","#FF69B4","#87CEEB","#90EE90","#FFB6C1","#FFA07A","#8A2BE2","#00BFA6","#F4A460"];
  return p[Math.floor(Math.random() * p.length)];
}

// GLOBAL
window.currentUser = () => currentUser;
window.pushNotification = pushNotification;
window.sanitizeId = sanitizeId;
window.getUserId = getUserId;  // ← RESTORED FOR OLD CODE
window.formatNumberWithCommas = formatNumberWithCommas;

// USER COLORS — FINAL & PERFECT
function setupUsersListener() {
  if (!currentUser) return;

  console.log("[COLORS] Starting user colors listener");

  // Cleanup old listener
  if (window.userColorsUnsubscribe) {
    window.userColorsUnsubscribe();
  }

  window.userColorsUnsubscribe = onSnapshot(
    collection(db, "users"),
    (snap) => {
      refs.userColors = refs.userColors || {};

      let updated = false;
      snap.forEach(docSnap => {
        const data = docSnap.data();
        const color = data?.usernameColor;
        if (color && refs.userColors[docSnap.id] !== color) {
          refs.userColors[docSnap.id] = color;
          updated = true;
        }
      });

      if (updated || Object.keys(refs.userColors).length === snap.size) {
        console.log("[COLORS] Colors updated — re-rendering messages");
        // Re-render all messages to apply new colors
        renderMessagesFromArray(lastMessagesArray || []);
      }
    },
    (err) => {
      console.error("[COLORS] Listener error:", err);
    }
  );
}

/* ----------------------------
   GIFT MODAL — FINAL ETERNAL VERSION (2025+)
   Works perfectly with sanitized IDs • Zero bugs • Instant & reliable
----------------------------- */
async function showGiftModal(targetUid, targetData) {
  if (!currentUser) {
    showStarPopup("You must be logged in");
    return;
  }

  if (!targetUid || !targetData?.chatId) {
    console.warn("Invalid gift target");
    return;
  }

  const { giftModal, giftModalTitle, giftAmountInput, giftConfirmBtn, giftModalClose } = refs;

  if (!giftModal || !giftModalTitle || !giftAmountInput || !giftConfirmBtn || !giftModalClose) {
    console.warn("Gift modal DOM elements missing");
    return;
  }

  // === SETUP MODAL ===
  giftModalTitle.textContent = `Gift Stars to ${targetData.chatId}`;
  giftAmountInput.value = "100";
  giftAmountInput.focus();
  giftAmountInput.select();
  giftModal.style.display = "flex";

  // === CLOSE HANDLERS ===
  const closeModal = () => {
    giftModal.style.display = "none";
  };

  giftModalClose.onclick = closeModal;
  giftModal.onclick = (e) => {
    if (e.target === giftModal) closeModal();
  };
  // Allow ESC key to close
  const escHandler = (e) => {
    if (e.key === "Escape") closeModal();
  };
  document.addEventListener("keydown", escHandler);

  // === CLEAN & REPLACE CONFIRM BUTTON (removes old listeners) ===
  const newConfirmBtn = giftConfirmBtn.cloneNode(true);
  giftConfirmBtn.replaceWith(newConfirmBtn);

  // === GIFT LOGIC ===
  newConfirmBtn.addEventListener("click", async () => {
    const amt = parseInt(giftAmountInput.value.trim(), 10);

    if (isNaN(amt) || amt < 100) {
      showStarPopup("Minimum 100 stars");
      return;
    }

    if ((currentUser.stars || 0) < amt) {
      showStarPopup("Not enough stars");
      return;
    }

    newConfirmBtn.disabled = true;
    newConfirmBtn.textContent = "Sending...";

    try {
      const fromRef = doc(db, "users", currentUser.uid);        // sender (sanitized ID)
      const toRef = doc(db, "users", targetUid);                // receiver (sanitized ID)

      await runTransaction(db, async (transaction) => {
        const fromSnap = await transaction.get(fromRef);
        if (!fromSnap.exists()) throw "Sender not found";
        if ((fromSnap.data().stars || 0) < amt) throw "Not enough stars";

        transaction.update(fromRef, {
          stars: increment(-amt),
          starsGifted: increment(amt)
        });

        transaction.update(toRef, {
          stars: increment(amt)
        });
      });

           // === SUCCESS — GIFT SENT CLEAN & SILENT (NO BANNER, NO GLOW, EVER AGAIN) ===
      showGiftAlert(`Gifted ${amt} stars to ${targetData.chatId}!`);
      closeModal();

    } catch (err) {
      console.error("Gift transaction failed:", err);
      showStarPopup("Gift failed — try again");
      closeModal();
    } finally {
      newConfirmBtn.disabled = false;
      newConfirmBtn.textContent = "Send Gift";
      document.removeEventListener("keydown", escHandler);
    }
  });
}

function updateInfoTab() {
  const cashEl = document.getElementById("infoCashBalance");
  const starsEl = document.getElementById("infoStarBalance");
  const lastEl = document.getElementById("infoLastEarnings");

  if (currentUser) {
    if (cashEl) cashEl.textContent = currentUser.cash.toLocaleString();
    if (starsEl) starsEl.textContent = currentUser.stars.toLocaleString();
    if (lastEl) lastEl.textContent = (currentUser.lastEarnings || 0).toLocaleString();
  }
}

// CONVERT PREVIEW (unchanged)
document.getElementById("convertAmount")?.addEventListener("input", e => {
  const stars = Number(e.target.value) || 0;
  document.getElementById("convertResult").textContent = (stars * 0.25).toLocaleString();
});

// WITHDRAW PREVIEW — NEW: Live update as user types
document.getElementById("withdrawAmount")?.addEventListener("input", e => {
  const amount = Number(e.target.value) || 0;
  document.getElementById("withdrawPreview").textContent = amount.toLocaleString();
});

// CONVERT STRZ TO CASH (unchanged)
document.getElementById("convertBtn")?.addEventListener("click", async () => {
  const stars = Number(document.getElementById("convertAmount").value);
  if (!stars || stars <= 0) return showGoldAlert("Enter valid amount");
  if (stars > (currentUser?.stars || 0)) return showGoldAlert("Not enough STRZ");
  const cash = stars * 0.25;
  const ok = await showConfirm("Convert", `Convert ${stars.toLocaleString()} STRZ → ₦${cash.toLocaleString()}?`);
  if (!ok) return;
  showLoader("Converting...");
  try {
    await updateDoc(doc(db, "users", currentUser.uid), {
      stars: increment(-stars),
      cash: increment(cash)
    });
    currentUser.stars -= stars;
    currentUser.cash += cash;
    updateInfoTab();
    document.getElementById("convertAmount").value = "";
    document.getElementById("convertResult").textContent = "0";
    hideLoader();
    showGoldAlert(`Success! +₦${cash.toLocaleString()}`);
  } catch (e) {
    hideLoader();
    showGoldAlert("Conversion failed");
  }
});

// WITHDRAW CASH — NOW MODAL-FREE & CLEAN
document.getElementById("withdrawCashBtn")?.addEventListener("click", async () => {
  const input = document.getElementById("withdrawAmount");
  const amount = Number(input.value);

  const currentCash = currentUser?.cash || 0;

  // Basic validation
  if (!amount || amount <= 0) {
    return showGoldAlert("Enter a valid amount");
  }
  if (amount < 5000) {
    return showGoldAlert("Minimum withdrawal is ₦5,000");
  }
  if (amount > currentCash) {
    return showGoldAlert(`Insufficient balance. Available: ₦${currentCash.toLocaleString()}`);
  }

  // Confirm action
  const ok = await showConfirm(
    "Withdraw Cash",
    `Request withdrawal of ₦${amount.toLocaleString()}?\n\nYour balance will be deducted immediately.`
  );
  if (!ok) return;

  showLoader("Processing withdrawal...");

  try {
    // DEDUCT CASH + CREATE REQUEST IN ONE TRANSACTION
    await runTransaction(db, async (transaction) => {
      const userRef = doc(db, "users", currentUser.uid);
      const snap = await transaction.get(userRef);
      if (!snap.exists()) throw "User not found";
      const currentCash = snap.data().cash || 0;
      if (currentCash < amount) throw "Not enough cash";

      // Deduct cash
      transaction.update(userRef, { cash: currentCash - amount });

      // Create withdrawal request
      const withdrawalRef = doc(collection(db, "hostWithdrawal"));
      transaction.set(withdrawalRef, {
        uid: currentUser.uid,
        username: currentUser.chatId || currentUser.email.split('@')[0],
        amount,
        type: "cash",
        status: "pending",
        requestedAt: serverTimestamp(),
        deducted: true
      });
    });

    // Update local state
    currentUser.cash -= amount;
    updateInfoTab();

    // Update any other cash displays
    const cashCountEl = document.getElementById("cashCount");
    if (cashCountEl) cashCountEl.textContent = currentUser.cash.toLocaleString();

    // Reset input
    input.value = "";
    document.getElementById("withdrawPreview").textContent = "0";

    hideLoader();
    showGoldAlert(
      `Withdrawal requested!\n₦${amount.toLocaleString()} deducted.\nAdmin will transfer soon.`
    );
  } catch (e) {
    console.error("Withdraw failed:", e);
    hideLoader();
    showGoldAlert("Request failed — please try again");
  }
});

// CALL ON LOAD & AFTER ANY UPDATE
document.addEventListener("DOMContentLoaded", updateInfoTab);


// LOADER FUNCTIONS — BULLETPROOF
const loaderOverlay = document.getElementById("loaderOverlay");
const loaderText = document.getElementById("loaderText");

function showLoader(text = "Working...") {
  if (loaderText) loaderText.textContent = text;
  if (loaderOverlay) loaderOverlay.style.display = "flex";
}

function hideLoader() {
  if (loaderOverlay) loaderOverlay.style.display = "none";
}


// MODERN CONFIRM MODAL — MATCHES MEET MODAL DESIGN
async function showConfirm(title, msg) {
  return new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.id = "confirmModalOverlay"; // optional ID for cleanup
    Object.assign(overlay.style, {
      position: "fixed",
      top: 0,
      left: 0,
      width: "100vw",
      height: "100vh",
      background: "rgba(0,0,0,0.75)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: "999999",
      backdropFilter: "blur(3px)",
      WebkitBackdropFilter: "blur(3px)"
    });

    overlay.innerHTML = `
      <div style="
        background:#111;
        padding:20px 22px;
        border-radius:12px;
        text-align:center;
        color:#fff;
        max-width:340px;
        width:90%;
        box-shadow:0 0 20px rgba(0,0,0,0.5);
      ">
        <h3 style="margin:0 0 10px; font-weight:600; font-size:20px;">${title}</h3>
        <p style="margin:0 0 20px; line-height:1.5; color:#ccc; font-size:15px;">${msg}</p>
        <div style="display:flex; gap:12px; justify-content:center;">
          <button id="confirmNo" style="
            padding:10px 20px;
            background:#333;
            border:none;
            color:#ccc;
            border-radius:10px;
            font-weight:500;
            cursor:pointer;
            min-width:100px;
          ">Cancel</button>
          <button id="confirmYes" style="
            padding:10px 20px;
            background:linear-gradient(90deg,#c3f60c,#e8ff6a);
            border:none;
            color:#000;
            border-radius:10px;
            font-weight:700;
            cursor:pointer;
            min-width:100px;
          ">Confirm</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector("#confirmNo").onclick = () => {
      overlay.remove();
      resolve(false);
    };

    overlay.querySelector("#confirmYes").onclick = () => {
      overlay.remove();
      resolve(true);
    };

    // Optional: click outside to cancel
    overlay.addEventListener("click", e => {
      if (e.target === overlay) {
        overlay.remove();
        resolve(false);
      }
    });
  });
}

// ==============================
// CHAT.JS — CLEAN FULL VERSION
// ==============================

document.addEventListener('DOMContentLoaded', () => {

  // Grab chat elements
  const chatContainer = document.getElementById('chatContainer');
  const messagesEl = document.getElementById('messages');
  const sendArea = document.getElementById('sendArea');
  if (!chatContainer || !messagesEl || !sendArea) return;

  // ------------------------------
  // Helper: check if chat has real messages
  // ------------------------------
  function hasRealMessages() {
    return !!messagesEl.querySelector('.msg');
  }

  // ------------------------------
  // Update placeholder visibility
  // ------------------------------
  function updateMessagesPlaceholder() {
    if (hasRealMessages()) {
      messagesEl.classList.remove('show-placeholder');
    } else if (messagesEl.classList.contains('active')) {
      messagesEl.classList.add('show-placeholder');
    } else {
      // Startup page, do not show placeholder
      messagesEl.classList.remove('show-placeholder');
    }
  }

  // ------------------------------
  // MutationObserver for  updates
  // ------------------------------
  const messagesObserver = new MutationObserver(updateMessagesPlaceholder);
  messagesObserver.observe(messagesEl, { childList: true });

  // ------------------------------
  // Global function to reveal chat AFTER login
  // ------------------------------
  window.revealChatAfterLogin = function() {
    chatContainer.style.display = 'flex';   // show chat container
    sendArea.style.display = 'flex';        // show input area
    messagesEl.classList.add('active');     // gray placeholder logic
    updateMessagesPlaceholder();            // show/hide placeholder if empty
  };

  // ------------------------------
  // Startup: everything hidden
  // ------------------------------
  chatContainer.style.display = 'none';
  sendArea.style.display = 'none';
  messagesEl.classList.remove('active');
  updateMessagesPlaceholder();

});

// Create a secure token
async function createLoginToken(uid) {
  const token = crypto.getRandomValues(new Uint8Array(16))
                     .reduce((s, b) => s + b.toString(16).padStart(2,'0'), '');

  const tokenRef = doc(db, "loginTokens", token);
  await setDoc(tokenRef, {
    uid,
    createdAt: serverTimestamp(),
    expiresAt: Date.now() + 15 * 60 * 1000 // 15 minutes
  });

  return token;
}

// Cleanup expired tokens automatically
async function cleanupExpiredTokens() {
  const tokensRef = collection(db, "loginTokens");
  const q = query(tokensRef, where("expiresAt", "<", Date.now()));
  const snap = await getDocs(q);

  snap.forEach(async docSnap => {
    await deleteDoc(docSnap.ref);
  });
}

 // REDEEM BUTTON — SAFE & ALWAYS SHOWS
async function updateRedeemLink() {
  if (!refs.redeemBtn || !currentUser?.uid) {
    if (refs.redeemBtn) refs.redeemBtn.style.display = "none";
    return;
  }

  try {
    const token = await createLoginToken(currentUser.uid);
    refs.redeemBtn.href = `/tm?t=${token}`;
  } catch (err) {
    console.warn("[REDEEM] Token failed, using fallback");
    refs.redeemBtn.href = "/tm"; // fallback link
  }

  refs.redeemBtn.style.display = "inline-block";
  console.log("[REDEEM] Button shown");
}

// TIP BUTTON — SAFE & ALWAYS SHOWS
async function updateTipLink() {
  if (!refs.tipBtn || !currentUser?.uid) {
    if (refs.tipBtn) refs.tipBtn.style.display = "none";
    return;
  }

  try {
    const token = await createLoginToken(currentUser.uid);
    refs.tipBtn.href = `/tm1?t=${token}`;
  } catch (err) {
    console.warn("[TIP] Token failed, using fallback");
    refs.tipBtn.href = "/tm1"; // fallback link
  }

  refs.tipBtn.style.display = "inline-block";
  console.log("[TIP] Button shown");
}

/* ----------------------------
   GIFT ALERT (ON-SCREEN CELEBRATION)
----------------------------- */
function showGiftAlert(text) {
  if (!refs.giftAlert) return;
  refs.giftAlert.textContent = text;
  refs.giftAlert.classList.add("show", "glow");
  setTimeout(() => refs.giftAlert.classList.remove("show", "glow"), 4000);
}

// ---------------------- AUTO-SCROLL + TWITCH-STYLE MIDDLE DRAG BUTTON ----------------------
let scrollPending = false;
let scrollArrow = null;
let middleDragBtn = null;

function handleChatAutoScroll() {
  if (!refs.messagesEl) return;

  // BOTTOM ARROW (your existing one)
  scrollArrow = document.getElementById("scrollToBottomBtn");
  if (!scrollArrow) {
    scrollArrow = document.createElement("div");
    scrollArrow.id = "scrollToBottomBtn";
    scrollArrow.textContent = "Down Arrow";
    scrollArrow.style.cssText = `
      position: fixed;
      bottom: 90px;
      right: 20px;
      padding: 10px 16px;
      background: rgba(255,20,147,0.95);
      color: #fff;
      border-radius: 50px;
      font-size: 18px;
      font-weight: 900;
      cursor: pointer;
      opacity: 0;
      pointer-events: none;
      transition: all 0.3s ease;
      z-index: 9999;
      box-shadow: 0 0 20px rgba(255,0,147,0.6);
    `;
    document.body.appendChild(scrollArrow);
    scrollArrow.addEventListener("click", () => {
      refs.messagesEl.scrollTo({ top: refs.messagesEl.scrollHeight, behavior: "smooth" });
      scrollArrow.style.opacity = 0;
      scrollArrow.style.pointerEvents = "none";
    });
  }

  // TWITCH-STYLE MIDDLE DRAG BUTTON
  middleDragBtn = document.getElementById("middleScrollDrag");
  if (!middleDragBtn) {
    middleDragBtn = document.createElement("div");
    middleDragBtn.id = "middleScrollDrag";
    middleDragBtn.innerHTML = "Drag";
    middleDragBtn.style.cssText = `
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      width: 36px;
      height: 80px;
      background: rgba(255,20,147,0.7);
      color: #fff;
      border-radius: 50px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-size: 12px;
      cursor: ns-resize;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
      z-index: 999;
      box-shadow: 0 0 20px rgba(255,0,147,0.4);
      writing-mode: vertical-rl;
      text-orientation: mixed;
    `;
    refs.messagesEl.style.position = "relative"; // important
    refs.messagesEl.appendChild(middleDragBtn);

    // DRAG FUNCTIONALITY
    let isDragging = false;
    let startY = 0;
    let startScroll = 0;

    middleDragBtn.addEventListener("mousedown", e => {
      isDragging = true;
      startY = e.clientY;
      startScroll = refs.messagesEl.scrollTop;
      middleDragBtn.style.background = "rgba(255,20,147,1)";
      e.preventDefault();
    });

    document.addEventListener("mousemove", e => {
      if (!isDragging) return;
      const delta = startY - e.clientY;
      refs.messagesEl.scrollTop = startScroll + delta;
    });

    document.addEventListener("mouseup", () => {
      if (isDragging) {
        isDragging = false;
        middleDragBtn.style.background = "rgba(255,20,147,0.7)";
      }
    });
  }

  // SHOW/HIDE LOGIC
  refs.messagesEl.addEventListener("scroll", () => {
    const distanceFromBottom = refs.messagesEl.scrollHeight - refs.messagesEl.scrollTop - refs.messagesEl.clientHeight;
    const distanceFromTop = refs.messagesEl.scrollTop;

    // Bottom arrow
    if (distanceFromBottom > 300) {
      scrollArrow.style.opacity = 1;
      scrollArrow.style.pointerEvents = "auto";
    } else {
      scrollArrow.style.opacity = 0;
      scrollArrow.style.pointerEvents = "none";
    }

    // Middle drag button — show when not at bottom
    if (distanceFromBottom > 100 && distanceFromTop > 100) {
      middleDragBtn.style.opacity = 0.8;
      middleDragBtn.style.pointerEvents = "auto";
    } else {
      middleDragBtn.style.opacity = 0;
      middleDragBtn.style.pointerEvents = "none";
    }
  });

  // Auto-scroll on new messages (robust version)
const observer = new MutationObserver(() => {
  const distanceFromBottom = refs.messagesEl.scrollHeight - refs.messagesEl.scrollTop - refs.messagesEl.clientHeight;
  if (distanceFromBottom < 200) {
    refs.messagesEl.scrollTo({
      top: refs.messagesEl.scrollHeight,
      behavior: "smooth"
    });
  }
});
  
observer.observe(refs.messagesEl, { childList: true, subtree: true });

  // AUTO SCROLL TO BOTTOM ON NEW MESSAGES
  if (!scrollPending) {
    scrollPending = true;
    requestAnimationFrame(() => {
      refs.messagesEl.scrollTop = refs.messagesEl.scrollHeight;
      scrollPending = false;
    });
  }
}

// CALL IT
handleChatAutoScroll();

function cancelReply() {
  currentReplyTarget = null;
  refs.messageInputEl.placeholder = "Type a message...";

  if (refs.cancelReplyBtn && refs.cancelReplyBtn.parentNode) {
    refs.cancelReplyBtn.remove();
    refs.cancelReplyBtn = null;
  }

  // Optional: collapse input if empty
  if (!refs.messageInputEl.value.trim()) {
    resizeAndExpand();
  }
}

// =============================
// REPLY CANCEL BUTTON — OLD LAYOUT + NEON "×" COLOR ONLY
// =============================
function showReplyCancelButton() {
  // Remove any existing button
  if (refs.cancelReplyBtn && refs.cancelReplyBtn.parentNode) {
    refs.cancelReplyBtn.remove();
  }

  const btn = document.createElement("button");
  btn.textContent = "×";
  btn.style.marginLeft = "6px";
  btn.style.fontSize = "12px";
  btn.style.color = "var(--accent, #FF1493)";  // Neon accent color
  btn.style.fontWeight = "700";
  btn.style.background = "none";
  btn.style.border = "none";
  btn.style.cursor = "pointer";
  btn.style.outline = "none";
  btn.onclick = cancelReply;
  refs.cancelReplyBtn = btn;
  refs.messageInputEl.parentElement.appendChild(btn);
}

// Report a message
async function reportMessage(msgData) {
  try {
    const reportRef = doc(db, "reportedmsgs", msgData.id);
    const reportSnap = await getDoc(reportRef);
    const reporterChatId = currentUser?.chatId || "unknown";
    const reporterUid = currentUser?.uid || null;

    if (reportSnap.exists()) {
      const data = reportSnap.data();
      if ((data.reportedBy || []).includes(reporterChatId)) {
        return showStarPopup("You’ve already reported this message.", { type: "info" });
      }
      await updateDoc(reportRef, {
        reportCount: increment(1),
        reportedBy: arrayUnion(reporterChatId),
        reporterUids: arrayUnion(reporterUid),
        lastReportedAt: serverTimestamp()
      });
    } else {
      await setDoc(reportRef, {
        messageId: msgData.id,
        messageText: msgData.content,
        offenderChatId: msgData.chatId,
        offenderUid: msgData.uid || null,
        reportedBy: [reporterChatId],
        reporterUids: [reporterUid],
        reportCount: 1,
        createdAt: serverTimestamp(),
        status: "pending"
      });
    }
    showStarPopup("Report submitted!", { type: "success" });
  } catch (err) {
    console.error(err);
    showStarPopup("Error reporting message.", { type: "error" });
  }
}

// =============================
// TAP MODAL — MINIMAL, CLEAN & MOBILE-PERFECT (2026 FINAL)
// =============================

function showTapModal(targetEl, msgData) {
  // Remove existing modal
  if (tapModalEl) {
    tapModalEl.remove();
    tapModalEl = null;
  }

  tapModalEl = document.createElement("div");
  tapModalEl.className = "tap-modal";

  // Reply button
  const replyBtn = document.createElement("button");
  replyBtn.textContent = "Reply";
 replyBtn.onclick = (e) => {
  e.stopPropagation();
  currentReplyTarget = {
    id: msgData.id,
    chatId: msgData.chatId,
    content: msgData.content
  };
  refs.messageInputEl.placeholder = `Replying to ${msgData.chatId}: ${msgData.content.substring(0, 30)}...`;
  refs.messageInputEl.focus();
  showReplyCancelButton(); // ← This is your original working function
  tapModalEl.remove();
  tapModalEl = null;
};
  // Report button
  const reportBtn = document.createElement("button");
  reportBtn.textContent = "Report";
  reportBtn.onclick = async (e) => {
    e.stopPropagation();
    await reportMessage(msgData);
    tapModalEl.remove();
    tapModalEl = null;
  };

  // Cancel "×" — grey backdrop + neon accent
  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "×";
  cancelBtn.onclick = (e) => {
    e.stopPropagation();
    tapModalEl.remove();
    tapModalEl = null;
  };

  // Assemble
  tapModalEl.append(replyBtn, reportBtn, cancelBtn);
  document.body.appendChild(tapModalEl);

  // Position above tapped message
  const rect = targetEl.getBoundingClientRect();
  tapModalEl.style.cssText = `
    position: absolute;
    top: ${rect.top - 56 + window.scrollY}px;
    left: ${rect.left}px;
    background: #000000;
    color: #ffffff;
    padding: 8px 12px;
    border-radius: 10px;
    font-size: 13.5px;
    display: flex;
    gap: 14px;
    align-items: center;
    z-index: 99999;
    box-shadow: 0 4px 16px rgba(0,0,0,0.7);
    -webkit-tap-highlight-color: transparent;
  `;

  // Buttons — clean & minimal
  replyBtn.style.cssText = `
    background: transparent;
    color: #ffffff;
    padding: 6px 12px;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
  `;

  reportBtn.style.cssText = `
    background: transparent;
    color: #ffffff;
    padding: 6px 12px;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
  `;

  // "×" — grey circle + neon
  cancelBtn.style.cssText = `
    background: rgba(255,255,255,0.12);
    color: var(--accent, #FF1493);
    font-size: 16px;
    font-weight: 700;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  // Auto-remove after 4 seconds
  setTimeout(() => {
    if (tapModalEl) {
      tapModalEl.remove();
      tapModalEl = null;
    }
  }, 4000);
}
// =============================
// EXTRACT COLORS FROM GRADIENT — USED FOR CONFETTI
// =============================
function extractColorsFromGradient(gradient) {
  var matches = gradient.match(/#[0-9a-fA-F]{6}/g);
  if (matches && matches.length > 0) {
    return matches;
  }
  // Fallback colors if parsing fails
  return ["#ff9a9e", "#fecfef", "#a8edea", "#fed6e3"];
}

//666
function applyHostUI() {
  if (!currentUser || !currentUser.isHost) return;

  document.querySelectorAll(".host-only").forEach(el => {
    el.style.display = "inline-flex"; // buttons need inline-flex
  });
}

applyHostUI();


document.addEventListener("click", (e) => {
  const btn = e.target.closest(".tab-btn");
  if (!btn) return;

  const tabId = btn.dataset.tab;

  if (tabId === "infoTab" && (!currentUser || !currentUser.isHost)) {
    console.warn("[tabs] Non-host blocked from Tools");
    e.preventDefault();
    return;
  }
});

// =============================
// CREATE CONFETTI INSIDE STICKER — DEFINED ONCE, OUTSIDE LOOP
// =============================
function createConfettiInside(container, colors) {
  for (var i = 0; i < 18; i++) {
    var piece = document.createElement("div");
    var size = 6 + Math.random() * 10;
    var delay = Math.random() * 3;
    var duration = 4 + Math.random() * 4;
    var left = Math.random() * 100;
    var color = colors[Math.floor(Math.random() * colors.length)];

    piece.style.cssText = `
      position: absolute;
      left: ${left}%;
      top: -20px;
      width: ${size}px;
      height: ${size * 1.8}px;
      background: ${color};
      border-radius: 50%;
      opacity: 0.8;
      pointer-events: none;
      animation: confettiFall ${duration}s linear infinite;
      animation-delay: ${delay}s;
      transform: rotate(${Math.random() * 360}deg);
    `;
    container.appendChild(piece);
  }
}

// =============================
// RENDER MESSAGES — FINAL SAFARI-FIXED + SMALLER FONT (2026 ETERNAL)
// =============================
function renderMessagesFromArray(messages) {
  if (!refs.messagesEl) return;

  messages.forEach(function(item) {
    const id = item.id || item.tempId || item.data?.id;
    if (!id || document.getElementById(id)) return;

    const m = item.data ?? item;

    // BLOCK BANNERS & SYSTEM
    if (
      m.isBanner ||
      m.type === "banner" ||
      m.type === "gift_banner" ||
      m.systemBanner ||
      m.chatId === "SYSTEM" ||
      /system/i.test(m.uid || "")
    ) return;

    const wrapper = document.createElement("div");
    wrapper.className = "msg";
    wrapper.id = id;

    // === USERNAME — TAP → SOCIAL CARD (SAFARI-FRIENDLY) ===
    const nameSpan = document.createElement("span");
    nameSpan.className = "chat-username";
    nameSpan.textContent = (m.chatId || "Guest") + " ";

    const realUid = (m.uid || (m.email ? m.email.replace(/[.@]/g, '_') : m.chatId) || "unknown")
      .replace(/[.@/\\]/g, '_');
    nameSpan.dataset.userId = realUid;

    const usernameColor = refs.userColors?.[m.uid] || "#ffffff";

    nameSpan.style.cssText = `
      cursor: pointer;
      font-weight: 600;
      font-size: 13.5px;           /* Slightly smaller — cleaner look */
      color: ${usernameColor};
      opacity: 0.9;
      user-select: none;
      display: inline;
      margin-right: 4px;
      -webkit-tap-highlight-color: transparent; /* Removes Safari blue flash */
    `;

    // SAFARI-PROOF TAP: use 'touchend' + preventDefault + manual click
    nameSpan.addEventListener("touchend", (e) => {
      e.preventDefault(); // Stops Safari from ignoring the click
      const chatIdLower = (m.chatId || "").toLowerCase();
      const user = usersByChatId?.[chatIdLower] || allUsers.find(u => u.chatIdLower === chatIdLower);
      if (user && user._docId !== currentUser?.uid) {
        showSocialCard(user);
      }
    });

    // Desktop click still works
    nameSpan.addEventListener("click", (e) => {
      e.stopPropagation();
      const chatIdLower = (m.chatId || "").toLowerCase();
      const user = usersByChatId?.[chatIdLower] || allUsers.find(u => u.chatIdLower === chatIdLower);
      if (user && user._docId !== currentUser?.uid) {
        showSocialCard(user);
      }
    });

    wrapper.appendChild(nameSpan);

    // === REPLY PREVIEW ===
    let preview = null;
    if (m.replyTo) {
      preview = document.createElement("div");
      preview.className = "reply-preview";
      preview.style.cssText = `
        background:rgba(255,255,255,0.06);
        border-left:3px solid #b3b3b3;
        padding:6px 10px;
        margin:6px 0 8px;
        border-radius:0 8px 8px 0;
        font-size:13px;
        color:#aaa;
        cursor:pointer;
        line-height:1.4;
      `;
      const replyText = (m.replyToContent || "Original message").replace(/\n/g, " ").trim();
      const shortText = replyText.length > 80 ? replyText.substring(0,80) + "..." : replyText;
      preview.innerHTML = `<strong style="color:#999;">⤿ ${m.replyToChatId || "someone"}:</strong> <span style="color:#aaa;">${shortText}</span>`;

      preview.onclick = (e) => {
        e.stopPropagation();
        const target = document.getElementById(m.replyTo);
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "center" });
          target.style.background = "rgba(180,180,180,0.15)";
          setTimeout(() => target.style.background = "", 2000);
        }
      };
      wrapper.appendChild(preview);
    }

    // === MESSAGE CONTENT ===
    const content = document.createElement("span");
    content.className = "content";
    content.textContent = m.content || "";

    // NORMAL MESSAGES — LIGHT, SMALLER & AIRY
    if (m.type !== "buzz") {
      content.style.cssText = `
        font-weight: 400;
        font-size: 13px;            /* Reduced from 14.5px — cleaner */
        line-height: 1.55;
        color: #d0d0d0;
        word-wrap: break-word;
        white-space: pre-wrap;
        display: inline;
        opacity: 0.95;
        cursor: pointer;
      `;
    }

    // BUZZ MESSAGES — EPIC
    if (m.type === "buzz" && m.stickerGradient) {
      wrapper.className += " super-sticker";
      wrapper.style.cssText = `
        display: inline-block;
        max-width: 85%;
        margin: 14px 10px;
        padding: 20px 24px;
        border-radius: 28px;
        background: ${m.stickerGradient};
        box-shadow: 0 10px 40px rgba(0,0,0,0.25), inset 0 2px 0 rgba(255,255,255,0.3);
        position: relative;
        overflow: hidden;
        border: 3px solid rgba(255,255,255,0.25);
        animation: stickerPop 0.7s ease-out;
        backdrop-filter: blur(4px);
      `;

      const confettiContainer = document.createElement("div");
      confettiContainer.style.cssText = "position:absolute;inset:0;pointer-events:none;overflow:hidden;opacity:0.7;";
      createConfettiInside(confettiContainer, extractColorsFromGradient(m.stickerGradient));
      wrapper.appendChild(confettiContainer);

      wrapper.style.transition = "transform 0.2s";
      wrapper.onmouseenter = () => wrapper.style.transform = "scale(1.03) translateY(-4px)";
      wrapper.onmouseleave = () => wrapper.style.transform = "scale(1)";

      setTimeout(() => {
        wrapper.style.background = "rgba(255,255,255,0.06)";
        wrapper.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
        wrapper.style.border = "none";
        confettiContainer.remove();
      }, 20000);

      content.style.cssText = `
        font-size: 1.45em;
        font-weight: 900;
        line-height: 1.4;
        letter-spacing: 0.6px;
        color: #fff;
        text-shadow: 0 2px 8px rgba(0,0,0,0.6);
        word-wrap: break-word;
        white-space: pre-wrap;
        display: block;
        cursor: pointer;
      `;
    }

    // TAP ON TEXT → REPLY/REPORT
    content.addEventListener("click", (e) => {
      e.stopPropagation();
      showTapModal(wrapper, {
        id,
        chatId: m.chatId,
        uid: realUid,
        content: m.content,
        replyTo: m.replyTo,
        replyToContent: m.replyToContent,
        replyToChatId: m.replyToChatId
      });
    });

    wrapper.appendChild(content);

    // BUBBLE BACKGROUND — COMPLETELY UNTAPPABLE
    wrapper.style.pointerEvents = "none";

    // Re-enable on interactive parts
    nameSpan.style.pointerEvents = "auto";
    if (preview) preview.style.pointerEvents = "auto";
    content.style.pointerEvents = "auto";

    refs.messagesEl.appendChild(wrapper);
  });

  // Auto-scroll
  const distanceFromBottom = refs.messagesEl.scrollHeight - refs.messagesEl.scrollTop - refs.messagesEl.clientHeight;
  if (distanceFromBottom < 200) {
    refs.messagesEl.scrollTo({ top: refs.messagesEl.scrollHeight, behavior: "smooth" });
  }

  if (!scrollPending) {
    scrollPending = true;
    requestAnimationFrame(() => {
      refs.messagesEl.scrollTop = refs.messagesEl.scrollHeight;
      scrollPending = false;
    });
  }
}

/* ---------- 🔔 Messages Listener – Clean & Correct (2026) ---------- */
/*
  ✔ Oldest messages render first (top)
  ✔ Newest messages render last (bottom)
  ✔ Limit applied safely
  ✔ Optimistic message reconciliation preserved
  ✔ Gift alerts preserved
  ✔ Cache-aware logging
  ✔ Proper unsubscribe handling
*/

let messagesUnsubscribe = null;

function attachMessagesListener() {
  // ---- Cleanup existing listener (prevents duplicates)
  if (typeof messagesUnsubscribe === "function") {
    messagesUnsubscribe();
    messagesUnsubscribe = null;
  }

  const CHAT_LIMIT = 21;

  // ---- Correct chronological query
  const q = query(
    collection(db, CHAT_COLLECTION),
    orderBy("timestamp", "asc"), // ← OLDEST → NEWEST (correct chat order)
    limit(CHAT_LIMIT)
  );

  // ---- Persisted gift alerts
  const shownGiftAlerts = new Set(
    JSON.parse(localStorage.getItem("shownGiftAlerts") || "[]")
  );

  function saveShownGift(id) {
    shownGiftAlerts.add(id);
    localStorage.setItem(
      "shownGiftAlerts",
      JSON.stringify([...shownGiftAlerts])
    );
  }

  // ---- Local optimistic messages
  let localPendingMsgs = JSON.parse(
    localStorage.getItem("localPendingMsgs") || "{}"
  );

  messagesUnsubscribe = onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snapshot) => {
      console.log(
        `Messages snapshot | ${snapshot.metadata.fromCache ? "✓ cache" : "server"} | ` +
        `docs: ${snapshot.size} | changes: ${snapshot.docChanges().length}`
      );

      snapshot.docChanges().forEach((change) => {
        if (change.type !== "added") return;

        const msgId = change.doc.id;
        const msg   = change.doc.data();

        // ---- Skip temp echoes
        if (msg.tempId?.startsWith("temp_")) return;

        // ---- Defensive: already rendered
        if (document.getElementById(msgId)) return;

        // ---- Match optimistic message
        for (const [tempId, pending] of Object.entries(localPendingMsgs)) {
          const sameUser = pending.uid === msg.uid;
          const sameText = pending.content === msg.content;

          const timeDiff = Math.abs(
            (msg.timestamp?.toMillis?.() || 0) - (pending.createdAt || 0)
          );

          if (sameUser && sameText && timeDiff < 7000) {
            const tempEl = document.getElementById(tempId);
            if (tempEl) tempEl.remove();

            delete localPendingMsgs[tempId];
            localStorage.setItem(
              "localPendingMsgs",
              JSON.stringify(localPendingMsgs)
            );
            break;
          }
        }

        // ---- Render message (append → bottom)
        renderMessagesFromArray([{ id: msgId, data: msg }]);

        // ---- Gift alert (receiver only)
        if (msg.highlight && msg.content?.includes("gifted")) {
          const myChatId = currentUser?.chatId?.toLowerCase();
          if (!myChatId) return;

          const [sender, , receiver, amount] = msg.content.split(" ");

          if (
            receiver?.toLowerCase() === myChatId &&
            amount &&
            !shownGiftAlerts.has(msgId)
          ) {
            showGiftAlert(`${sender} gifted you ${amount} stars ⭐️`);
            saveShownGift(msgId);
          }
        }

        // ---- Auto-scroll only when YOU send
        if (refs.messagesEl && msg.uid === currentUser?.uid) {
          refs.messagesEl.scrollTop = refs.messagesEl.scrollHeight;
        }
      });
    },
    (error) => {
      console.error("Messages listener error:", error);
    }
  );
}

/* ===== NOTIFICATIONS SYSTEM — FINAL ETERNAL EDITION ===== */
let notificationsUnsubscribe = null; // ← one true source of truth

async function setupNotifications() {
  // Prevent double setup
  if (notificationsUnsubscribe) return;

  const listEl = document.getElementById("notificationsList");
  const markAllBtn = document.getElementById("markAllRead");

  if (!listEl) {
    console.warn("Notifications tab not found in DOM");
    return;
  }

  // Show loading
  listEl.innerHTML = `<p style="opacity:0.6; text-align:center;">Loading notifications...</p>`;

  if (!currentUser?.uid) {
    listEl.innerHTML = `<p style="opacity:0.7;">Log in to see notifications.</p>`;
    return;
  }

  const notifCol = collection(db, "users", currentUser.uid, "notifications");
  const q = query(notifCol, orderBy("timestamp", "desc"));

  notificationsUnsubscribe = onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      listEl.innerHTML = `<p style="opacity:0.7; text-align:center;">No notifications yet.</p>`;
      if (markAllBtn) markAllBtn.style.display = "none";
      return;
    }

    if (markAllBtn) markAllBtn.style.display = "block";

    const frag = document.createDocumentFragment();
    snapshot.docs.forEach(docSnap => {
      const n = docSnap.data();
      const time = n.timestamp?.toDate?.() || n.timestamp?.seconds
        ? new Date((n.timestamp.toDate?.() || n.timestamp.seconds * 1000))
        : new Date();

      const item = document.createElement("div");
      item.className = `notification-item ${n.read ? "" : "unread"}`;
      item.dataset.id = docSnap.id;
      item.innerHTML = `
        <div class="notif-message">${n.message || "New notification"}</div>
        <div class="notif-time">${time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
      `;

      // Optional: tap to mark as read
      item.style.cursor = "pointer";
      item.onclick = () => {
        if (!n.read) {
          updateDoc(doc(db, "users", currentUser.uid, "notifications", docSnap.id), { read: true });
        }
      };

      frag.appendChild(item);
    });

    listEl.innerHTML = "";
    listEl.appendChild(frag);
  }, (error) => {
    console.error("Notifications listener failed:", error);
    listEl.innerHTML = `<p style="color:#ff6666;">Failed to load notifications.</p>`;
  });

  // === MARK ALL AS READ (safe + one-time) ===
  if (markAllBtn) {
    markAllBtn.onclick = async () => {
      if (markAllBtn.disabled) return;
      markAllBtn.disabled = true;
      markAllBtn.textContent = "Marking...";

      try {
        const snapshot = await getDocs(notifCol);
        const batch = writeBatch(db);
        snapshot.docs.forEach(docSnap => {
          if (!docSnap.data().read) {
            batch.update(docSnap.ref, { read: true });
          }
        });
        await batch.commit();
        showStarPopup("All notifications marked as read");
      } catch (err) {
        console.error("Mark all failed:", err);
        showStarPopup("Failed to mark as read");
      } finally {
        markAllBtn.disabled = false;
        markAllBtn.textContent = "Mark All Read";
      }
    };
  }
}

// === TAB SWITCHING — CLEAN & LAZY (only once) ===
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    // Visual switch
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(t => t.style.display = "none");

    btn.classList.add("active");
    const tab = document.getElementById(btn.dataset.tab);
    if (tab) tab.style.display = "block";

    // Lazy load notifications — only once
    if (btn.dataset.tab === "notificationsTab" && !notificationsUnsubscribe) {
      setupNotifications();
    }
  });
});

// === CLEANUP ON LOGOUT (CRITICAL) ===
window.addEventListener("beforeunload", () => {
  if (notificationsUnsubscribe) {
    notificationsUnsubscribe();
    notificationsUnsubscribe = null;
  }
});

// ——— CLICKING THE NOTIFICATIONS TAB BUTTON ———
document.getElementById("notificationsTabBtn")?.addEventListener("click", () => {
  // Hide all tabs
  document.querySelectorAll(".tab-content")?.forEach(tab => {
    tab.style.display = "none";
  });
  
  // Remove active class from all buttons
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.remove("active");
  });

  // Show notifications tab
  const notifTab = document.getElementById("notificationsTab");
  if (notifTab) notifTab.style.display = "block";

  // Mark this button as active
  document.getElementById("notificationsTabBtn")?.classList.add("active");

  // Load notifications
  loadNotifications();
});


// Load notifications + update badge
async function loadNotifications() {
  const list = document.getElementById("notificationsList");
  const badge = document.getElementById("notif-badge");
  const clearBtn = document.getElementById("markAllRead");

  if (!list || !currentUser?.uid) return;

  list.innerHTML = `<div style="padding:60px;text-align:center;color:#666;">Loading...</div>`;

  try {
    const q = query(
      collection(db, "notifications"),
      where("recipientId", "==", currentUser.uid),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);
    const unreadCount = snapshot.docs.length; // now all = "unread" visually

    // UPDATE BADGE
    if (badge) {
      badge.textContent = unreadCount > 99 ? "99+" : unreadCount;
      badge.style.display = unreadCount > 0 ? "flex" : "none";
    }

    // UPDATE CLEAR BUTTON — GRADIENT WHEN NOTIFS EXIST
    if (clearBtn) {
      if (unreadCount > 0) {
        clearBtn.style.background = "linear-gradient(135deg, #ff006e, #ff5500)";
        clearBtn.style.color = "#fff";
        clearBtn.style.boxShadow = "0 4px 12px rgba(255,0,110,0.4)";
        clearBtn.textContent = "Clear all";
      } else {
        clearBtn.style.background = "#333";
        clearBtn.style.color = "#666";
        clearBtn.style.boxShadow = "none";
        clearBtn.textContent = "All clear";
      }
    }

    if (snapshot.empty) {
      list.innerHTML = `<div style="padding:100px;text-align:center;color:#888;font-size:14px;">No notifications.</div>`;
      return;
    }

    list.innerHTML = "";
    snapshot.forEach(doc => {
      const n = doc.data();
      const age = Date.now() - (n.createdAt?.toDate?.() || 0);
      const isFresh = age < 30_000;

      const item = document.createElement("div");
      item.style.cssText = `
        padding:10px 12px; margin:2px 6px; border-radius:9px;
        background:rgba(255,0,110,${isFresh ? "0.12" : "0.06"});
        border-left:${isFresh ? "3px solid #ff006e" : "none"};
        cursor:pointer; transition:all 0.2s;
      `;

      item.innerHTML = `
        <div style="font-weight:800; font-size:13.5px; color:#fff;">${n.title}</div>
        <div style="font-size:12.5px; color:#ddd; margin-top:3px;">${n.message}</div>
        <div style="font-size:10.5px; color:#888; margin-top:5px; display:flex; justify-content:space-between;">
          <span>${timeAgo(n.createdAt?.toDate())}</span>
          ${isFresh ? `<span style="color:#ff006e; font-weight:900; font-size:9px; animation:blink 1.5s infinite;">NEW</span>` : ""}
        </div>
      `;

      item.onclick = () => {
        deleteDoc(doc.ref).then(() => loadNotifications());
      };

      list.appendChild(item);
    });

  } catch (err) {
    console.error("Notifications error:", err);
    list.innerHTML = `<div style="color:#f66; text-align:center; padding:80px;">Failed</div>`;
  }
}

// Helper: time ago
function timeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return Math.floor(seconds / 60) + "m ago";
  if (seconds < 86400) return Math.floor(seconds / 3600) + "h ago";
  return Math.floor(seconds / 86400) + "d ago";
}


// MARK ALL AS READ BUTTON
document.getElementById("markAllRead")?.addEventListener("click", async () => {
  if (!currentUser?.uid) return;

  const clearBtn = document.getElementById("markAllRead");
  if (clearBtn.textContent.includes("All clear")) return;

  clearBtn.textContent = "Clearing...";
  clearBtn.disabled = true;

  try {
    const q = query(
      collection(db, "notifications"),
      where("recipientId", "==", currentUser.uid)
    );

    const snapshot = await getDocs(q);
    const batch = writeBatch(db);

    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    loadNotifications(); // refresh UI + badge gone
    console.log("All notifications deleted");

  } catch (err) {
    console.error("Clear all failed:", err);
    clearBtn.textContent = "Error";
  }
});

// HOST BADGE — FINAL WORKING VERSION
const hostBtn = document.getElementById('hostSettingsBtn');
const hostBadge = document.getElementById('hostBadge');

async function checkHostNotifications() {
  if (!currentUser || !currentUser.isHost || !hostBadge) {
    if (hostBadge) hostBadge.style.display = "none";
    return;
  }

  try {
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", currentUser.uid),
      where("type", "==", "host"),
      where("read", "==", false),
      limit(1)
    );

    const snap = await getDocs(q);
    if (hostBadge) {
      hostBadge.style.display = snap.empty ? "none" : "block";
    }

  } catch (e) {
    console.warn("Badge check failed:", e);
    if (hostBadge) hostBadge.style.display = "none";
  }
}


// Hide badge when clicked
hostBtn?.addEventListener("click", () => {
  if (hostBadge) {
    hostBadge.style.display = "none";
  }
});


// Check every 15 seconds
setInterval(checkHostNotifications, 15000);

// Run immediately
checkHostNotifications();


/* ----------------------------
   ⚡ Accurate + Organic Loading Bar (Best of Both)
----------------------------- */
function showLoadingBar() {
  const postLoginLoader = document.getElementById("postLoginLoader");
  const loadingBar = document.getElementById("loadingBar");
  if (!postLoginLoader || !loadingBar) return;

  postLoginLoader.style.display = "flex";
  loadingBar.style.width = "0%";
  loadingBar.style.transition = "width 0.35s ease-out"; // smooth real updates

  let progress = 0;

  // Organic fallback animation (runs in background)
  const interval = 60;
  let organicProgress = 0;
  const organicStep = 1.8 + Math.random() * 1.5; // gentle natural growth

  const organicInterval = setInterval(() => {
    if (progress >= 100) return;
    organicProgress += organicStep;
    if (organicProgress > 92) organicProgress = 92; // never auto-reach 100%
    if (organicProgress > progress) {
      progress = organicProgress;
      loadingBar.style.width = `${progress}%`;
    }
  }, interval);

  // Manual update function — called at real steps
  const update = (target) => {
    progress = Math.max(progress, target);
    loadingBar.style.width = `${Math.min(progress, 100)}%`;

    if (progress >= 100) {
      clearInterval(organicInterval);
      // Final polish
      setTimeout(() => {
        loadingBar.style.width = "100%";
        setTimeout(() => {
          postLoginLoader.style.display = "none";
          setTimeout(() => loadingBar.style.width = "0%", 300);
        }, 300);
      }, 200);
    }
  };

  // Auto-finish after max 4 seconds (safety)
  setTimeout(() => update(100), 4000);

  // Return updater so login code can push real progress
  return { update };
}
 /* ----------------------------
   🔁 Auto Login Session
----------------------------- */
async function autoLogin() {
  const vipUser = JSON.parse(localStorage.getItem("vipUser"));
  if (vipUser?.email && vipUser?.password) {
    showLoadingBar(1200);  // nice bar on auto-login too
    await sleep(60);
    const success = await loginWhitelist(vipUser.email, vipUser.password);
    if (!success) return;
    await sleep(400);
    updateRedeemLink();
    updateTipLink();
  }
}

// Call on page load
autoLogin();


/* ---------- 🆔 ChatID Modal ---------- */
async function promptForChatID(userRef, userData) {
  if (!refs.chatIDModal || !refs.chatIDInput || !refs.chatIDConfirmBtn)
    return userData?.chatId || null;

  // Skip if user already set chatId
  if (userData?.chatId && !userData.chatId.startsWith("GUEST"))
    return userData.chatId;

  refs.chatIDInput.value = "";
  refs.chatIDModal.style.display = "flex";
  if (refs.sendAreaEl) refs.sendAreaEl.style.display = "none";

  return new Promise(resolve => {
    refs.chatIDConfirmBtn.onclick = async () => {
      const chosen = refs.chatIDInput.value.trim();
      if (chosen.length < 3 || chosen.length > 12)
        return alert("Chat ID must be 3–12 characters");

      const lower = chosen.toLowerCase();
      const q = query(collection(db, "users"), where("chatIdLower", "==", lower));
      const snap = await getDocs(q);

      let taken = false;
      snap.forEach(docSnap => {
        if (docSnap.id !== userRef.id) taken = true;
      });
      if (taken) return alert("This Chat ID is taken 💬");

      try {
        await updateDoc(userRef, { chatId: chosen, chatIdLower: lower });
        currentUser.chatId = chosen;
        currentUser.chatIdLower = lower;
        refs.chatIDModal.style.display = "none";
        if (refs.sendAreaEl) refs.sendAreaEl.style.display = "flex";
        showStarPopup(`Welcome ${chosen}! 🎉`);
        resolve(chosen);
      } catch (err) {
        console.error(err);
        alert("Failed to save Chat ID");
      }
    };
  });
}


/* ======================================================
   SANITIZE FIRESTORE KEYS — REQUIRED FOR LOGIN & SOCIAL CARD
   YAH DEMANDS CLEAN KEYS
====================================================== */
function sanitizeKey(email) {
  if (!email) return "";
  return email.toLowerCase().replace(/[@.]/g, "_").trim();
}
/* ======================================================
  SOCIAL CARD SYSTEM — UNIFIED HOST & VIP STYLE (Dec 2025)
  • Hosts now use exact same compact VIP card style
  • No video, no gift slider for Hosts
  • Meet button centered
  • bioPick + typewriter effect for both
====================================================== */
(async function initSocialCardSystem() {
  const allUsers = [];
  const usersByChatId = {};

  // Load all users
  try {
    const snaps = await getDocs(collection(db, "users"));
    snaps.forEach(doc => {
      const data = doc.data();
      data._docId = doc.id;
      data.chatIdLower = (data.chatId || "").toString().toLowerCase();
      allUsers.push(data);
      usersByChatId[data.chatIdLower] = data;
    });
    console.log("Social card: loaded", allUsers.length, "users");
  } catch (err) {
    console.error("Failed to load users:", err);
  }

  function showSocialCard(user) {
    if (!user) return;
    document.getElementById('socialCard')?.remove();

    // Both isHost and isVIP (and others) now use the same clean compact card
    showUnifiedCard(user);
  }

  // ==================== UNIFIED CARD FOR HOSTS & VIPs ====================
  function showUnifiedCard(user) {
    const card = document.createElement("div");
    card.id = "socialCard";

    Object.assign(card.style, {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      background: "linear-gradient(135deg, rgba(20,20,22,0.9), rgba(25,25,27,0.9))",
      backdropFilter: "blur(10px)",
      borderRadius: "14px",
      padding: "12px 16px",
      color: "#fff",
      width: "230px",
      maxWidth: "90%",
      zIndex: "999999",
      textAlign: "center",
      boxShadow: "0 6px 24px rgba(0,0,0,0.5)",
      fontFamily: "Poppins, sans-serif",
      opacity: "0",
      transition: "opacity .18s ease, transform .18s ease"
    });

    // Close X
    const closeBtn = document.createElement("div");
    closeBtn.innerHTML = "×";
    Object.assign(closeBtn.style, {
      position: "absolute",
      top: "6px",
      right: "10px",
      fontSize: "16px",
      fontWeight: "700",
      cursor: "pointer",
      opacity: "0.6"
    });
    closeBtn.onmouseenter = () => closeBtn.style.opacity = "1";
    closeBtn.onmouseleave = () => closeBtn.style.opacity = "0.6";
    closeBtn.onclick = () => card.remove();
    card.appendChild(closeBtn);

    // Header @chatId
    const header = document.createElement("h3");
    header.textContent = user.chatId ? user.chatId.charAt(0).toUpperCase() + user.chatId.slice(1) : "Unknown";
    const headerColor = user.isHost ? "#ff6600" : user.isVIP ? "#ff0099" : "#cccccc";
    header.style.cssText = `margin:0 0 8px;font-size:18px;font-weight:700;background:linear-gradient(90deg,${headerColor},#ff33cc);-webkit-background-clip:text;-webkit-text-fill-color:transparent;`;
    card.appendChild(header);

    // Legendary details
    const gender = (user.gender || "person").toLowerCase();
    const pronoun = gender === "male" ? "his" : "her";
    const ageGroup = !user.age ? "20s" : user.age >= 30 ? "30s" : "20s";
    const flair = gender === "male" ? "😎" : "💋";
    const fruit = user.fruitPick || "🍇";
    const nature = user.naturePick || "cool";
    const city = user.location || user.city || "Lagos";
    const country = user.country || "Nigeria";

    let detailsText = `A ${gender} from ${city}, ${country}. ${flair}`;
    if (user.isHost || user.isVIP) {
      detailsText = `A ${fruit} ${nature} ${gender} in ${pronoun} ${ageGroup}, currently in ${city}, ${country}. ${flair}`;
    }

    const detailsEl = document.createElement("p");
    detailsEl.textContent = detailsText;
    detailsEl.style.cssText = "margin:0 0 10px;font-size:14px;line-height:1.4;color:#ccc;";
    card.appendChild(detailsEl);

    // Bio with typewriter effect
    const bioEl = document.createElement("div");
    bioEl.style.cssText = "margin:12px 0 16px;font-style:italic;font-weight:600;font-size:13px;";
    bioEl.style.color = ["#ff99cc","#ffcc33","#66ff99","#66ccff","#ff6699","#ff9966","#ccccff","#f8b500"][Math.floor(Math.random()*8)];
    card.appendChild(bioEl);
    typeWriterEffect(bioEl, user.bioPick || "Nothing shared yet...");

// Meet button — centered (only for Hosts) — Only color changed to dark glossy black
if (user.isHost) {
  const meetBtn = document.createElement("div");
  meetBtn.style.cssText = `
    width:50px;height:50px;border-radius:50%;
    background:rgba(20,20,25,0.9);
    display:flex;align-items:center;justify-content:center;
    margin:20px auto 10px auto; /* Extra top margin for breathing room */
    cursor:pointer;
    border:2px solid rgba(255,255,255,0.12);
    transition:all 0.3s ease;
    box-shadow:0 0 15px rgba(0,0,0,0.6);
  `;
  meetBtn.innerHTML = `<img src="https://cdn.shopify.com/s/files/1/0962/6648/6067/files/128_x_128_px_1.png?v=1765845334" style="width:28px;height:28px;"/>`;

  meetBtn.onclick = (e) => {
    e.stopPropagation();
    if (typeof showMeetModal === 'function') showMeetModal(user);
  };

  meetBtn.onmouseenter = () => {
    meetBtn.style.transform = "scale(1.15)";
    meetBtn.style.background = "rgba(35,35,40,0.95)";
    meetBtn.style.boxShadow = "0 0 25px rgba(0,0,0,0.8)";
  };

  meetBtn.onmouseleave = () => {
    meetBtn.style.transform = "scale(1)";
    meetBtn.style.background = "rgba(20,20,25,0.9)";
    meetBtn.style.boxShadow = "0 0 15px rgba(0,0,0,0.6)";
  };

  card.appendChild(meetBtn);
}
  document.body.appendChild(card);
    
    // Fade in
    requestAnimationFrame(() => {
      card.style.opacity = "1";
      card.style.transform = "translate(-50%, -50%) scale(1)";
    });

    // Close on outside click
    const closeOut = (e) => {
      if (!card.contains(e.target)) {
        card.remove();
        document.removeEventListener("click", closeOut);
      }
    };
    setTimeout(() => document.addEventListener("click", closeOut), 10);
  }

  // Typewriter effect
  function typeWriterEffect(el, text, speed = 40) {
    el.textContent = "";
    let i = 0;
    const t = setInterval(() => {
      if (i < text.length) el.textContent += text[i++];
      else clearInterval(t);
    }, speed);
  }

  // Click listener to open card
  document.addEventListener("pointerdown", e => {
    const el = e.target.closest("[data-user-id]") || e.target;
    if (!el.textContent) return;
    const text = el.textContent.trim();
    if (!text || text.includes(":")) return;
    const chatId = text.split(" ")[0].toLowerCase();
    const u = usersByChatId[chatId] || allUsers.find(u => u.chatIdLower === chatId);
    if (!u || u._docId === currentUser?.uid) return;
    el.style.background = "#ffcc00";
    setTimeout(() => el.style.background = "", 200);
    showSocialCard(u);
       e.stopPropagation();
     
  });

  console.log("Social Card System — Unified clean style for Hosts & VIPs ♡");
  window.showSocialCard = showSocialCard;
  window.typeWriterEffect = typeWriterEffect;
})();

async function sendStarsToUser(targetUser, amt) {
  if (amt < 100 || !currentUser?.uid) {
    showGoldAlert("Invalid gift", 4000);
    return;
  }

  const sanitize = (str) => str?.toLowerCase().replace(/[.@/\\]/g, '_');
  const senderId = sanitize(currentUser.email);
  if (!senderId) {
    showGoldAlert("Your profile error", 4000);
    return;
  }

  let receiverId = null;
  if (targetUser._docId) {
    receiverId = targetUser._docId;
  } else if (targetUser.email) {
    receiverId = sanitize(targetUser.email);
  } else if (targetUser.chatId?.includes("@")) {
    receiverId = sanitize(targetUser.chatId);
  } else if (targetUser.uid) {
    receiverId = targetUser.uid;
  }

  if (!receiverId) {
    showGoldAlert("User not found", 4000);
    return;
  }
  if (senderId === receiverId) {
    showGoldAlert("Can't gift yourself", 4000);
    return;
  }

  const fromRef = doc(db, "users", senderId);
  const toRef = doc(db, "users", receiverId);

  try {
    // 1. Star transfer — 100% identical to your old working code
    await runTransaction(db, async (tx) => {
      const senderSnap = await tx.get(fromRef);
      const receiverSnap = await tx.get(toRef);
      if (!senderSnap.exists()) throw "Profile missing";
      if ((senderSnap.data().stars || 0) < amt) throw "Not enough stars";

      if (!receiverSnap.exists()) {
        tx.set(toRef, {
          chatId: targetUser.chatId || "User",
          email: targetUser.email || targetUser.chatId,
          stars: 0
        }, { merge: true });
      }

      tx.update(fromRef, { stars: increment(-amt), starsGifted: increment(amt) });
      tx.update(toRef, { stars: increment(amt) });
    });

    // 2. YOUR NOTIFICATION — EXACT SAME AS BEFORE (this is what makes the badge pop)
    await addDoc(collection(db, "notifications"), {
      recipientId: receiverId,
      title: "Star Gift!",
      message: `${currentUser.chatId} gifted you ${amt} stars!`,
      type: "starGift",
      fromChatId: currentUser.chatId,
      amount: amt,
      createdAt: serverTimestamp()
    });

    // 3. Last gift tracker — same as before
    await updateDoc(toRef, {
      lastGift: { from: currentUser.chatId, amt, at: Date.now() }
    });

    // 4. On-screen alert — same as before
    showGoldAlert(`You sent ${amt} stars to ${targetUser.chatId}!`, 4000);

    // BANNER CODE IS GONE — THAT'S IT. NOTHING ELSE CHANGED.

  } catch (err) {
    console.error("Gift failed:", err);
    showGoldAlert("Failed — try again", 4000);
  }
}
/* ===============================
   FINAL VIP LOGIN SYSTEM — 100% WORKING
   Google disabled | VIP button works | Safe auto-login
================================= */
document.addEventListener("DOMContentLoaded", () => {
  const googleBtn = document.getElementById("googleSignInBtn");
  if (!googleBtn) return;

  // Reset any previous styles / states
  googleBtn.style.cssText = "";
  googleBtn.disabled = false;

  // Remove old listeners (safe way)
  const newBtn = googleBtn.cloneNode(true);
  googleBtn.parentNode.replaceChild(newBtn, googleBtn);

  // Add your block handler
  newBtn.addEventListener("click", e => {
    e.preventDefault();
    e.stopPropagation();
    showStarPopup("Google Sign-Up is not available at the moment.<br>Use VIP Email Login instead.");
  });
});


// FINAL LOGIN BUTTON — NO WHITELIST, ONLY HOST OR PAID VIP
document.getElementById("whitelistLoginBtn")?.addEventListener("click", async () => {
  const email = document.getElementById("emailInput")?.value.trim().toLowerCase();
  const password = document.getElementById("passwordInput")?.value;

  if (!email || !password) {
    showStarPopup("Enter email and password");
    return;
  }

  // Start smart accurate loader
  const loader = showLoadingBar();

  try {
    loader.update(18); // Starting login...

    // STEP 1: Firebase Auth login
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log("Firebase Auth Success:", userCredential.user.uid);

    loader.update(55); // Authenticated, checking profile...

    // STEP 2: Check if allowed
    const uidKey = sanitizeKey(email);
    const userRef = doc(db, "users", uidKey);
    const userSnap = await getDoc(userRef);

    loader.update(82); // Profile loaded...

    if (!userSnap.exists()) {
      showStarPopup("Profile not found — contact support");
      await signOut(auth);
      loader.update(100); // finish cleanly
      return;
    }

    const data = userSnap.data();

    if (data.isHost || (data.isVIP && data.hasPaid === true)) {
      console.log("Access granted");
      loader.update(100); // Success → full bar + hide
      // Chat opens normally via onAuthStateChanged
    } else {
      showStarPopup("Access denied.\nOnly Hosts and paid VIPs can enter.");
      await signOut(auth);
      loader.update(100);
      return;
    }

  } catch (err) {
    console.error("Login failed:", err);
    if (err.code === "auth/wrong-password" || err.code === "auth/user-not-found") {
      showStarPopup("Wrong password or email");
    } else if (err.code === "auth/too-many-requests") {
      showStarPopup("Too many attempts. Wait a minute.");
    } else {
      showStarPopup("Login failed — try again");
    }
    loader.update(100); // Always finish bar on error
  }
});

// HELPER — SET CURRENT USER
function setCurrentUserFromData(data, uidKey, email) {
  currentUser = {
    uid: uidKey,
    email,
    phone: data.phone,
    chatId: data.chatId,
    chatIdLower: data.chatIdLower,
    stars: data.stars || 0,
    cash: data.cash || 0,
    usernameColor: data.usernameColor || randomColor(),
    isAdmin: !!data.isAdmin,
    isVIP: !!data.isVIP,
    hasPaid: !!data.hasPaid,
    fullName: data.fullName || "",
    gender: data.gender || "",
    subscriptionActive: !!data.subscriptionActive,
    subscriptionCount: data.subscriptionCount || 0,
    lastStarDate: data.lastStarDate || todayDate(),
    starsGifted: data.starsGifted || 0,
    starsToday: data.starsToday || 0,
    hostLink: data.hostLink || null,
    invitedBy: data.invitedBy || null,
    inviteeGiftShown: !!data.inviteeGiftShown,
    isHost: !!data.isHost
  };
}

// HELPER — ALL POST-LOGIN ACTIONS (DRY & CLEAN)
function setupPostLogin() {
  localStorage.setItem("vipUser", JSON.stringify({ uid: currentUser.uid }));
  console.log("%c vipUser SET IN CHAT:", "color:#00ffaa", localStorage.getItem("vipUser"));
  console.log("%cCurrent UID:", "color:#00ffaa", currentUser.uid);


  updateRedeemLink();
  setupPresence(currentUser);
  attachMessagesListener();
  startStarEarning(currentUser.uid);

  // Prompt GUEST users for permanent chatID (non-blocking)
  if (currentUser.chatId?.startsWith("GUEST")) {
    promptForChatID(doc(db, "users", currentUser.uid), currentUser).catch(e => {
      console.warn("ChatID prompt cancelled:", e);
    });
  }

  // UI & BALANCE UPDATES
  showChatUI(currentUser);
  updateInfoTab();     // Info tab balance
  safeUpdateDOM();     // Header balances
  revealHostTabs();    // Host features

  console.log("%cPost-login setup complete — Welcome!", "color:#00ff9d", currentUser.chatId);
}

/* LOGOUT — CLEAN, FUN, SAFE */
window.logoutVIP = async () => {
  try {
    await signOut(auth);
  } catch (e) {
    console.warn("Sign out failed:", e);
  } finally {
    localStorage.removeItem("vipUser");
    localStorage.removeItem("lastVipEmail");
    sessionStorage.setItem("justLoggedOut", "true");
    currentUser = null;
    location.reload();
  }
};

// HOST LOGOUT BUTTON — FUN & PREVENTS DOUBLE-CLICK
document.getElementById("hostLogoutBtn")?.addEventListener("click", async (e) => {
  e.preventDefault();
  e.stopPropagation();

  const btn = e.target.closest("button");
  if (!btn || btn.disabled) return;
  btn.disabled = true;

  try {
    await signOut(auth);
    localStorage.removeItem("vipUser");
    localStorage.removeItem("lastVipEmail");
    sessionStorage.setItem("justLoggedOut", "true");
    currentUser = null;

    const messages = [
      "See ya later, Alligator!",
      "Off you go — $STRZ waiting when you return!",
      "Catch you on the flip side!",
      "Adios, Amigo!",
      "Peace out, Player!",
      "Hasta la vista, Baby!",
      "Hmmm, now why'd you do that...",
      "Off you go, Champ!"
    ];
    const message = messages[Math.floor(Math.random() * messages.length)];
    showStarPopup(message);

    setTimeout(() => location.reload(), 1800);
  } catch (err) {
    console.error("Logout failed:", err);
    btn.disabled = false;
    showStarPopup("Logout failed — try again!");
  }
});




/* ===============================
   💫 Auto Star Earning System
================================= */
function startStarEarning(uid) {
  if (!uid) return;
  if (starInterval) clearInterval(starInterval);

  const userRef = doc(db, "users", uid);
  let displayedStars = currentUser.stars || 0;
  let animationTimeout = null;

  // ✨ Smooth UI update
  const animateStarCount = target => {
    if (!refs.starCountEl) return;
    const diff = target - displayedStars;

    if (Math.abs(diff) < 1) {
      displayedStars = target;
      refs.starCountEl.textContent = formatNumberWithCommas(displayedStars);
      return;
    }

    displayedStars += diff * 0.25; // smoother easing
    refs.starCountEl.textContent = formatNumberWithCommas(Math.floor(displayedStars));
    animationTimeout = setTimeout(() => animateStarCount(target), 40);
  };

  // 🔄 Real-time listener
  onSnapshot(userRef, snap => {
    if (!snap.exists()) return;
    const data = snap.data();
    const targetStars = data.stars || 0;
    currentUser.stars = targetStars;

    if (animationTimeout) clearTimeout(animationTimeout);
    animateStarCount(targetStars);

    // 🎉 Milestone popup
    if (targetStars > 0 && targetStars % 1000 === 0) {
      showStarPopup(`🔥 Congrats! You’ve reached ${formatNumberWithCommas(targetStars)} stars!`);
    }
  });

  // ⏱️ Increment loop
  starInterval = setInterval(async () => {
    if (!navigator.onLine) return;

    const snap = await getDoc(userRef);
    if (!snap.exists()) return;

    const data = snap.data();
    const today = todayDate();

    // Reset daily count
    if (data.lastStarDate !== today) {
      await updateDoc(userRef, { starsToday: 0, lastStarDate: today });
      return;
    }

    // Limit: 250/day
    if ((data.starsToday || 0) < 250) {
      await updateDoc(userRef, {
        stars: increment(10),
        starsToday: increment(10)
      });
    }
  }, 60000);

  // 🧹 Cleanup
  window.addEventListener("beforeunload", () => clearInterval(starInterval));
}

/* ===============================
   🧩 Helper Functions
================================= */
const todayDate = () => new Date().toISOString().split("T")[0];
const sleep = ms => new Promise(res => setTimeout(res, ms));


/* ---------- UPDATE UI AFTER AUTH — IMPROVED & SAFE ---------- */
function updateUIAfterAuth(user) {
  const subtitle = document.getElementById("roomSubtitle");
  const helloText = document.getElementById("helloText");
  const roomDescText = document.querySelector(".room-desc .text");
  const loginBar = document.getElementById("loginBar");

  if (openBtn) openBtn.style.display = "block";

  if (user) {
    [subtitle, helloText, roomDescText].forEach(el => el && (el.style.display = "none"));
    if (loginBar) loginBar.style.display = "flex";
  } else {
    [subtitle, helloText, roomDescText].forEach(el => el && (el.style.display = "block"));
    if (loginBar) loginBar.style.display = "flex";
  }

  // ENSURE MODAL STAYS CLOSED
  if (modal) {
    modal.style.display = "none";
    modal.style.opacity = "0";
  }
}

/* ===============================
   💬 Show Chat UI After Login
================================= */
function showChatUI(user) {
  const { authBox, sendAreaEl, profileBoxEl, profileNameEl, starCountEl, cashCountEl, adminControlsEl } = refs;

  // Hide login/auth elements
  document.getElementById("emailAuthWrapper")?.style?.setProperty("display", "none");
  document.getElementById("googleSignInBtn")?.style?.setProperty("display", "none");
  document.getElementById("vipAccessBtn")?.style?.setProperty("display", "none");

  // Show chat interface
  authBox && (authBox.style.display = "none");
  sendAreaEl && (sendAreaEl.style.display = "flex");
  profileBoxEl && (profileBoxEl.style.display = "block");

  if (profileNameEl) {
    profileNameEl.innerText = user.chatId;
    profileNameEl.style.color = user.usernameColor;
  }

  if (starCountEl) starCountEl.textContent = formatNumberWithCommas(user.stars);
  if (cashCountEl) cashCountEl.textContent = formatNumberWithCommas(user.cash);
  if (adminControlsEl) adminControlsEl.style.display = user.isAdmin ? "flex" : "none";

  // 🔹 Apply additional UI updates (hide intro, show hosts)
  updateUIAfterAuth(user);
}

/* ===============================
   🚪 Hide Chat UI On Logout
================================= */
function hideChatUI() {
  const { authBox, sendAreaEl, profileBoxEl, adminControlsEl } = refs;

  authBox && (authBox.style.display = "block");
  sendAreaEl && (sendAreaEl.style.display = "none");
  profileBoxEl && (profileBoxEl.style.display = "none");
  if (adminControlsEl) adminControlsEl.style.display = "none";

  // 🔹 Restore intro UI (subtitle, hello text, etc.)
  updateUIAfterAuth(null);
}

/* =======================================
   🚀 DOMContentLoaded Bootstrap
======================================= */
window.addEventListener("DOMContentLoaded", () => {


  
/* ----------------------------
   ⚡ Global setup for local message tracking
----------------------------- */
let localPendingMsgs = JSON.parse(localStorage.getItem("localPendingMsgs") || "{}"); 
// structure: { tempId: { content, uid, chatId, createdAt } }

/* ================================
   SEND MESSAGE + BUZZ (2025 FINAL)
   - Secure Firestore paths
   - Uses getUserId() correctly
   - No permission errors
   - Buzz works perfectly
   - Instant local echo + reply support
================================ */

// Helper: Clear reply state
function clearReplyAfterSend() {
  if (typeof cancelReply === "function") cancelReply();
  currentReplyTarget = null;
  refs.messageInputEl.placeholder = "Type a message...";
}

// SEND REGULAR MESSAGE — FIXED COLLAPSE AFTER SEND
refs.sendBtn?.addEventListener("click", async () => {
  try {
    if (!currentUser) return showStarPopup("Sign in to chat.");

    const txt = refs.messageInputEl?.value.trim();
    if (!txt) return showStarPopup("Type a message first.");

    if ((currentUser.stars || 0) < SEND_COST)
      return showStarPopup("Not enough stars to send message.");

    // Deduct stars
    currentUser.stars -= SEND_COST;
    if (refs.starCountEl) refs.starCountEl.textContent = formatNumberWithCommas(currentUser.stars);
    await updateDoc(doc(db, "users", currentUser.uid), { stars: increment(-SEND_COST) });

    // REPLY DATA
    const replyData = currentReplyTarget
      ? {
          replyTo: currentReplyTarget.id,
          replyToContent: (currentReplyTarget.content || "Original message")
            .replace(/\n/g, " ").trim().substring(0, 80) + "...",
          replyToChatId: currentReplyTarget.chatId || "someone"
        }
      : { replyTo: null, replyToContent: null, replyToChatId: null };

    // SEND TO FIRESTORE
    await addDoc(collection(db, CHAT_COLLECTION), {
      content: txt,
      uid: currentUser.uid,
      chatId: currentUser.chatId,
      usernameColor: currentUser.usernameColor || "#ff69b4",
      timestamp: serverTimestamp(),
      highlight: false,
      buzzColor: null,
      ...replyData
    });

    // === CRITICAL FIX: FULL RESET & COLLAPSE ===
    refs.messageInputEl.value = "";
    cancelReply?.(); // Clear reply preview
    resizeAndExpand(); // Manually trigger resize → collapses to original pill

    console.log("Message sent to Firestore");

  } catch (err) {
    console.error("Send failed:", err);
    showStarPopup("Failed to send — check connection", { type: "error" });
    currentUser.stars += SEND_COST;
    if (refs.starCountEl) refs.starCountEl.textContent = formatNumberWithCommas(currentUser.stars);
  }
});


// Private Message Modal Logic
const privateMsgBtn = document.getElementById('privateMsgBtn');
const privateMsgModal = document.getElementById('privateMsgModal');
const privateClose = document.querySelector('.private-close');
const privateMsgInput = document.getElementById('privateMsgInput');
const privateSendBtn = document.getElementById('privateSendBtn');

privateMsgBtn.addEventListener('click', () => {
  privateMsgModal.classList.add('open');
  privateMsgInput.focus();
});

privateClose.addEventListener('click', () => {
  privateMsgModal.classList.remove('open');
  privateMsgInput.value = '';
});

privateMsgModal.addEventListener('click', (e) => {
  if (e.target === privateMsgModal) {
    privateMsgModal.classList.remove('open');
    privateMsgInput.value = '';
  }
});

// Send Private Message (100 stars, anonymous to host only)
privateSendBtn.addEventListener('click', async () => {
  const message = privateMsgInput.value.trim();
  if (!message) return;

  if (!currentUser) {
    showStarPopup("Sign in to send private messages.");
    return;
  }

  if ((currentUser.stars || 0) < 100) {
    showStarPopup("Need 100 stars to send a private message 💌");
    return;
  }

  try {
    // Deduct stars
    currentUser.stars -= 100;
    refs.starCountEl.textContent = formatNumberWithCommas(currentUser.stars);
    await updateDoc(doc(db, "users", currentUser.uid), {
      stars: increment(-100)
    });

    // Send to private collection (only host sees)
    await addDoc(collection(db, "privateLiveMessages"), {
      content: message,
      senderUid: currentUser.uid,
      senderChatId: currentUser.chatId || "anonymous",
      timestamp: serverTimestamp(),
      read: false
    });

    privateMsgInput.value = '';
    privateMsgModal.classList.remove('open');
    showStarPopup("Private message sent! Host only sees it 💌", { type: "success" });
  } catch (err) {
    console.error("Private send failed:", err);
    showStarPopup("Failed to send — try again", { type: "error" });
    // Refund
    currentUser.stars += 100;
    refs.starCountEl.textContent = formatNumberWithCommas(currentUser.stars);
  }
});

  // Auto-resize textarea as user types (cute growing input)
privateMsgInput.addEventListener('input', () => {
  privateMsgInput.style.height = 'auto';
  privateMsgInput.style.height = privateMsgInput.scrollHeight + 'px';
});

// Enter key sends (Shift+Enter for new line)
privateMsgInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    privateSendBtn.click();
  }
});
  
// =============================
// BUZZ MESSAGE — CLEAN, ETERNAL & PERFECT (2026 FINAL)
// =============================
const buzzSound = document.getElementById("buzz-sound");

if (!refs.buzzBtn) return;

refs.buzzBtn.addEventListener("click", async () => {
  // AUTH CHECK
  if (!currentUser?.uid) {
    showStarPopup("Sign in to BUZZ.");
    return;
  }

  // MESSAGE VALIDATION
  const text = refs.messageInputEl?.value?.trim() || "";
  if (!text) {
    showStarPopup("Write something to make the chat SHAKE");
    return;
  }

  if (text.length > 21) {
    showStarPopup("BUZZ messages are limited to 21 characters!", { type: "error" });
    return;
  }

  // STAR CHECK
  if ((currentUser.stars || 0) < BUZZ_COST) {
    showStarPopup(`BUZZ costs ${BUZZ_COST.toLocaleString()} stars!`, { type: "error" });
    return;
  }

  // DISABLE BUTTON TO PREVENT DOUBLE BUZZ
  refs.buzzBtn.disabled = true;
  refs.buzzBtn.style.opacity = "0.6";

  try {
    const gradient = randomStickerGradient();
    const newMsgRef = doc(collection(db, CHAT_COLLECTION));

    // ATOMIC TRANSACTION: DEDUCT STARS + SEND BUZZ
    await runTransaction(db, async (transaction) => {
      transaction.update(doc(db, "users", currentUser.uid), {
        stars: increment(-BUZZ_COST)
      });

      transaction.set(newMsgRef, {
        content: text,
        uid: currentUser.uid,
        chatId: currentUser.chatId,
        usernameColor: currentUser.usernameColor || "#ff69b4",
        timestamp: serverTimestamp(),
        type: "buzz",
        buzzLevel: "epic",
        highlight: true,
        screenShake: true,
        stickerGradient: gradient,
        sound: "buzz_sound"
      });
    });

    // LOCAL UI UPDATE
    currentUser.stars -= BUZZ_COST;
    if (refs.starCountEl) {
      refs.starCountEl.textContent = formatNumberWithCommas(currentUser.stars);
    }

    // CLEAR INPUT & FORCE COLLAPSE TO ORIGINAL SIZE
    refs.messageInputEl.value = "";
    cancelReply?.();
    resizeAndExpand(); // Critical: ensures perfect collapse to compact pill

    // SOUND & VISUAL MAGIC
    if (buzzSound) {
      buzzSound.currentTime = 0;
      buzzSound.play().catch(() => {});
    }

    triggerStickerBuzz(gradient, text, currentUser.chatId);

    showStarPopup("STICKER BUZZ DROPPED — CONFETTI INSIDE!", {
      type: "success",
      duration: 5000
    });

  } catch (err) {
    console.error("BUZZ failed:", err);
    showStarPopup("BUZZ failed — stars refunded", { type: "error" });

    // REFUND ON ERROR
    currentUser.stars += BUZZ_COST;
    if (refs.starCountEl) {
      refs.starCountEl.textContent = formatNumberWithCommas(currentUser.stars);
    }
  } finally {
    // RE-ENABLE BUTTON
    refs.buzzBtn.disabled = false;
    refs.buzzBtn.style.opacity = "1";
  }
});

// =============================
// MILDER APOCALYPSE — STICKER-FOCUSED (Flash + Confetti + Shake)
// =============================
function triggerStickerBuzz(gradient, text, name) {
  // 1. SUBTLE FULL SCREEN FLASH (using gradient)
  var flash = document.createElement("div");
  flash.style.cssText = "position:fixed;top:0;left:0;width:100vw;height:100vh;background:" + gradient + ";opacity:0.7;pointer-events:none;z-index:99999;animation:stickerFlash 1s ease-out;";
  document.body.appendChild(flash);

  // 2. GENTLE SCREEN SHAKE
  document.body.classList.add("screen-shake");
  setTimeout(function() {
    document.body.classList.remove("screen-shake");
  }, 800);

  // 3. CONFETTI BURST (from sticker colors)
  if (typeof launchConfetti === "function") {
    launchConfetti({
      particleCount: 200,
      spread: 90,
      origin: { y: 0.7 },
      colors: extractColorsFromGradient(gradient)  // Pulls from gradient
    });
  }

  // 4. SOUND
  if (typeof playSound === "function") {
    playSound("buzz_sound");
  }

  // 5. STICKER ANNOUNCE (smaller text)
  var announce = document.createElement("div");
  announce.textContent = name + " SENT A STICKER BUZZ!";
  announce.style.cssText = "position:fixed;top:20%;left:50%;transform:translate(-50%,-50%);font-size:2.5rem;font-weight:700;color:#fff;text-shadow:0 0 20px rgba(0,0,0,0.5);pointer-events:none;z-index:99999;animation:stickerAnnounce 2s ease-out forwards;letter-spacing:4px;";
  document.body.appendChild(announce);

  // Cleanup
  setTimeout(function() {
    if (flash && flash.parentNode) flash.remove();
    if (announce && announce.parentNode) announce.remove();
  }, 2500);
}

// =============================
// RANDOM STICKER GRADIENTS — CLASSY, NON-NEON (YouTube-Style)
// =============================
function randomStickerGradient() {
  var gradients = [
    // Warm sunset (orange-pink, soft)
    "linear-gradient(135deg, #ff9a9e 0%, #fecfef 50%, #fecfef 100%)",
    // Cool ocean (blue-teal, calming)
    "linear-gradient(135deg, #a8edea 0%, #fed6e3 50%, #a8edea 100%)",
    // Vibrant purple (elegant, not neon)
    "linear-gradient(135deg, #d299c2 0%, #fef9d7 50%, #d299c2 100%)",
    // Fresh green (nature-inspired)
    "linear-gradient(135deg, #89f7fe 0%, #66a6ff 50%, #89f7fe 100%)",
    // Golden hour (warm yellow-orange)
    "linear-gradient(135deg, #f093fb 0%, #f5576c 50%, #f093fb 100%)",
    // Soft lavender (pastel purple-blue)
    "linear-gradient(135deg, #fa709a 0%, #fee140 50%, #fa709a 100%)",
    // Earthy terracotta (red-brown fade)
    "linear-gradient(135deg, #ffecd2 0%, #fcb69f 50%, #ffecd2 100%)",
    // Minty fresh (green-cyan)
    "linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 50%, #a1c4fd 100%)"
  ];
  return gradients[Math.floor(Math.random() * gradients.length)];
}

// HELPER: Extract 3-4 colors from gradient for confetti
function extractColorsFromGradient(gradient) {
  // Simple regex to pull hex colors (e.g., #ff9a9e, #fecfef)
  var colors = gradient.match(/#[0-9a-f]{6}/gi) || ["#ff9a9e", "#fecfef", "#fff"];
  return colors.slice(0, 4).concat("#fff");  // Add white for confetti pop
}
  /* ----------------------------
     👋 Rotating Hello Text
  ----------------------------- */
  const greetings = ["HELLO","HOLA","BONJOUR","CIAO","HALLO","こんにちは","你好","안녕하세요","SALUT","OLÁ","NAMASTE","MERHABA"];
  const helloEl = document.getElementById("helloText");
  let greetIndex = 0;

  setInterval(() => {
    if (!helloEl) return;
    helloEl.style.opacity = "0";

    setTimeout(() => {
      helloEl.innerText = greetings[greetIndex++ % greetings.length];
      helloEl.style.color = randomColor();
      helloEl.style.opacity = "1";
    }, 220);
  }, 1500);

  /* ----------------------------
     🧩 Tiny Helpers
  ----------------------------- */
  const scrollToBottom = el => {
    if (!el) return;
    requestAnimationFrame(() => el.scrollTop = el.scrollHeight);
  };
  const sleep = ms => new Promise(res => setTimeout(res, ms));
});

/* =====================================
   🎥 Video Navigation & UI Fade Logic
======================================= */
(() => {
  const videoPlayer = document.getElementById("videoPlayer");
  const prevBtn = document.getElementById("prev");
  const nextBtn = document.getElementById("next");
  const container = document.querySelector(".video-container");
  const navButtons = [prevBtn, nextBtn].filter(Boolean);

  if (!videoPlayer || navButtons.length === 0) return;

  // Wrap the video in a relative container if not already
  const videoWrapper = document.createElement("div");
  videoWrapper.style.position = "relative";
  videoWrapper.style.display = "inline-block";
  videoPlayer.parentNode.insertBefore(videoWrapper, videoPlayer);
  videoWrapper.appendChild(videoPlayer);

  // ---------- Create hint overlay inside video ----------
  const hint = document.createElement("div");
  hint.className = "video-hint";
  hint.style.position = "absolute";
  hint.style.bottom = "10%"; // slightly above bottom
  hint.style.left = "50%";
  hint.style.transform = "translateX(-50%)"; // horizontal center
  hint.style.padding = "2px 8px";
  hint.style.background = "rgba(0,0,0,0.5)";
  hint.style.color = "#fff";
  hint.style.borderRadius = "12px";
  hint.style.fontSize = "14px";
  hint.style.opacity = "0";
  hint.style.pointerEvents = "none";
  hint.style.transition = "opacity 0.4s";
  videoWrapper.appendChild(hint);

  const showHint = (msg, timeout = 1500) => {
    hint.textContent = msg;
    hint.style.opacity = "1";
    clearTimeout(hint._t);
    hint._t = setTimeout(() => (hint.style.opacity = "0"), timeout);
  };

  // 🎞️ Video list (Shopify video)
  const videos = [
    "https://cdn.shopify.com/videos/c/o/v/45c20ba8df2c42d89807c79609fe85ac.mp4"
  ];

  let currentVideo = 0;
  let hideTimeout = null;

  /* ----------------------------
       ▶️ Load & Play Video
  ----------------------------- */
  const loadVideo = (index) => {
    if (index < 0) index = videos.length - 1;
    if (index >= videos.length) index = 0;

    currentVideo = index;
    videoPlayer.src = videos[currentVideo];
    videoPlayer.muted = true;

    // Wait for metadata before playing
    videoPlayer.addEventListener("loadedmetadata", function onMeta() {
      videoPlayer.play().catch(() => console.warn("Autoplay may be blocked by browser"));
      videoPlayer.removeEventListener("loadedmetadata", onMeta);
    });
  };

  /* ----------------------------
       🔊 Toggle Mute on Tap
  ----------------------------- */
  videoPlayer.addEventListener("click", () => {
    videoPlayer.muted = !videoPlayer.muted;
    showHint(videoPlayer.muted ? "Tap to unmute" : "Sound on");
  });

  /* ----------------------------
       ⏪⏩ Navigation Buttons
  ----------------------------- */
  prevBtn?.addEventListener("click", () => loadVideo(currentVideo - 1));
  nextBtn?.addEventListener("click", () => loadVideo(currentVideo + 1));

  /* ----------------------------
       👀 Auto Hide/Show Buttons
  ----------------------------- */
  const showButtons = () => {
    navButtons.forEach(btn => {
      btn.style.opacity = "1";
      btn.style.pointerEvents = "auto";
    });
    clearTimeout(hideTimeout);
    hideTimeout = setTimeout(() => {
      navButtons.forEach(btn => {
        btn.style.opacity = "0";
        btn.style.pointerEvents = "none";
      });
    }, 3000);
  };

  navButtons.forEach(btn => {
    btn.style.transition = "opacity 0.6s ease";
    btn.style.opacity = "0";
    btn.style.pointerEvents = "none";
  });

  ["mouseenter", "mousemove", "click"].forEach(evt => container?.addEventListener(evt, showButtons));
  container?.addEventListener("mouseleave", () => {
    navButtons.forEach(btn => {
      btn.style.opacity = "0";
      btn.style.pointerEvents = "none";
    });
  });

  // Start with first video
  loadVideo(0);

  // Show initial hint after video metadata loads
  videoPlayer.addEventListener("loadedmetadata", () => {
    showHint("Tap to unmute", 1500);
  });
})();


// URL of your custom star SVG hosted on Shopify
const customStarURL = "https://cdn.shopify.com/s/files/1/0962/6648/6067/files/starssvg.svg?v=1761770774";

// Replace stars in text nodes with SVG + floating stars (invisible)
function replaceStarsWithSVG(root = document.body) {
  if (!root) return;

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: node => {
        if (node.nodeValue.includes("⭐") || node.nodeValue.includes("⭐️")) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_REJECT;
      }
    }
  );

  const nodesToReplace = [];
  while (walker.nextNode()) nodesToReplace.push(walker.currentNode);

  nodesToReplace.forEach(textNode => {
    const parent = textNode.parentNode;
    if (!parent) return;

    const fragments = textNode.nodeValue.split(/⭐️?|⭐/);

    fragments.forEach((frag, i) => {
      if (frag) parent.insertBefore(document.createTextNode(frag), textNode);

      if (i < fragments.length - 1) {
        // Inline star
        const span = document.createElement("span");
        span.style.display = "inline-flex";
        span.style.alignItems = "center";
        span.style.position = "relative";

        const inlineStar = document.createElement("img");
        inlineStar.src = customStarURL;
        inlineStar.alt = "⭐";
        inlineStar.style.width = "1.2em";
        inlineStar.style.height = "1.2em";
        inlineStar.style.display = "inline-block";
        inlineStar.style.verticalAlign = "text-bottom";
        inlineStar.style.transform = "translateY(0.15em) scale(1.2)";

        span.appendChild(inlineStar);
        parent.insertBefore(span, textNode);

        // Floating star (fully invisible)
        const floatingStar = document.createElement("img");
        floatingStar.src = customStarURL;
        floatingStar.alt = "⭐";
        floatingStar.style.width = "40px";
        floatingStar.style.height = "40px";
        floatingStar.style.position = "absolute";
        floatingStar.style.pointerEvents = "none";
        floatingStar.style.zIndex = "9999";
        floatingStar.style.opacity = "0"; // invisible
        floatingStar.style.transform = "translate(-50%, -50%)";

        const rect = inlineStar.getBoundingClientRect();
        floatingStar.style.top = `${rect.top + rect.height / 2 + window.scrollY}px`;
        floatingStar.style.left = `${rect.left + rect.width / 2 + window.scrollX}px`;

        document.body.appendChild(floatingStar);

        // Remove immediately (optional, keeps DOM cleaner)
        setTimeout(() => floatingStar.remove(), 1);
      }
    });

    parent.removeChild(textNode);
  });
}

// Observe dynamic content including BallerAlert
const observer = new MutationObserver(mutations => {
  mutations.forEach(m => {
    m.addedNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) replaceStarsWithSVG(node.parentNode);
      else if (node.nodeType === Node.ELEMENT_NODE) replaceStarsWithSVG(node);
    });
  });
});
observer.observe(document.body, { childList: true, subtree: true });

// Initial run
replaceStarsWithSVG();





/* ===============================
   FEATURED HOSTS MODAL — FINAL 2025 BULLETPROOF
   NEVER OPENS ON RELOAD — ONLY WHEN USER CLICKS
================================= */

/* ---------- DOM Elements (KEEP THESE) ---------- */
const openBtn = document.getElementById("openHostsBtn");
const modal = document.getElementById("featuredHostsModal");
const closeModal = document.querySelector(".featured-close");
const videoFrame = document.getElementById("featuredHostVideo");
const usernameEl = document.getElementById("featuredHostUsername");
const detailsEl = document.getElementById("featuredHostDetails");
const hostListEl = document.getElementById("featuredHostList");
const giftSlider = document.getElementById("giftSlider");
const modalGiftBtn = document.getElementById("featuredGiftBtn");
const giftAmountEl = document.getElementById("giftAmount");
const prevBtn = document.getElementById("prevHost");
const nextBtn = document.getElementById("nextHost");

// =============================================
// SHARED PAGINATION & CACHE UTILITIES
// =============================================

const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function saveToCache(key, data, lastDocId = null) {
  localStorage.setItem(key, JSON.stringify({
    data,
    timestamp: Date.now(),
    lastDocId: lastDocId ? lastDocId.id : null
  }));
}

function loadFromCache(key) {
  const cached = localStorage.getItem(key);
  if (!cached) return null;
  try {
    const { data, timestamp, lastDocId } = JSON.parse(cached);
    if (Date.now() - timestamp < CACHE_TTL) {
      return { data, lastDocId };
    }
  } catch {}
  return null;
}

// =============================================
// FEATURED HOSTS – Lazy Pagination (20 per page)
// =============================================

let hosts = [];
let currentHostIndex = 0;
let lastVisibleHostDoc = null;
let hasMoreHosts = true;
let isFetchingHosts = false;
const HOSTS_PAGE_SIZE = 20;
const HOSTS_CACHE_KEY = "featuredHostsCache_v2";

async function loadHostsPage(isFirstPage = true) {
  if (isFetchingHosts) return [];
  isFetchingHosts = true;

  try {
    const docRef = doc(db, "featuredHosts", "current");
    const snap = await getDoc(docRef);

    if (!snap.exists() || !snap.data().hosts?.length) {
      hasMoreHosts = false;
      hosts = [];
      return [];
    }

    const allHostIds = snap.data().hosts;
    const startIdx = isFirstPage ? 0 : hosts.length;
    const pageIds = allHostIds.slice(startIdx, startIdx + HOSTS_PAGE_SIZE);

    if (pageIds.length === 0) {
      hasMoreHosts = false;
      return [];
    }

    // Fetch in chunks of 10 (in query limit)
    const chunks = [];
    for (let i = 0; i < pageIds.length; i += 10) {
      chunks.push(pageIds.slice(i, i + 10));
    }

    const pageHosts = [];
    await Promise.all(chunks.map(async chunk => {
      if (chunk.length === 0) return;
      const q = query(
        collection(db, "users"),
        where(firebase.firestore.FieldPath.documentId(), "in", chunk)
      );
      const snap = await getDocs(q);
      snap.forEach(doc => pageHosts.push({ id: doc.id, ...doc.data() }));
    }));

    lastVisibleHostDoc = pageHosts.length > 0 ? pageHosts[pageHosts.length - 1] : null;
    hasMoreHosts = startIdx + pageIds.length < allHostIds.length;

    return pageHosts;
  } catch (err) {
    console.error("Hosts fetch failed:", err);
    return [];
  } finally {
    isFetchingHosts = false;
  }
}

// ---------- STAR HOSTS BUTTON – LAZY + PAGINATED ----------
if (openBtn) {
  openBtn.onclick = async () => {
    const cache = loadFromCache(HOSTS_CACHE_KEY);
    if (cache) {
      hosts = cache.data;
      lastVisibleHostDoc = cache.lastDocId ? { id: cache.lastDocId } : null;
      hasMoreHosts = hosts.length % HOSTS_PAGE_SIZE === 0;
      console.log("Hosts from cache:", hosts.length);
    } else {
      hosts = [];
      lastVisibleHostDoc = null;
      hasMoreHosts = true;
      const firstPage = await loadHostsPage(true);
      hosts = firstPage;
      saveToCache(HOSTS_CACHE_KEY, hosts, lastVisibleHostDoc);
    }

    if (hosts.length === 0) {
      showGiftAlert("No Star Hosts online right now!");
      return;
    }

    // Open modal with first host
    loadHost(currentIndex);
    modal.style.display = "flex";
    modal.style.justifyContent = "center";
    modal.style.alignItems = "center";
    setTimeout(() => modal.style.opacity = "1", 50);

    if (giftSlider) giftSlider.style.background = randomFieryGradient();

    console.log("Star Hosts Modal Opened —", hosts.length, "loaded so far");
  };
}

// ---------- CLOSE MODAL ----------
if (closeModal) {
  closeModal.onclick = () => {
    modal.style.opacity = "0";
    setTimeout(() => modal.style.display = "none", 300);
  };
}
if (modal) {
  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.style.opacity = "0";
      setTimeout(() => modal.style.display = "none", 300);
    }
  };
}

// ---------- FETCH FIRST OR NEXT PAGE ----------
async function fetchFeaturedHostsPage(isFirstPage = false) {
  if (isFetchingHosts) return;
  isFetchingHosts = true;

  try {
    // Get the list of featured host IDs
    const docRef = doc(db, "featuredHosts", "current");
    const snap = await getDoc(docRef);

    if (!snap.exists() || !snap.data().hosts?.length) {
      console.warn("No featured hosts found.");
      hosts = [];
      hasMoreHosts = false;
      renderHostAvatars();
      return;
    }

    const allHostIds = snap.data().hosts; // full array of IDs

    // For pagination: determine which slice of IDs to fetch next
    const startIndex = isFirstPage ? 0 : hosts.length;
    const endIndex = startIndex + PAGE_SIZE;
    const pageIds = allHostIds.slice(startIndex, endIndex);

    if (pageIds.length === 0) {
      hasMoreHosts = false;
      return;
    }

    // Fetch user docs for this page
    const pageHosts = [];

    // Chunk IDs into groups of 10 (Firestore 'in' limit)
    const chunks = [];
    for (let i = 0; i < pageIds.length; i += 10) {
      chunks.push(pageIds.slice(i, i + 10));
    }

    await Promise.all(
      chunks.map(async (chunk) => {
        if (chunk.length === 0) return;
        const q = query(
          collection(db, "users"),
          where(firebase.firestore.FieldPath.documentId(), "in", chunk)
        );
        const querySnap = await getDocs(q);
        querySnap.forEach((doc) => {
          pageHosts.push({ id: doc.id, ...doc.data() });
        });
      })
    );

    // Append new hosts
    hosts = isFirstPage ? pageHosts : [...hosts, ...pageHosts];

    // Update pagination state
    lastVisibleDoc = pageHosts.length > 0 ? pageHosts[pageHosts.length - 1] : null;
    hasMoreHosts = endIndex < allHostIds.length;

    console.log(`Loaded page ${Math.ceil(hosts.length / PAGE_SIZE)}: ${pageHosts.length} hosts`);

    renderHostAvatars();
    updateLoadMoreButton();
  } catch (err) {
    console.error("Featured hosts fetch failed:", err);
    showStarPopup("Error loading hosts", { type: "error" });
  } finally {
    isFetchingHosts = false;
  }
}

// ---------- RENDER AVATARS + LOAD MORE BUTTON ----------
function renderHostAvatars() {
  hostListEl.innerHTML = "";

  hosts.forEach((host, idx) => {
    const img = document.createElement("img");
    img.src = host.popupPhoto || "";
    img.alt = host.chatId || "Host";
    img.classList.add("featured-avatar");
    if (idx === currentIndex) img.classList.add("active");
    img.addEventListener("click", () => loadHost(idx));
    hostListEl.appendChild(img);
  });

  // Add "Load More" button if there are more
  updateLoadMoreButton();
}

function updateLoadMoreButton() {
  // Remove old button if exists
  const existingBtn = document.getElementById("loadMoreHostsBtn");
  if (existingBtn) existingBtn.remove();

  if (!hasMoreHosts || isFetchingHosts) return;

  const loadMoreBtn = document.createElement("button");
  loadMoreBtn.id = "loadMoreHostsBtn";
  loadMoreBtn.textContent = "Load More Hosts";
  loadMoreBtn.style.cssText = `
    margin: 20px auto;
    padding: 10px 24px;
    background: linear-gradient(90deg, #ff3366, #ff9933);
    color: white;
    border: none;
    border-radius: 30px;
    font-weight: bold;
    cursor: pointer;
    display: block;
  `;

  loadMoreBtn.onclick = async () => {
    await fetchFeaturedHostsPage(false); // false = next page
    saveToCache();
  };

  hostListEl.appendChild(loadMoreBtn);
}
/* ---------- Load Host (Faster Video Loading) ---------- */
async function loadHost(idx) {
  const host = hosts[idx];
  if (!host) return;
  currentIndex = idx;

  const videoContainer = document.getElementById("featuredHostVideo");
  if (!videoContainer) return;
  videoContainer.innerHTML = "";
  videoContainer.style.position = "relative";
  videoContainer.style.touchAction = "manipulation";

  // Shimmer loader
  const shimmer = document.createElement("div");
  shimmer.className = "video-shimmer";
  videoContainer.appendChild(shimmer);

  // Video element
  const videoEl = document.createElement("video");
  Object.assign(videoEl, {
    src: host.videoUrl || "",
    autoplay: true,
    muted: true,
    loop: true,
    playsInline: true,
    preload: "auto", // preload more data
    style: "width:100%;height:100%;object-fit:cover;border-radius:8px;display:none;cursor:pointer;"
  });
  videoEl.setAttribute("webkit-playsinline", "true");
  videoContainer.appendChild(videoEl);

  // Force video to start loading immediately
  videoEl.load();

  // Hint overlay
  const hint = document.createElement("div");
  hint.className = "video-hint";
  hint.textContent = "Tap to unmute";
  videoContainer.appendChild(hint);

  function showHint(msg, timeout = 1400) {
    hint.textContent = msg;
    hint.classList.add("show");
    clearTimeout(hint._t);
    hint._t = setTimeout(() => hint.classList.remove("show"), timeout);
  }

  let lastTap = 0;
  function onTapEvent() {
    const now = Date.now();
    if (now - lastTap < 300) {
      document.fullscreenElement ? document.exitFullscreen?.() : videoEl.requestFullscreen?.();
    } else {
      videoEl.muted = !videoEl.muted;
      showHint(videoEl.muted ? "Tap to unmute" : "Sound on", 1200);
    }
    lastTap = now;
  }
  videoEl.addEventListener("click", onTapEvent);
  videoEl.addEventListener("touchend", (ev) => {
    if (ev.changedTouches.length < 2) {
      ev.preventDefault?.();
      onTapEvent();
    }
  }, { passive: false });

  // Show video as soon as it can play
  videoEl.addEventListener("canplay", () => {
    shimmer.style.display = "none";
    videoEl.style.display = "block";
    showHint("Tap to unmute", 1400);
    videoEl.play().catch(() => {});
  });

/* ---------- Host Info — FIXED 2025 ---------- */
const usernameEl = document.createElement('span');
usernameEl.textContent = (host.chatId || "Unknown Host")
  .toLowerCase()
  .replace(/\b\w/g, char => char.toUpperCase());

// THESE 3 LINES ARE THE MAGIC
usernameEl.className = 'tapable-username';           // any class you like
usernameEl.dataset.userId = host.uid;                // CRITICAL — your Firestore doc ID
usernameEl.style.cssText = 'cursor:pointer; font-weight:600; color:#ff69b4; user-select:none;';

// Optional: nice little hover/tap feedback
usernameEl.addEventListener('pointerdown', () => {
  usernameEl.style.opacity = '0.7';
});
usernameEl.addEventListener('pointerup', () => {
  usernameEl.style.opacity = '1';
});
  
const gender = (host.gender || "person").toLowerCase();
const pronoun = gender === "male" ? "his" : "her";
const ageGroup = !host.age ? "20s" : host.age >= 30 ? "30s" : "20s";
const flair = gender === "male" ? "😎" : "💋";

const fruit = host.fruitPick || "🍇";
const nature = host.naturePick || "cool";
const bodyType = host.bodyTypePick || ""; // ← THIS is all you add

const city = host.location || "Lagos";
const country = host.country || "Nigeria";
detailsEl.innerHTML = `A ${fruit} ${nature} ${gender} in ${pronoun} ${ageGroup}, currently in ${city}, ${country}. ${flair}`;

// Typewriter bio
if (host.bioPick) {
  const bioText = host.bioPick.length > 160 ? host.bioPick.slice(0, 160) + "…" : host.bioPick;

  // Create a container for bio
  const bioEl = document.createElement("div");
  bioEl.style.marginTop = "6px";
  bioEl.style.fontWeight = "600";  // little bold
  bioEl.style.fontSize = "0.95em";
  bioEl.style.whiteSpace = "pre-wrap"; // keep formatting

  // Pick a random bright color
  const brightColors = ["#FF3B3B", "#FF9500", "#FFEA00", "#00FFAB", "#00D1FF", "#FF00FF", "#FF69B4"];
  bioEl.style.color = brightColors[Math.floor(Math.random() * brightColors.length)];

  detailsEl.appendChild(bioEl);

  // Typewriter effect
  let index = 0;
  function typeWriter() {
    if (index < bioText.length) {
      bioEl.textContent += bioText[index];
      index++;
      setTimeout(typeWriter, 40); // typing speed (ms)
    }
  }
  typeWriter();
}
/* ---------- Meet Button ---------- */
let meetBtn = document.getElementById("meetBtn");
if (!meetBtn) {
  meetBtn = document.createElement("button");
  meetBtn.id = "meetBtn";
  meetBtn.textContent = "Meet";
  Object.assign(meetBtn.style, {
    marginTop: "6px",
    padding: "8px 16px",
    borderRadius: "6px",
    background: "linear-gradient(90deg,#ff0099,#ff6600)",
    color: "#fff",
    border: "none",
    fontWeight: "bold",
    cursor: "pointer"
  });
  detailsEl.insertAdjacentElement("afterend", meetBtn);
}
meetBtn.onclick = () => showMeetModal(host);

/* ---------- Avatar Highlight ---------- */
hostListEl.querySelectorAll("img").forEach((img, i) => {
  img.classList.toggle("active", i === idx);
});

giftSlider.value = 1;
giftAmountEl.textContent = "1";
}

/* ---------- Meet Modal with Staged Playful Flow for Telegram → WhatsApp ---------- */
function showMeetModal(host) {
  let modal = document.getElementById("meetModal");
  if (modal) modal.remove();

  modal = document.createElement("div");
  modal.id = "meetModal";
  Object.assign(modal.style, {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    background: "rgba(0,0,0,0.75)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: "999999",
    backdropFilter: "blur(3px)",
    WebkitBackdropFilter: "blur(3px)"
  });

  modal.innerHTML = `
    <div id="meetModalContent" style="
      background:#111;
      padding:20px 22px;
      border-radius:12px;
      text-align:center;
      color:#fff;
      max-width:340px;
      box-shadow:0 0 20px rgba(0,0,0,0.5);
    ">
      <h3 style="margin-bottom:10px;font-weight:600;">Meet ${host.chatId || "this host"}?</h3>
      <p style="margin-bottom:16px;">Request meet with <b>400 stars ⭐</b>?</p>
      <div style="display:flex;gap:10px;justify-content:center;">
        <button id="cancelMeet" style="padding:8px 16px;background:#333;border:none;color:#fff;border-radius:8px;font-weight:500;">Cancel</button>
        <button id="confirmMeet" style="padding:8px 16px;background:linear-gradient(90deg,#ff0099,#ff6600);border:none;color:#fff;border-radius:8px;font-weight:600;">Yes</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const cancelBtn = modal.querySelector("#cancelMeet");
  const confirmBtn = modal.querySelector("#confirmMeet");
  const modalContent = modal.querySelector("#meetModalContent");

  cancelBtn.onclick = () => modal.remove();

  confirmBtn.onclick = async () => {
    const COST = 400;

    if (!currentUser?.uid) {
      showGiftAlert("⚠️ Please log in to request meets");
      modal.remove();
      return;
    }

    if ((currentUser.stars || 0) < COST) {
      showGiftAlert("⚠️ Not enough stars ⭐");
      modal.remove();
      return;
    }

    confirmBtn.disabled = true;
    confirmBtn.style.opacity = 0.6;
    confirmBtn.style.cursor = "not-allowed";

    try {
      // Deduct stars
      currentUser.stars -= COST;
      if (refs?.starCountEl) refs.starCountEl.textContent = formatNumberWithCommas(currentUser.stars);
      await updateDoc(doc(db, "users", currentUser.uid), { stars: increment(-COST) });

      // === PLAYFUL STAGED ANIMATION (SAME FOR TELEGRAM & WHATSAPP) ===
      const fixedStages = ["Handling your meet request…", "Collecting host’s identity…"];
      const playfulMessages = [
        "Oh, she’s hella cute…💋", "Careful, she may be naughty..😏",
        "Be generous with her, she’ll like you..", "Ohh, she’s a real star.. 🤩",
        "Be a real gentleman, when she texts u..", "She’s ready to dazzle you tonight.. ✨",
        "Watch out, she might steal your heart.. ❤️", "Look sharp, she’s got a sparkle.. ✨",
        "Don’t blink, or you’ll miss her charm.. 😉", "Get ready for some fun surprises.. 😏",
        "She knows how to keep it exciting.. 🎉", "Better behave, she’s watching.. 👀",
        "She might just blow your mind.. 💥", "Keep calm, she’s worth it.. 😘",
        "She’s got a twinkle in her eyes.. ✨", "Brace yourself for some charm.. 😎",
        "She’s not just cute, she’s 🔥", "Careful, her smile is contagious.. 😁",
        "She might make you blush.. 😳", "She’s a star in every way.. 🌟",
        "Don’t miss this chance.. ⏳"
      ];

      const randomPlayful = [];
      while (randomPlayful.length < 3) {
        const choice = playfulMessages[Math.floor(Math.random() * playfulMessages.length)];
        if (!randomPlayful.includes(choice)) randomPlayful.push(choice);
      }

      const stages = [...fixedStages, ...randomPlayful, "Generating secure link…"];

      modalContent.innerHTML = `<p id="stageMsg" style="margin-top:20px; font-weight:500; font-size:15px;"></p>`;
      const stageMsgEl = modalContent.querySelector("#stageMsg");

      let totalTime = 0;
      stages.forEach((stage, index) => {
        const duration = index < 2
          ? 1500 + Math.random() * 1000
          : index < stages.length - 1
          ? 1700 + Math.random() * 600
          : 2000 + Math.random() * 500;

        totalTime += duration;

        setTimeout(() => {
          stageMsgEl.textContent = stage;

          // Final stage → show success screen
          if (index === stages.length - 1) {
            setTimeout(() => {
              const firstName = currentUser.fullName?.split(" ")[0] || "VIP";
              const baseMsg = `Hey ${host.chatId}! 👋\nMy name is ${firstName} (VIP on CUBE) and I’d love to meet you.`;

              let openURL = "";
              let buttonColor = "";
              let platform = "";
              let contact = "";

              // Telegram first
              if (host.telegram && host.telegram.trim()) {
                const username = host.telegram.trim().replace(/^@/, "");
                openURL = `https://t.me/${username}?text=${encodeURIComponent(baseMsg)}`;
                buttonColor = "#0088cc";
                platform = "Telegram";
                contact = `@${username}`;
              }
              // Then WhatsApp
              else if (host.whatsapp && host.whatsapp.trim()) {
                const countryCodes = { Nigeria: "+234", Ghana: "+233", "United States": "+1", "United Kingdom": "+44", "South Africa": "+27" };
                const hostCountry = host.country || "Nigeria";
                let waNumber = host.whatsapp.trim();
                if (waNumber.startsWith("0")) waNumber = waNumber.slice(1);
                waNumber = countryCodes[hostCountry] + waNumber;

                openURL = `https://wa.me/${waNumber}?text=${encodeURIComponent(baseMsg)}`;
                buttonColor = "#25D366";
                platform = "WhatsApp";
                contact = host.chatId;
              } else {
                showSocialRedirectModal(modalContent, host);
                return;
              }

              // Unified final screen — SMALL, CUTE & CLEAN (no phone emoji)
modalContent.innerHTML = `
  <h3 style="
    margin:0 0 12px;
    font-weight:600;
    font-size:18px;
    line-height:1.3;
  ">
   Request to meet ${host.chatId} is approved!
  </h3>
  <p style="
    margin:0 0 24px;
    font-size:15px;
    color:#ddd;
  ">
    Chat with <b>${contact}</b> on ${platform}
  </p>
  <button id="openChatBtn" style="
    padding:12px 36px;
    border:none;
    border-radius:50px;
    font-weight:700;
    font-size:16px;
    background:${buttonColor};
    color:#fff;
    cursor:pointer;
    box-shadow:0 6px 20px rgba(0,0,0,0.4);
    transition:transform 0.2s ease;
  "
  onmouseover="this.style.transform='translateY(-2px)'"
  onmouseout="this.style.transform='translateY(0)'">
    Send Message
  </button>
`;
              const openBtn = modalContent.querySelector("#openChatBtn");
              openBtn.onclick = () => {
                window.open(openURL, "_blank");
                modal.remove();
              };

              // Auto-open chat
              window.open(openURL, "_blank");

              // Auto-close modal
              setTimeout(() => modal.remove(), 8000);
            }, 500);
          }
        }, totalTime);
      });

    } catch (err) {
      console.error("Meet request failed:", err);
      showGiftAlert("Something went wrong. Try again.");
      modal.remove();
    }
  };
}

/* ---------- Social Fallback (unchanged) ---------- */
function showSocialRedirectModal(modalContent, host) {
  const socialUrl = host.tiktok || host.instagram || "";
  const socialName = host.tiktok ? "TikTok" : host.instagram ? "Instagram" : "";
  const hostName = host.chatId || "this host";

  if (socialUrl) {
    modalContent.innerHTML = `
      <h3 style="margin-bottom:10px;font-weight:600;">Meet ${hostName}?</h3>
      <p style="margin-bottom:16px;">${hostName} isn’t available for direct meets yet.</p>
      <p style="margin-bottom:16px;">Check her out on <b>${socialName}</b> instead?</p>
      <button id="goSocialBtn" style="padding:8px 16px;background:linear-gradient(90deg,#ff0099,#ff6600);border:none;color:#fff;border-radius:8px;font-weight:600;">Go</button>
      <button id="cancelMeet" style="margin-top:10px;padding:8px 16px;background:#333;border:none;color:#fff;border-radius:8px;font-weight:500;">Close</button>
    `;

    modalContent.querySelector("#goSocialBtn").onclick = () => {
      window.open(socialUrl, "_blank");
      modalContent.parentElement.remove();
    };
    modalContent.querySelector("#cancelMeet").onclick = () => modalContent.parentElement.remove();
  } else {
    modalContent.innerHTML = `
      <h3 style="margin-bottom:10px;font-weight:600;">Meet ${hostName}?</h3>
      <p style="margin-bottom:16px;">${hostName} isn’t meeting new people yet. Check back soon!</p>
      <button id="cancelMeet" style="padding:8px 16px;background:#333;border:none;color:#fff;border-radius:8px;font-weight:500;">Close</button>
    `;
    modalContent.querySelector("#cancelMeet").onclick = () => modalContent.parentElement.remove();
  }
}

/* ---------- Gift Slider ---------- */
const fieryColors = [
  ["#ff0000", "#ff8c00"], // red to orange
  ["#ff4500", "#ffd700"], // orange to gold
  ["#ff1493", "#ff6347"], // pinkish red
  ["#ff0055", "#ff7a00"], // magenta to orange
  ["#ff5500", "#ffcc00"], // deep orange to yellow
  ["#ff3300", "#ff0066"], // neon red to hot pink
];

// Generate a random fiery gradient
function randomFieryGradient() {
  const [c1, c2] = fieryColors[Math.floor(Math.random() * fieryColors.length)];
  return `linear-gradient(90deg, ${c1}, ${c2})`;
}

/* ---------- Gift Slider ---------- */
giftSlider.addEventListener("input", () => {
  giftAmountEl.textContent = giftSlider.value;
  giftSlider.style.background = randomFieryGradient(); // change fiery color as it slides
});

/*
=========================================
🚫 COMMENTED OUT: Duplicate modal opener
=========================================
openBtn.addEventListener("click", () => {
  modal.style.display = "flex";
  modal.style.justifyContent = "center";
  modal.style.alignItems = "center";

  // Give it a fiery flash on open
  giftSlider.style.background = randomFieryGradient();
  console.log("📺 Modal opened");
});
*/


/* ===============================
   SEND GIFT + DUAL NOTIFICATION — FINAL 2025 GOD-TIER EDITION
   CLEAN, SAFE, ELEGANT — WORKS FOREVER
================================= */
async function sendGift() {
  const receiver = hosts[currentIndex];
  if (!receiver?.id) return showGiftAlert("No host selected.");
  if (!currentUser?.uid) return showGiftAlert("Please log in to send stars");

  const giftStars = parseInt(giftSlider.value, 10);
  if (!giftStars || giftStars <= 0) return showGiftAlert("Invalid star amount");

  const giftBtn = document.getElementById("featuredGiftBtn"); // ← correct ID
  if (!giftBtn) return;

  const originalText = giftBtn.textContent;
  giftBtn.disabled = true;
  giftBtn.innerHTML = `<span class="gift-spinner"></span>`;

  try {
    const senderRef = doc(db, "users", currentUser.uid);
    const receiverRef = doc(db, "users", receiver.id);
    const featuredRef = doc(db, "featuredHosts", receiver.id);

    await runTransaction(db, async (tx) => {
      const [senderSnap, receiverSnap] = await Promise.all([
        tx.get(senderRef),
        tx.get(receiverRef)
      ]);

      if (!senderSnap.exists()) throw new Error("Your profile not found");
      
      const senderData = senderSnap.data();
      if ((senderData.stars || 0) < giftStars) {
        throw new Error("Not enough stars");
      }

      // Update sender
      tx.update(senderRef, {
        stars: increment(-giftStars),
        starsGifted: increment(giftStars)
      });

      // Update receiver (create if missing)
      if (receiverSnap.exists()) {
        tx.update(receiverRef, { stars: increment(giftStars) });
      } else {
        tx.set(receiverRef, { stars: giftStars }, { merge: true });
      }

      // Update featured host stats
      tx.set(featuredRef, { stars: increment(giftStars) }, { merge: true });

      // Track last gift from this user
      tx.update(receiverRef, {
        [`lastGiftSeen.${currentUser.chatId || currentUser.uid}`]: giftStars
      });
    });

    // DUAL NOTIFICATIONS — BOTH SIDES
    const senderName = currentUser.chatId || "Someone";
    const receiverName = receiver.chatId || receiver.username || "Host";

    await Promise.all([
      pushNotification(receiver.id, `${senderName} gifted you ${giftStars} stars!`),
      pushNotification(currentUser.uid, `You gifted ${giftStars} stars to ${receiverName}!`)
    ]);

    // Success feedback
    showGiftAlert(`Sent ${giftStars} stars to ${receiverName}!`);

    // If user gifted themselves (rare but possible)
    if (currentUser.uid === receiver.id) {
      setTimeout(() => {
        showGiftAlert(`${senderName} gifted you ${giftStars} stars!`);
      }, 1200);
    }

    console.log(`Gift sent: ${giftStars} stars → ${receiverName}`);

  } catch (err) {
    console.error("Gift failed:", err);
    const msg = err.message.includes("enough")
      ? "Not enough stars"
      : "Gift failed — try again";
    showGiftAlert(msg);
  } finally {
    // Always restore button
    giftBtn.innerHTML = originalText;
    giftBtn.disabled = false;
  }
}

/* ---------- Navigation ---------- */
prevBtn.addEventListener("click", e => {
  e.preventDefault();
  loadHost((currentIndex - 1 + hosts.length) % hosts.length);
});

nextBtn.addEventListener("click", e => {
  e.preventDefault();
  loadHost((currentIndex + 1) % hosts.length);
});

// --- ✅ Prevent redeclaration across reloads ---
if (!window.verifyHandlersInitialized) {
  window.verifyHandlersInitialized = true;

  // ---------- ✨ SIMPLE GOLD MODAL ALERT ----------
  window.showGoldAlert = function (message, duration = 3000) {
    const existing = document.getElementById("goldAlert");
    if (existing) existing.remove();

    const alertEl = document.createElement("div");
    alertEl.id = "goldAlert";
    Object.assign(alertEl.style, {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      background: "linear-gradient(90deg, #ffcc00, #ff9900)",
      color: "#111",
      padding: "12px 30px", // increased padding for one-liner
      borderRadius: "10px",
      fontWeight: "600",
      fontSize: "14px",
      zIndex: "999999",
      boxShadow: "0 0 12px rgba(255, 215, 0, 0.5)",
      whiteSpace: "nowrap",
      animation: "slideFade 0.4s ease-out",
    });
    alertEl.innerHTML = message;

    const style = document.createElement("style");
    style.textContent = `
      @keyframes slideFade {
        from {opacity: 0; transform: translate(-50%, -60%);}
        to {opacity: 1; transform: translate(-50%, -50%);}
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(alertEl);
    setTimeout(() => alertEl.remove(), duration);
  };



  // ---------- PHONE NORMALIZER (for backend matching) ----------
  function normalizePhone(number) {
    return number.replace(/\D/g, "").slice(-10); // last 10 digits
  }

  // ---------- CLICK HANDLER ----------
  document.addEventListener("click", (e) => {
    if (e.target.id === "verifyNumberBtn") {
      const input = document.getElementById("verifyNumberInput");
      const numberRaw = input?.value.trim();
      const COST = 21;

      if (!currentUser?.uid) return showGoldAlert("⚠️ Please log in first.");
      if (!numberRaw) return showGoldAlert("⚠️ Please enter a phone number.");

      showConfirmModal(numberRaw, COST);
    }
  });

 // ---------- CONFIRM MODAL ----------
  window.showConfirmModal = function (number, cost = 21) {
    let modal = document.getElementById("verifyConfirmModal");
    if (modal) modal.remove();

    modal = document.createElement("div");
    modal.id = "verifyConfirmModal";
    Object.assign(modal.style, {
      position: "fixed",
      top: 0,
      left: 0,
      width: "100vw",
      height: "100vh",
      background: "rgba(0,0,0,0.7)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: "999999",
      backdropFilter: "blur(2px)",
    });

    modal.innerHTML = `
      <div style="background:#111;padding:16px 18px;border-radius:10px;text-align:center;color:#fff;max-width:280px;box-shadow:0 0 12px rgba(0,0,0,0.5);">
        <h3 style="margin-bottom:10px;font-weight:600;">Verification</h3>
        <p>Scan phone number <b>${number}</b> for <b>${cost} STRZ ⭐</b>?</p>
        <div style="display:flex;justify-content:center;gap:10px;margin-top:12px;">
          <button id="cancelVerify" style="padding:6px 12px;border:none;border-radius:6px;background:#333;color:#fff;font-weight:600;cursor:pointer;">Cancel</button>
          <button id="confirmVerify" style="padding:6px 12px;border:none;border-radius:6px;background:linear-gradient(90deg,#ff0099,#ff6600);color:#fff;font-weight:600;cursor:pointer;">Yes</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const cancelBtn = modal.querySelector("#cancelVerify");
    const confirmBtn = modal.querySelector("#confirmVerify");

    cancelBtn.onclick = () => modal.remove();

confirmBtn.onclick = async () => {
  if (!currentUser?.uid) {
    showGoldAlert("⚠️ Please log in first");
    modal.remove();
    return;
  }

  if ((currentUser.stars || 0) < cost) {
    showGoldAlert("⚠️ Not enough stars ⭐");
    modal.remove();
    return;
  }

      confirmBtn.disabled = true;
      confirmBtn.style.opacity = 0.6;
      confirmBtn.style.cursor = "not-allowed";

      try {
        // Deduct stars
        await updateDoc(doc(db, "users", currentUser.uid), { stars: increment(-cost) });
        currentUser.stars -= cost;
        if (refs?.starCountEl) refs.starCountEl.textContent = formatNumberWithCommas(currentUser.stars);

        // Run verification
        await runNumberVerification(number);
        modal.remove();
      } catch (err) {
        console.error(err);
        showGoldAlert("❌ Verification failed, please retry!");
        modal.remove();
      }
    };
  };

  // ---------- RUN VERIFICATION ----------
  async function runNumberVerification(number) {
    try {
      const lastDigits = normalizePhone(number);

      const usersRef = collection(db, "users");
      const qSnap = await getDocs(usersRef);

      let verifiedUser = null;
      qSnap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.phone) {
          const storedDigits = normalizePhone(data.phone);
          if (storedDigits === lastDigits) verifiedUser = data;
        }
      });

      showVerificationModal(verifiedUser, number);
    } catch (err) {
      console.error(err);
      showGoldAlert("❌ Verification failed, please retry!");
    }
  }

  // ---------- VERIFICATION MODAL ----------
  function showVerificationModal(user, inputNumber) {
    let modal = document.getElementById("verifyModal");
    if (modal) modal.remove();

    modal = document.createElement("div");
    modal.id = "verifyModal";
    Object.assign(modal.style, {
      position: "fixed",
      top: 0,
      left: 0,
      width: "100vw",
      height: "100vh",
      background: "rgba(0,0,0,0.75)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: "999999",
      backdropFilter: "blur(2px)",
    });

    modal.innerHTML = `
      <div id="verifyModalContent" style="background:#111;padding:14px 16px;border-radius:10px;text-align:center;color:#fff;max-width:320px;box-shadow:0 0 12px rgba(0,0,0,0.5);">
        <p id="stageMsg" style="margin-top:12px;font-weight:500;"></p>
      </div>
    `;
    document.body.appendChild(modal);

    const modalContent = modal.querySelector("#verifyModalContent");
    const stageMsgEl = modalContent.querySelector("#stageMsg");

    // fixed + random stages
    const fixedStages = ["Gathering information…", "Checking phone number validity…"];
    const playfulMessages = [
      "Always meet in public spaces for the first time..",
      "Known hotels are safer for meetups 😉",
      "Condoms should be in the conversation always..",
      "Trust your instincts, always..",
      "Keep things fun and safe 😎",
      "Be polite and confident when messaging..",
      "Avoid sharing sensitive info too soon..",
      "Remember, first impressions last ✨",
      "Don’t rush, enjoy the conversation..",
      "Check for verified accounts before proceeding..",
      "Safety first, fun second 😏",
      "Listen carefully to their plans..",
      "Pick neutral locations for first meets..",
      "Be respectful and courteous..",
      "Share your location with a friend..",
      "Always verify identity before meeting..",
      "Plan ahead, stay alert 👀",
      "Keep communication clear and honest..",
      "Bring a friend if unsure..",
      "Set boundaries clearly..",
      "Have fun, but stay safe!"
    ];
    const randomPlayful = [];
    while (randomPlayful.length < 5) {
      const choice = playfulMessages[Math.floor(Math.random() * playfulMessages.length)];
      if (!randomPlayful.includes(choice)) randomPlayful.push(choice);
    }
    const stages = [...fixedStages, ...randomPlayful, "Finalizing check…"];

    let totalTime = 0;
    stages.forEach((stage, index) => {
      let duration = 1400 + Math.random() * 600;
      totalTime += duration;

      setTimeout(() => {
        stageMsgEl.textContent = stage;

        if (index === stages.length - 1) {
          setTimeout(() => {
            modalContent.innerHTML = user
              ? `<h3>Number Verified! ✅</h3>
                 <p>This number belongs to <b>${user.fullName}</b></p>
                 <p style="margin-top:8px; font-size:13px; color:#ccc;">You’re free to chat, they’re legit 😌</p>
                 <button id="closeVerifyModal" style="margin-top:12px;padding:6px 14px;border:none;border-radius:8px;background:linear-gradient(90deg,#ff0099,#ff6600);color:#fff;font-weight:600;cursor:pointer;">Close</button>`
              : `<h3>Number Not Verified! ❌</h3>
                 <p>The number <b>${inputNumber}</b> does not exist on verified records — be careful!</p>
                 <button id="closeVerifyModal" style="margin-top:12px;padding:6px 14px;border:none;border-radius:8px;background:linear-gradient(90deg,#ff0099,#ff6600);color:#fff;font-weight:600;cursor:pointer;">Close</button>`;

            modal.querySelector("#closeVerifyModal").onclick = () => modal.remove();

            if (user) setTimeout(() => modal.remove(), 8000 + Math.random() * 1000);
          }, 500);
        }
      }, totalTime);
    });
  }
}
        
// ================================
// HIGHLIGHT UPLOAD HANDLER + PROGRESS BAR + THUMBNAIL
// One document per user in highlightVideos collection
// All user's videos stored in 'highlights' array inside that one doc
// ================================

function toCloudflareUrl(firebaseUrl) {
    const clean = firebaseUrl.split('?')[0];
    return clean
        .replace('https://firebasestorage.googleapis.com/v0/b/', 'https://media.visitcube.xyz/')
        .replace('/o/', '/')
        .replace(/%2F/g, '/') + '?alt=media';
}

function resetButton(btn) {
    btn.disabled = false;
    btn.classList.remove('uploading');
    btn.textContent = 'Post Highlight';
    btn.style.background = 'linear-gradient(90deg, #ff2e78, #ff5e2e)';

    const container = document.getElementById('progressContainer');
    if (container) {
        container.style.opacity = '0';
        setTimeout(() => {
            const bar = document.getElementById('progressBar');
            const txt = document.getElementById('progressText');
            if (bar) bar.style.width = '0%';
            if (txt) txt.textContent = '';
        }, 450);
    }
}

function resetForm() {
    const fields = {
        highlightUploadInput: '',
        highlightTitleInput: '',
        highlightDescInput: '',
        highlightPriceInput: '50'
    };
    Object.entries(fields).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    });

    const cb = document.getElementById('boostTrendingCheckbox');
    if (cb) cb.checked = false;

    document.querySelectorAll('.tag-btn.selected').forEach(el => el.classList.remove('selected'));

    const ph = document.getElementById('uploadPlaceholder');
    const pc = document.getElementById('videoPreviewContainer');
    const v = document.getElementById('videoPreview');
    const si = document.getElementById('fileSizeInfo');

    if (v) v.src = '';
    if (pc) pc.style.display = 'none';
    if (ph) ph.style.display = 'block';
    if (si) si.textContent = '';
}

async function generateThumbnail(file) {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        video.src = URL.createObjectURL(file);

        video.onloadedmetadata = () => {
            video.currentTime = Math.min(3, video.duration || 1);
        };

        video.onseeked = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 320;
            canvas.height = 180;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                URL.revokeObjectURL(video.src);
                return reject(new Error('Canvas failed'));
            }
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            canvas.toBlob(blob => {
                URL.revokeObjectURL(video.src);
                if (!blob) return reject(new Error('Blob failed'));
                resolve(new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' }));
            }, 'image/jpeg', 0.85);
        };

        video.onerror = err => {
            URL.revokeObjectURL(video.src);
            reject(err);
        };
    });
}

document.getElementById('uploadHighlightBtn')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    if (btn.disabled) return;

    resetButton(btn);

    if (!currentUser?.uid) {
        showStarPopup('Please sign in to upload', 'error');
        return;
    }

    const title = document.getElementById('highlightTitleInput')?.value.trim() ?? '';
    const description = document.getElementById('highlightDescInput')?.value.trim() ?? '';
    const price = parseInt(document.getElementById('highlightPriceInput')?.value ?? '0', 10) || 0;
    const isBoost = document.getElementById('boostTrendingCheckbox')?.checked ?? false;
    const tags = Array.from(document.querySelectorAll('.tag-btn.selected')).map(el => el.dataset.tag);
    const file = document.getElementById('highlightUploadInput')?.files?.[0];

    if (!title) return showStarPopup('Title is required', 'error');
    if (!file) return showStarPopup('Please select a video', 'error');
    if (file.size > 50 * 1024 * 1024) return showStarPopup('Maximum file size is 50MB', 'error');
    if (!isBoost && price < 10) return showStarPopup('Minimum unlock price is 10 STRZ', 'error');

    if (isBoost) {
        try {
            const userRef = doc(db, 'users', currentUser.uid);
            const snap = await getDoc(userRef);
            const stars = snap.data()?.stars ?? 0;
            if (stars < 500) {
                showStarPopup('Not enough STRZ! Need 500 for trending boost', 'error');
                return;
            }
            await updateDoc(userRef, { stars: increment(-500) });
            showStarPopup('500 STRZ spent — Trending boost activated! 🔥', 'success');
        } catch (err) {
            console.error('Boost failed:', err);
            showStarPopup('Failed to activate boost — try again', 'error');
            return;
        }
    }

    btn.disabled = true;
    btn.classList.add('uploading');
    btn.textContent = 'Processing...';
    const progressContainer = document.getElementById('progressContainer');
    if (progressContainer) progressContainer.style.opacity = '1';
    showStarPopup('Dropping your highlight...', 'loading');

    try {
        let thumbnailFile = null;
        try {
            thumbnailFile = await generateThumbnail(file);
        } catch (err) {
            console.warn('Thumbnail skipped:', err);
        }

        const ts = Date.now();
        const rand = Math.random().toString(36).slice(2, 10);
        const ext = (file.name.split('.').pop() || 'mp4').toLowerCase();

        const videoName = `${ts}_${rand}.${ext}`;
        const thumbName = thumbnailFile ? `thumb_${ts}_${rand}.jpg` : null;
        const basePath = `users/${currentUser.uid}`;
        const videoPath = `${basePath}/${videoName}`;
        const thumbPath = thumbName ? `${basePath}/${thumbName}` : null;

        const videoRef = ref(storage, videoPath);
        const meta = {
            contentType: file.type,
            cacheControl: 'public, max-age=31536000, immutable',
            customMetadata: { uploader: currentUser.uid, originalName: file.name }
        };

        const uploadTask = uploadBytesResumable(videoRef, file, meta);

        uploadTask.on(
            'state_changed',
            snapshot => {
                const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                const bar = document.getElementById('progressBar');
                const txt = document.getElementById('progressText');
                if (bar) bar.style.width = `${percent}%`;
                if (txt) txt.textContent = `Uploading... ${percent}%`;
            },
            err => {
                console.error('Upload error:', err);
                showStarPopup('Upload failed — try again', 'error');
                resetButton(btn);
            },
            async () => {
                try {
                    const rawVideo = await getDownloadURL(videoRef);
                    const videoUrl = toCloudflareUrl(rawVideo);

                    let thumbnailUrl = '';
                    if (thumbnailFile && thumbPath) {
                        const thumbRef = ref(storage, thumbPath);
                        await uploadBytes(thumbRef, thumbnailFile, { contentType: 'image/jpeg', cacheControl: 'public, max-age=31536000, immutable' });
                        const rawThumb = await getDownloadURL(thumbRef);
                        thumbnailUrl = toCloudflareUrl(rawThumb);
                    }

                    const newHighlight = {
                        id: `${ts}_${rand}`,
                        title: isBoost ? `@${currentUser.chatId || 'Legend'}` : title,
                        description: description || '',
                        videoUrl: videoUrl,
                        thumbnailUrl: thumbnailUrl,
                        storagePath: videoPath,
                        highlightVideoPrice: isBoost ? 0 : price,
                        tags: tags.length ? tags : [],
                        views: 0,
                        isTrending: isBoost,
                        trendingUntil: isBoost ? Date.now() + 86400000 : null,  // client-side millis
                        uploadedAt: new Date().toISOString(),   // client-side ISO string (or use server later if needed)
                        createdAt: new Date().toISOString()
                    };

                    const docRef = doc(db, 'highlightVideos', currentUser.uid);

                    try {
                        // Try update first (for existing docs)
                        await updateDoc(docRef, {
                            highlights: arrayUnion(newHighlight),
                            lastUploadAt: serverTimestamp(),
                            totalVideos: increment(1)
                        });
                    } catch (updateErr) {
                        if (updateErr.code === 'not-found' || updateErr.message.includes('No document to update')) {
                            // Create new doc for first-time user
                            await setDoc(docRef, {
                                uploaderId: currentUser.uid,
                                uploaderName: currentUser.chatId || 'Legend',
                                createdAt: serverTimestamp(),
                                lastUploadAt: serverTimestamp(),
                                totalVideos: 1,
                                highlights: [newHighlight]
                            });
                        } else {
                            throw updateErr;
                        }
                    }

                    showStarPopup('Your Video is LIVE! 🎉', 'success');
                    btn.textContent = isBoost ? 'TRENDING LIVE!' : 'DROPPED!';
                    btn.style.background = isBoost
                        ? 'linear-gradient(90deg, #00ffea, #8a2be2, #ff00f2)'
                        : 'linear-gradient(90deg, #00ff9d, #00cc66)';

                    resetForm();
                    if (typeof loadMyClips === 'function') loadMyClips();
                    setTimeout(() => resetButton(btn), 2600);

                } catch (err) {
                    console.error('Save failed:', err);
                    showStarPopup('Upload succeeded but saving failed — try again', 'error');
                    resetButton(btn);
                }
            }
        );
    } catch (err) {
        console.error('Setup failed:', err);
        showStarPopup('Failed to start — try again', 'error');
        resetButton(btn);
    }
});

// Tag selection (unchanged)
document.querySelectorAll('.tag-btn').forEach(btn => {
    btn.addEventListener('click', () => btn.classList.toggle('selected'));
});

// Video preview on select (unchanged)
document.getElementById('highlightUploadInput')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const placeholder = document.getElementById('uploadPlaceholder');
    const previewCont = document.getElementById('videoPreviewContainer');
    const videoEl = document.getElementById('videoPreview');
    const sizeInfo = document.getElementById('fileSizeInfo');

    if (!videoEl || !previewCont || !placeholder) return;

    placeholder.style.display = 'none';
    previewCont.style.display = 'block';
    videoEl.src = URL.createObjectURL(file);
    videoEl.load();

    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    if (sizeInfo) sizeInfo.textContent = `${sizeMB} MB`;

    videoEl.onloadeddata = () => videoEl.currentTime = 0;
});


(function() {
  const onlineCountEl = document.getElementById('onlineCount');
  const storageKey = 'fakeOnlineCount';

  function formatCount(n) {
    if (n >= 10000) return (n / 10000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + 'K';
    return n;
  }

  // Start in a realistic zone for a moderately active site
  let count = parseInt(localStorage.getItem(storageKey)) || 1240;

  function updateDisplay() {
    onlineCountEl.textContent = formatCount(count);
    localStorage.setItem(storageKey, count);
  }

  updateDisplay();

  let baseTrend = 0; // -1 = drifting down, 0 = neutral, 1 = drifting up

  setInterval(() => {
    const dice = Math.random();

    // 1. Most of the time: very small natural breathing (±1–8)
    if (dice < 0.55) {
      count += Math.floor(Math.random() * 17) - 8;
    }
    // 2. Small group join/leave waves (±10–35)
    else if (dice < 0.82) {
      count += Math.floor(Math.random() * 51) - 25;
    }
    // 3. Occasional medium bump (new share / small promo / refresh wave) +45–+140
    else if (dice < 0.94) {
      count += Math.floor(Math.random() * 96) + 45;
      // slightly increase upward pressure after a bump
      baseTrend = Math.min(1, baseTrend + 0.3);
    }
    // 4. Small drop-off after video ends / tab closed (±40–110 down)
    else if (dice < 0.99) {
      count -= Math.floor(Math.random() * 71) + 40;
      // slight downward pressure
      baseTrend = Math.max(-1, baseTrend - 0.3);
    }
    // 5. Rare bigger spike — feels like influencer just mentioned it
    else {
      count += Math.floor(Math.random() * 220) + 120; // +120–340
      baseTrend = 1;
    }

    // Gentle time-of-day influence (assumes your audience timezone)
    const hour = new Date().getHours();
    if (hour >= 23 || hour < 7) {
      baseTrend = -1; // night → slow drain
    } else if ((hour >= 12 && hour <= 14) || (hour >= 19 && hour <= 22)) {
      baseTrend = 1;  // lunch + evening = active
    } else if (hour >= 8 && hour <= 11) {
      baseTrend = 0.3; // morning slow build
    } else {
      baseTrend = 0;
    }

    // Apply very gentle trend force
    if (baseTrend > 0) {
      count += Math.random() > 0.6 ? 2 : 1;
    } else if (baseTrend < 0) {
      count -= Math.random() > 0.6 ? 2 : 1;
    }

    // ------------------- Hard realistic boundaries -------------------
    // Almost never go below ~650 or above ~1950
    if (count < 650) {
      count = 650 + Math.floor(Math.random() * 350); // jump back into believable range
      baseTrend = 0.5; // give it some upward momentum after floor hit
    }
    if (count > 1950) {
      count = 1950 - Math.floor(Math.random() * 450);
      baseTrend = -0.5;
    }

    // Prevent staying stuck on xxx0 or xxx00 too long
    if ((count % 100 === 0 || count % 1000 === 0) && Math.random() < 0.85) {
      count += Math.floor(Math.random() * 70) - 35;
    }

    // Keep it integer
    count = Math.round(count);

    updateDisplay();
  }, 2800 + Math.floor(Math.random() * 3400)); // ~3–6 second updates → natural jitter

  // Very gentle long-term recentering (prevents infinite upward/downward creep)
  setInterval(() => {
    const target = 1100 + Math.floor(Math.random() * 700); // 1100–1800 zone
    const diff = target - count;
    count += Math.round(diff * 0.08); // move ~8% toward target
    updateDisplay();
  }, 8 * 60 * 1000); // every ~8 minutes

})();



document.addEventListener('DOMContentLoaded', () => {
// === ELEMENTS ===
const liveModal = document.getElementById('liveModal');
const liveConsentModal = document.getElementById('adultConsentModal'); // Optional: for adult content consent
const livePlayerContainer = document.getElementById('livePlayerContainer');
const livePostersSection = document.getElementById('upcomingPosters');
const liveCloseBtn = document.querySelector('.live-close');
const tabBtns = document.querySelectorAll('.live-tab-btn');
const tabContents = document.querySelectorAll('.live-tab-content');
const openHostsBtn = document.getElementById('openHostsBtn');
// Consent buttons (only if adult tab exists)
const consentAgreeBtn = document.getElementById('consentAgree');
const consentCancelBtn = document.getElementById('consentCancel');
// Reels videos for preview interaction
const reelVideos = document.querySelectorAll('.reel-item video');


// === CONFIG ===
let fadeTimer;
const POSTER_FADE_DELAY = 8000;

// Real Playback IDs (from your Render creation)
const PLAYBACK_IDS = {
  regular: '00ArRcw4u5aRgIh02qWDfGKzpEZ1G7QWcgESUwS003KP58',
  adult:   '00ArRcw4u5aRgIh02qWDfGKzpEZ1G7QWcgESUwS003KP58' // same stream
};

// Real Live Stream IDs (reference only – backend uses env var)
const MUX_LIVE_STREAM_IDS = {
  regular: '02QJjwFbcAgD9SUV9KlXML00v1wlE9o3d1ddKP01HFXNnk',
  adult:   '02QJjwFbcAgD9SUV9KlXML00v1wlE9o3d1ddKP01HFXNnk'
};

// Offline placeholder customization
const OFFLINE_IMAGE_URL = 'https://cdn.shopify.com/s/files/1/0962/6648/6067/files/livestream_offline.jpg?v=1767572776';
const OFFLINE_TITLE = 'Live stream is currently offline';
const OFFLINE_MESSAGE = "We'll be back soon, check upcoming for the next broadcast!";

// Backend URL – IMPORTANT: change if your Render service name changes
const BACKEND_URL = 'https://mux-backend-service.onrender.com';

// === CORE FUNCTIONS ===

function switchContent(type) {
  if (type === 'regular' || type === 'adult') {
    showTab('live');
    startStream(type);
  }
}

async function startStream(type = 'regular') {
  const playbackId = PLAYBACK_IDS[type];
  const liveStreamId = MUX_LIVE_STREAM_IDS[type]; // reference only

  // Show loading state immediately
  livePlayerContainer.innerHTML = `
    <div style="color:#aaa; text-align:center; padding:80px 20px; font-size:18px;">
      Checking for active livestreams...
    </div>
  `;

  // Basic config check
  if (!playbackId || !liveStreamId) {
    showOfflineState('Stream configuration missing');
    return;
  }

  try {
    // Call backend with full URL (fixes 404 when domains differ)
    const response = await fetch(`${BACKEND_URL}/api/mux-live-status?type=${type}`, {
      cache: 'no-store' // prevent caching issues
    });

    console.log('Backend response status:', response.status); // debug

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No details');
      throw new Error(`Backend returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    if (data.isActive) {
      // Stream is LIVE → show player
      livePlayerContainer.innerHTML = '';
      const player = document.createElement('mux-player');
      player.setAttribute('playback-id', playbackId);
      player.setAttribute('stream-type', 'live');
      player.setAttribute('autoplay', 'muted');
      player.setAttribute('muted', 'true');
      player.setAttribute('controls', 'true');
   player.setAttribute('poster', `https://image.mux.com/${playbackId}/thumbnail.webp?time=10&width=720&height=1280&fit_mode=preserve`);

      player.style.width = '100%';
      player.style.height = '100%';
      player.style.objectFit = 'contain';

      livePlayerContainer.appendChild(player);
    } else {
      // Not live → show custom offline UI
      showOfflineState(data.error || 'Stream is idle');
    }
  } catch (err) {
    console.error('Failed to check live stream status:', err.message);
    // Show friendly message (Render free tier sleeps sometimes → first call takes 10-30s)
    showOfflineState(
      err.message.includes('503') || err.message.includes('failed to fetch')
        ? 'Stream service waking up... try Refresh in 20 seconds'
        : 'Unable to check stream status right now'
    );
  }
}

// Custom offline placeholder – mobile-optimized
// Custom offline placeholder – super mobile-optimized (tiny text, image priority)
function showOfflineState(customError = '') {
  livePlayerContainer.innerHTML = `
    <div style="
      width: 100%;
      height: 100%;
      background: #000;
      color: #ffffff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 8px;
      box-sizing: border-box;
      overflow: hidden;
    ">
      <!-- Image takes almost all space on mobile -->
      <div style="
        flex: 1;
        width: 100%;
        max-height: 85vh;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 8px;
      ">
        <img
          src="${OFFLINE_IMAGE_URL}"
          alt="Live stream offline"
          style="
            width: 100%;
            height: 100%;
            object-fit: contain;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5);
          "
        >
      </div>

      <!-- Tiny text section – minimal & mobile-friendly -->
      <div style="
        width: 100%;
        max-width: 90%;
      ">
        <h2 style="
          margin: 0 0 6px;
          font-size: clamp(1.1rem, 4.5vw, 1.4rem); /* way smaller */
          font-weight: 700;
        ">
          ${OFFLINE_TITLE}
        </h2>
        <p style="
          margin: 0 0 14px;
          font-size: clamp(0.8rem, 3.5vw, 0.95rem); /* tiny subtext */
          opacity: 0.85;
          line-height: 1.4;
        ">
          ${OFFLINE_MESSAGE}
        </p>
        ${customError ? `
          <p style="
            color: #ff6b6b;
            margin: 0 0 12px;
            font-size: clamp(0.75rem, 3vw, 0.9rem);
          ">
            ${customError}
          </p>` : ''}

        <button
          onclick="startStream('regular')"
          style="
            padding: 9px 24px;
            background: #e50914;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: clamp(0.9rem, 3.8vw, 1rem);
            font-weight: bold;
            cursor: pointer;
            min-width: 130px;
          "
          onmouseover="this.style.background='#c40810'"
          onmouseout="this.style.background='#e50914'"
        >
          Refresh Stream
        </button>
      </div>
    </div>
  `;
}

function closeAllLiveModal() {
  liveModal.style.display = 'none';
  if (liveConsentModal) liveConsentModal.style.display = 'none';
  livePlayerContainer.innerHTML = '';
  livePlayerContainer.classList.remove('portrait', 'landscape');
  livePostersSection?.classList.remove('fading');
  clearTimeout(fadeTimer);
  liveCloseBtn?.classList.remove('hidden');
}

function resetPosterFade() {
  livePostersSection?.classList.remove('fading');
  clearTimeout(fadeTimer);
  fadeTimer = setTimeout(() => {
    livePostersSection?.classList.add('fading');
  }, POSTER_FADE_DELAY);
}

// Expose startStream globally so inline onclick="startStream('regular')" works
window.startStream = startStream;
// (your showTab function can stay exactly as it was – omitted here for brevity)

  function showTab(tabId) {
    tabBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.content === tabId));
    tabContents.forEach(content => content.classList.toggle('active', content.id === tabId));

    // Tab-specific behavior
    if (tabId === 'live') {
      startStream('regular'); // Always load regular stream in Live tab
      resetPosterFade();
    } else if (tabId === 'upcoming') {
      resetPosterFade();
    } else if (tabId === 'reels') {
      // Reset reel previews
      reelVideos.forEach(video => {
        video.pause();
        video.currentTime = 0;
      });
    }
  }

  // === REELS INTERACTION (TikTok-style) ===
  reelVideos.forEach(video => {
    const reelItem = video.parentElement;

    // Desktop: hover preview
    reelItem.addEventListener('mouseenter', () => video.play().catch(() => {}));
    reelItem.addEventListener('mouseleave', () => {
      video.pause();
      video.currentTime = 0;
    });

    // Mobile: tap to play/pause + try fullscreen
    reelItem.addEventListener('click', (e) => {
      e.stopPropagation();

      if (video.paused) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }

      // Optional: attempt fullscreen on play
      if (!video.paused) {
        if (video.requestFullscreen) video.requestFullscreen();
        else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen(); // iOS
      }
    });
  });

  // === EVENT LISTENERS ===
  // Open modal — ONLY FOR LOGGED-IN VIP/HOST USERS
  if (openHostsBtn) {
    openHostsBtn.onclick = () => {
      if (!currentUser?.uid) {
        showGoldAlert("Please log in to watch liveshows");
        return;
      }

      liveModal.style.display = 'block';
      showTab('live'); // Default to Live tab
      resetPosterFade();
      liveCloseBtn?.classList.remove('hidden');
    };
  }

  // Close button
  if (liveCloseBtn) {
    liveCloseBtn.onclick = closeAllLiveModal;
  }

  // Backdrop close
  if (liveModal) {
    liveModal.onclick = (e) => {
      if (e.target === liveModal) {
        closeAllLiveModal();
      }
    };
  }

  // Tab switching
  tabBtns.forEach(btn => {
    btn.onclick = () => {
      const target = btn.dataset.content;

      // Optional adult consent gate (remove if not using adult content)
      if (target === 'adult' && liveConsentModal) {
        liveConsentModal.style.display = 'flex';
        liveCloseBtn?.classList.add('hidden');
        return;
      }

      showTab(target);
    };
  });

  // Consent: Agree
  if (consentAgreeBtn) {
    consentAgreeBtn.onclick = () => {
      liveConsentModal.style.display = 'none';
      liveCloseBtn?.classList.remove('hidden');

      // If you have an adult tab, switch to it and load adult stream
      const adultBtn = document.querySelector('.live-tab-btn[data-content="adult"]');
      if (adultBtn) {
        showTab('adult');
        startStream('adult');
      }
    };
  }

  // Consent: Cancel or backdrop
  if (consentCancelBtn) {
    consentCancelBtn.onclick = () => {
      liveConsentModal.style.display = 'none';
      liveCloseBtn?.classList.remove('hidden');
      showTab('live');
    };
  }

  if (liveConsentModal) {
    liveConsentModal.onclick = (e) => {
      if (e.target === liveConsentModal) {
        liveConsentModal.style.display = 'none';
        liveCloseBtn?.classList.remove('hidden');
        showTab('live');
      }
    };
  }

  // Legacy support for old tab buttons (if any still exist)
  document.querySelectorAll('.live-tab-btn[data-content="regular"], .live-tab-btn[data-content="adult"]').forEach(oldBtn => {
    oldBtn.onclick = () => switchContent(oldBtn.dataset.content);
  });
});

// ---------- DEBUGGABLE HOST INIT (drop-in) ----------
(function () {
  // Toggle this dynamically in your app
  const isHost = true; // <-- make sure this equals true at runtime for hosts

  // Small helper: wait for a set of elements to exist (polling)
  function waitForElements(selectors = [], { timeout = 5000, interval = 80 } = {}) {
    const start = Date.now();
    return new Promise((resolve, reject) => {
      (function poll() {
        const found = selectors.map(s => document.querySelector(s));
        if (found.every(el => el)) return resolve(found);
        if (Date.now() - start > timeout) return reject(new Error("waitForElements timeout: " + selectors.join(", ")));
        setTimeout(poll, interval);
      })();
    });
  }

  // Safe getter w/ default
  const $ = (sel) => document.querySelector(sel);

  // run everything after DOM ready (and still robust if DOM already loaded)
  function ready(fn) {
    if (document.readyState === "complete" || document.readyState === "interactive") {
      setTimeout(fn, 0);
    } else {
      document.addEventListener("DOMContentLoaded", fn);
    }
  }

  ready(async () => {
    console.log("[host-init] DOM ready. isHost =", isHost);

    if (!isHost) {
      console.log("[host-init] not a host. exiting host init.");
      return;
    }

    // 1) Wait for the most important elements that must exist for host flow.
    try {
      const [
        hostSettingsWrapperEl,
        hostModalEl,
        hostSettingsBtnEl,
      ] = await waitForElements(
        ["#hostSettingsWrapper", "#hostModal", "#hostSettingsBtn"],
        { timeout: 7000 }
      );

      console.log("[host-init] Found host elements:", {
        hostSettingsWrapper: !!hostSettingsWrapperEl,
        hostModal: !!hostModalEl,
        hostSettingsBtn: !!hostSettingsBtnEl,
      });

      // Show wrapper/button
      hostSettingsWrapperEl.style.display = "block";

      // close button - optional but preferred
      const closeModalEl = hostModalEl.querySelector(".close");
      if (!closeModalEl) {
        console.warn("[host-init] close button (.close) not found inside #hostModal.");
      }

      // --- attach tab init (shared across modals)
      function initTabsForModal(modalEl) {
        modalEl.querySelectorAll(".tab-btn").forEach((btn) => {
          btn.addEventListener("click", () => {
            modalEl.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
            // Hide only tab-content referenced by dataset or global shared notifications
            document.querySelectorAll(".tab-content").forEach((tab) => (tab.style.display = "none"));
            btn.classList.add("active");
            const target = document.getElementById(btn.dataset.tab);
            if (target) target.style.display = "block";
            else console.warn("[host-init] tab target not found:", btn.dataset.tab);
          });
        });
      }
      initTabsForModal(hostModalEl);

      // --- host button click: show modal + populate
      hostSettingsBtnEl.addEventListener("click", async () => {
        try {
          hostModalEl.style.display = "block";

          if (!currentUser?.uid) {
            console.warn("[host-init] currentUser.uid missing");
            return showStarPopup("⚠️ Please log in first.");
          }

          const userRef = doc(db, "users", currentUser.uid);
          const snap = await getDoc(userRef);
          if (!snap.exists()) {
            console.warn("[host-init] user doc not found for uid:", currentUser.uid);
            return showStarPopup("⚠️ User data not found.");
          }
          const data = snap.data() || {};
          // populate safely (guard each element)
          const safeSet = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.value = value ?? "";
          };

          safeSet("fullName", data.fullName || "");
          safeSet("city", data.city || "");
          safeSet("location", data.location || "");
          safeSet("bio", data.bioPick || "");
          safeSet("bankAccountNumber", data.bankAccountNumber || "");
          safeSet("bankName", data.bankName || "");
          safeSet("telegram", data.telegram || "");
          safeSet("tiktok", data.tiktok || "");
          safeSet("whatsapp", data.whatsapp || "");
          safeSet("instagram", data.instagram || "");
          // picks
          const natureEl = document.getElementById("naturePick");
          if (natureEl) natureEl.value = data.naturePick || "";
          const fruitEl = document.getElementById("fruitPick");
          if (fruitEl) fruitEl.value = data.fruitPick || "";
          
// --- NEW: body type pick
const bodyTypeEl = document.getElementById("bodyTypePick");
if (bodyTypeEl) bodyTypeEl.value = data.bodyTypePick || "";

          // preview photo
          if (data.popupPhoto) {
            const photoPreview = document.getElementById("photoPreview");
            const photoPlaceholder = document.getElementById("photoPlaceholder");
            if (photoPreview) {
              photoPreview.src = data.popupPhoto;
              photoPreview.style.display = "block";
            }
            if (photoPlaceholder) photoPlaceholder.style.display = "none";
          } else {
            // ensure preview hidden if no photo
            const photoPreview = document.getElementById("photoPreview");
            const photoPlaceholder = document.getElementById("photoPlaceholder");
            if (photoPreview) photoPreview.style.display = "none";
            if (photoPlaceholder) photoPlaceholder.style.display = "inline-block";
          }

        } catch (err) {
          console.error("[host-init] error in hostSettingsBtn click:", err);
          showStarPopup("⚠️ Failed to open settings. Check console.");
        }
      });

      // --- close handlers
      if (closeModalEl) {
        closeModalEl.addEventListener("click", () => (hostModalEl.style.display = "none"));
      }
      window.addEventListener("click", (e) => {
        if (e.target === hostModalEl) hostModalEl.style.display = "none";
      });

      // --- photo preview handler (delegated)
      document.addEventListener("change", (e) => {
        if (e.target && e.target.id === "popupPhoto") {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            const photoPreview = document.getElementById("photoPreview");
            const photoPlaceholder = document.getElementById("photoPlaceholder");
            if (photoPreview) {
              photoPreview.src = reader.result;
              photoPreview.style.display = "block";
            }
            if (photoPlaceholder) photoPlaceholder.style.display = "none";
          };
          reader.readAsDataURL(file);
        }
      });

    // --- save info button (safe)
const maybeSaveInfo = document.getElementById("saveInfo");
if (maybeSaveInfo) {
  maybeSaveInfo.addEventListener("click", async () => {
    if (!currentUser?.uid) return showStarPopup("⚠️ Please log in first.");

    const getVal = id => document.getElementById(id)?.value ?? "";

    // Collect all form values
let dataToUpdate = {
  fullName: (getVal("fullName") || "").replace(/\b\w/g, l => l.toUpperCase()),
  city: getVal("city"),
  location: getVal("location"),
  bioPick: getVal("bio"),
  bankAccountNumber: getVal("bankAccountNumber"),
  bankName: getVal("bankName"),
  telegram: getVal("telegram"),
  tiktok: getVal("tiktok"),
  whatsapp: getVal("whatsapp"),
  instagram: getVal("instagram"),
  naturePick: getVal("naturePick"),
  fruitPick: getVal("fruitPick"),
  bodyTypePick: getVal("bodyTypePick"), // ← ADD THIS
};

    // ───────────────────────────────────────────────────────────────
    // ADD BANK NORMALIZATION + SLUG GENERATION HERE
    if (dataToUpdate.bankName) {
      const selectedBankName = dataToUpdate.bankName.trim();

      // Clean and normalize the name (just in case user typed manually — though unlikely with <select>)
      const normalizedBankName = selectedBankName
        .replace(/\s+/g, ' ')           // normalize multiple spaces
        .trim();

      // Generate slug (Paystack-compatible format)
      const bankSlug = normalizedBankName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')   // remove special chars except letters, numbers, space, hyphen
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');

      // Update the data object with both versions
      dataToUpdate.bankName = normalizedBankName;   // "Guaranty Trust Bank (GTBank)"
      dataToUpdate.bankSlug = bankSlug;             // "guaranty-trust-bank-gtbank"
    }
    // ───────────────────────────────────────────────────────────────

    // Validation (existing)
    if (dataToUpdate.bankAccountNumber && !/^\d{1,11}$/.test(dataToUpdate.bankAccountNumber))
      return showStarPopup("⚠️ Bank account number must be digits only (max 11).");

    if (dataToUpdate.whatsapp && !/^\d+$/.test(dataToUpdate.whatsapp))
      return showStarPopup("⚠️ WhatsApp number must be numbers only.");

    const originalHTML = maybeSaveInfo.innerHTML;
    maybeSaveInfo.innerHTML = `<div class="spinner" style="width:12px;height:12px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation: spin 0.6s linear infinite;margin:auto;"></div>`;
    maybeSaveInfo.disabled = true;

    try {
      const userRef = doc(db, "users", currentUser.uid);
      const filteredData = Object.fromEntries(
        Object.entries(dataToUpdate).filter(([_, v]) => v !== undefined && v !== "")
      );

      await updateDoc(userRef, { ...filteredData, lastUpdated: serverTimestamp() });

      // mirror to featuredHosts if exists
      const hostRef = doc(db, "featuredHosts", currentUser.uid);
      const hostSnap = await getDoc(hostRef);
      if (hostSnap.exists()) {
        await updateDoc(hostRef, { ...filteredData, lastUpdated: serverTimestamp() });
      }

      showStarPopup("✅ Profile updated successfully!");

      // blur inputs for UX
      document.querySelectorAll("#mediaTab input, #mediaTab textarea, #mediaTab select").forEach(i => i.blur());
    } catch (err) {
      console.error("[host-init] saveInfo error:", err);
      showStarPopup("⚠️ Failed to update info. Please try again.");
    } finally {
      maybeSaveInfo.innerHTML = originalHTML;
      maybeSaveInfo.disabled = false;
    }
  });
} else {
  console.warn("[host-init] saveInfo button not found.");
}

      // --- save media button (optional)
      const maybeSaveMedia = document.getElementById("saveMedia");
      if (maybeSaveMedia) {
        maybeSaveMedia.addEventListener("click", async () => {
          if (!currentUser?.uid) return showStarPopup("⚠️ Please log in first.");
          const popupPhotoFile = document.getElementById("popupPhoto")?.files?.[0];
          const uploadVideoFile = document.getElementById("uploadVideo")?.files?.[0];
          if (!popupPhotoFile && !uploadVideoFile) return showStarPopup("⚠️ Please select a photo or video to upload.");
          try {
            showStarPopup("⏳ Uploading media...");
            const formData = new FormData();
            if (popupPhotoFile) formData.append("photo", popupPhotoFile);
            if (uploadVideoFile) formData.append("video", uploadVideoFile);
            const res = await fetch("/api/uploadShopify", { method: "POST", body: formData });
            if (!res.ok) throw new Error("Upload failed.");
            const data = await res.json();
            const userRef = doc(db, "users", currentUser.uid);
            await updateDoc(userRef, {
              ...(data.photoUrl && { popupPhoto: data.photoUrl }),
              ...(data.videoUrl && { videoUrl: data.videoUrl }),
              lastUpdated: serverTimestamp()
            });
            if (data.photoUrl) {
              const photoPreview = document.getElementById("photoPreview");
              const photoPlaceholder = document.getElementById("photoPlaceholder");
              if (photoPreview) {
                photoPreview.src = data.photoUrl;
                photoPreview.style.display = "block";
              }
              if (photoPlaceholder) photoPlaceholder.style.display = "none";
            }
            showStarPopup("✅ Media uploaded successfully!");
            hostModalEl.style.display = "none";
          } catch (err) {
            console.error("[host-init] media upload error:", err);
            showStarPopup(`⚠️ Failed to upload media: ${err.message}`);
          }
        });
      } else {
        console.info("[host-init] saveMedia button not present (ok if VIP-only UI).");
      }

      console.log("[host-init] Host logic initialized successfully.");
    } catch (err) {
      console.error("[host-init] Could not find required host elements:", err);
      // helpful message for debugging during development:
      showStarPopup("⚠️ Host UI failed to initialize. Check console for details.");
    }
  }); // ready
})();
/* =======================================
   Dynamic Host Panel Greeting (No Images)
========================================== */
function capitalizeFirstLetter(str) {
  if (!str) return "Guest";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function setGreeting() {
  if (!currentUser?.chatId) {
    document.getElementById("hostPanelTitle").textContent = "Host Panel";
    return;
  }

  const name = capitalizeFirstLetter(currentUser.chatId.replace(/_/g, " "));
  const hour = new Date().getHours();

  let greetingText;
  if (hour < 12) {
    greetingText = `Good Morning, ${name}!`;
  } else if (hour < 18) {
    greetingText = `Good Afternoon, ${name}!`;
  } else {
    greetingText = `Good Evening, ${name}!`;
  }

  const titleEl = document.getElementById("hostPanelTitle");
  if (titleEl) {
    titleEl.textContent = greetingText;  // Plain text only
  }
}

/* Run greeting when host panel opens */
document.getElementById("hostSettingsBtn")?.addEventListener("click", () => {
  setGreeting();
});

// === SINGLE FULL-SCREEN VIDEO MODAL – SAFE & REUSABLE ===
let fullScreenVideoModal = null;
let currentFullVideo = null;

function initFullScreenVideoModal() {
  if (fullScreenVideoModal) return;

  fullScreenVideoModal = document.createElement("div");
  Object.assign(fullScreenVideoModal.style, {
    position: "fixed",
    inset: "0",
    width: "100vw",
    height: "100vh",
    background: "#000",
    zIndex: "99999",
    display: "none",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer"
  });

  currentFullVideo = document.createElement("video");
  currentFullVideo.controls = true;
  currentFullVideo.playsInline = false;
  Object.assign(currentFullVideo.style, {
    maxWidth: "100%",
    maxHeight: "100%",
    objectFit: "contain"
  });

  // Close on click outside video (not on video itself)
  fullScreenVideoModal.onclick = (e) => {
    if (e.target === fullScreenVideoModal) {
      closeFullScreenVideoModal();
    }
  };

  // ESC key close
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && fullScreenVideoModal.style.display === "flex") {
      closeFullScreenVideoModal();
    }
  });

  fullScreenVideoModal.appendChild(currentFullVideo);
  document.body.appendChild(fullScreenVideoModal);
}

function openFullScreenVideo(videoUrl) {
  initFullScreenVideoModal();

  // Full cleanup before opening new video
  closeFullScreenVideoModal(true); // force cleanup without delay

  currentFullVideo.src = videoUrl || "";
  currentFullVideo.load();

  fullScreenVideoModal.style.display = "flex";

  // Autoplay
  currentFullVideo.play().catch(err => console.log("Autoplay blocked:", err));

  // Fullscreen (with fallback timing)
  setTimeout(() => {
    const video = currentFullVideo;
    if (video && document.fullscreenElement !== video) {
      if (video.requestFullscreen) {
        video.requestFullscreen().catch(() => {});
      } else if (video.webkitRequestFullscreen) {
        video.webkitRequestFullscreen();
      } else if (video.msRequestFullscreen) {
        video.msRequestFullscreen();
      }
    }
  }, 300); // slightly longer delay = more reliable on mobile
}

function closeFullScreenVideoModal(force = false) {
  if (!fullScreenVideoModal) return;

  // Always stop & clear
  currentFullVideo.pause();
  currentFullVideo.src = "";
  currentFullVideo.load(); // force unload

  // Exit fullscreen safely
  if (document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  } else if (document.webkitExitFullscreen) {
    document.webkitExitFullscreen();
  } else if (document.msExitFullscreen) {
    document.msExitFullscreen();
  }

  fullScreenVideoModal.style.display = "none";

  // Extra safety: remove from DOM on force close (prevents stale state)
  if (force) {
    setTimeout(() => {
      if (fullScreenVideoModal.parentNode) {
        fullScreenVideoModal.parentNode.removeChild(fullScreenVideoModal);
        fullScreenVideoModal = null;
        currentFullVideo = null;
      }
    }, 500);
  }
}

// Initialize once
initFullScreenVideoModal();

// Optional: expose globally if needed elsewhere
window.openFullScreenVideo = openFullScreenVideo;
window.closeFullScreenVideoModal = closeFullScreenVideoModal;


/* Highlights Button – shows ALL clips from ALL users */
highlightsBtn.onclick = async () => {
    try {
        if (!currentUser?.uid) {
            showGoldAlert("Please log in to view cuties");
            return;
        }

        const colRef = collection(db, "highlightVideos");
        const snap = await getDocs(colRef);

        if (snap.empty) {
            showGoldAlert("No clips uploaded yet");
            return;
        }

        const allClips = [];

        snap.forEach(userDoc => {
            const userData = userDoc.data();
            const clips = userData.highlights || [];

            clips.forEach(clip => {
                allClips.push({
                    id: clip.id,
                    highlightVideo: clip.videoUrl || "",
                    highlightVideoPrice: clip.highlightVideoPrice || 0,
                    title: clip.title || "Untitled",
                    uploaderName: userData.uploaderName || userData.chatId || "Anonymous",
                    uploaderId: userData.uploaderId || userDoc.id,
                    uploaderEmail: userData.uploaderEmail || "unknown",
                    description: clip.description || "",
                    thumbnail: clip.thumbnailUrl || "",
                    createdAt: clip.uploadedAt || null,
                    unlockedBy: clip.unlockedBy || [],
                    previewClip: clip.previewClip || "",
                    videoUrl: clip.videoUrl || "",
                    isTrending: clip.isTrending || false,
                    tags: clip.tags || []
                });
            });
        });

        if (allClips.length === 0) {
            showGoldAlert("No clips available yet");
            return;
        }

        showHighlightsModal(allClips);  // ← pass array, as your modal originally expects

    } catch (err) {
        console.error("Error fetching clips:", err);
        showGoldAlert("Error fetching clips — please try again.");
    }
};

/* ---------- Highlights Modal – Cuties Morphine Edition (RANDOM ORDER FIXED) ---------- */
function showHighlightsModal(videos) {
  document.getElementById("highlightsModal")?.remove();
  const modal = document.createElement("div");
  modal.id = "highlightsModal";
  Object.assign(modal.style, {
    position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
    background: "rgba(8,3,25,0.97)",
    backgroundImage: "linear-gradient(135deg, rgba(0,255,234,0.09), rgba(255,0,242,0.14), rgba(138,43,226,0.11))",
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "flex-start",
    zIndex: "999999", overflowY: "auto", padding: "20px 12px", boxSizing: "border-box",
    fontFamily: "system-ui, sans-serif"
  });
  // HEADER
  const intro = document.createElement("div");
  intro.innerHTML = `
    <div style="text-align:center; color:#e0b0ff; max-width:640px; margin:0 auto 24px;
                line-height:1.6; font-size:14px;
                background:linear-gradient(135deg,rgba(255,0,242,0.15),rgba(138,43,226,0.12));
                padding:16px 28px; border:1px solid rgba(138,43,226,0.5);
                box-shadow:0 0 20px rgba(255,0,242,0.25); border-radius:16px; position:relative;">
      <div style="margin-bottom:8px;">
        <span style="background:linear-gradient(90deg,#00ffea,#ff00f2,#8a2be2);
                     -webkit-background-clip:text; -webkit-text-fill-color:transparent;
                     font-weight:800; font-size:22px; letter-spacing:0.4px;">
          Cuties💕
        </span>
      </div>
      <p style="margin:0 0 4px;">Cam-worthy moments from girls on cube.</p>
      <p style="margin:0;">Unlock a cutie’s clip with STRZ and get closer.</p>
    </div>
  `;
  modal.appendChild(intro);
  // CLOSE BUTTON
  const closeBtn = document.createElement("div");
  closeBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M18 6L6 18M6 6L18 18" stroke="#00ffea" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`;
 Object.assign(closeBtn.style, {
  position: "absolute",
  top: "8px",           // ← was 16px, now moved upward (smaller number = higher up)
  right: "10px",        // ← was 16px, now moved a bit to the right (smaller number = more to the right)
  width: "32px",
  height: "32px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  zIndex: "1002",
  transition: "all 0.25s ease",
  filter: "drop-shadow(0 0 10px rgba(0,255,234,0.7))"
});
  closeBtn.onmouseenter = () => closeBtn.style.transform = "rotate(90deg) scale(1.2)";
  closeBtn.onmouseleave = () => closeBtn.style.transform = "rotate(0deg) scale(1)";
  closeBtn.onclick = (e) => {
    e.stopPropagation();
    closeBtn.style.transform = "rotate(180deg) scale(1.35)";
    setTimeout(() => modal.remove(), 280);
  };
  intro.firstElementChild.appendChild(closeBtn);
  // CONTROLS
  const controls = document.createElement("div");
  controls.style.cssText = `
    width:100%; max-width:640px; margin:0 auto 28px;
    display:flex; flex-direction:column; align-items:center; gap:16px;
  `;
  // Main filter buttons
  const mainButtons = document.createElement("div");
  mainButtons.style.cssText = "display:flex; gap:12px; flex-wrap:wrap; justify-content:center;";
  const unlockedBtn = document.createElement("button");
  unlockedBtn.textContent = "Show Unlocked";
  Object.assign(unlockedBtn.style, {
    padding: "8px 16px", borderRadius: "30px", fontSize: "13px", fontWeight: "700",
    background: "linear-gradient(135deg, #240046, #3c0b5e)", color: "#00ffea",
    border: "1px solid rgba(138,43,226,0.6)", cursor: "pointer",
    transition: "all 0.3s", boxShadow: "0 4px 12px rgba(138,43,226,0.4)"
  });
 const trendingBtn = document.createElement("button");

// Use innerHTML so we can style only the emoji
trendingBtn.innerHTML = 'Free Tonight <span style="background: linear-gradient(90deg, #ff3366, #ff6b6b, #ff9f1c); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-weight: 900;">🔥</span>';
Object.assign(trendingBtn.style, {
  padding: "8px 16px",
  borderRadius: "30px",
  fontSize: "13px",
  fontWeight: "700",
  background: "linear-gradient(135deg, #8a2be2, #ff00f2)",
  color: "#fff",                  // whole button text stays white
  border: "1px solid rgba(255,0,242,0.7)",
  cursor: "pointer",
  transition: "all 0.3s",
  boxShadow: "0 4px 14px rgba(255,0,242,0.5)",
  display: "inline-flex",         // helps align text + emoji nicely
  alignItems: "center",
  gap: "4px"                      // tiny spacing between text and emoji
});
  mainButtons.append(unlockedBtn, trendingBtn);
  controls.appendChild(mainButtons);


  // TAG FILTER BUTTONS
  const tagContainer = document.createElement("div");
  tagContainer.id = "tagButtons";
  tagContainer.style.cssText = `
    display:flex; flex-wrap:wrap; gap:10px; justify-content:center; max-width:500px;
    margin-top:12px; padding:8px 0;
  `;
  controls.appendChild(tagContainer);
  modal.appendChild(controls);
  // GRID
  const grid = document.createElement("div");
  grid.id = "highlightsGrid";
  grid.style.cssText = `
    display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 14px; width: 100%; max-width: 960px; margin: 0 auto; padding-bottom: 80px;
  `;
  modal.appendChild(grid);
  // State
  let unlockedVideos = JSON.parse(localStorage.getItem("userUnlockedVideos") || "[]");
  let filterMode = "all";
  let activeTags = new Set();
  function renderCards(videosToRender = videos) {
    grid.innerHTML = "";
   tagContainer.innerHTML = "";

// Only build tag buttons from currently visible/filtered videos
let visibleVideos = videosToRender.filter(v => {
  if (filterMode === "unlocked") return unlockedVideos.includes(v.id);
  if (filterMode === "trending") return v.isTrending === true;
  return true;
});

// Apply active tag filters (if any)
if (activeTags.size > 0) {
  visibleVideos = visibleVideos.filter(v => {
    const videoTags = (v.tags || []).map(t => (t || "").trim().toLowerCase());
    return [...activeTags].every(tag => videoTags.includes(tag));
  });
}

// Now collect tags ONLY from visible videos
const visibleTags = new Set();
visibleVideos.forEach(v => {
  (v.tags || []).forEach(t => {
    if (t && typeof t === "string" && t.trim()) {
      visibleTags.add(t.trim().toLowerCase());
    }
  });
});

const sortedVisibleTags = [...visibleTags].sort();

// Define location keywords (expand as needed)
const locationKeywords = [
  "nigeria", "lagos", "abuja", "oyo", "kano", "rivers", "enugu", 
  "ghana", "accra", "naija", "lekki", "ikeja", "portharcourt", "ibadan"
  // Add more real ones you see in your data
];

const isFreeTonightMode = filterMode === "trending";

// Build tag buttons — skip location tags unless in Free Tonight mode
sortedVisibleTags.forEach(tag => {
  const lowerTag = tag.toLowerCase();
  const isLocationTag = locationKeywords.some(kw => lowerTag.includes(kw));

  // Hide location tag buttons completely outside Free Tonight tab
  if (isLocationTag && !isFreeTonightMode) return;

  const btn = document.createElement("button");
  btn.textContent = `#${tag}`;
  btn.dataset.tag = tag;
  Object.assign(btn.style, {
    padding: "6px 14px",
    borderRadius: "24px",
    fontSize: "12px",
    fontWeight: "600",
    background: activeTags.has(tag) ? "linear-gradient(135deg, #ff2e78, #ff5e9e)" : "rgba(255,46,120,0.2)",
    color: activeTags.has(tag) ? "#fff" : "#ff6ab6",
    border: "1px solid rgba(255,46,120,0.6)",
    cursor: "pointer",
    transition: "all 0.25s"
  });
  btn.onclick = () => {
    if (activeTags.has(tag)) activeTags.delete(tag);
    else activeTags.add(tag);
    renderCards(videosToRender);
  };
  tagContainer.appendChild(btn);
});
   
    // Filter videos
    let filtered = videosToRender.filter(v => {
      if (filterMode === "unlocked") return unlockedVideos.includes(v.id);
      if (filterMode === "trending") return v.isTrending === true;
      return true;
    });
    if (activeTags.size > 0) {
      filtered = filtered.filter(v => {
        const videoTags = (v.tags || []).map(t => (t || "").trim().toLowerCase());
        return [...activeTags].every(tag => videoTags.includes(tag));
      });
    }
     
    // === FIXED: SHUFFLE THE FILTERED LIST FOR RANDOM ORDER EVERY TIME ===
    filtered = filtered.sort(() => Math.random() - 0.5);

    // Empty state
    if (filtered.length === 0) {
      const empty = document.createElement("div");
      empty.textContent = "No one's on free tonight right now";
      empty.style.cssText = "grid-column:1/-1; text-align:center; padding:60px; color:#888; font-size:16px;";
      grid.appendChild(empty);
      return;
    }
    // Render cards
    filtered.forEach(video => {
      const isUnlocked = unlockedVideos.includes(video.id);
      const card = document.createElement("div");
      Object.assign(card.style, {
        position: "relative", aspectRatio: "9/16", borderRadius: "16px", overflow: "hidden",
        background: "#0f0a1a", cursor: "pointer", boxShadow: "0 4px 20px rgba(138,43,226,0.35)",
        transition: "transform 0.25s ease, box-shadow 0.25s ease",
        border: "1px solid rgba(138,43,226,0.4)"
      });
      card.onmouseenter = () => {
        card.style.transform = "scale(1.03)";
        card.style.boxShadow = "0 12px 32px rgba(255,0,242,0.5)";
      };
      card.onmouseleave = () => {
        card.style.transform = "scale(1)";
        card.style.boxShadow = "0 4px 20px rgba(138,43,226,0.35)";
      };
      const vidContainer = document.createElement("div");
      vidContainer.style.cssText = "width:100%; height:100%; position:relative; background:#000;";
      const videoEl = document.createElement("video");
      videoEl.muted = true; videoEl.loop = true; videoEl.preload = "metadata";
      videoEl.style.cssText = "width:100%; height:100%; object-fit:cover;";
      if (isUnlocked) {
        videoEl.src = video.previewClip || video.videoUrl || "";
        videoEl.load();
        vidContainer.onmouseenter = (e) => { e.stopPropagation(); videoEl.play().catch(() => {}); };
        vidContainer.onmouseleave = (e) => { e.stopPropagation(); videoEl.pause(); videoEl.currentTime = 0; };
      } else {
        const lock = document.createElement("div");
        lock.innerHTML = `
          <div style="position:absolute; inset:0; background:rgba(10,5,30,0.85);
                      display:flex; align-items:center; justify-content:center;">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C9.2 2 7 4.2 7 7V11H6C4.9 11 4 11.9 4 13V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V13C20 11.9 19.1 11 18 11H17V7C17 4.2 14.8 2 12 2ZM12 4C13.7 4 15 5.3 15 7V11H9V7C9 5.3 10.3 4 12 4Z" fill="#ff00f2"/>
            </svg>
          </div>`;
        vidContainer.appendChild(lock);
      }
      vidContainer.onclick = (e) => {
        e.stopPropagation();
        if (!isUnlocked) {
          showUnlockConfirm(video, () => {
            // Refresh unlockedVideos from localStorage
            unlockedVideos = JSON.parse(localStorage.getItem("userUnlockedVideos") || "[]");
            // Re-render cards (with new random order)
            renderCards(videos);
            // Show success notification
            showStarPopup("Video unlocked! 🎉", "success");
          });
          return;
        }
        openFullScreenVideo(video.videoUrl || "");
      };
      vidContainer.appendChild(videoEl);
      card.appendChild(vidContainer);
      // Info overlay
      const info = document.createElement("div");
      info.style.cssText = `
        position:absolute; bottom:0; left:0; right:0;
        background:linear-gradient(to top, rgba(15,10,26,0.95), transparent);
        padding:60px 12px 12px;
      `;
      const title = document.createElement("div");
      title.textContent = video.title || "Cute moment";
      title.style.cssText = "font-weight:700; font-size:14px; color:#e0b0ff; margin-bottom:4px;";
      const user = document.createElement("div");
      user.textContent = `@${video.uploaderName || "cutie"}`;
      user.style.cssText = "font-size:12px; color:#00ffea; font-weight:600; cursor:pointer;";
      user.onclick = (e) => {
        e.stopPropagation();
        if (video.uploaderId) {
          getDoc(doc(db, "users", video.uploaderId))
            .then(userSnap => {
              if (userSnap.exists()) {
                showSocialCard(userSnap.data());
              }
            })
            .catch(err => console.error("Failed to load user:", err));
        }
      };
// Inside renderCards function, replace the tagsEl creation with this:

const tagsEl = document.createElement("div");
tagsEl.style.cssText = "display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;";

// Decide if we're in Free Tonight / Trending mode
const isFreeTonightMode = filterMode === "trending";

// Only show location tags in Free Tonight mode
const displayedTags = (video.tags || []).filter(tag => {
  if (!tag || typeof tag !== "string") return false;
  const lowerTag = tag.trim().toLowerCase();

  // Check if this tag is a location
  const isLocation = locationKeywords.some(kw => lowerTag.includes(kw));

  // Hide location tags unless we're in Free Tonight mode
  return !isLocation || isFreeTonightMode;
});

// Render the remaining tags
displayedTags.forEach(t => {
  const span = document.createElement("span");
  span.textContent = `#${t.trim()}`;
  
  // Special style for location tags (only visible in Free Tonight mode)
  const lowerT = t.trim().toLowerCase();
  const isLocationTag = locationKeywords.some(kw => lowerT.includes(kw));

  span.style.cssText = `
    font-size:11px;
    padding:2px 8px;
    border-radius:10px;
    background: ${isLocationTag ? "rgba(0,255,234,0.3)" : "rgba(255,46,120,0.22)"};
    color: ${isLocationTag ? "#00ffea" : "#ff4d8a"};
    border: 1px solid ${isLocationTag ? "rgba(0,255,234,0.6)" : "rgba(255,46,120,0.6)"};
  `;
  
  tagsEl.appendChild(span);
});
info.append(title, user, tagsEl);
      card.appendChild(info);
      // Badge
      const badge = document.createElement("div");
      badge.textContent = isUnlocked ? "Unlocked ♡" : `${video.highlightVideoPrice || "?"} ⭐️`;
      Object.assign(badge.style, {
        position: "absolute", top: "12px", right: "12px",
        padding: "6px 12px", borderRadius: "12px",
        fontSize: "12px", fontWeight: "700", color: "#fff",
        background: isUnlocked ? "rgba(0,255,234,0.5)" : "linear-gradient(135deg, #ff00f2, #8a2be2)",
        boxShadow: isUnlocked ? "0 0 18px rgba(0,255,234,0.9)" : "0 0 14px rgba(255,0,242,0.7)",
        border: "1px solid rgba(255,255,255,0.3)",
        textShadow: "0 0 4px rgba(0,0,0,0.7)"
      });
      card.appendChild(badge);
      grid.appendChild(card);
    });
  }
  // Filter buttons
  unlockedBtn.onclick = () => {
    filterMode = filterMode === "unlocked" ? "all" : "unlocked";
    unlockedBtn.textContent = filterMode === "unlocked" ? "All Videos" : "Show Unlocked";
    unlockedBtn.style.background = filterMode === "unlocked"
      ? "linear-gradient(135deg, #ff00f2, #00ffea)"
      : "linear-gradient(135deg, #240046, #3c0b5e)";
    renderCards();
  };
trendingBtn.onclick = () => {
  filterMode = filterMode === "trending" ? "all" : "trending";

  // When in trending mode → show "All Videos" plain
  // When not → show "Free Tonight" + fiery gradient emoji only
  trendingBtn.innerHTML = filterMode === "trending"
    ? "Show All Videos"
    : 'Free Tonight <span style="background: linear-gradient(90deg, #ff3366, #ff6b6b, #ff9f1c); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-weight: 900;">🔥</span>';

  trendingBtn.style.background = filterMode === "trending"
    ? "linear-gradient(135deg, #00ffea, #8a2be2, #ff00f2)"
    : "linear-gradient(135deg, #8a2be2, #ff00f2)";

  renderCards();
};
  // SEARCH – live, case-insensitive, only username/chatId
  const searchInput = document.getElementById("highlightSearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const term = e.target.value.trim().toLowerCase();
      const searchTerm = term.startsWith("@") ? term.slice(1).trim() : term;
      grid.querySelectorAll("div[style*='aspectRatio']").forEach(card => {
        const userEl = card.querySelector("div[style*='color:#00ffea']");
        let username = userEl?.textContent || "";
        username = username.replace("@", "").trim().toLowerCase();
        const matches = !searchTerm || username.includes(searchTerm);
        card.style.display = matches ? "" : "none";
      });
    });
  }
  // Initial render
  renderCards();
  document.body.appendChild(modal);
  setTimeout(() => document.getElementById("highlightSearchInput")?.focus(), 300);
}

function showUnlockConfirm(video, onUnlockCallback) {
    document.querySelectorAll("video").forEach(v => v.pause());
    document.getElementById("unlockConfirmModal")?.remove();

    const modal = document.createElement("div");
    modal.id = "unlockConfirmModal";
    Object.assign(modal.style, {
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(0,0,0,0.93)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: "1000001",
        opacity: "1",
    });

    modal.innerHTML = `
        <div style="background:#111;padding:20px;border-radius:12px;text-align:center;color:#fff;max-width:320px;box-shadow:0 0 20px rgba(0,0,0,0.5);">
            <h3 style="margin-bottom:10px;font-weight:600;">Unlock "${video.title}"?</h3>
            <p style="margin-bottom:16px;">This will cost <b>${video.highlightVideoPrice} STRZ</b></p>
            <div style="display:flex;gap:12px;justify-content:center;">
                <button id="cancelUnlock" style="padding:8px 16px;background:#333;border:none;color:#fff;border-radius:8px;font-weight:500;">Cancel</button>
                <button id="confirmUnlock" style="padding:8px 16px;background:linear-gradient(90deg,#00ffea,#ff00f2,#8a2be2);border:none;color:#fff;border-radius:8px;font-weight:600;">Yes</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector("#cancelUnlock").onclick = () => modal.remove();

    modal.querySelector("#confirmUnlock").onclick = async () => {
        modal.remove();
        await unlockVideo(video);
    };
}

async function unlockVideo(video) {
    if (!currentUser?.uid) {
        return showGoldAlert("Login required");
    }

    if (currentUser.uid === video.uploaderId) {
        return showGoldAlert("You already own this clip");
    }

    const cost = Number(video.highlightVideoPrice) || 0;
    if (cost <= 0) {
        return showGoldAlert("Invalid price");
    }

    try {
        // ─── ATOMIC TRANSACTION ─────────────────────────────────────────────
        await runTransaction(db, async (tx) => {
            const buyerRef = doc(db, "users", currentUser.uid);
            const buyerSnap = await tx.get(buyerRef);
            if (!buyerSnap.exists()) throw new Error("Buyer account not found");

            const buyerData = buyerSnap.data();
            const buyerStars = buyerData?.stars || 0;

            if (buyerStars < cost) {
                throw new Error("NOT_ENOUGH_STRZ");
            }

            const uploaderRef = doc(db, "users", video.uploaderId);
            const uploaderSnap = await tx.get(uploaderRef);
            if (!uploaderSnap.exists()) throw new Error("Uploader not found");

            const highlightsRef = doc(db, "highlightVideos", video.uploaderId);
            const highlightsSnap = await tx.get(highlightsRef);
            if (!highlightsSnap.exists()) throw new Error("Highlights document not found");

            const highlightsData = highlightsSnap.data();
            const currentHighlights = highlightsData.highlights || [];

            const clipIndex = currentHighlights.findIndex(c => c.id === video.id);
            if (clipIndex === -1) throw new Error("Clip not found in array");

            const updatedClip = { ...currentHighlights[clipIndex] };
            updatedClip.unlockedBy = [...(updatedClip.unlockedBy || []), currentUser.uid];

            const updatedArray = [...currentHighlights];
            updatedArray[clipIndex] = updatedClip;

            tx.update(buyerRef, { stars: increment(-cost) });
            tx.update(uploaderRef, { stars: increment(cost) });
            tx.update(highlightsRef, {
                highlights: updatedArray,
                lastUploadAt: serverTimestamp()
            });

            tx.update(buyerRef, {
                unlockedVideos: arrayUnion(video.id)
            });
        });

        // ─── Success: Confetti explosion ────────────────────────────────────
        let unlocked = JSON.parse(localStorage.getItem("userUnlockedVideos") || "[]");
        if (!unlocked.includes(video.id)) {
            unlocked.push(video.id);
            localStorage.setItem("userUnlockedVideos", JSON.stringify(unlocked));
        }

        // Notification (non-blocking)
        try {
            await addDoc(collection(db, "notifications"), {
                type: "clip_purchased",
                title: "Your clip was unlocked!",
                message: `${currentUser.chatId || "Someone"} paid ${cost} STRZ for "${video.title}"`,
                videoId: video.id,
                videoTitle: video.title,
                buyerId: currentUser.uid,
                buyerName: currentUser.chatId || "Anonymous",
                recipientId: video.uploaderId,
                read: false,
                createdAt: serverTimestamp()
            });
        } catch (notifErr) {
            console.warn("Notification failed (non-critical):", notifErr);
        }

        // Slutty morphine confetti
        if (typeof confetti === "function") {
            confetti({
                particleCount: 220,
                spread: 100,
                startVelocity: 45,
                ticks: 200,
                origin: { y: 0.6 },
                colors: ['#FF1493', '#00FFEA', '#FF00F2', '#8A2BE2', '#FFD700', '#FF69B4', '#0FF'],
                zIndex: 2147483647
            });

            // Second burst for extra drip
            setTimeout(() => {
                confetti({
                    particleCount: 120,
                    angle: 60,
                    spread: 80,
                    origin: { x: 0.2, y: 0.7 },
                    colors: ['#FF1493', '#00FFEA', '#FF00F2', '#8A2BE2'],
                });
                confetti({
                    particleCount: 120,
                    angle: 120,
                    spread: 80,
                    origin: { x: 0.8, y: 0.7 },
                    colors: ['#FFD700', '#FF69B4', '#0FF'],
                });
            }, 150);
        }

        showGoldAlert(`You unlocked "${video.title}"!`);

        // Refresh UI
        document.getElementById("highlightsModal")?.remove();
        setTimeout(() => {
            if (typeof highlightsBtn?.click === 'function') highlightsBtn.click();
            if (typeof loadMyClips === 'function') loadMyClips();
        }, 600);

        if (typeof loadNotifications === "function") loadNotifications();

    } catch (error) {
        console.error("Unlock failed:", error);

        let userMessage = "Unlock failed — try again";

        if (error.message === "NOT_ENOUGH_STRZ") {
            userMessage = "Not enough STRZ to unlock this clip";
        } else if (error.message.includes("No document to update") || error.code === "not-found") {
            userMessage = "Clip not found or already processed";
        }

        showGoldAlert(userMessage);
    }
}
async function loadMyClips() {
    const grid = document.getElementById("myClipsGrid");
    const noMsg = document.getElementById("noClipsMessage");

    if (!grid || !currentUser?.uid) return;

    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:120px;color:#888;font-size:18px;">Loading clips...</div>`;

    try {
        const docRef = doc(db, "highlightVideos", currentUser.uid);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists() || !docSnap.data()?.highlights?.length) {
            grid.innerHTML = "";
            if (noMsg) noMsg.style.display = "block";
            return;
        }

        if (noMsg) noMsg.style.display = "none";
        grid.innerHTML = "";

        const highlights = docSnap.data().highlights || [];
        highlights.sort((a, b) => {
            const timeA = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
            const timeB = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
            return timeB - timeA;
        });

        highlights.forEach(v => {
            const videoSrc = v.videoUrl || "";
            const thumbnailSrc = v.thumbnailUrl || ""; // used as poster
            const price = Number(v.highlightVideoPrice) || 0;
            const unlocks = v.unlockedBy?.length || 0;
            const earnings = price * unlocks;

            const card = document.createElement("div");
            card.style.cssText = `
                background:#111;
                border-radius:16px;
                overflow:hidden;
                box-shadow:0 10px 30px rgba(0,0,0,0.6);
                border:1px solid #333;
                display:flex;
                flex-direction:column;
                height:220px;
                transition:transform 0.2s;
            `;

            card.innerHTML = `
                <div style="display:flex;height:100%;background:#0d0d0d;">
                    <!-- Left: Video preview – exact original zoom style -->
                    <div style="width:136px;flex-shrink:0;position:relative;overflow:hidden;background:#000;">
                        <video 
                            src="${videoSrc}"
                            muted loop playsinline
                            poster="${thumbnailSrc}"
                            style="
                                position: absolute;
                                top: 50%;
                                left: 50%;
                                width: 220%;
                                height: 220%;
                                object-fit: cover;
                                object-position: center;
                                transform: translate(-50%, -50%) scale(0.52);
                                filter: brightness(0.96);
                            ">
                        </video>
                        <div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(13,13,13,0.98),transparent 70%);pointer-events:none;"></div>
                        <div style="position:absolute;bottom:8px;left:10px;color:#00ff9d;font-size:9px;font-weight:800;letter-spacing:1.2px;text-shadow:0 0 8px #000;">
                            ▶ CLIP
                        </div>
                    </div>

                    <!-- Right side (unchanged) -->
                    <div style="flex:1;padding:14px 16px 60px 16px;position:relative;background:linear-gradient(90deg,#0f0f0f,#111 50%);display:flex;flex-direction:column;">
                        <div style="flex-grow:1;">
                            <div style="color:#fff;font-weight:800;font-size:14px;line-height:1.3;margin-bottom:6px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;text-overflow:ellipsis;">
                                ${v.title || "Untitled Drop"}
                            </div>
                            ${v.description ? `
                                <div style="color:#aaa;font-size:11px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;text-overflow:ellipsis;opacity:0.9;">
                                    ${v.description}
                                </div>
                            ` : ''}
                            <div style="color:#666;font-size:10px;margin-top:6px;opacity:0.7;">
                                ID: ${v.id.slice(-8)}
                            </div>
                        </div>

                        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;text-align:center;margin-top:10px;">
                            <div>
                                <div style="color:#888;font-size:9px;text-transform:uppercase;letter-spacing:0.8px;">Price</div>
                                <div style="color:#00ff9d;font-weight:900;font-size:12px;">${price} STRZ</div>
                            </div>
                            <div>
                                <div style="color:#888;font-size:9px;text-transform:uppercase;letter-spacing:0.8px;">Unlocks</div>
                                <div style="color:#00ffea;font-weight:900;font-size:13px;">${unlocks}x</div>
                            </div>
                            <div>
                                <div style="color:#888;font-size:9px;text-transform:uppercase;letter-spacing:0.8px;">Revenue</div>
                                <div style="color:#ff00ff;font-weight:900;font-size:13px;">${earnings} ⭐</div>
                            </div>
                        </div>

                        <button class="delete-clip-btn"
                                data-id="${v.id}"
                                data-title="${(v.title || 'Clip').replace(/"/g,'&quot;')}"
                                style="
                                  position:absolute;bottom:12px;right:12px;
                                  background:linear-gradient(90deg,#ff0099,#ff6600);
                                  border:none;color:#fff;
                                  padding:8px 14px;border-radius:10px;
                                  font-size:10px;font-weight:800;letter-spacing:0.6px;
                                  cursor:pointer;opacity:0.92;
                                  box-shadow:0 2px 12px rgba(255,0,100,0.4);
                                  transition:all .25s ease;
                                "
                                onmouseover="this.style.background='linear-gradient(90deg,#ff5500,#ff33aa)';this.style.transform='translateY(-2px)';this.style.opacity='1'"
                                onmouseout="this.style.background='linear-gradient(90deg,#ff0099,#ff6600)';this.style.transform='translateY(0)';this.style.opacity='0.92'">
                            DELETE
                        </button>
                    </div>
                </div>
            `;

            // Hover play – same as original
            const videos = card.querySelectorAll("video");
            card.addEventListener("mouseenter", () => {
                videos.forEach(vid => vid.play().catch(() => {}));
            });
            card.addEventListener("mouseleave", () => {
                videos.forEach(vid => {
                    vid.pause();
                    vid.currentTime = 0;
                });
            });

            grid.appendChild(card);
        });

        document.querySelectorAll(".delete-clip-btn").forEach(btn => {
            btn.onclick = () => showDeleteConfirm(btn.dataset.id, btn.dataset.title);
        });

    } catch (err) {
        console.error("loadMyClips error:", err);
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:80px;color:#f66;">Failed to load clips</div>`;
    }
}

function showDeleteConfirm(clipId, clipTitle) {
    const modal = document.createElement("div");
    modal.style.cssText = `
        position:fixed;inset:0;background:rgba(0,0,0,0.9);
        display:flex;align-items:center;justify-content:center;
        z-index:99999;font-family:system-ui,sans-serif;
    `;

    modal.innerHTML = `
        <div style="background:#111;padding:25px;border-radius:12px;text-align:center;color:#fff;max-width:320px;box-shadow:0 0 20px rgba(0,0,0,0.5);">
            <h3 style="color:#fff;margin:0 0 16px;font-size:20px;font-weight:600;">
                Delete Clip?
            </h3>
            <p style="color:#ccc;margin:0 0 24px;line-height:1.5;">
                "<strong style="color:#ff3366;">${clipTitle}</strong>" will be removed.<br>
                <small style="color:#999;">Buyers keep access forever.</small>
            </p>
            <div style="display:flex;gap:16px;justify-content:center;">
                <button id="cancelDelete" style="padding:8px 16px;background:#333;border:none;color:#fff;border-radius:8px;font-weight:500;cursor:pointer;">Cancel</button>
                <button id="confirmDelete" style="padding:8px 16px;background:linear-gradient(90deg,#ff0099,#ff6600);border:none;color:#fff;border-radius:8px;font-weight:600;cursor:pointer;">Yes, Delete</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Cancel → just close
    modal.querySelector("#cancelDelete").onclick = () => modal.remove();

    // Confirm delete
    modal.querySelector("#confirmDelete").onclick = async () => {
        try {
            const userDocRef = doc(db, "highlightVideos", currentUser.uid);
            const userDocSnap = await getDoc(userDocRef);

            if (!userDocSnap.exists()) {
                throw new Error("User highlights document not found");
            }

            const data = userDocSnap.data();
            const currentHighlights = data.highlights || [];

            // Remove the clip with matching id
            const updatedHighlights = currentHighlights.filter(clip => clip.id !== clipId);

            // Update document (array + counter)
            await updateDoc(userDocRef, {
                highlights: updatedHighlights,
                totalVideos: increment(-1),
                lastUploadAt: serverTimestamp()  // optional: update timestamp
            });

            showGoldAlert("Clip deleted successfully");
            modal.remove();
            if (typeof loadMyClips === 'function') loadMyClips(); // refresh grid

        } catch (err) {
            console.error("Delete error:", err);
            showGoldAlert("Failed to delete clip. Try again.");
            modal.remove();
        }
    };

    // Click outside to close
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
}

  // INVITE FOLKS!!!!!
document.getElementById('inviteFriendsToolBtn')?.addEventListener('click', () => {
  if (!currentUser?.chatId) {
    showGoldAlert('Error', 'User not loaded yet');
    return;
  }

  const chatId = currentUser.chatId || 'friend';
  const prettyHandle = chatId.startsWith('@') ? chatId : `@${chatId}`;
  const message = `Hey! join my Cube and let’s win some together! Sign up using my rare invite link: `;
  const link = `https://cube.xixi.live/sign-up?ref=${encodeURIComponent(prettyHandle)}`;
  const fullText = message + link;

  navigator.clipboard.writeText(fullText)
    .then(() => {
      showStarPopup('Copied!', 'Your invite link is ready to share!', 2500);
    })
    .catch(() => {
      showStarPopup('Error', 'Could not copy link — try again', 3000);
    });
});

/*********************************
 * REELS DATA
 *********************************/
const reelsData = [
  {
    videoUrl: "https://cdn.shopify.com/videos/c/o/v/3901931aca4f497f834b1a7d07d06f92.mp4",
    title: "Hot Dance Reel",
    description: "Turning up the heat with this fire routine 🔥 Who's joining next?",
    views: 42300
  },
  {
    videoUrl: "https://cdn.shopify.com/videos/c/o/v/ac4b7566814a497ca3d4b2309ff9fa5d.mp4",
    title: "Behind the Scenes",
    description: "Day in the life — prep, laughs, and real moments backstage 🎥",
    views: 18700
  },
  {
    videoUrl: "https://cdn.shopify.com/videos/c/o/v/31941326eb1745428c65ee9bb2a42e81.mp4",
    title: "Late Night Vibes",
    description: "Chill session after hours — just vibes and good energy 🌙",
    views: 105200
  },
  {
    videoUrl: "https://cdn.shopify.com/videos/c/o/v/eb50a3c972c642a48ceef0c8424679b9.mp4",
    title: "Exclusive Drop",
    description: "First look at tomorrow's surprise... you saw it here first 👀",
    views: 89100
  }
];

/*********************************
 * FORMAT VIEWS
 *********************************/
function formatViews(count) {
  if (count >= 1_000_000) return (count / 1_000_000).toFixed(1) + 'M';
  if (count >= 1_000) return (count / 1_000).toFixed(1) + 'K';
  return count.toString();
}

/*********************************
 * LOAD REELS
 *********************************/
function loadReels() {
  const gallery = document.getElementById('reelsGallery');
  if (!gallery) return;

  gallery.innerHTML = '';

  reelsData.forEach(reel => {
    gallery.insertAdjacentHTML('beforeend', `
      <div class="reel-item">
        <video
          src="${reel.videoUrl}"
          muted
          preload="metadata"
        ></video>

        <!-- BIG PLAY BUTTON (UNCHANGED) -->
        <div class="play-icon">▶</div>

        <div class="reel-overlay">
          <div class="reel-info">
            <div class="reel-views">
              ${formatViews(reel.views)} views
            </div>
            <div class="reel-title">${reel.title}</div>
            <div class="reel-description">${reel.description}</div>
          </div>
        </div>
      </div>
    `);
  });

  attachReelInteractions();
}

/*********************************
 * INTERACTIONS
 *********************************/
function attachReelInteractions() {
  document.querySelectorAll('.reel-item').forEach(item => {
    const video = item.querySelector('video');
    const playIcon = item.querySelector('.play-icon');
    if (!video || !playIcon) return;

    // Reset on load
    video.muted = true;
    playIcon.style.opacity = '1';

    /* Desktop hover preview (muted) */
    item.addEventListener('mouseenter', () => {
      video.muted = true;
      video.play().catch(() => {});
    });
    item.addEventListener('mouseleave', () => {
      video.pause();
      video.currentTime = 0;
      playIcon.style.opacity = '1';
    });

    /* MOBILE & DESKTOP: Tap anywhere on reel to play with sound */
    item.addEventListener('click', async (e) => {
      e.stopPropagation();

      try {
        // First play muted to "unlock" audio on iOS/Android
        video.muted = true;
        await video.play();

        // Then unmute and replay with sound
        video.muted = false;
        video.currentTime = 0;
        await video.play();

        // Hide play icon
        playIcon.style.opacity = '0';

        // Optional: Enter fullscreen on mobile
        if (video.requestFullscreen) {
          await video.requestFullscreen();
        } else if (video.webkitEnterFullscreen) { // iOS Safari
          await video.webkitEnterFullscreen();
        }
      } catch (err) {
        console.log('Play failed:', err);
        // Fallback: show play icon if blocked
        playIcon.style.opacity = '1';
      }
    });

    // Sync play icon visibility
    video.addEventListener('play', () => playIcon.style.opacity = '0');
    video.addEventListener('pause', () => playIcon.style.opacity = '1');
    video.addEventListener('ended', () => {
      playIcon.style.opacity = '1';
      video.currentTime = 0;
    });
  });
}

// Private Message Reader - Host Only
const privateMsgReader = document.getElementById('privateMsgReader');
const privateMessagesList = document.getElementById('privateMessagesList');
const privateMsgCount = document.getElementById('privateMsgCount');

let unreadCount = 0;

// Only show if current user is the host and isLive = true
if (currentUser && currentUser.isLive) {
  privateMsgReader.style.display = 'block';

  // Listen to private messages in real-time
  const q = query(
    collection(db, "privateLiveMessages"),
    orderBy("timestamp", "asc")
  );

  onSnapshot(q, (snapshot) => {
    privateMessagesList.innerHTML = '';
    unreadCount = 0;

    if (snapshot.empty) {
      privateMessagesList.innerHTML = '<p class="no-messages">No private messages yet... waiting for secrets ✨</p>';
      privateMsgCount.textContent = '0';
      return;
    }

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      unreadCount++;

      const msgEl = document.createElement('div');
      msgEl.className = 'private-message-item';
      msgEl.innerHTML = `
        <div class="msg-time">${data.timestamp ? new Date(data.timestamp.toDate()).toLocaleTimeString() : 'Just now'}</div>
        <div class="msg-text">${data.content || '💕'}</div>
      `;
      privateMessagesList.appendChild(msgEl);
    });

    privateMsgCount.textContent = unreadCount;
    privateMessagesList.scrollTop = privateMessagesList.scrollHeight;
  });
} else {
  privateMsgReader.style.display = 'none';
}

// ===== TIPS MODAL LOGIC =====
document.addEventListener("DOMContentLoaded", () => {
  const button = document.getElementById("topBallersBtn");
  if (!button) {
    console.error("Button #topBallersBtn not found");
    return;
  }
  button.addEventListener("click", openTipsModal);
  console.log("Tips button listener attached");
});

function openTipsModal() {
  console.log("openTipsModal called");

  // Clean up old modal
  let modal = document.getElementById("tipsModal");
  if (modal) {
    modal.remove();
    console.log("Old modal removed");
  }

  // Create modal (page-like feel)
  modal = document.createElement("div");
  modal.id = "tipsModal";
  modal.style.cssText = `
    position: fixed;
    inset: 0;
    background: #0a0a0a;
    z-index: 2147483647;
    display: flex;
    flex-direction: column;
    align-items: center;
    overflow-y: auto;
    pointer-events: auto;
    visibility: visible;
    opacity: 1;
    padding: 0;
    margin: 0;
  `;

modal.innerHTML = `
  <div style="
    width: 100%;
    max-width: 420px;
    background: #0a0a0a;
    color: #eee;
    font-family: system-ui, sans-serif;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    max-height: 100vh;
    overflow-y: auto;
  ">
    <!-- Header -->
    <div style="
      padding: 20px 16px 12px;
      text-align: center;
      background: linear-gradient(to bottom, rgba(195,246,12,0.10), transparent);
      border-bottom: 1px solid rgba(195,246,12,0.20);
    ">
      <h3 style="
        margin: 0;
        font-size: 20px;
        color: #c3f60c;
        font-weight: 900;
        letter-spacing: 0.8px;
        text-shadow: 0 0 8px rgba(195,246,12,0.4);
      ">TIPS</h3>
      <p style="margin: 8px 0 0; font-size: 14px; color: #eee; opacity: 0.9;">
        Level up • Slay • Get Paid
      </p>
    </div>

    <!-- Carousel / Content Pages -->
    <div id="tipsCarousel" style="position: relative; flex: 1; overflow: hidden; min-height: 300px;">
      <div id="tipsSlides" style="
        display: flex;
        width: 500%;  /* Updated for 5 cards */
        height: 100%;
        transition: transform 0.5s ease;
        transform: translateX(0%);
      ">
        <!-- Card 1: Welcome -->
        <div style="width: 20%; flex-shrink: 0; padding: 0 16px; box-sizing: border-box; display: flex; flex-direction: column;">
          <img src="https://images.unsplash.com/photo-1556155099-490a1ba16284?w=800&q=80" alt="Club Vibe" style="
            width: 100%;
            height: 160px;
            object-fit: cover;
            border-radius: 10px;
            margin: 16px 0 12px;
            border: 1px solid rgba(195,246,12,0.25);
          ">
          <h4 style="margin: 0 0 10px; color: #c3f60c; font-size: 17px; text-align: center;">Welcome to Cube</h4>
          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #ddd; text-align: center;">
            You’re not just joining another platform, you’re stepping into <strong>Cube</strong>, an invite-only club where <strong>you call the shots</strong>, build wealth on your terms, and live like the prize you are.
          </p>
        </div>

        <!-- Card 2: How You Make Bank on Cube -->
        <div style="width: 20%; flex-shrink: 0; padding: 0 16px; box-sizing: border-box; display: flex; flex-direction: column;">
          <img src="https://images.unsplash.com/photo-1556740714-a8395b3a74dd?w=800&q=80" alt="Earn STRZ" style="
            width: 100%;
            height: 160px;
            object-fit: cover;
            border-radius: 10px;
            margin: 16px 0 12px;
            border: 1px solid rgba(195,246,12,0.25);
          ">
          <h4 style="margin: 0 0 10px; color: #c3f60c; font-size: 17px; text-align: center;">How You Make Bank on Cube</h4>
          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #ddd; text-align: center;">
            Everything flows toward you quietly, naturally, without force.<br><br>
            <strong>1. VIP Invites</strong><br>
            You open your circle to a select few who recognize your worth.<br>
            Each one who steps in pays a premium to be close to you.<br>
            You receive a meaningful share immediately and again every month they stay.<br><br>
            <strong>2. Parties & Liveshows</strong><br>
            When you choose to step forward, Cube opens doors most never see.<br>
            Weekly liveshows and intimate Cube Nights become your stage.<br>
            Tips, hearts, and connections turn into real rewards — all on your terms.
          </p>
        </div>

        <!-- Card 3: Withdrawing Your Cash -->
        <div style="width: 20%; flex-shrink: 0; padding: 0 16px; box-sizing: border-box; display: flex; flex-direction: column;">
          <img src="https://images.unsplash.com/photo-1556740714-a8395b3a74dd?w=800&q=80" alt="Withdraw Cash" style="
            width: 100%;
            height: 160px;
            object-fit: cover;
            border-radius: 10px;
            margin: 16px 0 12px;
            border: 1px solid rgba(195,246,12,0.25);
          ">
          <h4 style="margin: 0 0 10px; color: #c3f60c; font-size: 17px; text-align: center;">Withdrawing Your Cash</h4>
          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #ddd; text-align: center;">
            Cash out your earnings easily and quickly.<br><br>
            Set up your bank account once — we support 33+ Nigerian banks, 15 South African banks, and 5 international options.<br><br>
            Withdrawals are processed fast — your money lands where it belongs: in your pocket.
          </p>
        </div>

        <!-- Card 4: Using Tools as a Host -->
        <div style="width: 20%; flex-shrink: 0; padding: 0 16px; box-sizing: border-box; display: flex; flex-direction: column;">
          <img src="https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&q=80" alt="Host Tools" style="
            width: 100%;
            height: 160px;
            object-fit: cover;
            border-radius: 10px;
            margin: 16px 0 12px;
            border: 1px solid rgba(195,246,12,0.25);
          ">
          <h4 style="margin: 0 0 10px; color: #c3f60c; font-size: 17px; text-align: center;">Using Tools as a Host</h4>
          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #ddd; text-align: center;">
            Unlock powerful features to grow your presence.<br><br>
            Schedule liveshows, pin important messages, manage VIPs, and control your room vibe.<br><br>
            The more you use the tools, the more Cube rewards you — visibility, earnings, and influence.
          </p>
        </div>

        <!-- Card 5: Daily Grind Conquests -->
        <div style="width: 20%; flex-shrink: 0; padding: 0 16px; box-sizing: border-box; display: flex; flex-direction: column;">
          <img src="https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&q=80" alt="Daily Grind" style="
            width: 100%;
            height: 160px;
            object-fit: cover;
            border-radius: 10px;
            margin: 16px 0 12px;
            border: 1px solid rgba(195,246,12,0.25);
          ">
          <h4 style="margin: 0 0 10px; color: #c3f60c; font-size: 17px; text-align: center;">Daily Grind Conquests</h4>
          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #ddd; text-align: center;">
            Your VIPs play TapMaster every day.<br><br>
            Every time they place in the top ranks, you receive your share automatically.<br><br>
            Their skill becomes your steady flow, building quietly month after month.<br><br>
            You’re not chasing money.<br>
            The money is chasing you.<br><br>
            That’s the quiet power of Cube.<br>
            No pressure. No performance.<br>
            Just elegant, effortless abundance — made for women who already know they’re the prize.
          </p>
        </div>
      </div>

      <!-- Dots - centered perfectly (now 5 dots) -->
      <div id="tipsDots" style="
        position: absolute;
        bottom: 16px;
        left: 0;
        right: 0;
        margin: 0 auto;
        width: fit-content;
        display: flex;
        justify-content: center;
        gap: 12px;
        z-index: 10;
      ">
        <div data-index="0" style="width:10px; height:10px; border-radius:50%; background:#c3f60c; cursor:pointer;"></div>
        <div data-index="1" style="width:10px; height:10px; border-radius:50%; background:rgba(195,246,12,0.3); cursor:pointer;"></div>
        <div data-index="2" style="width:10px; height:10px; border-radius:50%; background:rgba(195,246,12,0.3); cursor:pointer;"></div>
        <div data-index="3" style="width:10px; height:10px; border-radius:50%; background:rgba(195,246,12,0.3); cursor:pointer;"></div>
        <div data-index="4" style="width:10px; height:10px; border-radius:50%; background:rgba(195,246,12,0.3); cursor:pointer;"></div>
      </div>
    </div>

    <!-- Close button - always visible at bottom (smaller version) -->
    <div style="
      padding: 12px;
      text-align: center;
      background: rgba(0,0,0,0.7);
      border-top: 1px solid rgba(195,246,12,0.2);
      flex-shrink: 0;
    ">
      <button id="closeTipsBtn" style="
        padding: 10px 32px;
        border: none;
        border-radius: 10px;
        background: #c3f60c;
        color: #000;
        font-weight: 900;
        font-size: 14px;
        cursor: pointer;
        box-shadow: 0 3px 12px rgba(195,246,12,0.35);
      ">I'm Ready</button>
    </div>
  </div>
`;

  document.body.appendChild(modal);
  console.log("Modal appended to body");

  initTipsCarousel();

  // Close handler with confetti
  const closeBtn = modal.querySelector("#closeTipsBtn");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      console.log("Close button clicked");
      if (typeof confetti === "function") {
        confetti({
          particleCount: 180,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#FF1493', '#00e676', '#FFD700', '#FF69B4', '#0f9'],
          zIndex: 2147483647
        });
      }
      setTimeout(() => {
        modal.style.display = "none";
        modal.remove();
        console.log("Modal hidden & removed");
      }, 800);
    });
  }
}
function initTipsCarousel() {
  const slides = document.getElementById("tipsSlides");
  const dotsContainer = document.getElementById("tipsDots");
  if (!slides || !dotsContainer) {
    console.warn("Carousel elements missing");
    return;
  }

  const dots = dotsContainer.querySelectorAll("[data-index]");
  let current = 0;
  const total = dots.length;

  // Fade timeout reference
  let fadeTimeout = null;

  function update() {
    slides.style.transform = `translateX(-${current * 33.333}%)`;
    dots.forEach((dot, i) => {
      dot.style.background = i === current ? "#c3f60c" : "rgba(195,246,12,0.3)";
    });
    // Reset fade timer whenever update happens (swipe or click)
    resetFadeTimer();
  }

  function resetFadeTimer() {
    // Clear any existing timeout
    if (fadeTimeout) clearTimeout(fadeTimeout);
    // Show dots fully
    dotsContainer.style.opacity = "1";
    dotsContainer.style.transition = "opacity 0.4s ease";
    // Start fade-out after 2 seconds
    fadeTimeout = setTimeout(() => {
      dotsContainer.style.opacity = "0.13"; // almost invisible but still there
    }, 1800);
  }

  // Touch swipe
  let startX = 0;
  const carousel = document.getElementById("tipsCarousel");
  if (carousel) {
    carousel.addEventListener("touchstart", e => {
      startX = e.touches[0].clientX;
      // Show dots on touch
      resetFadeTimer();
    }, { passive: true });

    carousel.addEventListener("touchend", e => {
      const diff = startX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 60) {
        if (diff > 0 && current < total - 1) current++;
        else if (diff < 0 && current > 0) current--;
        update();
      }
      // Show dots again after swipe ends
      resetFadeTimer();
    }, { passive: true });
  }

  // Dot clicks
  dots.forEach((dot, index) => {
    dot.addEventListener("click", () => {
      current = index;
      update();
      // Show dots on click
      resetFadeTimer();
    });
  });

  // Initial update + start fade timer
  update();

  console.log("Carousel initialized with fade-out dots");
}
/*********************************
 * fruity punch!!
 *********************************/
let currentFruitSlide = 0;
const totalFruitSlides = 4;

function updateFruitCarousel() {
  document.getElementById("fruitSlides").style.transform = `translateX(-${currentFruitSlide * 25}%)`;
  
  document.querySelectorAll("#fruitDots .dot").forEach((dot, i) => {
    dot.classList.toggle("active", i === currentFruitSlide);
  });
}

// Touch/Swipe Support
let touchStartX = 0;
const carousel = document.getElementById("fruitCarousel");
carousel.addEventListener("touchstart", e => {
  touchStartX = e.touches[0].clientX;
});
carousel.addEventListener("touchend", e => {
  const touchEndX = e.changedTouches[0].clientX;
  const diff = touchStartX - touchEndX;
  if (Math.abs(diff) > 50) { // minimum swipe distance
    if (diff > 0 && currentFruitSlide < totalFruitSlides - 1) {
      currentFruitSlide++;
    } else if (diff < 0 && currentFruitSlide > 0) {
      currentFruitSlide--;
    }
    updateFruitCarousel();
  }
});

// Dot clicks
document.querySelectorAll("#fruitDots .dot").forEach(dot => {
  dot.addEventListener("click", () => {
    currentFruitSlide = parseInt(dot.dataset.slide);
    updateFruitCarousel();
  });
});

// Open & Close
document.getElementById("openFruitGuide").addEventListener("click", () => {
  currentFruitSlide = 0;
  updateFruitCarousel();
  document.getElementById("fruitGuideModal").style.display = "flex";
});

// Only the bottom button remains (top × is gone)
document.getElementById("closeFruitGuideBottom").addEventListener("click", () => {
  document.getElementById("fruitGuideModal").style.display = "none";
});

// Function to toggle host-only fields
function toggleHostFields() {
  const hostFields = document.getElementById("hostOnlyFields");
  if (!hostFields) return; // Safety check

  if (currentUser && currentUser.isHost === true) {
    hostFields.style.display = "block"; // Show for hosts
  } else {
    hostFields.style.display = "none"; // Hide for non-hosts
  }
}

// ——— NEW: EXPANDING INPUT (Grok-style) ———
// This replaces your old input, but uses your original send/buzz logic
const messageInput = document.getElementById("messageInput");

// Auto-resize and expand like Grok
function resizeAndExpand() {
  messageInput.style.height = "auto";
  messageInput.style.height = messageInput.scrollHeight + "px";
  document.getElementById("sendArea").classList.toggle("expanded", messageInput.scrollHeight > 60);
}
messageInput.addEventListener("input", resizeAndExpand);

// Enter = send (mobile & desktop), Shift+Enter = new line
messageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    refs.sendBtn.click();  // Triggers your original send logic
  }
});

// Make send button work on mobile tap
refs.sendBtn.addEventListener("touchend", (e) => {
  e.preventDefault();
  refs.sendBtn.click();
});

// Make buzz button work on mobile tap
refs.buzzBtn.addEventListener("touchend", (e) => {
  e.preventDefault();
  refs.buzzBtn.click();
});

// Initial resize
resizeAndExpand();

const paystackNigeriaBanks = [
  "Access Bank",
  "Access Bank (Diamond)",
  "Abbey Mortgage Bank",
  "Above Only MFB",
  "ALAT by Wema",
  "ASOSavings",
  "Bowen Microfinance Bank",
  "Carbon",
  "Citibank Nigeria",
  "Coronation Merchant Bank",
  "Ecobank Nigeria",
  "FairMoney Microfinance Bank",
  "Fidelity Bank",
  "First Bank of Nigeria",
  "First City Monument Bank (FCMB)",
  "Globus Bank",
  "Guaranty Trust Bank (GTBank)",
  "Heritage Bank",
  "Jaiz Bank",
  "Keystone Bank",
  "Kuda Bank",
  "Moniepoint MFB",
  "Opay",
  "PalmPay",
  "Parallex Bank",
  "Paycom (Opay)",
  "Polaris Bank",
  "PremiumTrust Bank",
  "Providus Bank",
  "Stanbic IBTC Bank",
  "Standard Chartered Bank",
  "Sterling Bank",
  "Suntrust Bank",
  "TAJ Bank",
  "Titan Trust Bank",
  "Union Bank of Nigeria",
  "United Bank for Africa (UBA)",
  "Unity Bank",
  "VFD Microfinance Bank",
  "Wema Bank",
  "Zenith Bank"
];

const bankSelect = document.getElementById("bankName");

paystackNigeriaBanks.forEach(bank => {
  const option = document.createElement("option");
  option.value = bank;
  option.textContent = bank;
  bankSelect.appendChild(option);
});
/*********************************
 * INIT
 *********************************/
