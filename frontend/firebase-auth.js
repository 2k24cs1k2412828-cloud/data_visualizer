// Firebase Authentication & Firestore User Management for QUBRIX
// Using Firebase modular / compatibility SDK loaded via CDN

const firebaseConfig = {
  apiKey: "AIzaSyAuR9XQrPDAil3dsGIpIFHzYxEachk8V8w",
  authDomain: "qubrix-6024c.firebaseapp.com",
  projectId: "qubrix-6024c",
  storageBucket: "qubrix-6024c.firebasestorage.app",
  messagingSenderId: "786001252663",
  appId: "1:786001252663:web:a2841164fe75640a2bcab2",
  measurementId: "G-P8134WGKEX"
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

let currentUserProfile = null;

// Auth State Listener
auth.onAuthStateChanged(async (user) => {
  if (user) {
    console.log("Logged in user:", user.uid, user.email);
    await loadUserProfile(user);
  } else {
    console.log("No user logged in");
    currentUserProfile = null;
    updateAuthUI(null);
  }
});

// Ensure user is on home / landing screen or dashboard appropriately
function redirectToHome() {
  closeAuthModal();
  closeOnboardingModal();
  // Ensure background is visible and smooth scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Load user profile from Firestore or trigger onboarding
async function loadUserProfile(user) {
  try {
    const docRef = db.collection('users').doc(user.uid);
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      currentUserProfile = docSnap.data();
      updateAuthUI(currentUserProfile);
      redirectToHome();
    } else {
      // First-time user: close auth modal and open onboarding
      closeAuthModal();
      openOnboardingModal(user);
    }
  } catch (err) {
    console.error("Error fetching user profile:", err);
    // In case of error (e.g. firestore rules in progress), fallback to basic auth info
    currentUserProfile = {
      uid: user.uid,
      email: user.email,
      firstName: user.displayName ? user.displayName.split(' ')[0] : 'User',
      lastName: user.displayName ? user.displayName.split(' ').slice(1).join(' ') : '',
      occupation: 'Working Professional',
      photoURL: user.photoURL || null
    };
    updateAuthUI(currentUserProfile);
    redirectToHome();
  }
}

// Update Top Navigation Bar with User Info
function updateAuthUI(profile) {
  const authNav = document.getElementById('authNavContainer');
  if (!authNav) return;

  if (profile) {
    const displayName = profile.firstName ? `${profile.firstName} ${profile.lastName || ''}`.trim() : (profile.username || profile.email);
    const initials = (profile.firstName ? profile.firstName[0] : (profile.email ? profile.email[0] : 'U')).toUpperCase();
    const avatarHtml = profile.photoURL 
      ? `<img src="${profile.photoURL}" alt="${displayName}" class="w-7 h-7 rounded-full object-cover border border-gray-200">`
      : `<div class="w-7 h-7 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs font-semibold">${initials}</div>`;

    authNav.innerHTML = `
      <div class="relative">
        <button id="userProfileBtn" onclick="toggleUserDropdown(event)" class="flex items-center space-x-2 py-1 px-2 rounded-md hover:bg-gray-100 transition border border-transparent hover:border-gray-200">
          ${avatarHtml}
          <div class="text-left hidden sm:flex flex-col">
            <span class="text-xs font-semibold text-gray-900 leading-tight max-w-[120px] truncate">${displayName}</span>
            <span class="text-[10px] text-gray-500 font-medium leading-none">${profile.occupation || 'Member'}</span>
          </div>
          <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-gray-400"></i>
        </button>

        <!-- Dropdown Menu -->
        <div id="userDropdownMenu" class="hidden absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg py-1.5 z-50">
          <div class="px-3.5 py-2 border-b border-gray-100">
            <div class="text-xs font-bold text-gray-900">${displayName}</div>
            <div class="text-[11px] text-gray-500 truncate">${profile.email || ''}</div>
            <div class="mt-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-700">
              ${profile.occupation || 'Working Professional'}
            </div>
          </div>
          <!-- View Profile & History -->
          <button onclick="openProfilePage()" class="w-full text-left px-3.5 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center space-x-2 transition border-b border-gray-100">
            <i data-lucide="user" class="w-3.5 h-3.5 text-gray-500"></i>
            <span>User Profile & Analysis History</span>
          </button>
          <button onclick="handleSignOut()" class="w-full text-left px-3.5 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center space-x-2 transition">
            <i data-lucide="log-out" class="w-3.5 h-3.5 text-red-500"></i>
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    `;
    lucide.createIcons();
  } else {
    // Guest state
    authNav.innerHTML = `
      <button onclick="openAuthModal('signin')" class="px-2 sm:px-3 py-1.5 rounded text-xs font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 transition whitespace-nowrap">
        Sign In
      </button>
      <button onclick="openAuthModal('signup')" class="hidden sm:inline-block px-3 py-1.5 rounded text-xs font-medium bg-gray-900 text-white hover:bg-black transition shadow-2xs whitespace-nowrap">
        Get Started
      </button>
    `;
    lucide.createIcons();
  }
}

// Toggle user profile dropdown
function toggleUserDropdown(e) {
  e.stopPropagation();
  const menu = document.getElementById('userDropdownMenu');
  if (menu) menu.classList.toggle('hidden');
}

document.addEventListener('click', () => {
  const menu = document.getElementById('userDropdownMenu');
  if (menu) menu.classList.add('hidden');
});

// Modal Controls
function openAuthModal(mode = 'signup') {
  const modal = document.getElementById('authModal');
  if (!modal) {
    console.error("authModal element not found!");
    return;
  }
  modal.classList.remove('hidden');
  switchAuthTab(mode);
}

function closeAuthModal() {
  const modal = document.getElementById('authModal');
  if (!modal) return;
  modal.classList.add('hidden');
}

function switchAuthTab(mode) {
  const signinTab = document.getElementById('tabAuthSignin');
  const signupTab = document.getElementById('tabAuthSignup');
  const signinForm = document.getElementById('authSigninForm');
  const signupForm = document.getElementById('authSignupForm');
  const modalTitle = document.getElementById('authModalTitle');

  if (mode === 'signin') {
    if (signinTab) signinTab.className = "flex-1 py-2 text-xs font-semibold text-gray-900 border-b-2 border-gray-900 text-center";
    if (signupTab) signupTab.className = "flex-1 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent text-center";
    if (signinForm) signinForm.classList.remove('hidden');
    if (signupForm) signupForm.classList.add('hidden');
    if (modalTitle) modalTitle.textContent = "Welcome back to QUBRIX";
  } else {
    if (signupTab) signupTab.className = "flex-1 py-2 text-xs font-semibold text-gray-900 border-b-2 border-gray-900 text-center";
    if (signinTab) signinTab.className = "flex-1 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent text-center";
    if (signupForm) signupForm.classList.remove('hidden');
    if (signinForm) signinForm.classList.add('hidden');
    if (modalTitle) modalTitle.textContent = "Create your QUBRIX account";
  }
}

// Google Sign-In Handler
async function handleGoogleSignIn() {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    const result = await auth.signInWithPopup(provider);
    console.log("Google sign-in success:", result.user);
  } catch (error) {
    console.error("Google sign-in error:", error);
    showAuthError(error.message);
  }
}

