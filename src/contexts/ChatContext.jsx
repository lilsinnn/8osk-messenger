import React, { createContext, useContext, useState, useEffect } from 'react';
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
    const startConnection = async (peerIdBase64) => {
        try {
            await webrtcService.connectToPeer(peerIdBase64);
        } catch (e) {
            console.error("Connection failed to start", e);
            setError("Failed to initiate connection. Invalid ID format?");
            setConnectionState('disconnected');
        }
    };

    const sendMessage = async (text) => {
        return await webrtcService.sendMessage(text);
    };

    const sendFile = async (meta, base64) => {
        return await webrtcService.sendFile(meta, base64);
    };

    const clearChat = () => {
        setMessages([]);
    };

    return (
        <ChatContext.Provider value={{
            myToken,
            connectionState,
            remotePeerId,
            messages,
            isReady,
            error,
            startConnection,
            sendMessage,
            sendFile,
            clearChat
        }}>
            {children}
        </ChatContext.Provider>
    );
}
