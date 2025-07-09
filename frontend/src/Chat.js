import React, { useState, useRef, useEffect } from 'react';
import { styles } from './styles';
import { Send, Menu } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import NavigationPane from './components/NavigationPane';

const Chat = ({
  chatHistory,
  setChatHistory,
  loading,
  setLoading,
  question,
  setQuestion,
  getBaseUrl,
  selectedModuleId,
  setSelectedModuleId, // <-- add this
  modules = [], // <-- add this
  userConfig,
  onNavStateChange // <-- add this to notify parent of nav state changes
}) => {
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  
  // Chat session management state
  const [chatSessions, setChatSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [showSidebar, setShowSidebar] = useState(true);
  
  // Navigation pane state
  const [navExpanded, setNavExpanded] = useState(true);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [userTeams, setUserTeams] = useState([]);

  // Notify parent of navigation state changes
  useEffect(() => {
    if (onNavStateChange) {
      onNavStateChange({ 
        showSidebar, 
        navExpanded,
        navWidth: showSidebar ? (navExpanded ? 300 : 65) : 0
      });
    }
  }, [showSidebar, navExpanded, onNavStateChange]);

  // Load chat sessions on component mount
  useEffect(() => {
    loadChatSessions();
    fetchUserTeams();
  }, []);

  const fetchUserTeams = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getBaseUrl()}/api/user/teams`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.teams) {
        setUserTeams(data.teams);
      }
    } catch (error) {
      console.error('Error fetching user teams:', error);
    }
  };

  const loadChatSessions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getBaseUrl()}/api/chat/sessions`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setChatSessions(data.sessions);
        // If no current session, create a new one
        if (data.sessions.length === 0) {
          createNewSession();
        } else if (!currentSessionId) {
          // Load the most recent session
          const mostRecent = data.sessions[0];
          setCurrentSessionId(mostRecent.id);
          loadSessionHistory(mostRecent.id);
        }
      }
    } catch (error) {
      console.error('Error loading chat sessions:', error);
    }
  };

  const createNewSession = async (sessionName = "New Chat") => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getBaseUrl()}/api/chat/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ session_name: sessionName }),
      });
      const data = await response.json();
      if (data.success) {
        await loadChatSessions();
        setCurrentSessionId(data.session_id);
        setChatHistory([]); // Clear current chat
      }
    } catch (error) {
      console.error('Error creating new session:', error);
    }
  };

  const loadSessionHistory = async (sessionId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getBaseUrl()}/api/chat/sessions/${sessionId}/history`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        const formattedHistory = data.history.map(msg => ({
          type: msg.role === 'assistant' ? 'bot' : msg.role,
          message: msg.content
        }));
        setChatHistory(formattedHistory);
        setCurrentSessionId(sessionId);
      }
    } catch (error) {
      console.error('Error loading session history:', error);
    }
  };

  const deleteSession = async (sessionId) => {
    if (!window.confirm('Are you sure you want to delete this chat session?')) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getBaseUrl()}/api/chat/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        // If we deleted the current session, create a new one
        if (sessionId === currentSessionId) {
          setChatHistory([]);
          setCurrentSessionId(null);
          await createNewSession();
        }
        await loadChatSessions();
      }
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  };

  const updateSessionName = async (sessionId, newName) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getBaseUrl()}/api/chat/sessions/${sessionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ session_name: newName }),
      });
      const data = await response.json();
      if (data.success) {
        await loadChatSessions();
      }
    } catch (error) {
      console.error('Error updating session name:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!question.trim() || loading) return;

    const userMessage = question.trim();
    setQuestion('');
    
    // Check if this is the second user message BEFORE adding it to chat history
    // We want to update the session name on the second user query
    const userMessageCount = chatHistory.filter(msg => msg.type === 'user').length;
    const isSecondMessage = userMessageCount === 1; // This will be the second user message
    
    setChatHistory(prev => [...prev, { type: 'user', message: userMessage }]);
    setLoading(true);
    let botMessage = '';
    let botMessageIndex = null;
    
    try {
      const token = localStorage.getItem('token');
      
      // Get recent chat history for context (last 6 messages, 3 pairs)
      const recentHistory = chatHistory.slice(-6).map(msg => ({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.message
      }));
      
      const response = await fetch(`${getBaseUrl()}/api/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          question: userMessage,
          module_id: selectedModuleId || null,
          config: userConfig,
          chat_history: recentHistory,
          session_id: currentSessionId, // Include session ID for automatic saving
        }),
      });
      
      if (!response.ok) {
        let errText = await response.text();
        throw new Error(errText || 'Server error');
      }
      
      // Streaming response handling
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let done = false;
      let buffer = '';
      
      // Add a placeholder bot message to update as we stream
      botMessageIndex = chatHistory.length + 1;
      setChatHistory(prev => [...prev, { type: 'bot', message: '' }]);
      
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          let parts = buffer.split(/\n\n/);
          buffer = parts.pop();
          for (let part of parts) {
            part = part.trim();
            if (part.startsWith('data:')) {
              let jsonStr = part.replace(/^data:/, '').trim();
              if (!jsonStr) continue;
              try {
                const parsed = JSON.parse(jsonStr);
                if (parsed.chunk !== undefined) {
                  botMessage += parsed.chunk;
                  setChatHistory(prev => {
                    const updated = [...prev];
                    updated[botMessageIndex] = { type: 'bot', message: botMessage };
                    return updated;
                  });
                }
                if (parsed.done) {
                  done = true;
                }
                if (parsed.error) {
                  throw new Error(parsed.error);
                }
              } catch (err) {
                // Ignore JSON parse errors for incomplete chunks
              }
            }
          }
        }
      }
      
      // If nothing streamed, show fallback
      if (!botMessage) {
        setChatHistory(prev => {
          const updated = [...prev];
          updated[botMessageIndex] = { type: 'bot', message: 'Sorry, I received an empty response from the server.' };
          return updated;
        });
      }

      // Refresh session list to pick up any auto-generated session names from backend
      await loadChatSessions();

      // Note: Session name generation is now handled automatically by the backend
      // when the first substantive (non-greeting) question is asked
    } catch (error) {
      console.error('Error:', error);
      if (botMessageIndex !== null) {
        setChatHistory(prev => {
          const updated = [...prev];
          updated[botMessageIndex] = { type: 'bot', message: 'Sorry, I encountered an error while processing your request.' };
          return updated;
        });
      } else {
        setChatHistory(prev => [...prev, { type: 'bot', message: 'Sorry, I encountered an error while processing your request.' }]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [question]);

  // Auto-collapse navigation when user starts typing
  const handleInputFocus = () => {
    if (navExpanded && question.trim() === '') {
      setNavExpanded(false);
    }
  };

  const clearCurrentSession = async () => {
    if (currentSessionId) {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${getBaseUrl()}/api/chat/sessions/${currentSessionId}/messages`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          setChatHistory([]); // Clear frontend
        } else {
          console.error('Failed to clear session messages');
          // Still clear frontend as fallback
          setChatHistory([]);
        }
      } catch (error) {
        console.error('Error clearing session messages:', error);
        // Still clear frontend as fallback
        setChatHistory([]);
      }
    } else {
      // No current session, just clear frontend
      setChatHistory([]);
    }
  };

  return (
    <>
    <div style={{
      ...styles.mainContent,
      background: '#ffffff',
      display: 'flex',
      flexDirection: 'row',
      height: 'calc(100vh - 80px)', // Account for header
      overflow: 'hidden',
      width: '100%',
      position: 'relative',
    }}>
      {/* Navigation Pane */}
      <NavigationPane
        chatSessions={chatSessions}
        currentSessionId={currentSessionId}
        onSessionSelect={loadSessionHistory}
        onSessionCreate={createNewSession}
        onSessionDelete={deleteSession}
        onSessionRename={updateSessionName}
        modules={modules}
        selectedModuleId={selectedModuleId}
        setSelectedModuleId={setSelectedModuleId}
        selectedTeamId={selectedTeamId}
        setSelectedTeamId={setSelectedTeamId}
        userTeams={userTeams}
        showSidebar={showSidebar}
        setShowSidebar={setShowSidebar}
        navExpanded={navExpanded}
        setNavExpanded={setNavExpanded}
        onNavStateChange={onNavStateChange}
      />

      {/* Main Chat Area */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        background: '#ffffff',
        height: '100%',
        overflow: 'hidden',
        marginLeft: showSidebar ? (navExpanded ? '300px' : '65px') : '0',
        transition: 'margin-left 0.3s ease',
      }}>
        {/* Show navigation toggle button when sidebar is hidden */}
        {!showSidebar && (
          <div style={{
            position: 'absolute',
            top: '16px',
            left: '16px',
            zIndex: 1001,
          }}>
            <button
              onClick={() => {
                setShowSidebar(true);
                setNavExpanded(true);
              }}
              style={{
                padding: '8px 12px',
                backgroundColor: '#f3f4f6',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => {
                e.target.style.backgroundColor = '#e5e7eb';
              }}
              onMouseLeave={e => {
                e.target.style.backgroundColor = '#f3f4f6';
              }}
            >
              <Menu size={14} />
              Show Navigation
            </button>
          </div>
        )}

        {/* Chat Container */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          background: '#ffffff',
          height: '100%',
        }}>          {/* Messages Area */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            paddingBottom: '100px', // Space for floating input
            height: '100%',
          }}>{chatHistory.length === 0 && (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#718096',
              fontSize: '18px',
              fontWeight: '400',
              textAlign: 'center',
              padding: '48px 24px',
            }}>
              <div style={{
                fontSize: '24px',
                marginBottom: '12px',
                color: '#4a5568',
                fontWeight: '600',
              }}>
                Welcome to Developer Assistant
              </div>
              <div style={{
                fontSize: '16px',
                color: '#718096',
                maxWidth: '400px',
                lineHeight: '1.5',
              }}>
                Ask me anything about your documents and I'll help you find the information you need.
              </div>
            </div>
          )}{chatHistory.map((msg, index) => (
            <div
              key={index}
              style={{
                ...styles.message,
                ...(msg.type === 'user' ? styles.userMessage : styles.botMessage),
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '16px',
                maxWidth: '768px',
                margin: '0 auto',
                width: '100%',
                padding: '0 24px',
                boxSizing: 'border-box',
              }}>                {/* Avatar - Only for user messages */}
                {msg.type === 'user' && (
                  <div 
                    className="message-avatar"
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: '#4a5568',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      fontSize: '16px',
                      fontWeight: '600',
                      flexShrink: 0,
                      marginTop: '2px',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                      transition: 'transform 0.2s ease',
                      cursor: 'pointer',
                    }}
                  >
                    R
                  </div>
                )}
                  {/* Message Content */}
                <div style={{
                  ...styles.messageContent,
                  flex: 1,
                  paddingTop: '0px',
                  fontSize: '16px',
                  lineHeight: '1.5',
                }}>
                  {msg.type === 'bot' ? (
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                        table: ({node, ...props}) => <table className="markdown-table" {...props} />,
                        p: ({children}) => <p style={{margin: '0 0 16px 0', lineHeight: '1.5', fontSize: '16px'}}>{children}</p>,
                        ul: ({children}) => <ul style={{margin: '0 0 16px 0', paddingLeft: '20px'}}>{children}</ul>,
                        ol: ({children}) => <ol style={{margin: '0 0 16px 0', paddingLeft: '20px'}}>{children}</ol>,
                        li: ({children}) => <li style={{marginBottom: '4px'}}>{children}</li>,
                        h1: ({children}) => <h1 style={{margin: '0 0 16px 0', fontSize: '22px', fontWeight: '600'}}>{children}</h1>,
                        h2: ({children}) => <h2 style={{margin: '0 0 16px 0', fontSize: '20px', fontWeight: '600'}}>{children}</h2>,
                        h3: ({children}) => <h3 style={{margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600'}}>{children}</h3>,code: ({children, inline}) => inline ? 
                          <code style={{backgroundColor: '#f1f5f9', padding: '2px 4px', borderRadius: '3px', fontSize: '14px', wordBreak: 'break-word'}}>{children}</code> :
                          <code style={{display: 'block', backgroundColor: '#f1f5f9', padding: '12px', borderRadius: '6px', fontSize: '14px', margin: '8px 0', overflow: 'auto', maxWidth: '100%', whiteSpace: 'pre-wrap', wordBreak: 'break-word'}}>{children}</code>
                      }}
                    >
                      {msg.message}
                    </ReactMarkdown>                  ) : (
                    <div style={{
                      backgroundColor: '#f7fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '12px 16px',
                      maxWidth: 'fit-content',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                      lineHeight: '1.6',
                      color: '#2d3748',
                      fontSize: '16px',
                      margin: '0',
                      fontWeight: '400',
                    }}>
                      {msg.message}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}          {loading && (
            <div style={{
              ...styles.message,
              ...styles.botMessage,
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '16px',
                maxWidth: '768px',
                margin: '0 auto',
                width: '100%',
                padding: '0 24px',
                boxSizing: 'border-box',
              }}>
                <div style={{
                  ...styles.messageContent,
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  paddingTop: '2px',
                }}>
                  <div style={{
                    display: 'flex',
                    gap: '4px',
                  }}>
                    <div style={{
                      width: '6px',
                      height: '6px',
                      backgroundColor: '#9ca3af',
                      borderRadius: '50%',
                      animation: 'pulse 1.5s ease-in-out infinite',
                    }} />
                    <div style={{
                      width: '6px',
                      height: '6px',
                      backgroundColor: '#9ca3af',
                      borderRadius: '50%',
                      animation: 'pulse 1.5s ease-in-out infinite 0.2s',
                    }} />
                    <div style={{
                      width: '6px',
                      height: '6px',
                      backgroundColor: '#9ca3af',
                      borderRadius: '50%',
                      animation: 'pulse 1.5s ease-in-out infinite 0.4s',
                    }} />
                  </div>
                </div>
              </div>
            </div>
          )}
            <div ref={messagesEndRef} />
          </div>

          {/* Floating Input Area - Claude Style */}
          <div style={{
            position: 'absolute',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '90%',
            maxWidth: '768px',
            zIndex: 1000,
            backgroundColor: '#ffffff',
            borderRadius: '26px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
            border: '1px solid #e5e7eb',
            padding: '16px 20px',
          }}>

          <form onSubmit={handleSubmit} style={{
            display: 'flex',
            gap: '16px',
            alignItems: 'end',
            margin: 0,
          }}>            <textarea
              ref={textareaRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyPress={handleKeyPress}
              onFocus={handleInputFocus}
              placeholder="Message Developer Assistant..."
              style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: '20px',
                border: '1px solid #e2e8f0',
                background: '#f8f9fa',
                color: '#2d3748',
                fontSize: '16px',
                outline: 'none',
                transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                resize: 'none',
                minHeight: '20px',
                maxHeight: '120px',
                lineHeight: '1.5',
                overflow: 'hidden',
              }}
              disabled={loading}
              rows={1}
            /><button
              type="submit"
              disabled={!question.trim() || loading}
              style={{
                padding: '10px',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: (!question.trim() || loading) ? '#cbd5e0' : '#10a37f',
                color: '#ffffff',
                cursor: (!question.trim() || loading) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.2s ease, transform 0.1s ease, box-shadow 0.2s ease',
                width: '40px',
                height: '40px',
                boxShadow: (!question.trim() || loading) ? 'none' : '0 2px 8px rgba(16, 163, 127, 0.3)',
                flexShrink: 0,
              }}
            >
              <Send size={18} />
            </button>
            
            {/* Clear Conversation Button */}
            {chatHistory.length > 0 && (
              <button
                type="button"
                onClick={clearCurrentSession}
                style={{
                  background: '#f3f4f6',
                  color: '#6b7280',
                  border: 'none',
                  borderRadius: '16px',
                  padding: '0 12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: '500',
                  height: '32px',
                  flexShrink: 0,
                  marginLeft: '8px',
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#e5e7eb';
                  e.target.style.color = '#374151';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#f3f4f6';
                  e.target.style.color = '#6b7280';
                }}
              >
                Clear
              </button>
            )}            </form>
          </div>
        </div>
      </div>
    </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 0.4;
          }
          50% {
            opacity: 1;
          }
        }
        @keyframes messageHover {
          from { transform: translateY(0); }
          to { transform: translateY(-1px); }
        }
        textarea:focus {
          border-color: #111 !important;
          box-shadow: 0 0 0 3px rgba(0,0,0,0.08) !important;
          outline: none !important;
          background: #fff !important;
        }
        /* Avatar hover effects */
        .message-avatar:hover { transform: scale(1.05); }
        
        /* General scrollbar */
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #f8f9fa; border-radius: 3px; }
        ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #9ca3af; }
      `}</style>
    </>
  );
};

export default Chat;