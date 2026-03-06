import React, { useState } from 'react';
import { useChat } from '../contexts/ChatContext';
import webrtcService from '../lib/WebRTCService';
import { UserPlus, Shield, Copy, Check, Loader2, Info, RefreshCw } from 'lucide-react';

const WelcomeScreen = ({ onStartLocalScan }) => {
    const {
        myToken: myId,
        webrtcState,
        startConnection
    } = useChat();

    const [peerIdInput, setPeerIdInput] = useState('');
    const [copied, setCopied] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);

    const handleCopy = async () => {
        if (!myId) return;
        try {
            await navigator.clipboard.writeText(myId);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy', err);
        }
    };

    const handleConnect = async (e) => {
        e.preventDefault();
        if (!peerIdInput.trim()) return;

        setIsConnecting(true);
        await startConnection(peerIdInput.trim());
        setTimeout(() => { setIsConnecting(false); }, 10000);
    };

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
            <div style={{ maxWidth: '440px', width: '100%', position: 'relative' }}>
                <div className="glass-card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

                    <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(138, 43, 226, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', border: '1px solid var(--accent-primary)' }}>
                        <Shield size={32} color="var(--accent-secondary)" />
                    </div>

                    <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '8px', textAlign: 'center' }}>
                        Zero-Trust Messaging
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.9rem', marginBottom: '32px', lineHeight: 1.5 }}>
                        Direct, end-to-end encrypted peer-to-peer connection. No servers store your messages.
                    </p>

                    {/* My ID Section */}
                    <div style={{ width: '100%', background: 'var(--bg-secondary)', borderRadius: '12px', padding: '16px', border: '1px solid var(--border-color)', marginBottom: '32px' }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                            Your Secure ID
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ flex: 1, minWidth: 0, padding: '8px 12px', background: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <code style={{ display: 'block', fontSize: '0.8rem', color: 'var(--accent-secondary)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {myId || 'Generating...'}
                                </code>
                            </div>
                            <button
                                onClick={handleCopy}
                                disabled={!myId}
                                style={{ padding: '8px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }}
                                onMouseOver={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                                onMouseOut={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                                title="Copy ID"
                            >
                                {copied ? <Check size={20} color="var(--accent-primary)" /> : <Copy size={20} />}
                            </button>
                        </div>
                        <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                                <Info size={16} color="var(--text-muted)" />
                                <span>Copy and share this ID.</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ width: '100%', height: '1px', background: 'var(--border-color)', marginBottom: '32px' }}></div>

                    {/* Connect Section */}
                    <form onSubmit={handleConnect} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                            Connect to a Friend
                        </label>
                        <input
                            type="text"
                            value={peerIdInput}
                            onChange={(e) => setPeerIdInput(e.target.value)}
                            placeholder="Paste friend's ID here..."
                            style={{ width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '12px 16px', fontSize: '0.9rem', color: 'var(--text-primary)', fontFamily: 'monospace', outline: 'none' }}
                            onFocus={(e) => e.target.style.borderColor = 'var(--accent-primary)'}
                            onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                        />
                        <button
                            type="submit"
                            disabled={!peerIdInput.trim() || isConnecting || webrtcState === 'connecting'}
                            style={{
                                width: '100%',
                                background: (!peerIdInput.trim() || isConnecting || webrtcState === 'connecting') ? 'var(--bg-secondary)' : 'var(--accent-primary)',
                                color: (!peerIdInput.trim() || isConnecting || webrtcState === 'connecting') ? 'var(--text-muted)' : '#fff',
                                border: 'none',
                                padding: '14px',
                                borderRadius: '12px',
                                marginTop: '8px',
                                fontSize: '0.95rem',
                                fontWeight: 500,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                cursor: (!peerIdInput.trim() || isConnecting || webrtcState === 'connecting') ? 'not-allowed' : 'pointer',
                                transition: 'var(--transition-fast)'
                            }}
                        >
                            {isConnecting || webrtcState === 'connecting' ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Connecting...
                                </>
                            ) : (
                                <>
                                    <UserPlus size={18} />
                                    Establish Secure Connection
                                </>
                            )}
                        </button>
                    </form>

                </div>
            </div>
        </div>
    );
};

export default WelcomeScreen;
