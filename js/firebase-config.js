// Firebase Configuration for SportsPools
const firebaseConfig = {
    apiKey: "AIzaSyCX4iNBxECRKOxmCU29Qh-F-8pmERcoEH0",
    authDomain: "clarkspools.firebaseapp.com",
    projectId: "clarkspools",
    storageBucket: "clarkspools.firebasestorage.app",
    messagingSenderId: "874688845770",
    appId: "1:874688845770:web:23896b6c917c3d7cbc2133"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize services
const auth = firebase.auth();
const db = firebase.firestore();

// ============================================
// AUTH HELPER FUNCTIONS
// ============================================

// Sign up with email/password
async function signUpWithEmail(email, password, displayName) {
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Update display name
        await user.updateProfile({ displayName: displayName });
        
        // Create user document in Firestore
        await db.collection('users').doc(user.uid).set({
            email: email,
            displayName: displayName,
            role: 'user', // Default role
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        return { success: true, user: user };
    } catch (error) {
        console.error('Signup error:', error);
        return { success: false, error: error.message };
    }
}

// Sign in with email/password
async function signInWithEmail(email, password) {
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        return { success: true, user: userCredential.user };
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, error: error.message };
    }
}

// Sign in with Google
async function signInWithGoogle() {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const userCredential = await auth.signInWithPopup(provider);
        const user = userCredential.user;
        
        // Check if user document exists, if not create it
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (!userDoc.exists) {
            await db.collection('users').doc(user.uid).set({
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                role: 'user',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        
        return { success: true, user: user };
    } catch (error) {
        console.error('Google login error:', error);
        return { success: false, error: error.message };
    }
}

// Sign out
async function signOut() {
    try {
        await auth.signOut();
        return { success: true };
    } catch (error) {
        console.error('Signout error:', error);
        return { success: false, error: error.message };
    }
}

// Password reset
async function sendPasswordReset(email) {
    try {
        await auth.sendPasswordResetEmail(email);
        return { success: true };
    } catch (error) {
        console.error('Password reset error:', error);
        return { success: false, error: error.message };
    }
}

// Get current user data from Firestore
async function getCurrentUserData() {
    const user = auth.currentUser;
    if (!user) return null;
    
    try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists) {
            return { uid: user.uid, ...userDoc.data() };
        }
        return null;
    } catch (error) {
        console.error('Error getting user data:', error);
        return null;
    }
}

// Check if current user is admin
async function isAdmin() {
    const userData = await getCurrentUserData();
    return userData && userData.role === 'admin';
}

// ============================================
// UI HELPER FUNCTIONS
// ============================================

// Get user initials for avatar
function getUserInitials(displayName) {
    if (!displayName) return '??';
    const names = displayName.trim().split(' ');
    if (names.length === 1) {
        return names[0].substring(0, 2).toUpperCase();
    }
    return (names[0][0] + names[names.length - 1][0]).toUpperCase();
}

// Update UI based on auth state
function updateAuthUI(user, userData) {
    const loginBtn = document.getElementById('loginBtn');
    const signupBtn = document.getElementById('signupBtn');
    const userMenu = document.getElementById('userMenu');
    const userAvatar = document.getElementById('userAvatar');
    const userName = document.getElementById('userName');
    const adminLink = document.getElementById('adminLink');
    
    if (user) {
        // User is logged in
        if (loginBtn) loginBtn.style.display = 'none';
        if (signupBtn) signupBtn.style.display = 'none';
        if (userMenu) userMenu.style.display = 'flex';
        
        const displayName = user.displayName || user.email.split('@')[0];
        if (userAvatar) userAvatar.textContent = getUserInitials(displayName);
        if (userName) userName.textContent = displayName;
        
        // Show admin link if user is admin
        if (adminLink) {
            adminLink.style.display = userData && userData.role === 'admin' ? 'block' : 'none';
        }
    } else {
        // User is logged out
        if (loginBtn) loginBtn.style.display = 'inline-flex';
        if (signupBtn) signupBtn.style.display = 'inline-flex';
        if (userMenu) userMenu.style.display = 'none';
        if (adminLink) adminLink.style.display = 'none';
    }
}

// Show error message
function showError(elementId, message) {
    const errorEl = document.getElementById(elementId);
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
    }
}

// Hide error message
function hideError(elementId) {
    const errorEl = document.getElementById(elementId);
    if (errorEl) {
        errorEl.style.display = 'none';
    }
}

// ============================================
// AUTH STATE LISTENER
// ============================================

// Listen for auth state changes
auth.onAuthStateChanged(async (user) => {
    if (user) {
        console.log('User logged in:', user.email);
        const userData = await getCurrentUserData();
        updateAuthUI(user, userData);
        
        // Dispatch custom event for page-specific handling
        window.dispatchEvent(new CustomEvent('userLoggedIn', { detail: { user, userData } }));
    } else {
        console.log('User logged out');
        updateAuthUI(null, null);
        
        // Dispatch custom event for page-specific handling
        window.dispatchEvent(new CustomEvent('userLoggedOut'));
    }
});

