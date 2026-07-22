// Cloud Database Helper using kvdb.io for shared database across devices
const BUCKET_ID = "kv_biometric_vote_eb3c2f7c73";
const BASE_URL = `https://kvdb.io/${BUCKET_ID}`;

// Helper to get item from cloud DB with fallback to localStorage
async function getDB(key, defaultValue) {
    try {
        const response = await fetch(`${BASE_URL}/${key}`);
        if (response.status === 404) {
            // Write default value to cloud on first access
            await setDB(key, defaultValue);
            return defaultValue;
        }
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const text = await response.text();
        const data = JSON.parse(text);
        localStorage.setItem(key, JSON.stringify(data)); // update local cache
        return data;
    } catch (err) {
        console.warn(`Failed to read key "${key}" from cloud DB. Using local cache.`, err);
        const local = localStorage.getItem(key);
        return local ? JSON.parse(local) : defaultValue;
    }
}

// Helper to write item to cloud DB
async function setDB(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value)); // save local copy
        const response = await fetch(`${BASE_URL}/${key}`, {
            method: 'POST',
            body: JSON.stringify(value),
            headers: {
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    } catch (err) {
        console.error(`Failed to write key "${key}" to cloud DB:`, err);
    }
}

// Show a loading overlay on the screen during cloud operations
function showSpinner(text = "Communicating with secure cloud ledger...") {
    let overlay = document.getElementById('cloud-db-spinner-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'cloud-db-spinner-overlay';
        overlay.style = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(3, 7, 18, 0.85);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            z-index: 99999;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: #22d3ee;
            font-family: 'Outfit', sans-serif;
        `;
        overlay.innerHTML = `
            <div class="spinner-border text-info mb-3" style="width: 3.5rem; height: 3.5rem;" role="status"></div>
            <h4 class="fw-bold mb-1" id="cloud-spinner-title">Connecting...</h4>
            <p class="text-secondary small">Do not close this window</p>
        `;
        document.body.appendChild(overlay);
    }
    document.getElementById('cloud-spinner-title').innerText = text;
    overlay.style.display = 'flex';
}

function hideSpinner() {
    const overlay = document.getElementById('cloud-db-spinner-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}
