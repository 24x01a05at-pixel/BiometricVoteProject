// Cloud Database Helper using jsonblob.com directly for shared database across devices
const BLOB_ID = "019fb416-1555-73f0-b1db-fa853a37ac2d";
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

let dbObjCached = null;
let isInitialSyncDone = false;
let initialSyncPromise = null;
let saveDebounceTimeouts = {};
let lastSyncTime = 0;

async function syncCloudDB(force = false) {
    const now = Date.now();
    // Throttle background syncs to once every 60 seconds unless forced or it is the first sync
    if (!force && now - lastSyncTime < 60000 && isInitialSyncDone) {
        return;
    }
    
    if (initialSyncPromise) return initialSyncPromise;
    
    initialSyncPromise = (async () => {
        try {
            const response = await fetch(BASE_URL);
            if (response.status === 429) {
                throw new Error("429 (Rate Limited - Too Many Requests)");
            }
            if (!response.ok) throw new Error(`${response.status}`);
            
            const dbObj = await response.json();
            dbObjCached = dbObj;
            lastSyncTime = Date.now();
            
            const keys = ['voters', 'candidates', 'election_config', 'correction_requests'];
            let hasNewLocalData = false;
            
            for (const key of keys) {
                const cloudVal = dbObj[key];
                const local = localStorage.getItem(key);
                let mergedVal = cloudVal !== undefined && cloudVal !== null ? cloudVal : null;
                
                if (local !== null) {
                    try {
                        const localData = JSON.parse(local);
                        if (mergedVal === null) {
                            mergedVal = localData;
                            hasNewLocalData = true;
                        } else if (Array.isArray(localData) && Array.isArray(cloudVal)) {
                            // Smart bidirectional sync with delete support
                            const mergedMap = new Map();
                            
                            // 1. Populate the map with items currently in the cloud (marked as synced)
                            cloudVal.forEach(item => {
                                if (item && item.id) {
                                    item.synced = true;
                                    mergedMap.set(item.id, item);
                                }
                            });
                            
                            // 2. Loop through local storage items
                            localData.forEach(localItem => {
                                if (localItem && localItem.id) {
                                    const cloudItem = mergedMap.get(localItem.id);
                                    if (cloudItem) {
                                        // Item is present on both: preserve local base64 images if cloud is blank
                                        let updated = false;
                                        if (localItem.logo_path && localItem.logo_path.startsWith('data:image') && (!cloudItem.logo_path || cloudItem.logo_path === 'placeholder')) {
                                            cloudItem.logo_path = localItem.logo_path;
                                            updated = true;
                                        }
                                        if (localItem.capture_path && localItem.capture_path.startsWith('data:image') && (!cloudItem.capture_path || cloudItem.capture_path === 'placeholder')) {
                                            cloudItem.capture_path = localItem.capture_path;
                                            updated = true;
                                        }
                                        if (updated) {
                                            hasNewLocalData = true;
                                        }
                                    } else {
                                        // Item exists locally but is missing in the cloud
                                        if (localItem.synced === false || localItem.synced === undefined) {
                                            // New registration created offline (never synced) -> upload it
                                            localItem.synced = true;
                                            mergedMap.set(localItem.id, localItem);
                                            hasNewLocalData = true;
                                        } else {
                                            // Was already synced previously -> this means it was deleted on another device -> delete locally
                                            // So we DO NOT add it back to the merged list.
                                        }
                                    }
                                }
                            });
                            
                            const newMerged = Array.from(mergedMap.values());
                            if (newMerged.length > cloudVal.length) {
                                hasNewLocalData = true;
                            }
                            mergedVal = newMerged;
                        } else if (typeof localData === 'object' && typeof cloudVal === 'object') {
                            // Merge objects (election_config)
                            mergedVal = { ...localData, ...cloudVal };
                        }
                    } catch (e) {
                        console.warn("Merge error for", key, e);
                    }
                }
                
                if (mergedVal !== null) {
                    localStorage.setItem(key, JSON.stringify(mergedVal));
                    dbObj[key] = mergedVal;
                }
            }
            
            // Only write back to cloud if there is unsynced local data or photo heals
            if (hasNewLocalData) {
                const putResponse = await fetch(BASE_URL, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dbObj)
                });
                if (putResponse.status === 429) {
                    throw new Error("429 (Rate Limited - Too Many Requests)");
                }
                if (!putResponse.ok) throw new Error(`Write failed: ${putResponse.status}`);
            }
            
            hideOfflineWarningBadge();
            isInitialSyncDone = true;
        } catch (err) {
            console.error("Database synchronization failed:", err);
            showOfflineWarningBadge(err);
            throw err;
        } finally {
            initialSyncPromise = null;
        }
    })();
    
    return initialSyncPromise;
}

