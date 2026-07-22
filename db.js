// Cloud Database Helper using api.restful-api.dev for shared database across devices
const DB_ID = "ff8081819f7e10ae019f8af5d42f1557";
const BASE_URL = `https://api.restful-api.dev/objects/${DB_ID}`;

// Helper to get item from cloud DB
async function getDB(key, defaultValue) {
    try {
        const response = await fetch(BASE_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        const state = data.data || {};
        if (state[key] !== undefined) {
            localStorage.setItem(key, JSON.stringify(state[key])); // update local cache
            return state[key];
        }
        
        // Write default value back to cloud if key doesn't exist
        state[key] = defaultValue;
        await saveFullState(state);
        localStorage.setItem(key, JSON.stringify(defaultValue));
        return defaultValue;
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
        
        // 1. Fetch current full state first
        const response = await fetch(BASE_URL);
        if (!response.ok) throw new Error("Fetch state failed");
        const data = await response.json();
        const state = data.data || {};
        
        // 2. Modify key
        state[key] = value;
        
        // 3. Save full state back
        await saveFullState(state);
    } catch (err) {
        console.error(`Failed to write key "${key}" to cloud DB:`, err);
    }
}

async function saveFullState(state) {
    const response = await fetch(BASE_URL, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: "BiometricVoteData_Prod",
            data: state
        })
    });
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
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
