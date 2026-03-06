import {
    generateKeyPair,
    exportPublicKey,
    importPublicKey,
    deriveSharedKey,
    encryptMessage,
    decryptMessage
} from './crypto';
import mqtt from 'mqtt';

const MQTT_BROKER_URL = 'wss://test.mosquitto.org:8081'; // Public WebSocket MQTT
const TOPIC_PREFIX = '8osk/signaling/';

class WebRTCService {
    constructor() {
        this.peerConnection = null;
        this.dataChannel = null;
        this.mqttClient = null;

        // Callbacks
        this.onMessageCallback = null;
        this.onConnectionStateChange = null;

        // E2EE
        this.keyPair = null;
        this.myPublicKeyStr = null;

        // Peer State
        this.remotePublicKeyStr = null;
        this.remotePublicKey = null;
        this.sharedKey = null;

        // Local Storage keys
        this.STORAGE_KEY = '8osk_identity';

        // File transfer state
        this.incomingFiles = {};

        // STUN config
        this.config = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
    }

    // 1. Initialize Engine & MQTT
    async initEngine() {
        const savedIdentity = localStorage.getItem(this.STORAGE_KEY);

        if (savedIdentity) {
            try {
                const parsed = JSON.parse(savedIdentity);

                // Convert base64 strings back to Uint8Arrays before importing
                const pubBuffer = Uint8Array.from(atob(parsed.publicKey), c => c.charCodeAt(0));
                const privBuffer = Uint8Array.from(atob(parsed.privateKey), c => c.charCodeAt(0));

                this.keyPair = {
                    publicKey: await crypto.subtle.importKey(
                        "spki",
                        pubBuffer.buffer,
                        { name: "ECDH", namedCurve: "P-384" },
                        true,
                        []
                    ),
                    privateKey: await crypto.subtle.importKey(
                        "pkcs8",
                        privBuffer.buffer,
                        { name: "ECDH", namedCurve: "P-384" },
                        true,
                        ["deriveKey", "deriveBits"]
                    )
                };
                this.myPublicKeyStr = await exportPublicKey(this.keyPair.publicKey);
                console.log("Loaded existing stable identity.");
            } catch (e) {
                console.error("Failed to load saved identity, generating new one.", e);
                await this._generateAndSaveIdentity();
            }
        } else {
            await this._generateAndSaveIdentity();
        }

        return new Promise((resolve, reject) => {
            this.mqttClient = mqtt.connect(MQTT_BROKER_URL);

            this.mqttClient.on('connect', () => {
                console.log("Connected to Public MQTT Broker");
                this.mqttClient.subscribe(`${TOPIC_PREFIX}${this.myPublicKeyStr}`, (err) => {
                    if (err) {
                        console.error("MQTT Subscribe Error:", err);
                        reject(err);
                    } else {
                        console.log("Listening for incoming connections...");
                        resolve(this.myPublicKeyStr);
                    }
                });
            });

            this.mqttClient.on('message', async (topic, message) => {
                try {
                    const payload = JSON.parse(message.toString());
                    await this._handleIncomingSignalingMessage(payload);
                } catch (e) {
                    console.error("Failed to parse incoming MQTT message", e);
                }
            });

            this.mqttClient.on('error', (err) => {
                console.error("MQTT Error:", err);
            });
        });
    }

