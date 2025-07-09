import React from 'react';
import UserManagement from '../UserManagement';

const UserManagementTab = ({ role }) => {
  return (
    <div style={{ 
      padding: '40px', 
      maxWidth: '1200px',
      margin: '0 auto',
    }}>
      <h1 style={{
        color: '#111827',
        fontSize: '32px',
        fontWeight: 700,
        marginBottom: '24px',
        letterSpacing: '0.5px',
      }}>
        User Management
      </h1>
      <UserManagement 
        show={true} 
        onClose={() => {}} 
        role={role}
        embedded={true}
      />
    </div>
  );
};

export default UserManagementTab;
