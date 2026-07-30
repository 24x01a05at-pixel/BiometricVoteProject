// Cloud Database Helper using jsonblob.com for shared database across devices
const BLOB_ID = "019fb2b6-0ee6-7bdd-b5c0-e2d8fc17a77b";
const BASE_URL = `https://jsonblob.com/api/jsonBlob/${BLOB_ID}`;

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
    const response = await fetch(BASE_URL);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Cloud error ${response.status}`);
    const dbObj = await response.json();
    hideOfflineWarningBadge();
    if (!dbObj || dbObj[key] === undefined || dbObj[key] === null) return null;
    
    const val = dbObj[key];
    if (typeof val === 'string') {
        try {
            return decodeSafeBase64(val);
        } catch (e) {
            return val;
        }
    } else {
        return JSON.stringify(val);
    }
}

async function setCloudValue(key, valueStr) {
    // 1. Fetch current database object
    const getResponse = await fetch(BASE_URL);
    if (!getResponse.ok) {
        throw new Error(`Failed to fetch database for update: ${getResponse.status}`);
    }
    const dbObj = await getResponse.json();
    
    // 2. Safely store as object if it is valid JSON, otherwise store as base64 string
    try {
        dbObj[key] = JSON.parse(valueStr);
    } catch (e) {
        dbObj[key] = encodeSafeBase64(valueStr);
    }
    
    // 3. PUT the updated database object back to jsonblob
    const putResponse = await fetch(BASE_URL, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(dbObj)
    });
    if (!putResponse.ok) {
        throw new Error(`Write failed: ${putResponse.status}`);
    }
    hideOfflineWarningBadge();
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
    const leftBase64 = signatureToBase64(voter.left_signature || []);
    const rightBase64 = signatureToBase64(voter.right_signature || []);
    const votedVal = voter.has_voted ? "1" : "0";
    const age = voter.age || "";
    const gender = voter.gender || "";
    return `${voter.id}|${voter.full_name}|${votedVal}|${sigBase64}|${leftBase64}|${rightBase64}|${age}|${gender}`;
}

function deserializeVoter(rawStr) {
    const parts = rawStr.split('|');
    const id = parseInt(parts[0]);
    const full_name = parts[1];
    const has_voted = parts[2] === "1";
    const face_signature = base64ToSignature(parts[3] || "");
    const left_signature = parts[4] ? base64ToSignature(parts[4]) : [];
    const right_signature = parts[5] ? base64ToSignature(parts[5]) : [];
    const age = parts[6] || "";
    const gender = parts[7] || "";
    
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
        left_signature,
        right_signature,
        age,
        gender,
        capture_path
    };
}

function serializeCandidate(cand) {
    const approvedVal = cand.approved ? "1" : "0";
    const tieVotedVal = cand.has_tie_voted ? "1" : "0";
    let logo = cand.logo_path || "placeholder";
    if (logo.startsWith("data:image")) {
        logo = "placeholder";
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

// Global Candidate Logo Renderer Helper
function getCandidateLogoHtml(logoPath, className = "cand-thumb") {
    if (logoPath && logoPath !== 'placeholder') {
        return `<img src="${logoPath}" class="${className}" alt="Logo">`;
    }
    return `
        <div class="${className} d-inline-flex align-items-center justify-content-center bg-light border rounded" style="aspect-ratio: 1/1; vertical-align: middle; min-width: 40px;">
            <i class="bi bi-award-fill text-muted" style="font-size: 1.25rem;"></i>
        </div>
    `;
}

// Helper to get item from cloud DB
async function getDB(key, defaultValue) {
    try {
        if (key === 'voters') {
            const listStr = await getCloudValue('voters_list');
            if (listStr === null) {
                const local = localStorage.getItem('voters');
                if (local !== null && JSON.parse(local).length > 0) {
                    const localVoters = JSON.parse(local);
                    try {
                        const ids = [];
                        for (const voter of localVoters) {
                            ids.push(voter.id);
                            await setCloudValue(`voter_${voter.id}`, serializeVoter(voter));
                        }
                        await setCloudValue('voters_list', ids.join(','));
                    } catch(e) {}
                    return localVoters;
                }
                try {
                    await setCloudValue('voters_list', '');
                } catch(e) {}
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
            
            // Bidirectional voter cache merge
            const local = localStorage.getItem('voters');
            let mergedVoters = voters;
            if (local !== null) {
                const localVoters = JSON.parse(local);
                const mergedMap = new Map();
                localVoters.forEach(v => { if (v && v.id) mergedMap.set(v.id, v); });
                voters.forEach(v => { if (v && v.id) mergedMap.set(v.id, v); });
                mergedVoters = Array.from(mergedMap.values());
                
                if (mergedVoters.length > voters.length) {
                    try {
                        const newIds = [];
                        for (const voter of mergedVoters) {
                            newIds.push(voter.id);
                            await setCloudValue(`voter_${voter.id}`, serializeVoter(voter));
                        }
                        await setCloudValue('voters_list', newIds.join(','));
                    } catch(e) {}
                }
            }
            
            localStorage.setItem('voters', JSON.stringify(mergedVoters));
            return mergedVoters;
        } else if (key === 'candidates') {
            const listStr = await getCloudValue('candidates_list');
            if (listStr === null) {
                const local = localStorage.getItem('candidates');
                if (local !== null && JSON.parse(local).length > 0) {
                    const localCands = JSON.parse(local);
                    try {
                        const ids = localCands.map(c => c.id);
                        for (const c of localCands) {
                            await setCloudValue(`candidate_${c.id}`, serializeCandidate(c));
                        }
                        await setCloudValue('candidates_list', ids.join(','));
                    } catch(e) {}
                    return localCands;
                }
                const ids = defaultValue.map(c => c.id);
                try {
                    for (const c of defaultValue) {
                        const serialized = serializeCandidate(c);
                        await setCloudValue(`candidate_${c.id}`, serialized);
                    }
                    await setCloudValue('candidates_list', ids.join(','));
                } catch(e) {}
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
            
            // Bidirectional candidates cache merge
            const local = localStorage.getItem('candidates');
            let mergedCands = candidates;
            if (local !== null) {
                const localCands = JSON.parse(local);
                const mergedMap = new Map();
                localCands.forEach(c => { if (c && c.id) mergedMap.set(c.id, c); });
                candidates.forEach(c => { if (c && c.id) mergedMap.set(c.id, c); });
                mergedCands = Array.from(mergedMap.values());
                
                if (mergedCands.length > candidates.length) {
                    try {
                        const newIds = mergedCands.map(c => c.id);
                        for (const c of mergedCands) {
                            await setCloudValue(`candidate_${c.id}`, serializeCandidate(c));
                        }
                        await setCloudValue('candidates_list', newIds.join(','));
                    } catch(e) {}
                }
            }
            
            localStorage.setItem('candidates', JSON.stringify(mergedCands));
            return mergedCands;
        } else {
            const valStr = await getCloudValue(key);
            if (valStr === null) {
                const local = localStorage.getItem(key);
                if (local !== null) {
                    try {
                        await setCloudValue(key, local);
                    } catch(e) {}
                    return JSON.parse(local);
                }
                try {
                    await setCloudValue(key, JSON.stringify(defaultValue));
                } catch(e) {}
                localStorage.setItem(key, JSON.stringify(defaultValue));
                return defaultValue;
            }
            
            // Bidirectional generic array (e.g. correction_requests) cache merge
            const local = localStorage.getItem(key);
            let mergedVal = JSON.parse(valStr);
            if (local !== null) {
                try {
                    const localArr = JSON.parse(local);
                    const cloudArr = JSON.parse(valStr);
                    if (Array.isArray(localArr) && Array.isArray(cloudArr)) {
                        const mergedMap = new Map();
                        localArr.forEach(item => { if (item && item.id) mergedMap.set(item.id, item); });
                        cloudArr.forEach(item => { if (item && item.id) mergedMap.set(item.id, item); });
                        const mergedArr = Array.from(mergedMap.values());
                        
                        if (mergedArr.length > cloudArr.length) {
                            try {
                                await setCloudValue(key, JSON.stringify(mergedArr));
                            } catch(e) {}
                        }
                        mergedVal = mergedArr;
                    }
                } catch(e) {}
            }
            
            localStorage.setItem(key, JSON.stringify(mergedVal));
            return mergedVal;
        }
    } catch (err) {
        console.warn(`Failed to read key "${key}" from cloud DB. Using local cache.`, err);
        showOfflineWarningBadge();
        const local = localStorage.getItem(key);
        return local ? JSON.parse(local) : defaultValue;
    }
}

// Helper to write item to cloud DB
async function setDB(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
    try {
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
        showOfflineWarningBadge();
    }
}

function showOfflineWarningBadge() {
    let badge = document.getElementById('cloud-offline-badge');
    if (!badge) {
        badge = document.createElement('div');
        badge.id = 'cloud-offline-badge';
        badge.style = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            background: #ef4444;
            color: white;
            padding: 8px 16px;
            border-radius: 30px;
            font-family: 'Outfit', sans-serif;
            font-size: 0.85rem;
            font-weight: 600;
            box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4);
            z-index: 99999;
            display: flex;
            align-items: center;
            gap: 6px;
        `;
        badge.innerHTML = `<i class="bi bi-cloud-slash-fill"></i> Local Mode (Cloud Offline)`;
        document.body.appendChild(badge);
    }
}

function hideOfflineWarningBadge() {
    const badge = document.getElementById('cloud-offline-badge');
    if (badge) {
        badge.remove();
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