// Trigger initial load immediately on script import
syncCloudDB().catch(e => console.warn("Background sync failed:", e));

// Helper to get item from cloud DB
async function getDB(key, defaultValue, force = false) {
    if (force) {
        await syncCloudDB(force);
    } else {
        try {
            await syncCloudDB(force);
        } catch (e) {
            console.warn(`getDB: Sync failed for key "${key}", reading from local cache:`, e.message);
        }
    }
    const local = localStorage.getItem(key);
    return local ? JSON.parse(local) : defaultValue;
}

// Helper to write item to cloud DB with debouncing
async function setDB(key, value) {
    // Flag any newly created array items as unsynced (so they sync to cloud on next pass)
    if (Array.isArray(value)) {
        value.forEach(item => {
            if (item && item.id && item.synced === undefined) {
                item.synced = false;
            }
        });
    }
    
    localStorage.setItem(key, JSON.stringify(value));
    
    // Debounce writing back to the cloud database (key-specific to prevent concurrent update cancellations)
    if (saveDebounceTimeouts[key]) clearTimeout(saveDebounceTimeouts[key]);
    saveDebounceTimeouts[key] = setTimeout(async () => {
        try {
            const response = await fetch(BASE_URL);
            if (response.status === 429) {
                throw new Error("429 (Rate Limited - Too Many Requests)");
            }
            if (!response.ok) throw new Error(`Read failed: ${response.status}`);
            const dbObj = await response.json();
            
            dbObj[key] = value;
            dbObjCached = dbObj;
            lastSyncTime = Date.now();
            
            const putResponse = await fetch(BASE_URL, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dbObj)
            });
            if (putResponse.status === 429) {
                throw new Error("429 (Rate Limited - Too Many Requests)");
            }
            if (!putResponse.ok) throw new Error(`Write failed: ${putResponse.status}`);
            
            // Overwrite local copy with freshly synced database values to align flags
            localStorage.setItem(key, JSON.stringify(value));
            
            hideOfflineWarningBadge();
        } catch (err) {
            console.error(`Failed to write key "${key}" to cloud DB:`, err);
            showOfflineWarningBadge(err);
        }
    }, 1500);
}

function showOfflineWarningBadge(err) {
    let badge = document.getElementById('cloud-offline-badge');
    const errMsg = err ? `: ${err.message || err}` : '';
    const resetBtnHtml = ` <button onclick="localStorage.clear(); sessionStorage.clear(); location.reload();" class="btn btn-sm btn-light fw-bold py-0 px-2 ms-2" style="font-size: 0.7rem; border-radius: 20px; color: #ef4444; border: none;">Reset Cache</button>`;
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
        badge.innerHTML = `<i class="bi bi-cloud-slash-fill"></i> Local Mode (Cloud Offline)${errMsg}${resetBtnHtml}`;
        document.body.appendChild(badge);
    } else {
        badge.innerHTML = `<i class="bi bi-cloud-slash-fill"></i> Local Mode (Cloud Offline)${errMsg}${resetBtnHtml}`;
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