// Email/Password or Username Sign-In
async function handleEmailSignIn(e) {
  e.preventDefault();
  const identifier = document.getElementById('signinIdentifier').value.trim();
  const password = document.getElementById('signinPassword').value;
  const errorEl = document.getElementById('signinErrorMsg');
  errorEl.classList.add('hidden');

  try {
    let emailToUse = identifier;

    // If identifier is not an email (no '@'), look up email by username in firestore
    if (!identifier.includes('@')) {
      const usernameSnap = await db.collection('usernames').doc(identifier.toLowerCase()).get();
      if (!usernameSnap.exists) {
        throw new Error("No user found with username: " + identifier);
      }
      emailToUse = usernameSnap.data().email;
    }

    await auth.signInWithEmailAndPassword(emailToUse, password);
  } catch (error) {
    errorEl.textContent = error.message;
    errorEl.classList.remove('hidden');
  }
}

// Initial Email Signup (leads to onboarding modal)
async function handleEmailSignUp(e) {
  e.preventDefault();
  const username = document.getElementById('signupUsername').value.trim().toLowerCase();
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  const errorEl = document.getElementById('signupErrorMsg');
  errorEl.classList.add('hidden');

  if (username.length < 3) {
    errorEl.textContent = "Username must be at least 3 characters long.";
    errorEl.classList.remove('hidden');
    return;
  }

  try {
    // Check if username is already taken
    const usernameSnap = await db.collection('usernames').doc(username).get();
    if (usernameSnap.exists) {
      throw new Error("Username '@" + username + "' is already taken. Please pick another.");
    }

    // Create Firebase Auth user
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    const user = cred.user;

    // Attach temporary username to user object and open onboarding
    user._preselectedUsername = username;
    closeAuthModal();
    openOnboardingModal(user);
  } catch (error) {
    errorEl.textContent = error.message;
    errorEl.classList.remove('hidden');
  }
}

