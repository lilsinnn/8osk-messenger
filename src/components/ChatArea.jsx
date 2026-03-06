import { useState, useRef, useEffect } from 'react';
import { useChat } from '../contexts/ChatContext';
import { useContacts } from '../hooks/useContacts';
import { Trash2, Paperclip, Download, File as FileIcon } from 'lucide-react';

export default function ChatArea({ activeChat }) {
    const { messages, sendMessage, sendFile, myToken, clearChat } = useChat();
    const { contacts } = useContacts();
    const [inputText, setInputText] = useState('');
    const [isSendingFile, setIsSendingFile] = useState(false);
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!inputText.trim()) return;
        const text = inputText;
        setInputText(''); // optimistic clear
        await sendMessage(text);
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            alert("File is too large. Please select a file under 5MB.");
            e.target.value = '';
            return;
        }

        setIsSendingFile(true);
        try {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const base64Data = event.target.result.split(',')[1];
                const meta = { name: file.name, type: file.type || 'application/octet-stream', size: file.size };
                await sendFile(meta, base64Data);
                setIsSendingFile(false);
            };
            reader.readAsDataURL(file);
        } catch (err) {
            console.error(err);
            setIsSendingFile(false);
        }
        e.target.value = '';
    };

    const handleClearChat = () => {
        if (window.confirm("Are you sure you want to clear this chat? This action cannot be undone.")) {
            clearChat();
        }
    };

    const getContactName = (id) => {
        if (id === 'me') return 'Me';
        const contact = contacts.find(c => c.id === id);
        return contact ? contact.name : `${id.substring(0, 8)}...`;
    };

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)', height: '100%' }}>
            {/* Header */}
            <div className="glass-panel" style={{
                padding: '16px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--border-color)',
                borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                zIndex: 10
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--accent-secondary)', boxShadow: '0 0 8px var(--accent-secondary)' }} />
                    <div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 500 }}>{getContactName(activeChat)}</h3>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>E2E Encrypted</span>
                    </div>
                </div>
                {messages.length > 0 && (
                    <button
                        onClick={handleClearChat}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '6px 12px', borderRadius: '6px', transition: 'var(--transition-fast)' }}
                        onMouseOver={(e) => { e.currentTarget.style.color = '#ff6b6b'; e.currentTarget.style.background = 'rgba(255, 107, 107, 0.1)'; }}
                        onMouseOut={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                        title="Clear chat history"
                    >
                        <Trash2 size={16} />
                        Clear
                    </button>
                )}
            </div>

            {/* Messages List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ textAlign: 'center', color: 'var(--accent-primary)', fontSize: '0.85rem', marginBottom: '16px' }}>
                    Secure connection established. Messages are encrypted end-to-end.
                </p>

                {messages.map((msg, idx) => {
                    if (msg.type === 'system') {
                        return (
                            <div key={idx} style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', margin: '8px 0' }}>
                                {msg.text}
                            </div>
                        );
                    }

                    const isMine = msg.sender === 'me';
                    return (
                        <div key={idx} style={{
                            alignSelf: isMine ? 'flex-end' : 'flex-start',
                            maxWidth: '70%',
                            background: isMine ? 'var(--accent-primary)' : 'var(--bg-glass)',
                            border: isMine ? 'none' : '1px solid var(--border-color)',
                            padding: '12px 16px',
                            borderRadius: '16px',
                            borderBottomRightRadius: isMine ? '4px' : '16px',
                            borderBottomLeftRadius: isMine ? '16px' : '4px',
                            boxShadow: isMine ? '0 4px 12px var(--accent-glow)' : '0 4px 12px rgba(0,0,0,0.1)'
                        }}>
                            {!isMine && (
                                <span style={{ fontSize: '0.75rem', color: 'var(--accent-secondary)', display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                                    {getContactName(msg.sender)}
                                </span>
                            )}
                            {msg.type === 'file' ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(0,0,0,0.15)', padding: '10px 14px', borderRadius: '8px', marginTop: '4px' }}>
                                    <FileIcon size={24} color={isMine ? '#fff' : 'var(--accent-primary)'} />
                                    <div style={{ flex: 1, minWidth: 0, marginRight: '16px' }}>
                                        <p style={{ fontSize: '0.85rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>{msg.meta.name}</p>
                                        <p style={{ fontSize: '0.7rem', color: isMine ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)', margin: 0, marginTop: '2px' }}>{(msg.meta.size / 1024).toFixed(1)} KB</p>
                                    </div>
                                    <a
                                        href={`data:${msg.meta.type};base64,${msg.data}`}
                                        download={msg.meta.name}
                                        style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', transition: 'var(--transition-fast)', flexShrink: 0 }}
                                        title="Download securely"
                                    >
                                        <Download size={16} />
                                    </a>
                                </div>
                            ) : (
                                <p style={{ fontSize: '0.95rem', lineHeight: 1.4, wordBreak: 'break-word', margin: 0 }}>{msg.text}</p>
                            )}
                            <span style={{ fontSize: '0.7rem', color: isMine ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)', display: 'block', marginTop: '4px', textAlign: 'right' }}>
                                {new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    )
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div style={{ padding: '24px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}>
                <div className="glass-card" style={{ display: 'flex', padding: '8px', alignItems: 'center', gap: '8px' }}>
                    <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileSelect} />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isSendingFile}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: isSendingFile ? 'not-allowed' : 'pointer', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isSendingFile ? 0.5 : 1, transition: 'var(--transition-fast)', borderRadius: '50%' }}
                        onMouseOver={(e) => !isSendingFile && (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                        onMouseOut={(e) => !isSendingFile && (e.currentTarget.style.background = 'transparent')}
                        title="Attach File (Max 5MB)"
                    >
                        <Paperclip size={20} />
                    </button>
                    <input
                        type="text"
                        placeholder="Type an encrypted message..."
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        style={{
                            flex: 1,
                            background: 'transparent',
                            border: 'none',
                            padding: '8px 12px',
                            color: 'var(--text-primary)',
                            outline: 'none',
                            fontSize: '0.95rem'
                        }}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!inputText.trim()}
                        style={{
                            background: inputText.trim() ? 'var(--accent-primary)' : 'var(--bg-glass)',
                            color: inputText.trim() ? '#fff' : 'var(--text-muted)',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '10px 24px',
                            fontWeight: 600,
                            cursor: inputText.trim() ? 'pointer' : 'not-allowed',
                            transition: 'var(--transition-fast)'
                        }}>
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
}
