import { useState } from 'react';
import { Lock, ArrowRight, Loader2 } from 'lucide-react';
import { hashPassword, getPasswordHash } from '../lib/password';

export default function LockScreen({ onUnlock }) {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        const currentHash = getPasswordHash();
        if (!currentHash) {
            onUnlock(); // Failsafe
            return;
        }

        const inputHash = await hashPassword(password);
        if (inputHash === currentHash) {
            onUnlock();
        } else {
            setError('Incorrect password');
            setIsLoading(false);
        }
    };

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', background: 'var(--bg-primary)', color: 'var(--text-primary)', height: '100vh', width: '100vw' }}>
            <div style={{ maxWidth: '360px', width: '100%', position: 'relative' }}>
                <div className="glass-card" style={{ padding: '40px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>

                    <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(138, 43, 226, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', border: '1px solid var(--accent-primary)' }}>
                        <Lock size={32} color="var(--accent-secondary)" />
                    </div>

                    <h1 style={{ fontSize: '1.4rem', fontWeight: 600, marginBottom: '8px', textAlign: 'center' }}>
                        App Locked
                    </h1>
                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.9rem', marginBottom: '32px' }}>
                        Enter your master password to decrypt your identity and access your messages.
                    </p>

                    <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                                placeholder="Master Password"
                                autoFocus
                                style={{
                                    width: '100%',
                                    background: 'var(--bg-secondary)',
                                    border: `1px solid ${error ? '#ff6b6b' : 'var(--border-color)'}`,
                                    borderRadius: '12px',
                                    padding: '14px 16px',
                                    fontSize: '1rem',
                                    color: 'var(--text-primary)',
                                    outline: 'none',
                                    transition: 'var(--transition-fast)'
                                }}
                                onFocus={(e) => !error && (e.target.style.borderColor = 'var(--accent-primary)')}
                                onBlur={(e) => !error && (e.target.style.borderColor = 'var(--border-color)')}
                            />
                            {error && <p style={{ color: '#ff6b6b', fontSize: '0.8rem', marginTop: '8px', textAlign: 'center' }}>{error}</p>}
                        </div>

                        <button
                            type="submit"
                            disabled={!password || isLoading}
                            style={{
                                width: '100%',
                                background: (!password || isLoading) ? 'var(--bg-secondary)' : 'var(--accent-primary)',
                                color: (!password || isLoading) ? 'var(--text-muted)' : '#fff',
                                border: 'none',
                                padding: '14px',
                                borderRadius: '12px',
                                fontSize: '1rem',
                                fontWeight: 500,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                cursor: (!password || isLoading) ? 'not-allowed' : 'pointer',
                                transition: 'var(--transition-fast)'
                            }}
                        >
                            {isLoading ? <Loader2 size={20} className="animate-spin" /> : (
                                <>
                                    Unlock App
                                    <ArrowRight size={20} />
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
