export async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function savePasswordHash(hash) {
    localStorage.setItem('8osk_app_lock', hash);
}

export function getPasswordHash() {
    return localStorage.getItem('8osk_app_lock');
}

export function removePassword() {
    localStorage.removeItem('8osk_app_lock');
}