// ============================================
// FIRESTORE HELPER FUNCTIONS
// ============================================

// Get all pools
async function getPools() {
    try {
        const snapshot = await db.collection('pools').orderBy('createdAt', 'desc').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Error getting pools:', error);
        return [];
    }
}

// Get single pool
async function getPool(poolId) {
    try {
        const doc = await db.collection('pools').doc(poolId).get();
        if (doc.exists) {
            return { id: doc.id, ...doc.data() };
        }
        return null;
    } catch (error) {
        console.error('Error getting pool:', error);
        return null;
    }
}

// Create pool
async function createPoolInFirestore(poolData) {
    try {
        const user = auth.currentUser;
        if (!user) throw new Error('Must be logged in to create pool');
        
        const pool = {
            ...poolData,
            commissionerId: user.uid,
            commissionerName: user.displayName || user.email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'open',
            entryCount: 0
        };
        
        const docRef = await db.collection('pools').add(pool);
        return { success: true, poolId: docRef.id };
    } catch (error) {
        console.error('Error creating pool:', error);
        return { success: false, error: error.message };
    }
}

// Get entries for a pool
async function getPoolEntries(poolId) {
    try {
        const snapshot = await db.collection('pools').doc(poolId)
            .collection('entries')
            .orderBy('totalPoints', 'desc')
            .get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Error getting entries:', error);
        return [];
    }
}

// Submit entry
async function submitEntry(poolId, entryData) {
    try {
        const user = auth.currentUser;
        if (!user) throw new Error('Must be logged in to submit entry');
        
        const entry = {
            ...entryData,
            oderId: user.uid,
            userId: user.uid,
            userName: user.displayName || user.email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            totalPoints: 0,
            weekPoints: { wildCard: 0, divisional: 0, conference: 0, superBowl: 0 },
            paid: false
        };
        
        const docRef = await db.collection('pools').doc(poolId).collection('entries').add(entry);
        
        // Update pool entry count
        await db.collection('pools').doc(poolId).update({
            entryCount: firebase.firestore.FieldValue.increment(1)
        });
        
        return { success: true, entryId: docRef.id };
    } catch (error) {
        console.error('Error submitting entry:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// BETTING POOL FUNCTIONS
// ============================================

// Get user's betting bankroll for a pool
async function getUserBankroll(poolId) {
    try {
        const user = auth.currentUser;
        if (!user) return null;
        
        const doc = await db.collection('pools').doc(poolId)
            .collection('bankrolls').doc(user.uid).get();
        
        if (doc.exists) {
            return doc.data();
        }
        return null;
    } catch (error) {
        console.error('Error getting bankroll:', error);
        return null;
    }
}

// Initialize user bankroll for betting pool
async function initializeBankroll(poolId, startingAmount) {
    try {
        const user = auth.currentUser;
        if (!user) throw new Error('Must be logged in');
        
        await db.collection('pools').doc(poolId)
            .collection('bankrolls').doc(user.uid).set({
                oderId: user.uid,
                oderId: user.uid,
                userName: user.displayName || user.email,
                currentBankroll: startingAmount,
                startingBankroll: startingAmount,
                totalWagered: 0,
                totalWon: 0,
                totalLost: 0,
                record: { wins: 0, losses: 0, pushes: 0 },
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        
        return { success: true };
    } catch (error) {
        console.error('Error initializing bankroll:', error);
        return { success: false, error: error.message };
    }
}

// Place bet
async function placeBet(poolId, betData) {
    try {
        const user = auth.currentUser;
        if (!user) throw new Error('Must be logged in');
        
        const bet = {
            ...betData,
            oderId: user.uid,
            oderId: user.uid,
            userName: user.displayName || user.email,
            status: 'pending',
            result: null,
            payout: 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Add bet
        const docRef = await db.collection('pools').doc(poolId)
            .collection('bets').add(bet);
        
        // Update bankroll
        const bankrollRef = db.collection('pools').doc(poolId)
            .collection('bankrolls').doc(user.uid);
        
        await bankrollRef.update({
            currentBankroll: firebase.firestore.FieldValue.increment(-betData.wager),
            totalWagered: firebase.firestore.FieldValue.increment(betData.wager)
        });
        
        return { success: true, betId: docRef.id };
    } catch (error) {
        console.error('Error placing bet:', error);
        return { success: false, error: error.message };
    }
}

// Get user's bets for a pool
async function getUserBets(poolId) {
    try {
        const user = auth.currentUser;
        if (!user) return [];
        
        const snapshot = await db.collection('pools').doc(poolId)
            .collection('bets')
            .where('userId', '==', user.uid)
            .orderBy('createdAt', 'desc')
            .get();
        
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Error getting bets:', error);
        return [];
    }
}

// ============================================
// FUNCTION ALIASES (for compatibility)
// ============================================
const loginWithEmail = signInWithEmail;

console.log('Firebase initialized for SportsPools');
