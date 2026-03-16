import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import webrtcService from '../lib/WebRTCService';

const ChatContext = createContext();

export function useChat() {
    return useContext(ChatContext);
}

export function ChatProvider({ children }) {
    const [connectionState, setConnectionState] = useState('disconnected'); // 'disconnected' | 'connecting' | 'connected'
    const [messages, setMessages] = useState([]);
    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState(null);
    const [remotePeerId, setRemotePeerId] = useState(null);

    // My Identity
    const [myToken, setMyToken] = useState('');
    const [isSecureMode, setIsSecureMode] = useState(localStorage.getItem('8osk_secure') !== 'false');

    // Load History
    useEffect(() => {
        if (!isSecureMode && remotePeerId) {
            const saved = localStorage.getItem(`8osk_history_${remotePeerId}`);
            if (saved) {
                try { setMessages(JSON.parse(saved)); } catch (e) { setMessages([]); }
            } else {
                setMessages([]); // Clear if no history
            }
        } else if (isSecureMode && remotePeerId) {
            localStorage.removeItem(`8osk_history_${remotePeerId}`);
            setMessages([]);
        } else {
            setMessages([]); // Clear if no peer
        }
    }, [remotePeerId, isSecureMode]);

    // Save History
    useEffect(() => {
        if (!isSecureMode && remotePeerId && messages.length > 0) {
            const serializable = messages.map(m => m.type === 'file' ? { ...m, data: null } : m);
            localStorage.setItem(`8osk_history_${remotePeerId}`, JSON.stringify(serializable));
        }
    }, [messages, isSecureMode, remotePeerId]);

    useEffect(() => {
        const initEngine = async () => {
            try {
                // Returns my public key ID after connecting to MQTT
                const myPubKeyBase64 = await webrtcService.initEngine();
                setMyToken(myPubKeyBase64);
                setIsReady(true);
            } catch (err) {
                console.error("Engine init failed:", err);
                setError("Failed to connect to the P2P Signaling Network.");
                setIsReady(true);
            }
        };

        initEngine();

        webrtcService.onMessageCallback = (msg) => {
            setMessages(prev => [...prev, msg]);
        };

        webrtcService.onConnectionStateChange = (state) => {
            setConnectionState(state);
            if (state === 'connected') {
                setRemotePeerId(webrtcService.remotePublicKeyStr);
            } else if (state === 'disconnected') {
                setRemotePeerId(null);
            }
        };
    }, []);

    // Initiates the connection handshake via MQTT
    const startConnection = useCallback(async (peerIdBase64) => {
        try {
            await webrtcService.connectToPeer(peerIdBase64);
        } catch (e) {
            console.error("Connection failed to start", e);
            setError("Failed to initiate connection. Invalid ID format?");
            setConnectionState('disconnected');
        }
    }, []);

    const sendMessage = useCallback(async (text) => {
        return await webrtcService.sendMessage(text);
    }, []);

    const sendFile = useCallback(async (meta, base64, localBlobUrl = null) => {
        return await webrtcService.sendFile(meta, base64, localBlobUrl);
    }, []);

    const sendPing = useCallback(async () => {
        return await webrtcService.sendPing();
    }, []);

    const clearChat = useCallback(() => {
        setMessages([]);
    }, []);

    return (
        <ChatContext.Provider value={{
            myToken,
            connectionState,
            remotePeerId,
            setRemotePeerId, // Exported to allow selection when client is offline
            messages,
            isReady,
            error,
            startConnection,
            sendMessage,
            sendFile,
            sendPing,
            clearChat,
            isSecureMode,
            setIsSecureMode
        }}>
            {children}
        </ChatContext.Provider>
    );
}
