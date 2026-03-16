import {
    generateKeyPair,
    exportPublicKey,
    importPublicKey,
    deriveSharedKey,
    encryptMessage,
    decryptMessage
} from './crypto';
import mqtt from 'mqtt';

const DEFAULT_BROKER_URL = 'wss://test.mosquitto.org:8081'; // Public WebSocket MQTT
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
        this.BROKER_KEY = '8osk_broker';
        this.STUN_KEY = '8osk_stun';

        // File transfer state
        this.incomingFiles = {};

        // Load custom or default network settings
        this.brokerUrl = localStorage.getItem(this.BROKER_KEY) || DEFAULT_BROKER_URL;
        
        const savedStun = localStorage.getItem(this.STUN_KEY);
        const defaultIceServers = [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun.cloudflare.com:3478' },
            { urls: 'stun:stun.sipgate.net:3478' },
            { urls: 'stun:stun.twilio.com:3478' }
        ];

        this.config = {
            iceServers: savedStun ? JSON.parse(savedStun) : defaultIceServers
        };
    }

    updateNetworkSettings(brokerUrl, stunServersArray) {
        if (brokerUrl) {
            localStorage.setItem(this.BROKER_KEY, brokerUrl);
            this.brokerUrl = brokerUrl;
        } else {
            localStorage.removeItem(this.BROKER_KEY);
            this.brokerUrl = DEFAULT_BROKER_URL;
        }

        if (stunServersArray && stunServersArray.length > 0) {
            localStorage.setItem(this.STUN_KEY, JSON.stringify(stunServersArray));
            this.config.iceServers = stunServersArray;
        } else {
            localStorage.removeItem(this.STUN_KEY);
            // Default Ice servers will be loaded on next refresh or can be reset manually here
        }
        
        // Force reload to apply new underlying connection states cleanly
        window.location.reload();
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
            this.mqttClient = mqtt.connect(this.brokerUrl, {
                protocol: 'wss',
                connectTimeout: 10000
            });

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
                reject(err);
            });

            this.mqttClient.on('offline', () => {
                console.warn("MQTT went offline or failed to connect.");
                reject(new Error("Broker Offline"));
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

        // 15s Timeout safeguard
        if (this._connectionTimeout) clearTimeout(this._connectionTimeout);
        this._connectionTimeout = setTimeout(() => {
            if (this.peerConnection && this.peerConnection.connectionState !== 'connected') {
                console.error("Connection attempt timed out after 15s");
                if (this.onConnectionStateChange) this.onConnectionStateChange('failed');
                this._resetConnection();
            }
        }, 15000);

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

        // Ignore stale signaling (Offers/Answers) from persistent queue fallback buffering
        if (payload.type !== 'FALLBACK_MESSAGE' && payload.time && Date.now() - payload.time > 60000) {
            console.log("Ignoring stale signaling message from buffer.");
            return;
        }

        // Step 1: Establish shared key to decrypt the payload
        const senderKey = await importPublicKey(payload.senderPubKey);
        const tempSharedKey = await deriveSharedKey(this.keyPair.privateKey, senderKey);

        // Handle Fallback Message (Offline delivery)
        if (payload.type === 'FALLBACK_MESSAGE') {
            try {
                const decryptedText = await decryptMessage(tempSharedKey, payload.payload);
                if (this.onMessageCallback) {
                    this.onMessageCallback({
                        type: 'text',
                        text: decryptedText,
                        sender: 'peer',
                        time: payload.time || Date.now()
                    });
                }
            } catch (e) {
                console.error("Failed to decrypt fallback message:", e);
            }
            return; // Handled
        }

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

        let iceGatheringTimeout;
        let sdpSent = false;

        const sendEncryptedSdp = async () => {
            if (sdpSent) return;
            sdpSent = true;
            if (iceGatheringTimeout) clearTimeout(iceGatheringTimeout);

            const finalSdp = this.peerConnection.localDescription;
            if (!finalSdp) return; // Should not happen
            const sdpType = finalSdp.type === 'offer' ? 'OFFER' : 'ANSWER';

            // Encrypt the SDP with the peer's public key so the MQTT broker can't read it
            const encryptedSDP = await encryptMessage(this.sharedKey, JSON.stringify(finalSdp));

            const payload = {
                type: sdpType,
                senderPubKey: this.myPublicKeyStr,
                encryptedSDP: encryptedSDP,
                time: Date.now()
            };

            const targetTopic = `${TOPIC_PREFIX}${this.remotePublicKeyStr}`;
            this.mqttClient.publish(targetTopic, JSON.stringify(payload));
            console.log(`Sent encrypted ${sdpType} via MQTT to`, this.remotePublicKeyStr.substring(0, 10) + '...');
        };

        this.peerConnection.onicegatheringstatechange = () => {
             if (this.peerConnection.iceGatheringState === 'gathering') {
                // In case STUN is blocked, don't wait forever. Blast what we have after 3s.
                iceGatheringTimeout = setTimeout(sendEncryptedSdp, 3000);
             }
        };

        this.peerConnection.onicecandidate = async (event) => {
            // Send the signal when STUN gathering is natively complete
            if (event.candidate === null) {
                await sendEncryptedSdp();
            }
        };

        this.peerConnection.onconnectionstatechange = () => {
            const state = this.peerConnection.connectionState;
            console.log("WebRTC state: ", state);
            if (state === 'connected' && this.onConnectionStateChange) {
                if (this._connectionTimeout) clearTimeout(this._connectionTimeout);
                this.onConnectionStateChange('connected');
                // We don't need _initKeyExchange via DataChannel anymore! 
                // We already exchanged ECDH keys via MQTT to encrypt the SDPs.
                if (this.onMessageCallback) {
                    this.onMessageCallback({ type: 'system', text: 'Secure E2EE Channel Established.', time: Date.now() });
                }
            }
            if (state === 'disconnected' || state === 'failed') {
                if (this._connectionTimeout) clearTimeout(this._connectionTimeout);
                if (this.onConnectionStateChange) this.onConnectionStateChange(state);
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

                    if (inner.msgType === 'ping') {
                        if (window.navigator.vibrate) window.navigator.vibrate([200, 100, 200]);
                        try {
                            const ctx = new (window.AudioContext || window.webkitAudioContext)();
                            const osc = ctx.createOscillator();
                            const gain = ctx.createGain();
                            osc.connect(gain); gain.connect(ctx.destination);
                            osc.type = 'sine'; osc.frequency.value = 880;
                            gain.gain.setValueAtTime(0, ctx.currentTime);
                            gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05);
                            gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
                            osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
                        } catch (e) { }

                        if (this.onMessageCallback) {
                            this.onMessageCallback({ type: 'system', text: 'Incoming Ping', time: Date.now() });
                        }
                    } else if (inner.msgType === 'file_start') {
                        this.incomingFiles[inner.meta.fileId] = { meta: inner.meta, chunks: [] };
                        console.log("Receiving file...", inner.meta.name);
                    } else if (inner.msgType === 'file_chunk') {
                        if (this.incomingFiles[inner.meta.fileId]) {
                            this.incomingFiles[inner.meta.fileId].chunks[inner.meta.chunkIndex] = inner.data;
                        }
                    } else if (inner.msgType === 'file_end') {
                        const fileObj = this.incomingFiles[inner.meta.fileId];
                        if (fileObj) {
                            try {
                                const byteArrays = fileObj.chunks.map(chunk => {
                                    const byteString = atob(chunk);
                                    const u8 = new Uint8Array(byteString.length);
                                    for (let i = 0; i < byteString.length; i++) u8[i] = byteString.charCodeAt(i);
                                    return u8;
                                });
                                const blob = new Blob(byteArrays, { type: fileObj.meta.type });
                                const blobUrl = URL.createObjectURL(blob);
                                if (this.onMessageCallback) {
                                    this.onMessageCallback({
                                        type: 'file',
                                        meta: fileObj.meta,
                                        data: blobUrl, 
                                        sender: 'peer',
                                        time: data.time || Date.now()
                                    });
                                }
                            } catch (err) { console.error("Blob assemble failed:", err); }
                            delete this.incomingFiles[inner.meta.fileId];
                        }
                    } else if (inner.msgType !== 'file') {
                        if (this.onMessageCallback) {
                            this.onMessageCallback({
                                type: inner.msgType, meta: inner.meta, data: inner.data, sender: 'peer', time: data.time || Date.now()
                            });
                        }
                    }
                } catch (e) { console.error("Payload decryption failed:", e); }
            }
        };
    }

    async sendMessage(text) {
        if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
            return await this._sendMessageMqttFallback(text);
        }
        if (!this.sharedKey) return false;

        try {
            const encryptedPayload = await encryptMessage(this.sharedKey, text);
            if (window.navigator.vibrate) window.navigator.vibrate([30]); // light haptic
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

    async _sendMessageMqttFallback(text) {
        if (!this.sharedKey) return false;
        try {
            const encryptedPayload = await encryptMessage(this.sharedKey, text);
            const msgData = {
                type: 'FALLBACK_MESSAGE',
                senderPubKey: this.myPublicKeyStr,
                payload: encryptedPayload,
                time: Date.now()
            };
            const targetTopic = `${TOPIC_PREFIX}${this.remotePublicKeyStr}`;
            
            // Publish with QoS 1 for delivery assurance
            this.mqttClient.publish(targetTopic, JSON.stringify(msgData), { qos: 1 });

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
            console.error("Offline encryption failed:", e);
            return false;
        }
    }

    async sendFile(fileMeta, base64Data, localBlobUrl = null) {
        if (!this.dataChannel || this.dataChannel.readyState !== 'open') return false;
        if (!this.sharedKey) return false;

        const fileId = Math.random().toString(36).substring(7) + Date.now();
        const chunkSize = 16384; 
        const totalChunks = Math.ceil(base64Data.length / chunkSize);

        const enhancedMeta = { ...fileMeta, fileId, totalChunks };

        try {
            let encryptedStart = await encryptMessage(this.sharedKey, JSON.stringify({
                msgType: 'file_start', meta: enhancedMeta
            }));
            this.dataChannel.send(JSON.stringify({ type: 'ENCRYPTED_PAYLOAD', payload: encryptedStart, time: Date.now() }));

            for (let i = 0; i < totalChunks; i++) {
                const chunkStr = base64Data.substring(i * chunkSize, (i + 1) * chunkSize);
                let encryptedChunk = await encryptMessage(this.sharedKey, JSON.stringify({
                    msgType: 'file_chunk', meta: { fileId, chunkIndex: i }, data: chunkStr
                }));
                this.dataChannel.send(JSON.stringify({ type: 'ENCRYPTED_PAYLOAD', payload: encryptedChunk, time: Date.now() }));
                await new Promise(resolve => setTimeout(resolve, 0));
            }

            let encryptedEnd = await encryptMessage(this.sharedKey, JSON.stringify({
                msgType: 'file_end', meta: { fileId }
            }));
            this.dataChannel.send(JSON.stringify({ type: 'ENCRYPTED_PAYLOAD', payload: encryptedEnd, time: Date.now() }));

            if (this.onMessageCallback) {
                this.onMessageCallback({
                    type: 'file',
                    meta: fileMeta,
                    data: localBlobUrl || `data:${fileMeta.type};base64,${base64Data}`,
                    sender: 'me',
                    time: Date.now()
                });
            }
            return true;
        } catch (e) {
            console.error("File encryption failed:", e);
            return false;
        }
    }

    async sendPing() {
        if (!this.dataChannel || this.dataChannel.readyState !== 'open') return false;
        if (!this.sharedKey) return false;

        const now = Date.now();
        if (this.lastPingTime && now - this.lastPingTime < 5000) {
            return false; // Rate limit 5 seconds
        }
        this.lastPingTime = now;

        try {
            const encryptedPayload = await encryptMessage(this.sharedKey, JSON.stringify({ 
                msgType: 'ping' 
            }));
            this.dataChannel.send(JSON.stringify({ type: 'ENCRYPTED_PAYLOAD', payload: encryptedPayload, time: Date.now() }));

            if (this.onMessageCallback) {
                this.onMessageCallback({ type: 'system', text: 'Ping sent to peer', time: Date.now() });
            }
            return true;
        } catch (e) { return false; }
    }
}

const webrtcService = new WebRTCService();
export default webrtcService;