    async _generateAndSaveIdentity() {
        this.keyPair = await generateKeyPair();
        this.myPublicKeyStr = await exportPublicKey(this.keyPair.publicKey);

        const exportedPub = await crypto.subtle.exportKey("spki", this.keyPair.publicKey);
        const exportedPriv = await crypto.subtle.exportKey("pkcs8", this.keyPair.privateKey);

        const b64Pub = btoa(String.fromCharCode(...new Uint8Array(exportedPub)));
        const b64Priv = btoa(String.fromCharCode(...new Uint8Array(exportedPriv)));

        localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
            publicKey: b64Pub,
            privateKey: b64Priv
        }));
        console.log("Generated and saved new stable identity.");
    }

    clearIdentity() {
        localStorage.removeItem(this.STORAGE_KEY);
        window.location.reload();
    }

    // 2. Connect to a Peer (Be the Host/Caller)
    async connectToPeer(peerIdBase64) {
        if (this.onConnectionStateChange) this.onConnectionStateChange('connecting');
        this._resetConnection();

        this.remotePublicKeyStr = peerIdBase64;
        this.remotePublicKey = await importPublicKey(peerIdBase64);
        this.sharedKey = await deriveSharedKey(this.keyPair.privateKey, this.remotePublicKey);

        this.dataChannel = this.peerConnection.createDataChannel('8osk-secure-channel');
        this._setupDataChannel(this.dataChannel);

        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);

        // WebRTC starts gathering ICE candidates...
        // The trick: we wait for gathering to finish, then send the whole thing via MQTT
        // handled in onicecandidate
    }

    // 3. Handle Incoming Signals via MQTT
    async _handleIncomingSignalingMessage(payload) {
        // payload shape: { type: 'OFFER'|'ANSWER', senderPubKey: '...', encryptedSDP: '...' }

        // Step 1: Establish shared key to decrypt the payload
        const senderKey = await importPublicKey(payload.senderPubKey);
        const tempSharedKey = await deriveSharedKey(this.keyPair.privateKey, senderKey);

        let decryptedSdpStr;
        try {
            decryptedSdpStr = await decryptMessage(tempSharedKey, payload.encryptedSDP);
        } catch (e) {
            console.error("Failed to decrypt signaling message. Ignoring.", e);
            return;
        }

        const sdp = JSON.parse(decryptedSdpStr);

        // If it's an OFFER, we are the Guest
        if (payload.type === 'OFFER') {
            if (this.onConnectionStateChange) this.onConnectionStateChange('connecting');
            this._resetConnection();

            this.remotePublicKeyStr = payload.senderPubKey;
            this.remotePublicKey = senderKey;
            this.sharedKey = tempSharedKey; // save for chat messages later

            this.peerConnection.ondatachannel = (event) => {
                this.dataChannel = event.channel;
                this._setupDataChannel(this.dataChannel);
            };

            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);

            // Wait for ICE gathering, then send ANSWER payload back
            // Handled in onicecandidate
        }

        // If it's an ANSWER, we are the Host receiving the response
        else if (payload.type === 'ANSWER') {
            // remotePublicKey/sharedKey were already set in connectToPeer()
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
        }
    }

    _resetConnection() {
        if (this.peerConnection) {
            this.peerConnection.close();
        }
        this.peerConnection = new RTCPeerConnection(this.config);

        this.peerConnection.onicecandidate = async (event) => {
            // Send the signal only when STUN gathering is complete
            if (event.candidate === null) {
                const finalSdp = this.peerConnection.localDescription;
                const sdpType = finalSdp.type === 'offer' ? 'OFFER' : 'ANSWER';

                // Encrypt the SDP with the peer's public key so the MQTT broker can't read it
                const encryptedSDP = await encryptMessage(this.sharedKey, JSON.stringify(finalSdp));

                const payload = {
                    type: sdpType,
                    senderPubKey: this.myPublicKeyStr,
                    encryptedSDP: encryptedSDP
                };

                const targetTopic = `${TOPIC_PREFIX}${this.remotePublicKeyStr}`;
                this.mqttClient.publish(targetTopic, JSON.stringify(payload));
                console.log(`Sent encrypted ${sdpType} via MQTT to`, this.remotePublicKeyStr.substring(0, 10) + '...');
            }
        };

        this.peerConnection.onconnectionstatechange = () => {
            const state = this.peerConnection.connectionState;
            console.log("WebRTC state: ", state);
            if (state === 'connected' && this.onConnectionStateChange) {
                this.onConnectionStateChange('connected');
                // We don't need _initKeyExchange via DataChannel anymore! 
                // We already exchanged ECDH keys via MQTT to encrypt the SDPs.
                if (this.onMessageCallback) {
                    this.onMessageCallback({ type: 'system', text: 'Secure E2EE Channel Established.', time: Date.now() });
                }
            }
            if (state === 'disconnected' || state === 'failed') {
                if (this.onConnectionStateChange) this.onConnectionStateChange('disconnected');
                this.sharedKey = null;
                this.remotePublicKeyStr = null;
                this.remotePublicKey = null;
            }
        };
    }

    _setupDataChannel(channel) {
        channel.onopen = () => {
            console.log("Data channel open");
        };

        channel.onclose = () => {
            console.log("Data channel closed");
        };

        channel.onmessage = async (event) => {
            const data = JSON.parse(event.data);

            if (data.type === 'ENCRYPTED_MESSAGE' && this.sharedKey) {
                try {
                    const decryptedText = await decryptMessage(this.sharedKey, data.payload);
                    if (this.onMessageCallback) {
                        this.onMessageCallback({
                            type: 'text',
                            text: decryptedText,
                            sender: 'peer',
                            time: data.time || Date.now()
                        });
                    }
                } catch (e) {
                    console.error("Message decryption failed:", e);
                }
            }

            if (data.type === 'ENCRYPTED_PAYLOAD' && this.sharedKey) {
                try {
                    const decryptedString = await decryptMessage(this.sharedKey, data.payload);
                    const inner = JSON.parse(decryptedString);

                    if (inner.msgType === 'file_start') {
                        this.incomingFiles[inner.meta.fileId] = {
                            meta: inner.meta,
                            chunks: []
                        };
                        console.log("Receiving file...", inner.meta.name);
                    } else if (inner.msgType === 'file_chunk') {
                        if (this.incomingFiles[inner.meta.fileId]) {
                            this.incomingFiles[inner.meta.fileId].chunks[inner.meta.chunkIndex] = inner.data;
                        }
                    } else if (inner.msgType === 'file_end') {
                        const fileObj = this.incomingFiles[inner.meta.fileId];
                        if (fileObj) {
                            const fullBase64 = fileObj.chunks.join('');
                            console.log("File receive complete:", fileObj.meta.name);
                            if (this.onMessageCallback) {
                                this.onMessageCallback({
                                    type: 'file',
                                    meta: fileObj.meta,
                                    data: fullBase64,
                                    sender: 'peer',
                                    time: data.time || Date.now()
                                });
                            }
                            delete this.incomingFiles[inner.meta.fileId];
                        }
                    } else if (inner.msgType !== 'file') {
                        // generic fallback
                        if (this.onMessageCallback) {
                            this.onMessageCallback({
                                type: inner.msgType,
                                meta: inner.meta,
                                data: inner.data,
                                sender: 'peer',
                                time: data.time || Date.now()
                            });
                        }
                    }
                } catch (e) {
                    console.error("Payload decryption failed:", e);
                }
            }
        };
    }

    async sendMessage(text) {
        if (!this.dataChannel || this.dataChannel.readyState !== 'open') return false;
        if (!this.sharedKey) return false;

        try {
            const encryptedPayload = await encryptMessage(this.sharedKey, text);
            const msgData = {
                type: 'ENCRYPTED_MESSAGE',
                payload: encryptedPayload,
                time: Date.now()
            };

            this.dataChannel.send(JSON.stringify(msgData));

            if (this.onMessageCallback) {
                this.onMessageCallback({
                    type: 'text',
                    text: text,
                    sender: 'me',
                    time: msgData.time
                });
            }
            return true;
        } catch (e) {
            console.error("Encryption failed before sending:", e);
            return false;
        }
    }

    async sendFile(fileMeta, base64Data) {
        if (!this.dataChannel || this.dataChannel.readyState !== 'open') return false;
        if (!this.sharedKey) return false;

        const fileId = Math.random().toString(36).substring(7) + Date.now();
        const chunkSize = 16384; // 16KB WebRTC safe chunk size
        const totalChunks = Math.ceil(base64Data.length / chunkSize);

        const enhancedMeta = { ...fileMeta, fileId, totalChunks };

        try {
            // 1. Send Start
            let encryptedStart = await encryptMessage(this.sharedKey, JSON.stringify({
                msgType: 'file_start', meta: enhancedMeta
            }));
            this.dataChannel.send(JSON.stringify({ type: 'ENCRYPTED_PAYLOAD', payload: encryptedStart, time: Date.now() }));

            // 2. Send Chunks sequentially
            for (let i = 0; i < totalChunks; i++) {
                const chunkStr = base64Data.substring(i * chunkSize, (i + 1) * chunkSize);
                let encryptedChunk = await encryptMessage(this.sharedKey, JSON.stringify({
                    msgType: 'file_chunk', meta: { fileId, chunkIndex: i }, data: chunkStr
                }));
                this.dataChannel.send(JSON.stringify({ type: 'ENCRYPTED_PAYLOAD', payload: encryptedChunk, time: Date.now() }));

                // Yield thread to prevent blocking
                await new Promise(resolve => setTimeout(resolve, 0));
            }

            // 3. Send End
            let encryptedEnd = await encryptMessage(this.sharedKey, JSON.stringify({
                msgType: 'file_end', meta: { fileId }
            }));
            this.dataChannel.send(JSON.stringify({ type: 'ENCRYPTED_PAYLOAD', payload: encryptedEnd, time: Date.now() }));

            if (this.onMessageCallback) {
                this.onMessageCallback({
                    type: 'file',
                    meta: fileMeta,
                    data: base64Data, // local echo doesn't need reassembly
                    sender: 'me',
                    time: Date.now()
                });
            }
            return true;
        } catch (e) {
            console.error("File encryption/chunking failed before sending:", e);
            return false;
        }
    }
}

const webrtcService = new WebRTCService();
export default webrtcService;
