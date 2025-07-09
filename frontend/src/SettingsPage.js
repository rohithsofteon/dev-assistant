import React, { useState, useEffect } from 'react';
import { Users, Database, ArrowLeft, Settings as SettingsIcon, Users as UsersIcon } from 'lucide-react';
import TeamManagementTab from './components/TeamManagementTab';
import KnowledgeBaseTab from './components/KnowledgeBaseTab';
import ConfigurationTab from './components/ConfigurationTab';
import { getBaseUrl } from './utils';

const SettingsPage = ({ onBack, role, onConfigUpdated }) => {
  const [userTeams, setUserTeams] = useState([]);
  const [isTeamAdmin, setIsTeamAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState('configuration');
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0%, 100% {
          transform: scale(1);
          opacity: 1;
        }
        50% {
          transform: scale(1.05);
          opacity: 0.9;
        }
      }
      @keyframes shimmer {
        0% { background-position: -200px 0; }
        100% { background-position: calc(200px + 100%) 0; }
      }
      @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .animate-fadeInUp { animation: fadeInUp 0.5s ease-out; }
      .modern-dropdown {
        appearance: none;
        -webkit-appearance: none;
        -moz-appearance: none;
        background: #fff;
        border: 1.5px solid #e5e7eb;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        padding: 16px 44px 16px 18px;
        font-size: 1.08rem;
        font-weight: 600;
        color: #22223b;
        transition: border-color 0.2s, box-shadow 0.2s;
        outline: none;
        width: 100%;
        cursor: pointer;
        margin-top: 4px;
        margin-bottom: 2px;
        background-image: url('data:image/svg+xml;utf8,<svg fill="none" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M6 9l6 6 6-6" stroke="%239ca3af" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>');
        background-repeat: no-repeat;
        background-position: right 16px center;
        background-size: 22px 22px;
      }
      .modern-dropdown:focus {
        border-color: #6366f1;
        box-shadow: 0 0 0 2px #6366f133;
      }
      .modern-dropdown:hover {
        border-color: #a5b4fc;
      }
    `;
    document.head.appendChild(style);

    // Fetch user teams to check if user is team admin
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
          // Check if user is admin of any team
          const hasTeamAdmin = data.teams.some(team => team.is_team_admin === 1);
          setIsTeamAdmin(hasTeamAdmin);
        }
      } catch (error) {
        console.error('Error fetching user teams:', error);
      }
    };

    if (role !== 1) { // Only fetch for non-global admins
      fetchUserTeams();
    }

    return () => { document.head.removeChild(style); };
  }, [role]);

  // Set initial active tab based on user permissions
  useEffect(() => {
    if (role === 1) {
      setActiveTab('team-management');
    } else if (isTeamAdmin) {
      setActiveTab('team-management');
    } else {
      setActiveTab('configuration');
    }
  }, [role, isTeamAdmin]);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: '#f8f9fa',
      display: 'flex',
      zIndex: 1000,
    }}>
      {/* Sidebar */}
      <div style={{
        width: '280px',
        background: '#ffffff',
        borderRight: '1px solid #e5e7eb',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 0',
        boxShadow: '2px 0 10px rgba(0, 0, 0, 0.1)',
      }}>
        {/* Header */}
        <div style={{
          padding: '0 24px 24px',
          borderBottom: '1px solid #e5e7eb',
        }}>
          <button
            onClick={onBack}
            style={{
              background: 'none',
              border: 'none',
              color: '#374151',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 600,
              padding: '8px 0',
              marginBottom: '16px',
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => e.target.style.color = '#111827'}
            onMouseLeave={(e) => e.target.style.color = '#374151'}
          >
            <ArrowLeft size={20} />
            Back to Chat
          </button>
          <h2 style={{
            color: '#111827',
            fontSize: '24px',
            fontWeight: 700,
            margin: 0,
            letterSpacing: '0.5px',
          }}>
            Settings
          </h2>
        </div>

        {/* Navigation Tabs */}
        <div style={{ padding: '24px 0', flex: 1 }}>
          {/* Team Management - Available to Global Admin and Team Admin */}
          {(role === 1 || isTeamAdmin) && (
            <div
              onClick={() => setActiveTab('team-management')}
              style={{
                padding: '16px 24px',
                color: activeTab === 'team-management' ? '#111827' : '#6b7280',
                background: activeTab === 'team-management' ? '#f3f4f6' : 'transparent',
                borderRight: activeTab === 'team-management' ? '3px solid #374151' : 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontSize: '16px',
                fontWeight: 600,
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'team-management') {
                  e.target.style.background = '#f9fafb';
                  e.target.style.color = '#374151';
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'team-management') {
                  e.target.style.background = 'transparent';
                  e.target.style.color = '#6b7280';
                }
              }}
            >
              <UsersIcon size={20} />
              Team Management
            </div>
          )}
          
          {/* Knowledge Base - Available to Global Admin and Team Admin only */}
          {(role === 1 || isTeamAdmin) && (
            <div
              onClick={() => setActiveTab('knowledge-base')}
              style={{
                padding: '16px 24px',
                color: activeTab === 'knowledge-base' ? '#111827' : '#6b7280',
                background: activeTab === 'knowledge-base' ? '#f3f4f6' : 'transparent',
                borderRight: activeTab === 'knowledge-base' ? '3px solid #374151' : 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontSize: '16px',
                fontWeight: 600,
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'knowledge-base') {
                  e.target.style.background = '#f9fafb';
                  e.target.style.color = '#374151';
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'knowledge-base') {
                  e.target.style.background = 'transparent';
                  e.target.style.color = '#6b7280';
                }
              }}
            >
              <Database size={20} />
              Knowledge Base
            </div>
          )}
          
          {/* Configuration - Available to all users */}
          <div
            onClick={() => setActiveTab('configuration')}
            style={{
              padding: '16px 24px',
              color: activeTab === 'configuration' ? '#111827' : '#6b7280',
              background: activeTab === 'configuration' ? '#f3f4f6' : 'transparent',
              borderRight: activeTab === 'configuration' ? '3px solid #374151' : 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: '16px',
              fontWeight: 600,
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              if (activeTab !== 'configuration') {
                e.target.style.background = '#f9fafb';
                e.target.style.color = '#374151';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== 'configuration') {
                e.target.style.background = 'transparent';
                e.target.style.color = '#6b7280';
              }
            }}
          >
            <SettingsIcon size={20} />
            Configuration
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ 
        flex: 1, 
        overflow: 'auto',
        background: '#f8f9fa',
      }}>
        {activeTab === 'team-management' && (role === 1 || isTeamAdmin) && (
          <TeamManagementTab role={role} isTeamAdmin={isTeamAdmin} userTeams={userTeams} />
        )}
        
        {activeTab === 'knowledge-base' && (role === 1 || isTeamAdmin) && (
          <KnowledgeBaseTab />
        )}
        
        {activeTab === 'configuration' && (
          <ConfigurationTab onConfigSaved={onConfigUpdated} />
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
