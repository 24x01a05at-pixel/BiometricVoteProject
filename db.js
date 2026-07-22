// Cloud Database Helper using keyvalue.immanuel.co for shared database across devices
const APP_KEY = "tbeuf3z3";
const BASE_URL = `https://keyvalue.immanuel.co/api/KeyVal`;

// Safe Base64 Helper for URL-safe path values in IIS
function encodeSafeBase64(str) {
    return btoa(unescape(encodeURIComponent(str)))
        .replace(/\//g, '_')
        .replace(/\+/g, '-')
        .replace(/=/g, '');
}

function decodeSafeBase64(str) {
    let base64 = str.replace(/_/g, '/').replace(/-/g, '+');
    while (base64.length % 4) {
        base64 += '=';
    }
    return decodeURIComponent(escape(atob(base64)));
}

async function getCloudValue(key) {
    try {
        const response = await fetch(`${BASE_URL}/GetValue/${APP_KEY}/${key}`);
        if (!response.ok) return null;
        const resText = await response.text();
        if (!resText || resText === "null") return null;
        const encodedVal = JSON.parse(resText);
        if (!encodedVal) return null;
        return decodeSafeBase64(encodedVal);
    } catch (e) {
        console.error("Read error:", e);
        return null;
    }
}

async function setCloudValue(key, valueStr) {
    try {
        const encodedVal = encodeSafeBase64(valueStr);
        const response = await fetch(`${BASE_URL}/UpdateValue/${APP_KEY}/${key}/${encodedVal}`, {
            method: 'POST',
            headers: {
                'Content-Length': '0'
            }
        });
        if (!response.ok) {
            throw new Error(`Write failed: ${response.status}`);
        }
    } catch (e) {
        console.error("Write error:", e);
    }
}

// Compress / Downscale image to fit 1024 limit
function compressImage(base64Str, maxWidth, maxHeight, quality) {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
            }
            if (height > maxHeight) {
                width = Math.round((width * maxHeight) / height);
                height = maxHeight;
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => {
            resolve(base64Str);
        };
    });
}

// Helper to get item from cloud DB
async function getDB(key, defaultValue) {
    try {
        if (key === 'voters') {
            const listStr = await getCloudValue('voters_list');
            if (listStr === null) {
                // Initialize empty voters list in cloud
                await setCloudValue('voters_list', '');
                localStorage.setItem('voters', JSON.stringify([]));
                return [];
            }
            const ids = listStr.split(',').filter(Boolean);
            const voters = [];
            for (const id of ids) {
                const voterStr = await getCloudValue(`voter_${id}`);
                if (voterStr) {
                    voters.push(JSON.parse(voterStr));
                }
            }
            localStorage.setItem('voters', JSON.stringify(voters));
            return voters;
        } else {
            const valStr = await getCloudValue(key);
            if (valStr === null) {
                // Initialize default value in cloud
                await setCloudValue(key, JSON.stringify(defaultValue));
                localStorage.setItem(key, JSON.stringify(defaultValue));
                return defaultValue;
            }
            localStorage.setItem(key, valStr);
            return JSON.parse(valStr);
        }
    } catch (err) {
        console.warn(`Failed to read key "${key}" from cloud DB. Using local cache.`, err);
        const local = localStorage.getItem(key);
        return local ? JSON.parse(local) : defaultValue;
    }
}

// Helper to write item to cloud DB
async function setDB(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        if (key === 'voters') {
            const ids = [];
            for (const voter of value) {
                ids.push(voter.id);
                let cloudVoter = { ...voter };
                if (cloudVoter.capture_path && cloudVoter.capture_path.length > 2000) {
                    cloudVoter.capture_path = await compressImage(cloudVoter.capture_path, 40, 40, 0.4);
                }
                await setCloudValue(`voter_${voter.id}`, JSON.stringify(cloudVoter));
            }
            await setCloudValue('voters_list', ids.join(','));
        } else {
            await setCloudValue(key, JSON.stringify(value));
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
