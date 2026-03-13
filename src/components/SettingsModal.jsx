import { useState } from 'react';
import { X, Lock, Unlock, RefreshCw } from 'lucide-react';
import { hashPassword, savePasswordHash, getPasswordHash, removePassword } from '../lib/password';
import webrtcService from '../lib/WebRTCService';

export default function SettingsModal({ onClose }) {
    const [newPassword, setNewPassword] = useState('');
    const [hasPassword, setHasPassword] = useState(!!getPasswordHash());
    const [message, setMessage] = useState('');
    const [networkMsg, setNetworkMsg] = useState('');

    const [brokerUrl, setBrokerUrl] = useState(localStorage.getItem('8osk_broker') || 'wss://test.mosquitto.org:8081');
    
    // Format existing STUN JSON for easy text editing
    const currentStun = localStorage.getItem('8osk_stun') || JSON.stringify([
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun.cloudflare.com:3478' },
            { urls: 'stun:stun.sipgate.net:3478' },
            { urls: 'stun:stun.twilio.com:3478' }
        ], null, 2);
    const [stunServersStr, setStunServersStr] = useState(currentStun);

    const handleSetPassword = async (e) => {
        e.preventDefault();
        if (!newPassword.trim()) return;
        const hash = await hashPassword(newPassword);
        savePasswordHash(hash);
        setHasPassword(true);
        setNewPassword('');
        setMessage('Master password updated successfully.');
        setTimeout(() => setMessage(''), 3000);
    };

    const handleRemovePassword = () => {
        removePassword();
        setHasPassword(false);
        setMessage('Password protection removed.');
        setTimeout(() => setMessage(''), 3000);
    };

    const handleSaveNetwork = () => {
        try {
            const stunArray = stunServersStr ? JSON.parse(stunServersStr) : null;
            webrtcService.updateNetworkSettings(brokerUrl, stunArray);
        } catch (e) {
            setNetworkMsg('Invalid STUN JSON format.');
            setTimeout(() => setNetworkMsg(''), 3000);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
            <div className="glass-card" style={{ width: '400px', maxWidth: '90vw', padding: '24px', position: 'relative' }}>
                <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <X size={24} />
                </button>

                <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Lock size={20} color="var(--accent-primary)" /> Security Settings
                </h2>

                {/* Password Section */}
                <div style={{ marginBottom: '32px' }}>
                    <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px' }}>App Lock</h3>
                    {message && <p style={{ color: 'var(--accent-secondary)', fontSize: '0.8rem', marginBottom: '12px' }}>{message}</p>}

                    {hasPassword ? (
                        <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '16px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-secondary)' }}>
                                <Lock size={16} />
                                <span style={{ fontSize: '0.9rem' }}>App is protected</span>
                            </div>
                            <button onClick={handleRemovePassword} style={{ background: 'transparent', border: '1px solid #ff6b6b', color: '#ff6b6b', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}>
                                Remove
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSetPassword} style={{ display: 'flex', gap: '8px' }}>
                            <input
                                type="password"
                                placeholder="Set new master password..."
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }}
                            />
                            <button type="submit" disabled={!newPassword.trim()} style={{ background: 'var(--accent-primary)', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: newPassword.trim() ? 'pointer' : 'not-allowed', opacity: newPassword.trim() ? 1 : 0.5 }}>
                                Save
                            </button>
                        </form>
                    )}
                </div>

                {/* Identity Section */}
                <div style={{ marginBottom: '32px' }}>
                    <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px' }}>Identity Management</h3>
                    <div style={{ background: 'rgba(255, 107, 107, 0.05)', border: '1px solid rgba(255, 107, 107, 0.2)', padding: '16px', borderRadius: '12px' }}>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
                            Resetting your identity generates a new cryptographic keypair. Your current Secure ID will be permanently destroyed.
                        </p>
                        <button
                            onClick={() => {
                                if (window.confirm("Are you sure? This will destroy your current identity and disconnect all peers.")) {
                                    webrtcService.clearIdentity();
                                }
                            }}
                            style={{ width: '100%', background: 'rgba(255, 107, 107, 0.1)', color: '#ff6b6b', border: '1px solid rgba(255, 107, 107, 0.3)', padding: '12px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', fontWeight: 500 }}
                        >
                            <RefreshCw size={18} />
                            Generate New Identity
                        </button>
                    </div>
                </div>

                {/* Network Overrides */}
                <div>
                    <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px' }}>Custom Network Overrides</h3>
                    {networkMsg && <p style={{ color: 'var(--accent-secondary)', fontSize: '0.8rem', marginBottom: '12px' }}>{networkMsg}</p>}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>MQTT Signaling Broker (wss://)</label>
                            <input
                                type="text"
                                value={brokerUrl}
                                onChange={(e) => setBrokerUrl(e.target.value)}
                                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none', fontSize: '0.85rem' }}
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>STUN ICE Servers (JSON List)</label>
                            <textarea
                                value={stunServersStr}
                                onChange={(e) => setStunServersStr(e.target.value)}
                                rows={6}
                                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none', fontSize: '0.85rem', fontFamily: 'monospace', resize: 'vertical' }}
                            />
                        </div>
                        <button onClick={handleSaveNetwork} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', transition: 'var(--transition-fast)' }} onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--text-muted)'} onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}>
                            Apply & Restart Network
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
