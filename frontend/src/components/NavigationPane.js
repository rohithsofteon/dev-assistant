import React, { useState, useEffect } from 'react';
import { Plus, MessageSquare, Trash2, Edit2, Check, X, Filter, Menu, ChevronDown, ChevronLeft, Users } from 'lucide-react';

const NavigationPane = ({
  // Chat session props
  chatSessions,
  currentSessionId,
  onSessionSelect,
  onSessionCreate,
  onSessionDelete,
  onSessionRename,
  
  // Module/Team props
  modules = [],
  selectedModuleId,
  setSelectedModuleId,
  selectedTeamId,
  setSelectedTeamId,
  userTeams = [],
  
  // Navigation state props
  showSidebar,
  setShowSidebar,
  navExpanded,
  setNavExpanded,
  
  // Notification callback
  onNavStateChange
}) => {
  // Local state for dropdowns and editing
  const [showModuleDropdown, setShowModuleDropdown] = useState(false);
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editingSessionName, setEditingSessionName] = useState('');

  // Notify parent of navigation state changes
  useEffect(() => {
    if (onNavStateChange) {
      onNavStateChange({ 
        showSidebar, 
        navExpanded,
        navWidth: showSidebar ? (navExpanded ? 280 : 60) : 0
      });
    }
  }, [showSidebar, navExpanded, onNavStateChange]);

  // Handle clicking outside dropdowns to close them
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showTeamDropdown && !e.target.closest('.team-dropdown-parent')) {
        setShowTeamDropdown(false);
      }
      if (showModuleDropdown && !e.target.closest('.module-dropdown-parent')) {
        setShowModuleDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTeamDropdown, showModuleDropdown]);

  // Filter modules based on selected team
  const filteredModules = selectedTeamId 
    ? modules.filter(module => module.team_id === parseInt(selectedTeamId))
    : modules;

  const handleSessionRename = async (sessionId, newName) => {
    try {
      await onSessionRename(sessionId, newName);
      setEditingSessionId(null);
      setEditingSessionName('');
    } catch (error) {
      console.error('Error renaming session:', error);
    }
  };

  const startEditing = (session) => {
    setEditingSessionId(session.id);
    setEditingSessionName(session.session_name);
  };

  const cancelEditing = () => {
    setEditingSessionId(null);
    setEditingSessionName('');
  };

  if (!showSidebar) {
    return null;
  }

  return (
    <>
      <div style={{
        width: navExpanded ? '300px' : '65px',
        minWidth: navExpanded ? '300px' : '65px',
        backgroundColor: '#ffffff',
        borderRight: '1px solid #9ca3af',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        flexShrink: 0,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
        position: 'fixed',
        top: '0',
        left: '0',
        zIndex: '1000',
        boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.1)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      }}>
        {/* Navigation Header */}
        <div style={{
          padding: navExpanded ? '14px 24px' : '8px',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #f1f3f4',
          display: 'flex',
          alignItems: 'center',
          justifyContent: navExpanded ? 'space-between' : 'center',
        }}>
          {navExpanded ? (
            <>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <span style={{ 
                  fontSize: '16px', 
                  fontWeight: '600', 
                  color: '#1f2937',
                  letterSpacing: '-0.025em'
                }}>
                  Doc Sense - Assistant
                </span>
              </div>
              <button
                className="nav-pane-btn"
                onClick={() => setNavExpanded(false)}
                style={{
                  padding: '8px',
                  border: 'none',
                  background: 'transparent',
                  color: '#6b7280',
                  cursor: 'pointer',
                  borderRadius: '6px',
                  transition: 'all 0.15s ease',
                }}
              >
                <ChevronLeft size={16} />
              </button>
            </>
          ) : (
            <button
              className="nav-pane-btn"
              onClick={() => setNavExpanded(true)}
              style={{
                padding: '12px',
                border: 'none',
                background: 'transparent',
                color: '#6b7280',
                cursor: 'pointer',
                borderRadius: '8px',
                transition: 'all 0.15s ease',
              }}
            >
              <Menu size={20} />
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: navExpanded ? '24px' : '12px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: navExpanded ? 'stretch' : 'center',
          gap: navExpanded ? '0' : '12px',
        }}>
          {/* Team Selector Section */}
          {userTeams.length > 1 && (
            <div style={{ marginBottom: navExpanded ? '24px' : '0' }}>
              {navExpanded ? (
                <div style={{ width: '100%' }} className="team-dropdown-parent">
                  <label style={{
                    color: '#374151',
                    fontSize: '13px',
                    fontWeight: '600',
                    marginBottom: '12px',
                    display: 'block',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    Team
                  </label>
                  <button
                    className="nav-pane-btn"
                    style={{
                      width: '100%',
                      backgroundColor: '#f9fafb',
                      border: '1px solid #e5e7eb',
                      borderRadius: '10px',
                      color: '#1f2937',
                      padding: '12px 16px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      outline: 'none',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      textAlign: 'left',
                      fontFamily: 'inherit',
                    }}
                    onMouseEnter={(e) => { 
                      e.target.style.borderColor = '#d1d5db'; 
                      e.target.style.backgroundColor = '#ffffff';
                      e.target.style.boxShadow = '0 1px 3px 0 rgba(0, 0, 0, 0.1)';
                    }}
                    onMouseLeave={(e) => { 
                      e.target.style.borderColor = '#e5e7eb'; 
                      e.target.style.backgroundColor = '#f9fafb';
                      e.target.style.boxShadow = 'none';
                    }}
                    onClick={() => setShowTeamDropdown(v => !v)}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Users size={16} />
                      <span style={{ fontWeight: '500' }}>
                        {selectedTeamId
                          ? (userTeams.find(t => t.team_id === parseInt(selectedTeamId))?.name || 'Team')
                          : 'All Teams'}
                      </span>
                    </span>
                    <ChevronDown size={16} style={{ 
                      transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)', 
                      transform: showTeamDropdown ? 'rotate(180deg)' : 'none',
                      color: '#6b7280'
                    }} />
                  </button>
                  {showTeamDropdown && (
                    <div style={{
                      width: '100%',
                      background: '#ffffff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                      marginTop: '8px',
                      maxHeight: '280px',
                      overflowY: 'auto',
                      animation: 'slideDown 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      zIndex: 1001,
                    }}>
                      <div
                        style={{
                          padding: '12px 16px',
                          cursor: 'pointer',
                          color: '#1f2937',
                          fontWeight: '500',
                          borderBottom: '1px solid #f3f4f6',
                          backgroundColor: !selectedTeamId ? '#e5e5e5' : 'transparent',
                          transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                          fontSize: '14px',
                        }}
                        onMouseEnter={(e) => {
                          if (selectedTeamId) e.target.style.backgroundColor = '#f9fafb';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = !selectedTeamId ? '#e5e5e5' : 'transparent';
                        }}
                        onClick={() => {
                          setSelectedTeamId('');
                          setSelectedModuleId('');
                          setShowTeamDropdown(false);
                        }}
                      >
                        All Teams
                      </div>
                      {userTeams.map((team, idx) => (
                        <div
                          key={team.team_id}
                          style={{
                            padding: '12px 16px',
                            cursor: 'pointer',
                            color: selectedTeamId === team.team_id.toString() ? '#000000' : '#374151',
                            fontWeight: selectedTeamId === team.team_id.toString() ? 600 : 500,
                            borderBottom: idx === userTeams.length - 1 ? 'none' : '1px solid #f3f4f6',
                            backgroundColor: selectedTeamId === team.team_id.toString() ? '#e5e5e5' : 'transparent',
                            transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                            fontSize: '14px',
                          }}
                          onMouseEnter={(e) => {
                            if (selectedTeamId !== team.team_id.toString()) e.target.style.backgroundColor = '#f9fafb';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.backgroundColor = selectedTeamId === team.team_id.toString() ? '#e5e5e5' : 'transparent';
                          }}
                          onClick={() => {
                            setSelectedTeamId(team.team_id.toString());
                            setSelectedModuleId('');
                            setShowTeamDropdown(false);
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span>{team.name}</span>
                            {team.is_team_admin === 1 && (
                              <span style={{
                                fontSize: '11px',
                                color: '#666666',
                                marginTop: '2px',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                              }}>
                                Admin
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  className="nav-pane-btn"
                  onClick={() => setNavExpanded(true)}
                  style={{
                    width: '41px',
                    height: '41px',
                    padding: '0',
                    backgroundColor: '#f9fafb',
                    color: '#374151',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = '#ffffff';
                    e.target.style.borderColor = '#d1d5db';
                    e.target.style.boxShadow = '0 1px 3px 0 rgba(0, 0, 0, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = '#f9fafb';
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = 'none';
                  }}
                  title="Select Team"
                >
                  <Users size={18} />
                </button>
              )}
            </div>
          )}

          {/* Module Selector Section (Search in) */}
          {filteredModules.length > 0 && (
            <div style={{ marginBottom: navExpanded ? '24px' : '0' }}>
              {navExpanded ? (
                <div style={{ width: '100%' }} className="module-dropdown-parent">
                  <label style={{
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#374151',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '12px',
                    display: 'block',
                  }}>
                    Search in
                  </label>
                  <button
                    className="nav-pane-btn"
                    style={{
                      width: '100%',
                      backgroundColor: '#f9fafb',
                      border: '1px solid #e5e7eb',
                      borderRadius: '10px',
                      color: '#1f2937',
                      padding: '12px 16px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      outline: 'none',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontFamily: 'inherit',
                    }}
                    onMouseEnter={(e) => { 
                      e.target.style.borderColor = '#d1d5db'; 
                      e.target.style.backgroundColor = '#ffffff';
                      e.target.style.boxShadow = '0 1px 3px 0 rgba(0, 0, 0, 0.1)';
                    }}
                    onMouseLeave={(e) => { 
                      e.target.style.borderColor = '#e5e7eb'; 
                      e.target.style.backgroundColor = '#f9fafb';
                      e.target.style.boxShadow = 'none';
                    }}
                    onClick={() => setShowModuleDropdown(v => !v)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Filter size={16} />
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <span style={{ fontWeight: '500' }}>
                          {selectedModuleId
                            ? (filteredModules.find(m => m.module_id === selectedModuleId)?.name || 'Module')
                            : 'All Modules'}
                        </span>
                        {selectedModuleId && filteredModules.find(m => m.module_id === selectedModuleId)?.team_name && (
                          <span style={{
                            fontSize: '12px',
                            color: '#6b7280',
                            marginTop: '2px',
                            fontWeight: '400'
                          }}>
                            {filteredModules.find(m => m.module_id === selectedModuleId)?.team_name}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronDown size={16} style={{ 
                      transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)', 
                      transform: showModuleDropdown ? 'rotate(180deg)' : 'none',
                      color: '#6b7280'
                    }} />
                  </button>
                  {showModuleDropdown && (
                    <div style={{
                      width: '100%',
                      background: '#ffffff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                      marginTop: '8px',
                      maxHeight: '280px',
                      overflowY: 'auto',
                      animation: 'slideDown 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      zIndex: 1001,
                    }}>
                      <div
                        style={{
                          padding: '12px 16px',
                          cursor: 'pointer',
                          color: '#1f2937',
                          fontWeight: '500',
                          borderBottom: '1px solid #f3f4f6',
                          backgroundColor: !selectedModuleId ? '#e5e5e5' : 'transparent',
                          transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                          fontSize: '14px',
                        }}
                        onMouseEnter={(e) => {
                          if (selectedModuleId) e.target.style.backgroundColor = '#f9fafb';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = !selectedModuleId ? '#e5e5e5' : 'transparent';
                        }}
                        onClick={() => {
                          setSelectedModuleId('');
                          setShowModuleDropdown(false);
                        }}
                      >
                        All Modules
                      </div>
                      {filteredModules.map((module, idx) => (
                        <div
                          key={module.module_id}
                          style={{
                            padding: '12px 16px',
                            cursor: 'pointer',
                            color: selectedModuleId === module.module_id ? '#000000' : '#374151',
                            fontWeight: selectedModuleId === module.module_id ? 600 : 500,
                            borderBottom: idx === filteredModules.length - 1 ? 'none' : '1px solid #f3f4f6',
                            backgroundColor: selectedModuleId === module.module_id ? '#e5e5e5' : 'transparent',
                            transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                            fontSize: '14px',
                          }}
                          onMouseEnter={(e) => {
                            if (selectedModuleId !== module.module_id) e.target.style.backgroundColor = '#f9fafb';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.backgroundColor = selectedModuleId === module.module_id ? '#e5e5e5' : 'transparent';
                          }}
                          onClick={() => {
                            setSelectedModuleId(module.module_id);
                            setShowModuleDropdown(false);
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span>{module.name}</span>
                            {module.team_name && (
                              <span style={{
                                fontSize: '12px',
                                color: '#6b7280',
                                marginTop: '2px',
                                fontWeight: '400'
                              }}>
                                Team: {module.team_name}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  className="nav-pane-btn"
                  onClick={() => setNavExpanded(true)}
                  style={{
                    width: '41px',
                    height: '41px',
                    padding: '0',
                    backgroundColor: '#f9fafb',
                    color: '#374151',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = '#ffffff';
                    e.target.style.borderColor = '#d1d5db';
                    e.target.style.boxShadow = '0 1px 3px 0 rgba(0, 0, 0, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = '#f9fafb';
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = 'none';
                  }}
                  title="Search in"
                >
                  <Filter size={18} />
                </button>
              )}
            </div>
          )}

          {navExpanded && (
            <div style={{ 
              height: '1px', 
              background: 'linear-gradient(90deg, transparent 0%, #e5e7eb 50%, transparent 100%)', 
              margin: '24px 0' 
            }} />
          )}

          {/* New Chat Section */}
          <div style={{ marginBottom: navExpanded ? '24px' : '0' }}>
            {navExpanded ? (
              <button
                className="nav-pane-btn"
                onClick={() => onSessionCreate()}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  backgroundColor: '#333333',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  fontFamily: 'inherit',
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#666666';
                  e.target.style.transform = 'translateY(-1px)';
                  e.target.style.boxShadow = '0 4px 12px 0 rgba(0, 0, 0, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = '#333333';
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
                }}
              >
                <Plus size={18} color="currentColor" />
                New Chat
              </button>
            ) : (
              <button
                className="nav-pane-btn"
                onClick={() => onSessionCreate()}
                style={{
                  width: '41px',
                  height: '41px',
                  padding: '0',
                  backgroundColor: '#333333',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#666666';
                  e.target.style.transform = 'translateY(-1px)';
                  e.target.style.boxShadow = '0 4px 12px 0 rgba(0, 0, 0, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = '#333333';
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
                }}
                title="New Chat"
              >
                <Plus size={18} />
              </button>
            )}
          </div>

          {/* Chat History Section */}
          <div style={{ marginTop: '8px' }}>
            {navExpanded ? (
              <div>
                <div style={{
                  marginBottom: '16px',
                }}>
                  <span style={{
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#374151',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    Recent Conversations
                  </span>
                </div>
                {chatSessions.length === 0 ? (
                  <div style={{
                    padding: '24px 16px',
                    textAlign: 'center',
                    color: '#888888',
                    fontSize: '14px',
                    fontStyle: 'italic',
                  }}>
                    No conversations yet
                  </div>
                ) : (
                  chatSessions.map((session) => (
                    <div
                      key={session.id}
                      className="session-item"
                      style={{
                        padding: '12px 16px',
                        cursor: 'pointer',
                        backgroundColor: currentSessionId === session.id ? '#e5e5e5' : 'transparent',
                        borderRadius: '10px',
                        marginBottom: '4px',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        position: 'relative',
                        border: currentSessionId === session.id ? '1px solid #cccccc' : '1px solid transparent',
                      }}
                      onClick={() => onSessionSelect(session.id)}
                      onMouseEnter={e => {
                        if (currentSessionId !== session.id) {
                          e.currentTarget.style.backgroundColor = '#f9fafb';
                          e.currentTarget.style.borderColor = '#f3f4f6';
                        }
                      }}
                      onMouseLeave={e => {
                        if (currentSessionId !== session.id) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.borderColor = 'transparent';
                        }
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        width: '100%',
                      }}>
                        <MessageSquare size={16} style={{ color: '#6b7280', flexShrink: 0 }} />                        {editingSessionId === session.id ? (
                          <div style={{ flex: 1, display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input
                              type="text"
                              value={editingSessionName}
                              onChange={e => setEditingSessionName(e.target.value)}
                              onKeyPress={e => {
                                if (e.key === 'Enter') handleSessionRename(session.id, editingSessionName);
                                if (e.key === 'Escape') cancelEditing();
                              }}
                              autoFocus
                              style={{
                                flex: 1,
                                padding: '8px 12px',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                fontSize: '14px',
                                backgroundColor: '#ffffff',
                                outline: 'none',
                                transition: 'border-color 0.15s ease',
                                fontFamily: 'inherit',
                              }}
                              onFocus={e => e.target.style.borderColor = '#666666'}
                              onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                            />
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                handleSessionRename(session.id, editingSessionName);
                              }}
                              style={{
                                padding: '8px',
                                border: 'none',
                                background: '#333333',
                                color: 'white',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'background-color 0.15s ease',
                              }}
                              onMouseEnter={e => e.target.style.backgroundColor = '#666666'}
                              onMouseLeave={e => e.target.style.backgroundColor = '#333333'}
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                cancelEditing();
                              }}
                              style={{
                                padding: '8px',
                                border: 'none',
                                background: '#6b7280',
                                color: 'white',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'background-color 0.15s ease',
                              }}
                              onMouseEnter={e => e.target.style.backgroundColor = '#4b5563'}
                              onMouseLeave={e => e.target.style.backgroundColor = '#6b7280'}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <>
                            {/* Active session indicator */}
                            {currentSessionId === session.id && (
                              <div style={{
                                position: 'absolute',
                                left: '0',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                width: '3px',
                                height: '24px',
                                backgroundColor: '#333333',
                                borderRadius: '0 2px 2px 0',
                              }} />
                            )}
                            <div style={{
                              flex: 1,
                              fontSize: '14px',
                              color: currentSessionId === session.id ? '#1f2937' : '#4b5563',
                              fontWeight: currentSessionId === session.id ? '600' : '500',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              lineHeight: '1.5',
                              paddingLeft: currentSessionId === session.id ? '8px' : '0',
                            }}>
                              {session.session_name}
                            </div>
                            {/* Action buttons - show on hover */}
                            <div style={{
                              display: 'flex',
                              gap: '4px',
                              opacity: 0,
                              transition: 'opacity 0.2s ease',
                            }}
                            className="session-actions"
                            >
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  startEditing(session);
                                }}
                                style={{
                                  padding: '6px',
                                  border: 'none',
                                  background: 'transparent',
                                  color: '#6b7280',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.15s ease',
                                }}
                                onMouseEnter={e => {
                                  e.target.style.backgroundColor = '#f3f4f6';
                                  e.target.style.color = '#374151';
                                }}
                                onMouseLeave={e => {
                                  e.target.style.backgroundColor = 'transparent';
                                  e.target.style.color = '#6b7280';
                                }}
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  onSessionDelete(session.id);
                                }}
                                style={{
                                  padding: '6px',
                                  border: 'none',
                                  background: 'transparent',
                                  color: '#6b7280',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.15s ease',
                                }}
                                onMouseEnter={e => {
                                  e.target.style.backgroundColor = '#f3f3f3';
                                  e.target.style.color = '#333333';
                                }}
                                onMouseLeave={e => {
                                  e.target.style.backgroundColor = 'transparent';
                                  e.target.style.color = '#6b7280';
                                }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <button
                className="nav-pane-btn"
                onClick={() => setNavExpanded(true)}
                style={{
                  width: '41px',
                  height: '41px',
                  padding: '0',
                  backgroundColor: '#f9fafb',
                  color: '#374151',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#ffffff';
                  e.target.style.borderColor = '#d1d5db';
                  e.target.style.boxShadow = '0 1px 3px 0 rgba(0, 0, 0, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = '#f9fafb';
                  e.target.style.borderColor = '#e5e7eb';
                  e.target.style.boxShadow = 'none';
                }}
                title="Chat History"
              >
                <MessageSquare size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Navigation Footer */}
        {navExpanded && (
          <div style={{
            padding: '20px 24px',
            backgroundColor: '#fafbfc',
            borderTop: '1px solid #f1f3f4',
          }}>
            <button
              className="nav-pane-btn"
              onClick={() => setShowSidebar(false)}
              style={{
                width: '100%',
                padding: '12px 16px',
                backgroundColor: 'transparent',
                color: '#6b7280',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontFamily: 'inherit',
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#f9fafb';
                e.target.style.borderColor = '#d1d5db';
                e.target.style.color = '#374151';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'transparent';
                e.target.style.borderColor = '#e5e7eb';
                e.target.style.color = '#6b7280';
              }}
            >
              Hide Navigation
            </button>
          </div>
        )}
      </div>

      {/* CSS Styles */}
      <style jsx>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-8px);
            max-height: 0;
          }
          to {
            opacity: 1;
            transform: translateY(0);
            max-height: 280px;
          }
        }
        
        /* Navigation pane button styles */
        .nav-pane-btn {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .nav-pane-btn:focus {
          outline: 2px solid #666666;
          outline-offset: 2px;
        }
        
        .session-actions { 
          opacity: 0; 
          transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1); 
        }
        .session-item:hover .session-actions { 
          opacity: 1 !important; 
        }
        
        /* Custom scrollbar styles */
        ::-webkit-scrollbar { 
          width: 6px; 
        }
        ::-webkit-scrollbar-track { 
          background: transparent; 
        }
        ::-webkit-scrollbar-thumb { 
          background: #e5e7eb; 
          border-radius: 3px; 
        }
        ::-webkit-scrollbar-thumb:hover { 
          background: #d1d5db; 
        }
        
        /* Smooth scrolling */
        * {
          scroll-behavior: smooth;
        }
        
        /* Enhanced focus indicators for accessibility */
        button:focus-visible {
          outline: 2px solid #666666;
          outline-offset: 2px;
        }
        
        /* Improve text rendering */
        * {
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
      `}</style>
    </>
  );
};

export default NavigationPane;