function openOnboardingModal(user) {
  const modal = document.getElementById('onboardingModal');
  if (!modal) return;
  modal.classList.remove('hidden');

  // Pre-fill fields if available from Google
  const firstNameInput = document.getElementById('onboardFirstName');
  const lastNameInput = document.getElementById('onboardLastName');
  const usernameInput = document.getElementById('onboardUsername');
  const previewImg = document.getElementById('avatarPreviewImg');
  const previewPlaceholder = document.getElementById('avatarPlaceholder');

  if (user && user.displayName) {
    const parts = user.displayName.split(' ');
    if (firstNameInput) firstNameInput.value = parts[0] || '';
    if (lastNameInput) lastNameInput.value = parts.slice(1).join(' ') || '';
  }

  if (user && user._preselectedUsername && usernameInput) {
    usernameInput.value = user._preselectedUsername;
    usernameInput.readOnly = true;
  } else if (usernameInput && user && user.email) {
    usernameInput.value = user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');
  }

  if (user && user.photoURL && previewImg && previewPlaceholder) {
    previewImg.src = user.photoURL;
    previewImg.classList.remove('hidden');
    previewPlaceholder.classList.add('hidden');
  }
}

function closeOnboardingModal() {
  const modal = document.getElementById('onboardingModal');
  if (!modal) return;
  modal.classList.add('hidden');
}

// Handle avatar upload / URL
function handleAvatarFileSelected(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (file.size > 2 * 1024 * 1024) {
    alert("Image must be smaller than 2MB.");
    return;
  }

  const reader = new FileReader();
  reader.onload = function(evt) {
    const base64Data = evt.target.result;
    const previewImg = document.getElementById('avatarPreviewImg');
    const previewPlaceholder = document.getElementById('avatarPlaceholder');
    previewImg.src = base64Data;
    previewImg.classList.remove('hidden');
    previewPlaceholder.classList.add('hidden');
    window._selectedAvatarBase64 = base64Data;
  };
  reader.readAsDataURL(file);
}

