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

function signatureToBase64(sigArray) {
    if (!sigArray || sigArray.length === 0) return "";
    const bytes = new Uint8Array(sigArray);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToSignature(base64Str) {
    if (!base64Str) return [];
    try {
        const binary = atob(base64Str);
        const sigArray = [];
        for (let i = 0; i < binary.length; i++) {
            sigArray.push(binary.charCodeAt(i));
        }
        return sigArray;
    } catch(e) {
        return [];
    }
}

function serializeVoter(voter) {
    const sigBase64 = signatureToBase64(voter.face_signature || []);
    const votedVal = voter.has_voted ? "1" : "0";
    return `${voter.id}|${voter.full_name}|${votedVal}|${sigBase64}`;
}

function deserializeVoter(rawStr) {
    const parts = rawStr.split('|');
    const id = parseInt(parts[0]);
    const full_name = parts[1];
    const has_voted = parts[2] === "1";
    const face_signature = base64ToSignature(parts[3] || "");
    
    let capture_path = null;
    try {
        const localVoters = JSON.parse(localStorage.getItem('voters') || '[]');
        const match = localVoters.find(v => v.id === id);
        if (match && match.capture_path) {
            capture_path = match.capture_path;
        }
    } catch(e) {}

    return {
        id,
        full_name,
        has_voted,
        face_signature,
        capture_path
    };
}

function serializeCandidate(cand) {
    const approvedVal = cand.approved ? "1" : "0";
    const tieVotedVal = cand.has_tie_voted ? "1" : "0";
    let logo = cand.logo_path || "static/symbols/nota.png";
    if (logo.startsWith("data:image")) {
        logo = "static/symbols/nota.png";
    }
    return `${cand.id}|${cand.name}|${cand.party_name}|${logo}|${cand.votes || 0}|${cand.tie_votes || 0}|${approvedVal}|${tieVotedVal}`;
}

function deserializeCandidate(rawStr) {
    const parts = rawStr.split('|');
    const id = parseInt(parts[0]);
    const name = parts[1];
    const party_name = parts[2];
    let logo_path = parts[3];
    const votes = parseInt(parts[4] || "0");
    const tie_votes = parseInt(parts[5] || "0");
    const approved = parts[6] === "1";
    const has_tie_voted = parts[7] === "1";

    try {
        const localCands = JSON.parse(localStorage.getItem('candidates') || '[]');
        const match = localCands.find(c => c.id == id);
        if (match && match.logo_path && match.logo_path.startsWith('data:image')) {
            logo_path = match.logo_path;
        }
    } catch(e) {}

    return {
        id,
        name,
        party_name,
        logo_path,
        votes,
        tie_votes,
        approved,
        has_tie_voted
    };
}

// Helper to get item from cloud DB
async function getDB(key, defaultValue) {
    try {
        if (key === 'voters') {
            const listStr = await getCloudValue('voters_list');
            if (listStr === null) {
                await setCloudValue('voters_list', '');
                localStorage.setItem('voters', JSON.stringify([]));
                return [];
            }
            const ids = listStr.split(',').filter(Boolean);
            const voters = [];
            for (const id of ids) {
                const voterStr = await getCloudValue(`voter_${id}`);
                if (voterStr) {
                    voters.push(deserializeVoter(voterStr));
                }
            }
            localStorage.setItem('voters', JSON.stringify(voters));
            return voters;
        } else if (key === 'candidates') {
            const listStr = await getCloudValue('candidates_list');
            if (listStr === null) {
                const ids = defaultValue.map(c => c.id);
                for (const c of defaultValue) {
                    const serialized = serializeCandidate(c);
                    await setCloudValue(`candidate_${c.id}`, serialized);
                }
                await setCloudValue('candidates_list', ids.join(','));
                localStorage.setItem('candidates', JSON.stringify(defaultValue));
                return defaultValue;
            }
            const ids = listStr.split(',').filter(Boolean);
            const candidates = [];
            for (const id of ids) {
                const candStr = await getCloudValue(`candidate_${id}`);
                if (candStr) {
                    candidates.push(deserializeCandidate(candStr));
                }
            }
            localStorage.setItem('candidates', JSON.stringify(candidates));
            return candidates;
        } else {
            const valStr = await getCloudValue(key);
            if (valStr === null) {
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
                const serialized = serializeVoter(voter);
                await setCloudValue(`voter_${voter.id}`, serialized);
            }
            await setCloudValue('voters_list', ids.join(','));
        } else if (key === 'candidates') {
            const ids = [];
            for (const cand of value) {
                ids.push(cand.id);
                const serialized = serializeCandidate(cand);
                await setCloudValue(`candidate_${cand.id}`, serialized);
            }
            await setCloudValue('candidates_list', ids.join(','));
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
