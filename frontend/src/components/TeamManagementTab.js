import React from 'react';
import TeamManagement from '../TeamManagement';

const TeamManagementTab = ({ role, isTeamAdmin = false, userTeams = [] }) => {
  return (
    <div style={{ 
      padding: '40px', 
      maxWidth: '1200px',
      margin: '0 auto',
    }}>
      <h1 style={{
        color: '#111827',
        fontSize: '24px',
        fontWeight: 700,
        marginBottom: '24px',
        letterSpacing: '0.5px',
      }}>
        Team Management
      </h1>
      <TeamManagement 
        show={true} 
        onClose={() => {}} 
        role={role}
        isTeamAdmin={isTeamAdmin}
        userTeams={userTeams}
        embedded={true}
      />
    </div>
  );
};

export default TeamManagementTab;
