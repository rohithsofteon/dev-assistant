import React, { useState, useEffect, createContext, useContext } from 'react';

// Team Context for managing current team selection
const TeamContext = createContext();

export const useTeamContext = () => {
  const context = useContext(TeamContext);
  if (!context) {
    throw new Error('useTeamContext must be used within a TeamProvider');
  }
  return context;
};

export const TeamProvider = ({ children, userId }) => {
  const [currentTeamId, setCurrentTeamId] = useState(null);
  const [accessibleTeams, setAccessibleTeams] = useState([]);
  const [userPermissions, setUserPermissions] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      fetchUserTeamsAndPermissions();
    }
  }, [userId]);

  const fetchUserTeamsAndPermissions = async () => {
    try {
      setLoading(true);
      
      // Fetch user permissions and accessible teams
      const [permissionsResponse, teamsResponse] = await Promise.all([
        fetch(`/api/users/${userId}/permissions`),
        fetch(`/api/users/${userId}/teams`)
      ]);

      const permissions = await permissionsResponse.json();
      const teams = await teamsResponse.json();

      setUserPermissions(permissions);
      setAccessibleTeams(teams);

      // Set default team if user has teams
      if (teams.length > 0 && !currentTeamId) {
        // Default to first team where user is admin, or first team
        const adminTeam = teams.find(team => team.team_role === 'admin');
        setCurrentTeamId(adminTeam ? adminTeam.team_id : teams[0].team_id);
      }
    } catch (error) {
      console.error('Error fetching user teams and permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const switchTeam = (teamId) => {
    setCurrentTeamId(teamId);
  };

  const getCurrentTeam = () => {
    return accessibleTeams.find(team => team.team_id === currentTeamId);
  };

  const getCurrentTeamRole = () => {
    const currentTeam = getCurrentTeam();
    return currentTeam ? currentTeam.team_role : null;
  };

  const canManageCurrentTeam = () => {
    return userPermissions?.is_master_admin || getCurrentTeamRole() === 'admin';
  };

  const canManageUsers = () => {
    return userPermissions?.is_master_admin;
  };

  const canManageTeamContent = () => {
    return userPermissions?.is_master_admin || getCurrentTeamRole() === 'admin';
  };

  const value = {
    currentTeamId,
    accessibleTeams,
    userPermissions,
    loading,
    switchTeam,
    getCurrentTeam,
    getCurrentTeamRole,
    canManageCurrentTeam,
    canManageUsers,
    canManageTeamContent,
    refreshData: fetchUserTeamsAndPermissions
  };

  return (
    <TeamContext.Provider value={value}>
      {children}
    </TeamContext.Provider>
  );
};

// Team Context Selector Component
const TeamContextSelector = ({ className = "" }) => {
  const {
    currentTeamId,
    accessibleTeams,
    userPermissions,
    loading,
    switchTeam,
    getCurrentTeam,
    getCurrentTeamRole
  } = useTeamContext();

  if (loading) {
    return (
      <div className={`team-selector loading ${className}`}>
        <div className="loading-spinner">Loading teams...</div>
      </div>
    );
  }

  if (!accessibleTeams.length) {
    return (
      <div className={`team-selector no-teams ${className}`}>
        <span className="no-teams-text">No teams assigned</span>
      </div>
    );
  }

  const currentTeam = getCurrentTeam();
  const currentRole = getCurrentTeamRole();

  return (
    <div className={`team-selector ${className}`}>
      <div className="team-selector-header">
        <label htmlFor="team-select" className="team-selector-label">
          Current Team:
        </label>
        {userPermissions?.is_master_admin && (
          <span className="role-badge master-admin">Master Admin</span>
        )}
      </div>
      
      <div className="team-selector-content">
        <select
          id="team-select"
          value={currentTeamId || ''}
          onChange={(e) => switchTeam(parseInt(e.target.value))}
          className="team-select"
        >
          {accessibleTeams.map(team => (
            <option key={team.team_id} value={team.team_id}>
              {team.name}
            </option>
          ))}
        </select>
        
        {currentTeam && (
          <div className="team-info">
            <span className={`role-badge team-${currentRole}`}>
              {currentRole === 'admin' ? 'Team Admin' : 'Team Member'}
            </span>
            {currentTeam.description && (
              <span className="team-description">{currentTeam.description}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Enhanced Team Management Tab with Context
const EnhancedTeamManagementTab = () => {
  const {
    userPermissions,
    canManageUsers,
    canManageCurrentTeam,
    getCurrentTeam,
    loading
  } = useTeamContext();

  if (loading) {
    return <div className="loading">Loading team management...</div>;
  }

  return (
    <div style={{ 
      padding: '40px', 
      maxWidth: '1200px',
      margin: '0 auto',
    }}>
      {/* Team Context Selector */}
      <TeamContextSelector 
        className="mb-6"
        style={{ marginBottom: '24px' }}
      />

      <h1 style={{
        color: '#111827',
        fontSize: '32px',
        fontWeight: 700,
        marginBottom: '24px',
        letterSpacing: '0.5px',
      }}>
        Team Management
      </h1>

      {/* Permission-based content rendering */}
      {canManageUsers() ? (
        // Master Admin view - can manage all teams
        <div className="master-admin-view">
          <div className="admin-notice" style={{
            background: '#fef3c7',
            border: '1px solid #f59e0b',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '24px'
          }}>
            <strong>Master Admin Mode:</strong> You have full access to all teams and users.
          </div>
          {/* Include full team management component */}
          <TeamManagement 
            show={true} 
            onClose={() => {}} 
            role="master_admin"
            embedded={true}
          />
        </div>
      ) : canManageCurrentTeam() ? (
        // Team Admin view - can manage current team only
        <div className="team-admin-view">
          <div className="admin-notice" style={{
            background: '#dbeafe',
            border: '1px solid #3b82f6',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '24px'
          }}>
            <strong>Team Admin Mode:</strong> You can manage the "{getCurrentTeam()?.name}" team.
          </div>
          <TeamManagement 
            show={true} 
            onClose={() => {}} 
            role="team_admin"
            teamId={getCurrentTeam()?.team_id}
            embedded={true}
          />
        </div>
      ) : (
        // Regular user view - no management access
        <div className="user-view">
          <div className="info-notice" style={{
            background: '#f3f4f6',
            border: '1px solid #9ca3af',
            borderRadius: '8px',
            padding: '16px',
            textAlign: 'center'
          }}>
            <h3 style={{ margin: 0, marginBottom: '8px' }}>Team Information</h3>
            <p style={{ margin: 0, color: '#6b7280' }}>
              You are a member of "{getCurrentTeam()?.name}". 
              For team management, please contact your team administrator.
            </p>
            {getCurrentTeam()?.description && (
              <p style={{ margin: '8px 0 0 0', fontStyle: 'italic', color: '#6b7280' }}>
                {getCurrentTeam().description}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// CSS styles for the components (to be added to your CSS file)
const teamSelectorStyles = `
.team-selector {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 24px;
}

.team-selector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.team-selector-label {
  font-weight: 600;
  color: #374151;
  font-size: 14px;
}

.team-select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 16px;
  margin-bottom: 8px;
}

.team-info {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.role-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.role-badge.master-admin {
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #f59e0b;
}

.role-badge.team-admin {
  background: #dbeafe;
  color: #1e40af;
  border: 1px solid #3b82f6;
}

.role-badge.team-user {
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #9ca3af;
}

.team-description {
  font-size: 14px;
  color: #6b7280;
  font-style: italic;
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 40px;
  color: #6b7280;
}

.loading-spinner {
  font-size: 14px;
  color: #6b7280;
}
`;

export { TeamContextSelector, EnhancedTeamManagementTab, teamSelectorStyles };
export default TeamContextSelector;
