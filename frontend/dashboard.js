import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';

const firebaseConfig = {
    apiKey: "AIzaSyDy7BCBM_WnfjLffKOQDup-Y6jRC_RoePA",
    authDomain: "everyotherday-db39f.firebaseapp.com",
    databaseURL: "https://everyotherday-db39f-default-rtdb.firebaseio.com",
    projectId: "everyotherday-db39f",
    storageBucket: "everyotherday-db39f.firebasestorage.app",
    messagingSenderId: "879562247905",
    appId: "1:879562247905:web:afa33c4295e4db98d3f1a0",
    measurementId: "G-Y6Z2ZDNJQW"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();

function renderActivityChart() {
    const grid = document.getElementById('heatmap-grid');
    if (!grid) return;

    grid.innerHTML = '';

    // Generate 52 weeks * 7 days = 364 cells
    const totalCells = 52 * 7;

    for (let i = 0; i < totalCells; i++) {
        const cell = document.createElement('div');
        cell.className = 'heat-cell';

        // Randomly assign levels for visualization
        const rand = Math.random();
        if (rand > 0.95) cell.classList.add('level-4');
        else if (rand > 0.85) cell.classList.add('level-3');
        else if (rand > 0.7) cell.classList.add('level-2');
        else if (rand > 0.5) cell.classList.add('level-1');

        // Add tooltip info (mock date)
        const date = new Date();
        date.setDate(date.getDate() - (totalCells - i));
        cell.title = `${date.toLocaleDateString()}: ${Math.floor(Math.random() * 10)} activities`;

        grid.appendChild(cell);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const backBtn = document.getElementById('back-home-btn');
    const logoutBtnSmall = document.getElementById('signout-btn');

    const userPhotoSmall = document.getElementById('user-photo');
    const userNameHeader = document.getElementById('user-name-header');

    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }

    const handleSignout = () => {
        auth.signOut().then(() => {
            window.location.href = 'index.html';
        });
    };

    if (logoutBtnSmall) logoutBtnSmall.addEventListener('click', handleSignout);

    auth.onAuthStateChanged((user) => {
        if (user) {
            const photoURL = user.photoURL || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
            if (userPhotoSmall) userPhotoSmall.src = photoURL;
            if (userNameHeader) userNameHeader.textContent = user.displayName || 'Tobi Awolaju';

            renderActivityChart();
        } else {
            // Redirect to home if not logged in
            window.location.href = 'index.html';
        }
    });
});
