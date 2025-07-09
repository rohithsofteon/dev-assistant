import React, { useState, useEffect } from 'react';
import { Plus, Users, Settings, Trash2, UserPlus, UserMinus, Shield, ShieldOff, RefreshCw } from 'lucide-react';
import { getBaseUrl, generatePassword } from './utils';

const TeamManagement = ({ show, onClose, role, isTeamAdmin = false, userTeams = [], embedded = false }) => {
  const [activeTab, setActiveTab] = useState('teams');
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Create team form
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDescription, setNewTeamDescription] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Create user form
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState(generatePassword());
  const [createUserMsg, setCreateUserMsg] = useState('');

  // Create global admin form
  const [showCreateGlobalAdmin, setShowCreateGlobalAdmin] = useState(false);
  const [newGlobalAdminUsername, setNewGlobalAdminUsername] = useState('');
  const [newGlobalAdminPassword, setNewGlobalAdminPassword] = useState(generatePassword());
  const [createGlobalAdminMsg, setCreateGlobalAdminMsg] = useState('');

  useEffect(() => {
    if (show || embedded) {
      fetchTeams();
      fetchAllUsers();
    }
  }, [show, embedded]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  const fetchTeams = async () => {
    try {
      let response;
      if (role === 1) {
        // Global admin can see all teams
        response = await fetch(`${getBaseUrl()}/api/teams`, {
          headers: getAuthHeaders()
        });
      } else {
        // Team admin can only see teams they manage
        response = await fetch(`${getBaseUrl()}/api/user/teams`, {
          headers: getAuthHeaders()
        });
      }
      const data = await response.json();
      if (data.teams) {
        // For team admins, filter to only show teams they admin
        if (role !== 1 && isTeamAdmin) {
          const adminTeams = data.teams.filter(team => team.is_team_admin === 1);
          setTeams(adminTeams);
        } else {
          setTeams(data.teams);
        }
      }
    } catch (error) {
      console.error('Error fetching teams:', error);
      setMessage('Error fetching teams');
    }
  };

  const fetchAllUsers = async () => {
    try {
      const response = await fetch(`${getBaseUrl()}/api/all-users`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (data.users) {
        setAllUsers(data.users);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchTeamMembers = async (teamId) => {
    try {
      const response = await fetch(`${getBaseUrl()}/api/teams/${teamId}/members`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (data.members) {
        let members = data.members;
        
        // If current user is a global admin (role === 1), add them as a special member
        if (role === 1) {
          const currentUserResponse = await fetch(`${getBaseUrl()}/api/user-info`, {
            headers: getAuthHeaders()
          });
          const currentUserData = await currentUserResponse.json();
          
          if (currentUserData.user) {
            // Check if global admin is already a member
            const isAlreadyMember = members.some(member => member.id === currentUserData.user.id);
            
            if (!isAlreadyMember) {
              // Add global admin as a special member
              members.unshift({
                id: currentUserData.user.id,
                username: currentUserData.user.username,
                is_team_admin: 1,
                role: 1
              });
            }
          }
        }
        
        setTeamMembers(members);
      }
    } catch (error) {
      console.error('Error fetching team members:', error);
    }
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    setLoading(true);
    try {
      const response = await fetch(`${getBaseUrl()}/api/teams`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: newTeamName,
          description: newTeamDescription
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setMessage('Team created successfully!');
        setNewTeamName('');
        setNewTeamDescription('');
        setShowCreateForm(false);
        fetchTeams();
      } else {
        setMessage('Error creating team');
      }
    } catch (error) {
      setMessage('Error creating team');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreateUserMsg('');
    
    try {
      const res = await fetch(`${getBaseUrl()}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          role: 0, // Always create as regular user, not global admin
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCreateUserMsg('User created successfully!');
        setNewUsername('');
        setNewPassword(generatePassword());
        setShowCreateUser(false);
        // Refresh users list
        fetchAllUsers();
      } else {
        setCreateUserMsg(data.error || 'Failed to create user');
      }
    } catch (err) {
      setCreateUserMsg('Error connecting to server');
    }
  };

  const handleCreateGlobalAdmin = async (e) => {
    e.preventDefault();
    setCreateGlobalAdminMsg('');
    
    try {
      const response = await fetch(`${getBaseUrl()}/api/admin/create-global-admin`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          username: newGlobalAdminUsername,
          password: newGlobalAdminPassword,
          role: 1
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setCreateGlobalAdminMsg('Global admin created successfully!');
        setNewGlobalAdminUsername('');
        setNewGlobalAdminPassword(generatePassword());
        setShowCreateGlobalAdmin(false);
        fetchAllUsers(); // Refresh users list
      } else {
        setCreateGlobalAdminMsg(data.error || 'Failed to create global admin');
      }
    } catch (error) {
      setCreateGlobalAdminMsg('Error connecting to server');
    }
  };

  const handleDeleteTeam = async (teamId) => {
    if (!window.confirm('Are you sure you want to delete this team? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`${getBaseUrl()}/api/teams/${teamId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      
      const data = await response.json();
      if (data.success) {
        setMessage('Team deleted successfully!');
        fetchTeams();
        if (selectedTeam === teamId) {
          setSelectedTeam(null);
          setTeamMembers([]);
        }
      } else {
        setMessage('Error deleting team');
      }
    } catch (error) {
      setMessage('Error deleting team');
    }
  };

  const handleAddMember = async (userId, isAdmin = false) => {
    try {
      const response = await fetch(`${getBaseUrl()}/api/teams/add-member`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          team_id: selectedTeam,
          user_id: userId,
          is_team_admin: isAdmin
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setMessage('Member added successfully!');
        fetchTeamMembers(selectedTeam);
      } else {
        setMessage('Error adding member');
      }
    } catch (error) {
      setMessage('Error adding member');
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!window.confirm('Are you sure you want to remove this member from the team?')) {
      return;
    }

    try {
      const response = await fetch(`${getBaseUrl()}/api/teams/remove-member`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          team_id: selectedTeam,
          user_id: userId
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setMessage('Member removed successfully!');
        fetchTeamMembers(selectedTeam);
      } else {
        setMessage('Error removing member');
      }
    } catch (error) {
      setMessage('Error removing member');
    }
  };

  const handleToggleAdmin = async (userId, currentAdminStatus) => {
    try {
      const response = await fetch(`${getBaseUrl()}/api/teams/update-admin`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          team_id: selectedTeam,
          user_id: userId,
          is_admin: !currentAdminStatus
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setMessage('Admin status updated successfully!');
        fetchTeamMembers(selectedTeam);
      } else {
        setMessage('Error updating admin status');
      }
    } catch (error) {
      setMessage('Error updating admin status');
    }
  };

  const handleTeamSelect = (teamId) => {
    setSelectedTeam(teamId);
    setActiveTab('members');
    fetchTeamMembers(teamId);
  };

  const availableUsers = allUsers.filter(user => 
    !teamMembers.some(member => member.id === user.id)
  );

  if (!show && !embedded) return null;

  // Add style for hover effects
  const iconHoverStyle = `
    .tm-icon-hover {
      transition: transform 0.18s;
    }
    .tm-icon-hover:hover {
      transform: scale(1.18);
    }
    .tm-btn-hover {
      transition: background 0.2s, color 0.2s, transform 0.18s;
    }
    .tm-btn-hover:hover {
      background: #374151 !important;
      color: #ffffff !important;
      transform: translateY(-1px);
    }
    .tm-card-hover {
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .tm-card-hover:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(0,0,0,0.15);
    }
  `;

  return embedded ? (
    <div style={{ width: '100%' }}>
      <style>{iconHoverStyle}</style>
      
      {/* Embedded version with clean white cards */}
      <div style={{ display: 'flex', gap: '24px', marginBottom: '32px' }}>
        <button
          style={{
            background: activeTab === 'teams' ? '#111827' : '#ffffff',
            color: activeTab === 'teams' ? '#ffffff' : '#111827',
            border: activeTab === 'teams' ? 'none' : '1px solid #e5e7eb',
            padding: '12px 24px',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            transition: 'all 0.2s'
          }}
          className="tm-btn-hover"
          onClick={() => setActiveTab('teams')}
        >
          <Users size={16} />
          Teams ({teams.length})
        </button>
        {selectedTeam && (
          <button
            style={{
              background: activeTab === 'members' ? '#111827' : '#ffffff',
              color: activeTab === 'members' ? '#ffffff' : '#111827',
              border: activeTab === 'members' ? 'none' : '1px solid #e5e7eb',
              padding: '12px 24px',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              transition: 'all 0.2s'
            }}
            className="tm-btn-hover"
            onClick={() => setActiveTab('members')}
          >
            <Settings size={16} />
            Manage Members
          </button>
        )}
        {role === 1 && (
          <button
            style={{
              background: activeTab === 'admins' ? '#111827' : '#ffffff',
              color: activeTab === 'admins' ? '#ffffff' : '#111827',
              border: activeTab === 'admins' ? 'none' : '1px solid #e5e7eb',
              padding: '12px 24px',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              transition: 'all 0.2s'
            }}
            className="tm-btn-hover"
            onClick={() => setActiveTab('admins')}
          >
            <Shield size={16} />
            Global Admins
          </button>
        )}
      </div>

      {/* Message */}
      {message && (
        <div style={{ 
          background: message.includes('success') ? '#d1fae5' : '#fee2e2',
          color: message.includes('success') ? '#065f46' : '#991b1b', 
          padding: '12px 16px',
          borderRadius: 8,
          marginBottom: '24px',
          fontWeight: 600,
          border: `1px solid ${message.includes('success') ? '#a7f3d0' : '#fecaca'}`
        }}>
          {message}
        </div>
      )}

      {/* Content */}
      {activeTab === 'teams' && (
        <div style={{ display: 'grid', gap: '24px' }}>
          {/* Create Team Section */}
          {role === 1 && (
            <div style={{
              background: '#ffffff',
              borderRadius: 12,
              padding: 24,
              border: '1px solid #e5e7eb',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
            }}>
              <h3 style={{ color: '#111827', marginBottom: '16px', fontSize: '18px', fontWeight: 600 }}>
                Create New Team
              </h3>
              
              {!showCreateForm ? (
                <button
                  style={{
                    background: '#111827',
                    color: '#ffffff',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s'
                  }}
                  className="tm-btn-hover"
                  onClick={() => setShowCreateForm(true)}
                >
                  <Plus size={16} />
                  Create New Team
                </button>
              ) : (
                <form onSubmit={handleCreateTeam} style={{ display: 'grid', gap: '16px' }}>
                  <div>
                    <label style={{ color: '#374151', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                      Team Name *
                    </label>
                    <input
                      type="text"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px',
                        borderRadius: 8,
                        border: '1px solid #d1d5db',
                        fontSize: '14px',
                        boxSizing: 'border-box'
                      }}
                      required
                      placeholder="Enter team name"
                    />
                  </div>
                  <div>
                    <label style={{ color: '#374151', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                      Description
                    </label>
                    <textarea
                      value={newTeamDescription}
                      onChange={(e) => setNewTeamDescription(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px',
                        borderRadius: 8,
                        border: '1px solid #d1d5db',
                        fontSize: '14px',
                        resize: 'vertical',
                        minHeight: '80px',
                        boxSizing: 'border-box'
                      }}
                      placeholder="Enter team description (optional)"
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      type="submit"
                      disabled={loading}
                      style={{
                        background: '#10B981',
                        color: '#ffffff',
                        border: 'none',
                        padding: '12px 24px',
                        borderRadius: 8,
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontWeight: 600,
                        opacity: loading ? 0.6 : 1
                      }}
                    >
                      {loading ? 'Creating...' : 'Create Team'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateForm(false);
                        setNewTeamName('');
                        setNewTeamDescription('');
                      }}
                      style={{
                        background: '#6B7280',
                        color: '#ffffff',
                        border: 'none',
                        padding: '12px 24px',
                        borderRadius: 8,
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Teams List */}
          <div style={{
            background: '#ffffff',
            borderRadius: 12,
            padding: 24,
            border: '1px solid #e5e7eb',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ color: '#111827', marginBottom: '20px', fontSize: '18px', fontWeight: 600 }}>
              Existing Teams ({teams.length})
            </h3>
            
            {teams.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '40px 20px',
                color: '#6b7280'
              }}>
                <Users size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
                <p style={{ fontSize: '16px', fontWeight: 500 }}>
                  No teams found. {role === 1 ? 'Create your first team above!' : ''}
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '16px' }}>
                {teams.map((team) => (
                  <div
                    key={team.team_id}
                    style={{
                      background: '#f9fafb',
                      borderRadius: 8,
                      padding: '20px',
                      border: '1px solid #e5e7eb',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    className="tm-card-hover"
                    onClick={() => handleTeamSelect(team.team_id)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ color: '#111827', margin: '0 0 8px 0', fontSize: '16px', fontWeight: 600 }}>
                          {team.name}
                        </h4>
                        {team.description && (
                          <p style={{ color: '#6b7280', margin: '0 0 12px 0', fontSize: '14px', lineHeight: 1.4 }}>
                            {team.description}
                          </p>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <span style={{ color: '#374151', fontSize: '13px', fontWeight: 500 }}>
                            {team.member_count} member{team.member_count !== 1 ? 's' : ''}
                          </span>
                          {team.created_by_username && (
                            <span style={{ color: '#6b7280', fontSize: '13px' }}>
                              Created by {team.created_by_username}
                            </span>
                          )}
                        </div>
                      </div>
                      {role === 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTeam(team.team_id);
                          }}
                          style={{
                            background: '#EF4444',
                            color: '#ffffff',
                            border: 'none',
                            padding: '8px',
                            borderRadius: 6,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            marginLeft: '16px'
                          }}
                          className="tm-icon-hover"
                          title="Delete Team"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'members' && selectedTeam && (
        <div style={{ display: 'grid', gap: '24px' }}>
          {/* Add Member Section */}
          <div style={{
            background: '#ffffff',
            borderRadius: 12,
            padding: 24,
            border: '1px solid #e5e7eb',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ color: '#111827', marginBottom: '16px', fontSize: '18px', fontWeight: 600 }}>
              Add New Member
            </h3>
            
            {/* Create New User Section */}
            <div style={{ marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ color: '#374151', fontSize: '16px', fontWeight: 600, margin: 0 }}>
                  Create New User
                </h4>
                {!showCreateUser && (
                  <button
                    onClick={() => setShowCreateUser(true)}
                    style={{
                      background: 'black',
                      color: '#ffffff',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Plus size={14} />
                    Create User
                  </button>
                )}
              </div>
              
              {showCreateUser && (
                <div style={{ background: '#f9fafb', padding: '16px', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                  <form onSubmit={handleCreateUser} style={{ display: 'grid', gap: '12px' }}>
                    <div>
                      <label style={{ color: '#374151', display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '14px' }}>
                        Username:
                      </label>
                      <input
                        type="text"
                        value={newUsername}
                        onChange={e => setNewUsername(e.target.value)}
                        required
                        style={{
                          width: '100%',
                          padding: '10px',
                          borderRadius: 6,
                          border: '1px solid #d1d5db',
                          background: '#ffffff',
                          color: '#111827',
                          fontSize: '14px',
                          boxSizing: 'border-box'
                        }}
                        placeholder="Enter username"
                      />
                    </div>
                    <div>
                      <label style={{ color: '#374151', display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '14px' }}>
                        Password:
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="text"
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          required
                          style={{
                            flex: 1,
                            padding: '10px',
                            borderRadius: 6,
                            border: '1px solid #d1d5db',
                            background: '#ffffff',
                            color: '#111827',
                            fontSize: '14px',
                            boxSizing: 'border-box'
                          }}
                          placeholder="Enter or generate password"
                        />
                        <button
                          type="button"
                          style={{
                            padding: '10px',
                            borderRadius: 6,
                            border: '1px solid #d1d5db',
                            background: '#f3f4f6',
                            color: '#374151',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          onClick={() => setNewPassword(generatePassword())}
                          title="Generate Password"
                        >
                          <RefreshCw size={16} />
                        </button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="submit"
                        style={{
                          background: 'black',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: 6,
                          padding: '10px 16px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontSize: '14px',
                          flex: 1
                        }}
                      >
                        Create User
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreateUser(false);
                          setCreateUserMsg('');
                          setNewUsername('');
                          setNewPassword(generatePassword());
                        }}
                        style={{
                          background: '#f3f4f6',
                          color: '#374151',
                          border: '1px solid #d1d5db',
                          borderRadius: 6,
                          padding: '10px 16px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontSize: '14px',
                          flex: 1
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                  {createUserMsg && (
                    <div style={{ 
                      color: createUserMsg.includes('successfully') ? '#059669' : '#dc2626', 
                      marginTop: '12px', 
                      fontWeight: 600,
                      fontSize: '14px'
                    }}>
                      {createUserMsg}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Add Existing Users Section */}
            <div>
              <h4 style={{ color: '#374151', fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>
                Add Existing Users
              </h4>
              {availableUsers.length === 0 ? (
                <p style={{ color: '#6b7280', fontStyle: 'italic' }}>
                  All existing users are already members of this team.
                </p>
              ) : (
                <div style={{ display: 'grid', gap: '12px', maxHeight: '300px', overflowY: 'auto' }}>
                  {availableUsers.map((user) => (
                    <div
                      key={user.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: '#f9fafb',
                        padding: '12px 16px',
                        borderRadius: 8,
                        border: '1px solid #e5e7eb'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#111827', fontWeight: 500 }}>{user.username}</span>
                        {user.role === 1 && (
                          <span style={{
                            background: '#111827',
                            color: '#ffffff',
                            padding: '2px 6px',
                            borderRadius: 3,
                            fontSize: '10px',
                            fontWeight: 600,
                            textTransform: 'uppercase'
                          }}>
                            Global Admin
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handleAddMember(user.id, false)}
                          style={{
                            background: '#10B981',
                            color: '#ffffff',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 600
                          }}
                        >
                          Add as Member
                        </button>
                        <button
                          onClick={() => handleAddMember(user.id, true)}
                          style={{
                            background: '#F59E0B',
                            color: '#ffffff',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 600
                          }}
                        >
                          Add as Admin
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Current Members */}
          <div style={{
            background: '#ffffff',
            borderRadius: 12,
            padding: 24,
            border: '1px solid #e5e7eb',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ color: '#111827', marginBottom: '16px', fontSize: '18px', fontWeight: 600 }}>
              Team Members ({teamMembers.length})
            </h3>
            
            {teamMembers.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '40px 20px',
                color: '#6b7280'
              }}>
                <UserPlus size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
                <p style={{ fontSize: '16px', fontWeight: 500 }}>
                  No members in this team yet.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '12px' }}>
                {teamMembers.map((member) => (
                  <div
                    key={member.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: '#f9fafb',
                      padding: '16px',
                      borderRadius: 8,
                      border: '1px solid #e5e7eb'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ color: '#111827', fontWeight: 600 }}>
                        {member.username}
                      </span>
                      {member.role === 1 ? (
                        <span style={{
                          background: '#111827',
                          color: '#ffffff',
                          padding: '4px 8px',
                          borderRadius: 4,
                          fontSize: '11px',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          GLOBAL ADMIN
                        </span>
                      ) : member.is_team_admin ? (
                        <span style={{
                          background: '#F59E0B',
                          color: '#ffffff',
                          padding: '4px 8px',
                          borderRadius: 4,
                          fontSize: '11px',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          TEAM ADMIN
                        </span>
                      ) : (
                        <span style={{
                          background: '#6B7280',
                          color: '#ffffff',
                          padding: '4px 8px',
                          borderRadius: 4,
                          fontSize: '11px',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          MEMBER
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {/* Don't show admin toggle or remove buttons for global admins */}
                      {member.role !== 1 && (
                        <>
                          <button
                            onClick={() => handleToggleAdmin(member.id, member.is_team_admin)}
                            style={{
                              background: member.is_team_admin ? '#EF4444' : '#F59E0B',
                              color: '#ffffff',
                              border: 'none',
                              padding: '8px',
                              borderRadius: 6,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                            className="tm-icon-hover"
                            title={member.is_team_admin ? 'Remove Admin' : 'Make Admin'}
                          >
                            {member.is_team_admin ? <ShieldOff size={16} /> : <Shield size={16} />}
                          </button>
                          <button
                            onClick={() => handleRemoveMember(member.id)}
                            style={{
                              background: '#EF4444',
                              color: '#ffffff',
                              border: 'none',
                              padding: '8px',
                              borderRadius: 6,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                            className="tm-icon-hover"
                            title="Remove Member"
                          >
                            <UserMinus size={16} />
                          </button>
                        </>
                      )}
                      {/* For global admins, show they cannot be removed */}
                      {member.role === 1 && (
                        <span style={{
                          color: '#6B7280',
                          fontSize: '12px',
                          fontStyle: 'italic',
                          padding: '8px'
                        }}>
                          Global access
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Global Admins Tab - Only for global admins */}
      {activeTab === 'admins' && role === 1 && (
        <div style={{ display: 'grid', gap: '24px' }}>
          {/* Create Global Admin Section */}
          <div style={{
            background: '#ffffff',
            borderRadius: 12,
            padding: 24,
            border: '1px solid #e5e7eb',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ color: '#111827', marginBottom: '16px', fontSize: '18px', fontWeight: 600 }}>
              Create New Global Administrator
            </h3>
            <p style={{ color: '#6B7280', marginBottom: '20px', fontSize: '14px', lineHeight: '1.5' }}>
              Global administrators have full access to all teams and system management functions. Only create global admin accounts for trusted personnel.
            </p>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h4 style={{ color: '#374151', fontSize: '16px', fontWeight: 600, margin: 0 }}>
                New Global Admin
              </h4>
              {!showCreateGlobalAdmin && (
                <button
                  onClick={() => setShowCreateGlobalAdmin(true)}
                  style={{
                    background: '#DC2626',
                    color: '#ffffff',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)'
                  }}
                >
                  <Shield size={16} />
                  Create Global Admin
                </button>
              )}
            </div>

            {showCreateGlobalAdmin && (
              <form onSubmit={handleCreateGlobalAdmin} style={{ marginTop: '16px' }}>
                <div style={{ display: 'grid', gap: '16px', marginBottom: '20px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#374151' }}>
                      Username
                    </label>
                    <input
                      type="text"
                      value={newGlobalAdminUsername}
                      onChange={(e) => setNewGlobalAdminUsername(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '1px solid #d1d5db',
                        borderRadius: 8,
                        fontSize: '14px'
                      }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#374151' }}>
                      Password
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        value={newGlobalAdminPassword}
                        onChange={(e) => setNewGlobalAdminPassword(e.target.value)}
                        style={{
                          flex: 1,
                          padding: '12px',
                          border: '1px solid #d1d5db',
                          borderRadius: 8,
                          fontSize: '14px'
                        }}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setNewGlobalAdminPassword(generatePassword())}
                        style={{
                          background: '#6B7280',
                          color: '#ffffff',
                          border: 'none',
                          padding: '12px 16px',
                          borderRadius: 8,
                          cursor: 'pointer',
                          fontSize: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <RefreshCw size={14} />
                        Generate
                      </button>
                    </div>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="submit"
                    style={{
                      background: '#DC2626',
                      color: '#ffffff',
                      border: 'none',
                      padding: '12px 24px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '14px'
                    }}
                  >
                    Create Global Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateGlobalAdmin(false);
                      setCreateGlobalAdminMsg('');
                    }}
                    style={{
                      background: '#F3F4F6',
                      color: '#374151',
                      border: '1px solid #D1D5DB',
                      padding: '12px 24px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '14px'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {createGlobalAdminMsg && (
              <div style={{
                marginTop: '16px',
                padding: '12px',
                borderRadius: 8,
                backgroundColor: createGlobalAdminMsg.includes('success') ? '#D1FAE5' : '#FEE2E2',
                color: createGlobalAdminMsg.includes('success') ? '#065F46' : '#991B1B',
                border: `1px solid ${createGlobalAdminMsg.includes('success') ? '#A7F3D0' : '#FECACA'}`,
                fontSize: '14px',
                fontWeight: 600
              }}>
                {createGlobalAdminMsg}
              </div>
            )}
          </div>

          {/* List Current Global Admins */}
          <div style={{
            background: '#ffffff',
            borderRadius: 12,
            padding: 24,
            border: '1px solid #e5e7eb',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ color: '#111827', marginBottom: '16px', fontSize: '18px', fontWeight: 600 }}>
              Current Global Administrators
            </h3>
            
            <div style={{ display: 'grid', gap: '12px' }}>
              {allUsers.filter(user => user.role === 1).map(admin => (
                <div key={admin.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px',
                  background: '#FEF2F2',
                  borderRadius: 8,
                  border: '1px solid #FECACA'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Shield size={20} style={{ color: '#DC2626' }} />
                    <div>
                      <div style={{ fontWeight: 600, color: '#111827', fontSize: '14px' }}>
                        {admin.username}
                      </div>
                      <div style={{ color: '#6B7280', fontSize: '12px' }}>
                        Global Administrator
                      </div>
                    </div>
                  </div>
                  <div style={{ color: '#DC2626', fontSize: '12px', fontWeight: 600 }}>
                    GLOBAL ACCESS
                  </div>
                </div>
              ))}
              
              {allUsers.filter(user => user.role === 1).length === 0 && (
                <div style={{
                  textAlign: 'center',
                  color: '#6B7280',
                  padding: '32px',
                  fontSize: '14px'
                }}>
                  No global administrators found
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  ) : (
    // Popup version for backward compatibility (minimal implementation)
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '2rem',
      }}
      onClick={onClose}
    >
      <style>{iconHoverStyle}</style>
      <div style={{ 
        padding: '2rem', 
        background: '#fff', 
        borderRadius: '1rem', 
        maxWidth: '400px',
        textAlign: 'center'
      }}
      onClick={e => e.stopPropagation()}
      >
        <h2 style={{ marginBottom: '1rem' }}>Team Management</h2>
        <p style={{ marginBottom: '1.5rem', color: '#666' }}>
          Please use the Settings page to access Team Management features.
        </p>
        <button 
          onClick={onClose}
          style={{
            background: '#111827',
            color: '#fff',
            border: 'none',
            padding: '12px 24px',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 600
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default TeamManagement;