// Save complete profile to Firestore
async function handleCompleteOnboarding(e) {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return;

  const firstName = document.getElementById('onboardFirstName').value.trim();
  const lastName = document.getElementById('onboardLastName').value.trim();
  const occupation = document.getElementById('onboardOccupation').value;
  const username = document.getElementById('onboardUsername').value.trim().toLowerCase();
  const errorEl = document.getElementById('onboardErrorMsg');
  errorEl.classList.add('hidden');

  if (!firstName) {
    errorEl.textContent = "First name is required.";
    errorEl.classList.remove('hidden');
    return;
  }
  if (!username) {
    errorEl.textContent = "Username is required.";
    errorEl.classList.remove('hidden');
    return;
  }

  const submitBtn = document.getElementById('onboardSubmitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = "Setting up profile...";

  try {
    // If not preselected, check username uniqueness
    if (!user._preselectedUsername) {
      const usernameSnap = await db.collection('usernames').doc(username).get();
      if (usernameSnap.exists && usernameSnap.data().uid !== user.uid) {
        throw new Error("Username '@" + username + "' is already taken. Please choose another.");
      }
    }

    const photoURL = window._selectedAvatarBase64 || user.photoURL || null;

    const profileData = {
      uid: user.uid,
      email: user.email,
      username: username,
      firstName: firstName,
      lastName: lastName,
      occupation: occupation,
      photoURL: photoURL,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // Save profile document and claim username in parallel batch
    const batch = db.batch();
    batch.set(db.collection('users').doc(user.uid), profileData);
    batch.set(db.collection('usernames').doc(username), { uid: user.uid, email: user.email });
    await batch.commit();

    currentUserProfile = profileData;
    updateAuthUI(currentUserProfile);
    redirectToHome();
  } catch (error) {
    errorEl.textContent = error.message;
    errorEl.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Complete Setup & Launch QUBRIX";
  }
}

// Sign Out
async function handleSignOut() {
  try {
    await auth.signOut();
  } catch (err) {
    console.error("Sign-out error:", err);
  }
}

function showAuthError(msg) {
  const errorEl = document.getElementById('signinErrorMsg') || document.getElementById('signupErrorMsg');
  if (errorEl) {
    errorEl.textContent = msg;
    errorEl.classList.remove('hidden');
  } else {
    alert(msg);
  }
}

// =========================================================
// DEDICATED FULL-SCREEN PROFILE & ANALYSIS HISTORY WORKSPACE
// =========================================================

function openProfilePage() {
  const user = auth.currentUser;
  if (!user) {
    openAuthModal('signin');
    return;
  }

  // Navigate to dedicated full screen profile section
  if (typeof navigateToFeaturePage === 'function') {
    navigateToFeaturePage('profile');
  }

  populateFullProfileDetails();
  loadUserAnalysisHistory();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (window.lucide) lucide.createIcons();
}

function openProfileHistoryModal() {
  openProfilePage();
}

function closeProfileHistoryModal() {
  if (typeof returnToHome === 'function') {
    returnToHome();
  }
}

// Populate details on the Full Profile Page
function populateFullProfileDetails() {
  const user = auth.currentUser;
  const p = currentUserProfile || (user ? {
    uid: user.uid,
    email: user.email,
    firstName: user.displayName ? user.displayName.split(' ')[0] : 'User',
    lastName: user.displayName ? user.displayName.split(' ').slice(1).join(' ') : '',
    occupation: 'Working Professional',
    photoURL: user.photoURL || null
  } : {});

  const fullName = p.firstName ? `${p.firstName} ${p.lastName || ''}`.trim() : (p.username || user?.displayName || 'User');
  const initials = (p.firstName ? p.firstName[0] : (p.email ? p.email[0] : 'U')).toUpperCase();

  // Full Screen Elements
  const fullNameEl = document.getElementById('fullProfileFullName');
  const usernameEl = document.getElementById('fullProfileUsername');
  const emailEl = document.getElementById('fullProfileEmail');
  const roleBadgeEl = document.getElementById('fullProfileRoleBadge');
  const uidEl = document.getElementById('fullProfileUid');
  const fnInput = document.getElementById('fullEditFirstNameInput');
  const lnInput = document.getElementById('fullEditLastNameInput');
  const occSelect = document.getElementById('fullEditOccupationSelect');
  const avatarImg = document.getElementById('fullProfileAvatarImg');
  const avatarInitials = document.getElementById('fullProfileAvatarInitials');

  if (fullNameEl) fullNameEl.textContent = fullName;
  if (usernameEl) usernameEl.textContent = p.username ? `@${p.username}` : (user?.email ? `@${user.email.split('@')[0]}` : '@user');
  if (emailEl) emailEl.textContent = p.email || user?.email || '';
  if (roleBadgeEl) roleBadgeEl.textContent = p.occupation || 'Working Professional';
  if (uidEl) uidEl.value = p.uid || user?.uid || '';
  if (fnInput) fnInput.value = p.firstName || '';
  if (lnInput) lnInput.value = p.lastName || '';
  if (occSelect && p.occupation) occSelect.value = p.occupation;

  if (p.photoURL && avatarImg && avatarInitials) {
    avatarImg.src = p.photoURL;
    avatarImg.classList.remove('hidden');
    avatarInitials.classList.add('hidden');
  } else if (avatarImg && avatarInitials) {
    avatarImg.classList.add('hidden');
    avatarInitials.textContent = initials;
    avatarInitials.classList.remove('hidden');
  }

  // Also sync modal elements if any exist
  const modalNameEl = document.getElementById('profileModalFullName');
  const modalUserEl = document.getElementById('profileModalUsername');
  const modalEmailEl = document.getElementById('profileModalEmail');
  const modalRoleEl = document.getElementById('profileRoleBadge');
  const modalAvatarImg = document.getElementById('profileModalAvatarImg');
  const modalAvatarInitials = document.getElementById('profileModalAvatarInitials');
  const modalOccSelect = document.getElementById('editOccupationSelect');

  if (modalNameEl) modalNameEl.textContent = fullName;
  if (modalUserEl) modalUserEl.textContent = p.username ? `@${p.username}` : '';
  if (modalEmailEl) modalEmailEl.textContent = p.email || '';
  if (modalRoleEl) modalRoleEl.textContent = p.occupation || 'Professional';
  if (modalOccSelect && p.occupation) modalOccSelect.value = p.occupation;

  if (p.photoURL && modalAvatarImg && modalAvatarInitials) {
    modalAvatarImg.src = p.photoURL;
    modalAvatarImg.classList.remove('hidden');
    modalAvatarInitials.classList.add('hidden');
  } else if (modalAvatarImg && modalAvatarInitials) {
    modalAvatarImg.classList.add('hidden');
    modalAvatarInitials.textContent = initials;
    modalAvatarInitials.classList.remove('hidden');
  }
}

// Save Full Profile Changes
async function handleSaveFullProfileChanges() {
  const user = auth.currentUser;
  if (!user) return;

  const fnInput = document.getElementById('fullEditFirstNameInput');
  const lnInput = document.getElementById('fullEditLastNameInput');
  const occSelect = document.getElementById('fullEditOccupationSelect');
  const statusEl = document.getElementById('fullProfileUpdateStatus');
  const saveBtn = document.getElementById('saveProfileBtn');

  const newFn = fnInput ? fnInput.value.trim() : '';
  const newLn = lnInput ? lnInput.value.trim() : '';
  const newOcc = occSelect ? occSelect.value : 'Working Professional';

  if (saveBtn) saveBtn.disabled = true;

  try {
    await db.collection('users').doc(user.uid).update({
      firstName: newFn,
      lastName: newLn,
      occupation: newOcc,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    if (currentUserProfile) {
      currentUserProfile.firstName = newFn;
      currentUserProfile.lastName = newLn;
      currentUserProfile.occupation = newOcc;
    } else {
      currentUserProfile = {
        uid: user.uid,
        email: user.email,
        firstName: newFn,
        lastName: newLn,
        occupation: newOcc
      };
    }

    updateAuthUI(currentUserProfile);
    populateFullProfileDetails();

    if (statusEl) {
      statusEl.classList.remove('hidden');
      setTimeout(() => {
        statusEl.classList.add('hidden');
      }, 3500);
    }
  } catch (err) {
    console.error("Failed to update profile:", err);
    alert("Error updating profile: " + err.message);
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

// Edit Full Profile Avatar
async function handleFullProfileAvatarSelected(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (file.size > 2 * 1024 * 1024) {
    alert("Profile image must be smaller than 2MB.");
    return;
  }

  const reader = new FileReader();
  reader.onload = async function(evt) {
    const base64Data = evt.target.result;
    const user = auth.currentUser;
    if (!user) return;

    try {
      await db.collection('users').doc(user.uid).update({
        photoURL: base64Data,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      if (currentUserProfile) {
        currentUserProfile.photoURL = base64Data;
      }
      updateAuthUI(currentUserProfile);
      populateFullProfileDetails();
    } catch (err) {
      console.error("Failed to update avatar:", err);
      alert("Error saving profile photo: " + err.message);
    }
  };
  reader.readAsDataURL(file);
}

// Edit Profile Avatar (Modal compatible)
async function handleEditAvatarSelected(e) {
  await handleFullProfileAvatarSelected(e);
}

// Update Occupation
async function handleUpdateOccupation(e) {
  const newOcc = e.target.value;
  const user = auth.currentUser;
  if (!user) return;

  try {
    await db.collection('users').doc(user.uid).update({
      occupation: newOcc,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    if (currentUserProfile) {
      currentUserProfile.occupation = newOcc;
    }
    updateAuthUI(currentUserProfile);
    populateFullProfileDetails();
  } catch (err) {
    console.error("Failed to update occupation:", err);
  }
}

// Save Analysis Report to Firestore User History (Completely Free & Compact)
async function recordAnalysisInHistory(filename, datasetData) {
  const user = auth.currentUser;
  if (!user || !datasetData) {
    console.log("No authenticated user or data to save to history.");
    return;
  }

  try {
    const inv = datasetData.investigations || {};
    const shape = inv.shape || {};
    const quality = inv.data_quality_leakage || {};
    const missing = inv.missing_values || {};
    const target = inv.target_distribution || {};

    const memoryFormatted = shape.memory_bytes 
      ? (shape.memory_bytes > 1024 * 1024 ? (shape.memory_bytes / (1024 * 1024)).toFixed(1) + ' MB' : (shape.memory_bytes / 1024).toFixed(1) + ' KB')
      : 'N/A';

    const summaryRecord = {
      uid: user.uid,
      filename: filename || 'dataset.csv',
      rows: Number(shape.rows) || 0,
      columns: Number(shape.columns) || 0,
      memorySize: memoryFormatted,
      qualityScore: Number(quality.cleanliness_score) || 100,
      missingPct: Number(missing.total_missing_pct) || 0,
      targetCol: target.column || datasetData.target_col || 'None',
      targetTask: target.task_type || 'N/A',
      timestampMs: Date.now(),
      analyzedDateStr: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    };

    console.log("Saving analysis record to Firestore:", summaryRecord);
    
    // Store in users/{uid}/history subcollection
    const docRef = await db.collection('users').doc(user.uid).collection('history').add(summaryRecord);
    console.log("Successfully saved analysis history document ID:", docRef.id);
  } catch (err) {
    console.error("Firestore history save error:", err);
  }
}

// Load and Render History in Full Profile Page & Modal
async function loadUserAnalysisHistory() {
  const fullContainer = document.getElementById('fullProfileHistoryListContainer');
  const modalContainer = document.getElementById('historyListContainer');
  if (!fullContainer && !modalContainer) return;

  const user = auth.currentUser;
  if (!user) {
    const guestMsg = `<div class="text-xs text-gray-500 text-center py-6">Sign in to view your analysis history.</div>`;
    if (fullContainer) fullContainer.innerHTML = guestMsg;
    if (modalContainer) modalContainer.innerHTML = guestMsg;
    return;
  }

  const loadingMsg = `<div class="text-xs text-gray-400 text-center py-8">Loading your dataset history...</div>`;
  if (fullContainer) fullContainer.innerHTML = loadingMsg;
  if (modalContainer) modalContainer.innerHTML = loadingMsg;

  try {
    // Query history without requiring a composite index
    const snap = await db.collection('users').doc(user.uid).collection('history').get();

    if (snap.empty) {
      const emptyHtml = `
        <div class="text-center py-12 border border-dashed border-gray-200 rounded-xl p-8 bg-gray-50/50">
          <i data-lucide="file-question" class="w-10 h-10 text-gray-300 mx-auto mb-3"></i>
          <p class="text-sm font-semibold text-gray-800">No datasets analyzed yet</p>
          <p class="text-xs text-gray-500 mt-1 max-w-sm mx-auto">Upload any CSV in our workspaces to automatically keep track of exploratory audits and model-readiness metrics.</p>
          <button type="button" onclick="returnToHome()" class="mt-4 px-4 py-2 rounded-lg bg-gray-900 hover:bg-black text-white text-xs font-semibold shadow-xs">
            Start Your First Analysis
          </button>
        </div>
      `;
      if (fullContainer) fullContainer.innerHTML = emptyHtml;
      if (modalContainer) modalContainer.innerHTML = emptyHtml;

      const statCount = document.getElementById('statDatasetsCount');
      const statAvg = document.getElementById('statAvgCleanliness');
      const statRows = document.getElementById('statTotalRecords');
      if (statCount) statCount.textContent = "0";
      if (statAvg) statAvg.textContent = "100/100";
      if (statRows) statRows.textContent = "0";

      if (window.lucide) lucide.createIcons();
      return;
    }

    // Sort client-side by timestampMs descending
    const docs = [];
    let totalRows = 0;
    let totalQuality = 0;

    snap.forEach(doc => {
      const item = { id: doc.id, ...doc.data() };
      docs.push(item);
      totalRows += (item.rows || 0);
      totalQuality += (item.qualityScore || 100);
    });
    docs.sort((a, b) => (b.timestampMs || 0) - (a.timestampMs || 0));

    // Update Stats Summary Cards
    const avgScore = docs.length > 0 ? Math.round(totalQuality / docs.length) : 100;
    const statCount = document.getElementById('statDatasetsCount');
    const statAvg = document.getElementById('statAvgCleanliness');
    const statRows = document.getElementById('statTotalRecords');
    if (statCount) statCount.textContent = docs.length.toString();
    if (statAvg) statAvg.textContent = `${avgScore}/100`;
    if (statRows) statRows.textContent = totalRows.toLocaleString();

    let html = '';
    docs.slice(0, 50).forEach(d => {
      const scoreBadge = `
        <span class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200 font-mono">
          ${d.qualityScore}/100 Score
        </span>
      `;
      html += `
        <div class="border border-gray-200 rounded-xl p-4 bg-white hover:border-gray-300 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div class="flex items-center space-x-3 min-w-0">
            <div class="w-10 h-10 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-700 shrink-0">
              <i data-lucide="file-spreadsheet" class="w-5 h-5"></i>
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center space-x-2">
                <span class="text-sm font-bold text-gray-900 truncate max-w-[200px] sm:max-w-md">${d.filename}</span>
                <span class="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded whitespace-nowrap">
                  ${(d.rows || 0).toLocaleString()} × ${d.columns || 0}
                </span>
              </div>
              <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-gray-500">
                <span class="font-medium text-gray-700">${d.analyzedDateStr || 'Recently'}</span>
                <span>•</span>
                <span>Size: <span class="font-mono text-gray-600">${d.memorySize || 'N/A'}</span></span>
                <span>•</span>
                <span class="truncate max-w-[140px]">Target: <span class="text-gray-800 font-semibold">${d.targetCol || 'None'}</span></span>
                <span>•</span>
                <span>Nulls: <span class="font-mono">${d.missingPct || 0}%</span></span>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between sm:flex-col sm:items-end border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-100 shrink-0">
            ${scoreBadge}
            <div class="text-[10px] text-gray-400 font-medium mt-1">Audit Record</div>
          </div>
        </div>
      `;
    });

    if (fullContainer) fullContainer.innerHTML = html;
    if (modalContainer) modalContainer.innerHTML = html;
    if (window.lucide) lucide.createIcons();
  } catch (err) {
    console.error("Error loading analysis history:", err);
    const errHtml = `<div class="text-xs text-red-500 text-center py-6">Failed to load history: ${err.message}</div>`;
    if (fullContainer) fullContainer.innerHTML = errHtml;
    if (modalContainer) modalContainer.innerHTML = errHtml;
  }
}
