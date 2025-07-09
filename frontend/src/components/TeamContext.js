import React, { createContext, useContext, useState, useEffect } from 'react';

// Team Context for managing current team selection
const TeamContext = createContext();

export const useTeamContext = () => {
  const context = useContext(TeamContext);
  if (!context) {
    throw new Error('useTeamContext must be used within a TeamContextProvider');
  }
  return context;
};

export const TeamContextProvider = ({ children, user }) => {
  const [currentTeam, setCurrentTeam] = useState(null);
  const [accessibleTeams, setAccessibleTeams] = useState([]);
  const [userPermissions, setUserPermissions] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch user permissions and accessible teams
  useEffect(() => {
    if (user?.id) {
      fetchUserPermissions();
    }
  }, [user?.id]);

  const fetchUserPermissions = async () => {
    try {
      setLoading(true);
      
      // Fetch user permissions
      const permissionsResponse = await fetch(`/api/users/${user.id}/permissions`);
      const permissions = await permissionsResponse.json();
      setUserPermissions(permissions);

      // Fetch accessible teams
      const teamsResponse = await fetch(`/api/users/${user.id}/teams`);
      const teams = await teamsResponse.json();
      setAccessibleTeams(teams);

      // Set default team (first accessible team or null)
      if (teams.length > 0 && !currentTeam) {
        setCurrentTeam(teams[0]);
      }
    } catch (error) {
      console.error('Failed to fetch user permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const switchTeam = (team) => {
    setCurrentTeam(team);
    // Optionally store in localStorage for persistence
    if (team) {
      localStorage.setItem('currentTeamId', team.team_id.toString());
    } else {
      localStorage.removeItem('currentTeamId');
    }
  };

  // Get permissions for current team
  const getCurrentTeamPermissions = () => {
    if (!userPermissions || !currentTeam) {
      return {
        canManageMembers: userPermissions?.is_master_admin || false,
        canManageContent: userPermissions?.is_master_admin || false,
        canViewContent: false,
        teamRole: 'none'
      };
    }

    const teamMembership = userPermissions.team_memberships?.find(
      tm => tm.team_id === currentTeam.team_id
    );

    return {
      canManageMembers: userPermissions.is_master_admin || teamMembership?.team_role === 'admin',
      canManageContent: userPermissions.is_master_admin || teamMembership?.team_role === 'admin',
      canViewContent: userPermissions.is_master_admin || !!teamMembership,
      teamRole: teamMembership?.team_role || 'none'
    };
  };

  const value = {
    // State
    currentTeam,
    accessibleTeams,
    userPermissions,
    loading,
    
    // Actions
    switchTeam,
    fetchUserPermissions,
    
    // Computed
    getCurrentTeamPermissions,
    
    // Helper methods
    isMasterAdmin: () => userPermissions?.is_master_admin || false,
    canAccessTeam: (teamId) => {
      return userPermissions?.is_master_admin || 
             accessibleTeams.some(team => team.team_id === teamId);
    },
    canManageUsers: () => userPermissions?.is_master_admin || false,
    canManageAllTeams: () => userPermissions?.is_master_admin || false
  };

  return (
    <TeamContext.Provider value={value}>
      {children}
    </TeamContext.Provider>
  );
};

// Team selector component
export const TeamSelector = ({ className = '' }) => {
  const { 
    currentTeam, 
    accessibleTeams, 
    switchTeam, 
    loading,
    isMasterAdmin 
  } = useTeamContext();

  if (loading) {
    return (
      <div className={`team-selector loading ${className}`}>
        <div className="spinner">Loading teams...</div>
      </div>
    );
  }

  if (accessibleTeams.length === 0) {
    return (
      <div className={`team-selector no-teams ${className}`}>
        <span>No teams available</span>
      </div>
    );
  }

  return (
    <div className={`team-selector ${className}`}>
      <label htmlFor="team-select" className="team-selector-label">
        Current Team:
      </label>
      <select
        id="team-select"
        value={currentTeam?.team_id || ''}
        onChange={(e) => {
          const teamId = parseInt(e.target.value);
          const team = accessibleTeams.find(t => t.team_id === teamId);
          switchTeam(team);
        }}
        className="team-selector-dropdown"
      >
        {!currentTeam && (
          <option value="">Select a team...</option>
        )}
        {accessibleTeams.map(team => (
          <option key={team.team_id} value={team.team_id}>
            {team.name}
            {isMasterAdmin() && <span> (Master Access)</span>}
          </option>
        ))}
      </select>
      
      {isMasterAdmin() && (
        <div className="master-admin-indicator">
          <span className="admin-badge">Master Admin</span>
        </div>
      )}
    </div>
  );
};

// Permission-based component wrapper
export const PermissionWrapper = ({ 
  children, 
  requiredPermission, 
  teamId = null, 
  fallback = null 
}) => {
  const { userPermissions, currentTeam, canAccessTeam } = useTeamContext();

  const hasPermission = () => {
    const targetTeamId = teamId || currentTeam?.team_id;

    switch (requiredPermission) {
      case 'master_admin':
        return userPermissions?.is_master_admin;
      
      case 'team_access':
        return targetTeamId ? canAccessTeam(targetTeamId) : false;
      
      case 'team_admin':
        if (userPermissions?.is_master_admin) return true;
        if (!targetTeamId) return false;
        const membership = userPermissions?.team_memberships?.find(
          tm => tm.team_id === targetTeamId
        );
        return membership?.team_role === 'admin';
      
      case 'team_member':
        if (userPermissions?.is_master_admin) return true;
        if (!targetTeamId) return false;
        return userPermissions?.team_memberships?.some(
          tm => tm.team_id === targetTeamId
        );
      
      default:
        return false;
    }
  };

  if (!hasPermission()) {
    return fallback;
  }

  return children;
};

// Hook for permission checking
export const usePermissions = () => {
  const context = useTeamContext();
  
  return {
    ...context,
    hasPermission: (permission, teamId = null) => {
      const targetTeamId = teamId || context.currentTeam?.team_id;
      
      switch (permission) {
        case 'master_admin':
          return context.userPermissions?.is_master_admin;
        
        case 'team_access':
          return targetTeamId ? context.canAccessTeam(targetTeamId) : false;
        
        case 'team_admin':
          if (context.userPermissions?.is_master_admin) return true;
          if (!targetTeamId) return false;
          const membership = context.userPermissions?.team_memberships?.find(
            tm => tm.team_id === targetTeamId
          );
          return membership?.team_role === 'admin';
        
        case 'team_content_management':
          return context.getCurrentTeamPermissions().canManageContent;
        
        case 'team_member_management':
          return context.getCurrentTeamPermissions().canManageMembers;
        
        default:
          return false;
      }
    }
  };
};

// CSS styles (to be added to your CSS file)
const styles = `
.team-selector {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.team-selector-label {
  font-weight: 600;
  color: #495057;
  font-size: 14px;
}

.team-selector-dropdown {
  padding: 6px 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  background: white;
  font-size: 14px;
  min-width: 200px;
}

.team-selector-dropdown:focus {
  outline: none;
  border-color: #80bdff;
  box-shadow: 0 0 0 0.2rem rgba(0,123,255,.25);
}

.master-admin-indicator {
  margin-left: auto;
}

.admin-badge {
  background: #dc3545;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.team-selector.loading {
  opacity: 0.6;
}

.team-selector.no-teams {
  color: #6c757d;
  font-style: italic;
}

.spinner {
  font-size: 14px;
  color: #6c757d;
}
`;

export default TeamContextProvider;
