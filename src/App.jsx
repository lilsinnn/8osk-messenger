import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import WelcomeScreen from './components/WelcomeScreen';
import ChatArea from './components/ChatArea';
import LockScreen from './components/LockScreen';
import { useChat } from './contexts/ChatContext';
import { getPasswordHash } from './lib/password';

function App() {
  const [activeTab, setActiveTab] = useState('chats'); 
  const [isUnlocked, setIsUnlocked] = useState(!getPasswordHash());
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [mobileView, setMobileView] = useState('sidebar'); // 'sidebar' | 'chat'
  const [selectedChat, setSelectedChat] = useState(null);

  const {
    myToken,
    connectionState,
    remotePeerId,
    setRemotePeerId,
    isReady,
    error,
    startConnection
  } = useChat();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (selectedChat) {
      setMobileView('chat');
      setRemotePeerId(selectedChat); // Pre-load history for offline view
      // Attempt connection in background, but allow viewing local history/sending fallback immediately
      if (connectionState !== 'connected' && connectionState !== 'connecting') {
          startConnection(selectedChat);
      }
    } else {
      setMobileView('sidebar');
      setRemotePeerId(null);
    }
  }, [selectedChat, connectionState, startConnection, setRemotePeerId]);

  if (!isUnlocked) {
    return <LockScreen onUnlock={() => setIsUnlocked(true)} />;
  }

  // Anti-Sniffing / DevTools Prevention
  useEffect(() => {
    const handleContextMenu = (e) => e.preventDefault();
    document.addEventListener('contextmenu', handleContextMenu);

    const handleKeyDown = (e) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && e.key === 'I') ||
        (e.ctrlKey && e.shiftKey && e.key === 'J') ||
        (e.ctrlKey && e.key === 'U') ||
        (e.metaKey && e.altKey && e.key === 'I') || 
        (e.metaKey && e.altKey && e.key === 'J') || 
        (e.metaKey && e.key === 'U')                
      ) {
        e.preventDefault();
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  if (!isReady) {
    return (
      <div style={{ height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <div style={{
          width: '60px', height: '60px',
          borderRadius: '50%',
          border: '4px solid var(--border-color)',
          borderTopColor: 'var(--accent-primary)',
          animation: 'spin 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite'
         }} />
         <style dangerouslySetInnerHTML={{ __html: `@keyframes spin { to { transform: rotate(360deg); } }` }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', padding: '20px', textAlign: 'center' }}>
        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255, 50, 50, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
          <span style={{ fontSize: '2rem' }}>⚠️</span>
        </div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '16px' }}>Connection Error</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', lineHeight: 1.6 }}>{error}</p>
      </div>
    );
  }

  return (
    <div className="app-container" style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
      {(!isMobile || mobileView === 'sidebar') && (
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          activeChat={selectedChat}
          setActiveChat={setSelectedChat}
          myToken={myToken}
          peers={connectionState === 'connected' && remotePeerId ? [remotePeerId] : []}
          isMobile={isMobile}
        />
      )}

      {(!isMobile || mobileView === 'chat') && (
        <main className="main-content" style={{ flex: 1, display: 'flex', position: 'relative', width: '100%', height: '100%' }}>
          {selectedChat ? (
            <ChatArea activeChat={selectedChat} onBack={isMobile ? () => { setSelectedChat(null); } : undefined} />
          ) : (
            <WelcomeScreen />
          )}
        </main>
      )}
    </div>
  );
}

export default App;
