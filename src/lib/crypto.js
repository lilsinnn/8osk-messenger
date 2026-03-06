// lib/crypto.js - Web Crypto API Wrapper for E2E Encryption

// Generates ECDH Server/Client Keypair for exchanging AES keys
export async function generateKeyPair() {
    return await window.crypto.subtle.generateKey(
        {
            name: 'ECDH',
            namedCurve: 'P-384',
        },
        true, // MUST be extractable to save to localStorage
        ['deriveKey', 'deriveBits']
    );
}

// Exports the public key to a url-safe base64 string to send over MQTT
export async function exportPublicKey(key) {
    const exported = await window.crypto.subtle.exportKey('raw', key);
    const exportedArray = new Uint8Array(exported);
    const base64 = btoa(String.fromCharCode(...exportedArray));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Imports a url-safe base64 public key received from a peer
export async function importPublicKey(urlSafeB64Key) {
    // 1. Convert from URL-safe to standard Base64
    let b64Key = urlSafeB64Key.replace(/-/g, '+').replace(/_/g, '/');

    // 2. Pad with '=' until the length is a multiple of 4
    const pad = b64Key.length % 4;
    if (pad) {
        if (pad === 1) {
            throw new Error('Invalid base64 string length');
        }
        b64Key += new Array(5 - pad).join('=');
    }

    const binaryDerString = atob(b64Key);
    const binaryDer = new Uint8Array(binaryDerString.length);
    for (let i = 0; i < binaryDerString.length; i++) {
        binaryDer[i] = binaryDerString.charCodeAt(i);
    }
    return await window.crypto.subtle.importKey(
        'raw',
        binaryDer,
        {
            name: 'ECDH',
            namedCurve: 'P-384',
        },
        true,
        []
    );
}

// Derives a shared AES-GCM key using own Private Key + Peer's Public Key
export async function deriveSharedKey(privateKey, publicKey) {
    return await window.crypto.subtle.deriveKey(
        {
            name: 'ECDH',
            public: publicKey,
        },
        privateKey,
        {
            name: 'AES-GCM',
            length: 256,
        },
        false,
        ['encrypt', 'decrypt']
    );
}

// Encrypts a string message
export async function encryptMessage(sharedKey, messageString) {
    const encoder = new TextEncoder();
    const data = encoder.encode(messageString);
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV

    const encryptedContent = await window.crypto.subtle.encrypt(
        {
            name: 'AES-GCM',
            iv: iv,
        },
        sharedKey,
        data
    );

    // Return IV + Ciphertext as base64 (to easily send over WebRTC string channels)
    const encryptedBuffer = new Uint8Array(encryptedContent);
    const payload = new Uint8Array(iv.length + encryptedBuffer.length);
    payload.set(iv, 0);
    payload.set(encryptedBuffer, iv.length);

    return btoa(String.fromCharCode(...payload));
}

// Decrypts a base64 message back to string
export async function decryptMessage(sharedKey, b64Payload) {
    const binaryString = atob(b64Payload);
    const payload = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        payload[i] = binaryString.charCodeAt(i);
    }

    // Extract IV and Ciphertext
    const iv = payload.slice(0, 12);
    const ciphertext = payload.slice(12);

    try {
        const decryptedContent = await window.crypto.subtle.decrypt(
            {
                name: 'AES-GCM',
                iv: iv,
            },
            sharedKey,
            ciphertext
        );
        const decoder = new TextDecoder();
        return decoder.decode(decryptedContent);
    } catch (err) {
        console.error("Decryption failed:", err);
        return "[Encrypted message - Failed to decrypt]";
    }
}
