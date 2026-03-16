import { MessageCircle, Settings, Users, Copy, Check, Plus, Trash2, X, Edit2 } from 'lucide-react';
import { useState } from 'react';
import { useContacts } from '../hooks/useContacts';
import { useChat } from '../contexts/ChatContext';
import SettingsModal from './SettingsModal';

export default function Sidebar({ activeTab, setActiveTab, activeChat, setActiveChat, myToken, peers, isMobile }) {
    const [copied, setCopied] = useState(false);
    const { contacts, addContact, removeContact, editContact } = useContacts();
    const { startConnection, connectionState } = useChat();

    const [showAddContact, setShowAddContact] = useState(false);
    const [newContactName, setNewContactName] = useState('');
    const [newContactId, setNewContactId] = useState('');
    const [showSettings, setShowSettings] = useState(false);
    const [editingContactId, setEditingContactId] = useState(null);
    const [editingName, setEditingName] = useState('');

    const copyToken = () => {
        navigator.clipboard.writeText(myToken);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleAddContact = (e) => {
        e.preventDefault();
        if (!newContactName.trim() || !newContactId.trim()) return;
        addContact(newContactName.trim(), newContactId.trim());
        setNewContactName('');
        setNewContactId('');
        setShowAddContact(false);
    };

    return (
        <aside className="glass-panel" style={{
            width: isMobile ? '100%' : '320px',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            borderRight: isMobile ? 'none' : '1px solid var(--border-color)',
            borderTop: 'none', borderLeft: 'none', borderBottom: 'none',
            zIndex: 10
        }}>
            {/* Header / Logo */}
            <div style={{
                padding: 'calc(24px + env(safe-area-inset-top)) 20px 24px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                borderBottom: '1px solid var(--border-color)',
                WebkitAppRegion: 'drag'
            }}>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', margin: 0, letterSpacing: '0px' }}>
                    8osk/Messenger
                </h1>
            </div>

            {/* Profile / Token info */}
            <div style={{ padding: '20px' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>Your Token</p>
                <div
                    className="glass-card"
                    onClick={copyToken}
                    style={{
                        padding: '12px 16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        border: '1px solid var(--border-glow)',
                        background: 'rgba(138, 43, 226, 0.1)',
                        transition: 'var(--transition-fast)',
                        gap: '8px'
                    }}
                >
                    <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.85rem', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {myToken}
                        </span>
                    </div>
                    <div style={{ flexShrink: 0 }}>
                        {copied ? <Check size={16} color="var(--accent-secondary)" /> : <Copy size={16} color="var(--accent-primary)" />}
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div style={{ padding: '0 12px', display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                <button
                    className={`nav-btn ${activeTab === 'chats' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('chats'); setActiveChat(null); }}
                >
                    <MessageCircle size={18} />
                    <span>Chats</span>
                </button>
            </div>

            {/* Contacts Header */}
            <div style={{ padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', paddingLeft: '8px' }}>
                    Contacts
                </h2>
                <button
                    onClick={() => setShowAddContact(!showAddContact)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', padding: '4px' }}
                >
                    {showAddContact ? <X size={18} /> : <Plus size={18} />}
                </button>
            </div>

            {/* Add Contact Form */}
            {showAddContact && (
                <div style={{ padding: '0 12px 12px 12px' }}>
                    <form onSubmit={handleAddContact} style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <input
                            type="text"
                            placeholder="Name"
                            value={newContactName}
                            onChange={(e) => setNewContactName(e.target.value)}
                            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none' }}
                        />
                        <input
                            type="text"
                            placeholder="Secure ID"
                            value={newContactId}
                            onChange={(e) => setNewContactId(e.target.value)}
                            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none', fontFamily: 'monospace' }}
                        />
                        <button type="submit" disabled={!newContactName || !newContactId} style={{ background: 'var(--accent-primary)', color: '#fff', border: 'none', padding: '8px', borderRadius: '6px', fontSize: '0.85rem', cursor: (!newContactName || !newContactId) ? 'not-allowed' : 'pointer', opacity: (!newContactName || !newContactId) ? 0.5 : 1 }}>
                            Save Contact
                        </button>
                    </form>
                </div>
            )}

            {/* Contacts List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px 12px' }}>
                {contacts.length === 0 ? (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '20px' }}>
                        No contacts saved.<br />Click + to add a friend.
                    </p>
                ) : (
                    contacts.map(contact => {
                        const isConnected = connectionState === 'connected' && peers.length > 0; // Simple approximation for now

                        return (
                            <div
                                key={contact.id}
                                style={{
                                    padding: '12px',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    background: 'transparent',
                                    transition: 'var(--transition-fast)',
                                    marginBottom: '4px'
                                }}
                                className="contact-item"
                            >
                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <Users size={20} color="var(--text-muted)" />
                                </div>
                                <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', cursor: editingContactId === contact.id ? 'default' : 'pointer' }} onClick={() => {
                                    if (editingContactId !== contact.id) {
                                        setActiveChat(contact.id);
                                    }
                                }}>
                                    {editingContactId === contact.id ? (
                                        <input
                                            type="text"
                                            value={editingName}
                                            onChange={(e) => setEditingName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && editingName.trim()) {
                                                    editContact(contact.id, editingName.trim());
                                                    setEditingContactId(null);
                                                } else if (e.key === 'Escape') {
                                                    setEditingContactId(null);
                                                }
                                            }}
                                            autoFocus
                                            style={{
                                                width: '100%',
                                                padding: '4px 8px',
                                                borderRadius: '4px',
                                                border: '1px solid var(--accent-primary)',
                                                background: 'var(--bg-primary)',
                                                color: 'var(--text-primary)',
                                                fontSize: '0.95rem',
                                                outline: 'none',
                                                marginBottom: '2px'
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    ) : (
                                        <p style={{ fontWeight: 500, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>{contact.name}</p>
                                    )}
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>{contact.id}</p>
                                </div>

                                {editingContactId === contact.id ? (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (editingName.trim()) {
                                                editContact(contact.id, editingName.trim());
                                                setEditingContactId(null);
                                            }
                                        }}
                                        style={{ background: 'var(--accent-primary)', border: 'none', color: '#fff', cursor: 'pointer', padding: '6px', borderRadius: '4px', flexShrink: 0 }}
                                    >
                                        <Check size={14} />
                                    </button>
                                ) : (
                                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingContactId(contact.id);
                                                setEditingName(contact.name);
                                            }}
                                            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                                            title="Edit contact name"
                                            className="action-btn"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); removeContact(contact.id); }}
                                            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                                            title="Remove contact"
                                            className="action-btn delete-btn"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        )
                    })
                )}
            </div>

            {/* Footer Settings */}
            <div style={{ 
                padding: '16px 20px calc(16px + env(safe-area-inset-bottom)) 20px', 
                borderTop: '1px solid var(--border-color)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                background: 'rgba(255,255,255,0.02)' 
            }}>
                <Settings size={20} color="var(--text-muted)" style={{ cursor: 'pointer' }} onClick={() => setShowSettings(true)} />
            </div>

            {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

            <style dangerouslySetInnerHTML={{
                __html: `
        .nav-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          border-radius: 8px;
          cursor: pointer;
          transition: var(--transition-fast);
          font-family: inherit;
          font-size: 0.9rem;
          font-weight: 500;
        }
        .nav-btn:hover {
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-primary);
        }
        .nav-btn.active {
          background: rgba(138, 43, 226, 0.15);
          color: var(--accent-primary);
        }
        .contact-item:hover {
          background: rgba(255, 255, 255, 0.05) !important;
        }
        .action-btn:hover {
          color: var(--text-primary);
        }
        .action-btn.delete-btn:hover {
          color: #ff6b6b !important;
        }
      `}} />
        </aside>
    );
}
