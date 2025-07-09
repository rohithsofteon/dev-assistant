import React, { useState, useEffect, useRef } from 'react';
import { Plus, RefreshCw, Edit2, Trash2 } from 'lucide-react';
import { getBaseUrl, generatePassword } from './utils';

const UserManagement = ({ show, onClose, role, embedded = false }) => {
  const [userMgmtTab, setUserMgmtTab] = useState('');
  const [users, setUsers] = useState([]);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState(generatePassword());
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [addUserMsg, setAddUserMsg] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [editUsername, setEditUsername] = useState('');
  const [editUserMsg, setEditUserMsg] = useState('');

  // For regenerate icon rotation
  const regenIconRef = useRef();
  useEffect(() => {
    if (show) {
      fetch(`${getBaseUrl()}/api/users`)
        .then(res => res.json())
        .then(data => setUsers(data.users || []));
    }
  }, [show]);  const handleAddUser = async (e) => {
    e.preventDefault();
    setAddUserMsg('');
    try {
      const res = await fetch(`${getBaseUrl()}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          role: newIsAdmin ? 1 : 0,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAddUserMsg('User added successfully!');
        setNewUsername('');
        setNewPassword(generatePassword());
        setNewIsAdmin(false);
        setUserMgmtTab('add');
        
        // Refresh the users list
        try {
          const usersRes = await fetch(`${getBaseUrl()}/api/users`);
          const usersData = await usersRes.json();
          setUsers(usersData.users || []);
        } catch (refreshErr) {
          console.log('User list refresh failed, but user was added successfully');
        }
      } else {
        setAddUserMsg(data.error || 'Failed to add user');
      }
    } catch (err) {
      setAddUserMsg('Error connecting to server');
    }
  };

  const handleDeleteUser = async (targetUsername) => {
    if (role !== 1) {
      alert('You are not authorized to delete users.');
      return;
    }
    if (window.confirm(`Are you sure you want to delete user "${targetUsername}"?`)) {
      try {
        const res = await fetch(`${getBaseUrl()}/api/delete-user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: targetUsername }),
        });
        const data = await res.json();
        if (data.success) {
          setAddUserMsg('User deleted successfully!');
          setUsers(users.filter(u => u.username !== targetUsername));
        } else {
          setAddUserMsg(data.error || 'Failed to delete user');
        }
      } catch (err) {
        setAddUserMsg('Error connecting to server');
      }
    }
  };

  const handleEditUser = (targetUsername) => {
    if (role !== 1) {
      alert('You are not authorized to edit users.');
      return;
    }
    setEditingUser(targetUsername);
    setEditUsername(targetUsername);
    setEditUserMsg('');
  };

  if (!show) return null;

  // Add style for hover effects
  const iconHoverStyle = `
    .umg-icon-hover {
      transition: transform 0.18s;
    }
    .umg-icon-hover:hover {
      transform: scale(1.18);
    }
    .umg-close-hover {
      transition: transform 0.18s;
    }
    .umg-close-hover:hover {
      transform: scale(1.35);
    }
    .regen-icon-rotate {
      transition: transform 0.18s;
      display: inline-block;
    }
    .regen-icon-rotate.regen-rotating {
      transition: transform 0.4s cubic-bezier(.4,2,.6,1);
    }
    .add-btn-hover {
      transition: background 0.2s, color 0.2s;
    }    .add-btn-hover:hover {
      background: #374151;
      color: #ffffff;
    }
    .plus-icon-hover {
      transition: transform 0.18s;
    }
    .plus-icon-hover:hover {
      transform: scale(1.25);
    }
  `;
  return embedded ? (
    <div style={{ width: '100%' }}>
      <style>{iconHoverStyle}</style>
      {editingUser ? (        <div
          style={{
            background: '#ffffff',
            borderRadius: 12,
            padding: 24,
            border: '1px solid #e5e7eb',
            position: 'relative',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          }}
        >
          <h3 style={{ color: '#111827', marginBottom: '16px', fontSize: '18px', fontWeight: 600 }}>Edit Username</h3>
          <input
            type="text"
            value={editUsername}
            onChange={e => setEditUsername(e.target.value)}
            style={{ 
              width: '100%', 
              padding: 12, 
              borderRadius: 8, 
              marginBottom: 16, 
              border: '1px solid #d1d5db',
              background: '#ffffff',
              color: '#111827',
              fontSize: '14px',
              boxSizing: 'border-box'
            }}
          />
          <div style={{ display: 'flex', gap: 12 }}>            <button
              style={{ 
                background: '#111827',
                color: '#ffffff',
                border: 'none',
                borderRadius: 8,
                padding: '12px 24px',
                fontWeight: 600,
                cursor: 'pointer',
                flex: 1
              }}
              onClick={async () => {
                setEditUserMsg('');
                if (!editUsername.trim()) {
                  setEditUserMsg('Username cannot be empty');
                  return;
                }
                try {
                  const res = await fetch(`${getBaseUrl()}/api/edit-user`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ oldUsername: editingUser, newUsername: editUsername }),
                  });
                  const data = await res.json();
                  if (data.success) {
                    setAddUserMsg('User updated successfully!');
                    setUsers(users.map(u => u.username === editingUser ? { ...u, username: editUsername } : u));
                    setEditingUser(null);
                  } else {
                    setEditUserMsg(data.error || 'Failed to update user');
                  }
                } catch (err) {
                  setEditUserMsg('Error connecting to server');
                }
              }}
            >
              Save
            </button>            <button
              style={{ 
                background: '#dc2626',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '12px 24px',
                fontWeight: 600,
                cursor: 'pointer',
                flex: 1
              }}
              onClick={() => setEditingUser(null)}
            >
              Cancel
            </button>
          </div>
          {editUserMsg && (
            <div style={{ color: '#dc2626', marginTop: 12, fontWeight: 600 }}>
              {editUserMsg}
            </div>
          )}
        </div>
      ) : userMgmtTab === 'add' ? (        <div
          style={{
            background: '#ffffff',
            borderRadius: 12,
            padding: 24,
            border: '1px solid #e5e7eb',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          }}
        >
          <h3 style={{ color: '#111827', fontWeight: 600, fontSize: '18px', marginBottom: 24 }}>Add User</h3>
          <form onSubmit={handleAddUser} style={{ width: '100%' }}>            <div style={{ marginBottom: 16 }}>
              <label style={{ color: '#374151', display: 'block', marginBottom: 8, fontWeight: 500 }}>Username:</label>
              <input
                type="text"
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: 12,
                  borderRadius: 8,
                  border: '1px solid #d1d5db',
                  background: '#ffffff',
                  color: '#111827',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ color: '#374151', display: 'block', marginBottom: 8, fontWeight: 500 }}>Password:</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>                <input
                  type="text"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  style={{
                    flex: 1,
                    padding: 12,
                    borderRadius: 8,
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
                    padding: 12,
                    borderRadius: 8,
                    border: '1px solid #d1d5db',
                    background: '#f3f4f6',
                    color: '#374151',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onClick={e => {
                    setNewPassword(generatePassword());
                    if (regenIconRef.current) {
                      let current = parseInt(regenIconRef.current.getAttribute('data-rot') || '0', 10);
                      current += 360;
                      regenIconRef.current.setAttribute('data-rot', current);
                      regenIconRef.current.classList.add('regen-rotating');
                      regenIconRef.current.style.transform = `rotate(${current}deg) scale(1.25)`;
                      setTimeout(() => {
                        regenIconRef.current.classList.remove('regen-rotating');
                        regenIconRef.current.style.transform = `rotate(${current}deg) scale(1)`;
                      }, 400);
                    }
                  }}
                  title="Regenerate Password"
                >
                  <RefreshCw ref={regenIconRef} className="regen-icon-rotate" size={20} data-rot="0" />
                </button>
              </div>
            </div>            <div style={{ marginBottom: 24 }}>
              <label style={{ color: '#374151', display: 'flex', alignItems: 'center', fontWeight: 500, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={newIsAdmin}
                  onChange={e => setNewIsAdmin(e.target.checked)}
                  style={{ marginRight: 8 }}
                />
                Is Admin
              </label>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>              <button
                type="submit"
                style={{
                  background: '#111827',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '12px 24px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  flex: 1
                }}
              >
                Add User
              </button>
              <button
                type="button"
                onClick={() => setUserMgmtTab('')}
                style={{
                  background: '#f3f4f6',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  padding: '12px 24px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  flex: 1
                }}
              >
                Cancel
              </button>
            </div>
          </form>          {addUserMsg && (
            <div style={{ 
              color: addUserMsg.includes('successfully') ? '#059669' : '#dc2626', 
              marginTop: 16, 
              fontWeight: 600 
            }}>
              {addUserMsg}
            </div>
          )}
        </div>
      ) : (
        <div style={{ width: '100%' }}>
          <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>            <button
              style={{
                background: '#111827',
                color: '#ffffff',
                border: 'none',
                borderRadius: 8,
                padding: '12px 24px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
              onClick={() => setUserMgmtTab('add')}
            >
              <Plus size={18} />
              Add User
            </button>
            <button
              style={{
                background: '#f3f4f6',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                padding: '12px 24px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
              onClick={() => {
                fetch(`${getBaseUrl()}/api/users`)
                  .then(res => res.json())
                  .then(data => setUsers(data.users || []));
              }}
            >
              <RefreshCw size={18} />
              Refresh
            </button>
          </div>          <div style={{
            background: '#ffffff',
            borderRadius: 12,
            border: '1px solid #e5e7eb',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          }}>            <div style={{
              padding: '16px 24px',
              borderBottom: '1px solid #e5e7eb',
              display: 'grid',
              gridTemplateColumns: '1fr auto auto',
              gap: 16,
              alignItems: 'center',
              fontWeight: 600,
              color: '#111827',
              background: '#f9fafb'
            }}>
              <span>Username</span>
              <span>Role</span>
              <span>Actions</span>
            </div>
            
            {users.length > 0 ? (
              users.map((user, index) => (
                <div
                  key={index}                  style={{
                    padding: '16px 24px',
                    borderBottom: index < users.length - 1 ? '1px solid #f3f4f6' : 'none',
                    display: 'grid',
                    gridTemplateColumns: '1fr auto auto',
                    gap: 16,
                    alignItems: 'center',
                    color: '#111827'
                  }}
                >
                  <span>{user.username}</span>                  <span style={{
                    background: user.role === 1 ? '#111827' : '#f3f4f6',
                    color: user.role === 1 ? '#fff' : '#6b7280',
                    padding: '4px 12px',
                    borderRadius: 20,
                    fontSize: '12px',
                    fontWeight: 500
                  }}>
                    {user.role === 1 ? 'Admin' : 'User'}
                  </span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => handleEditUser(user.username)}                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#374151',
                        cursor: 'pointer',
                        padding: 8,
                        borderRadius: 6,
                        transition: 'background 0.2s'
                      }}
                      title="Edit User"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user.username)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#dc2626',
                        cursor: 'pointer',
                        padding: 8,
                        borderRadius: 6,
                        transition: 'background 0.2s'
                      }}
                      title="Delete User"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            ) : (              <div style={{
                padding: '32px 24px',
                textAlign: 'center',
                color: '#6b7280'
              }}>
                No users found
              </div>
            )}
          </div>          {addUserMsg && (
            <div style={{ 
              color: addUserMsg.includes('successfully') ? '#059669' : '#dc2626', 
              marginTop: 16, 
              fontWeight: 600,
              textAlign: 'center'
            }}>
              {addUserMsg}
            </div>
          )}
        </div>
      )}
    </div>
  ) : (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(24,24,24,0.93)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={() => { onClose(); setUserMgmtTab(''); setAddUserMsg(''); }}
    >
      <style>{iconHoverStyle}</style>
      {editingUser ? (
        <div
          style={{
            background: '#fff',
            borderRadius: 12,
            padding: 24,
            minWidth: 320,
            boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
            position: 'relative'
          }}
          onClick={e => e.stopPropagation()}
        >
          <h3>Edit Username</h3>
          <input
            type="text"
            value={editUsername}
            onChange={e => setEditUsername(e.target.value)}
            style={{ width: '100%', padding: 8, borderRadius: 6, marginBottom: 12, border: '1px solid #ccc' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              style={{ 
                background: '#111827',
                color: '#ffffff',
                border: 'none',
                borderRadius: 8,
                padding: '12px 24px',
                fontWeight: 600,
                cursor: 'pointer',
                flex: 1
              }}
              onClick={async () => {
                setEditUserMsg('');
                if (!editUsername.trim()) {
                  setEditUserMsg('Username cannot be empty');
                  return;
                }
                try {
                  const res = await fetch(`${getBaseUrl()}/api/edit-user`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ oldUsername: editingUser, newUsername: editUsername }),
                  });
                  const data = await res.json();
                  if (data.success) {
                    setAddUserMsg('User updated successfully!');
                    setUsers(users.map(u => u.username === editingUser ? { ...u, username: editUsername } : u));
                    setEditingUser(null);
                  } else {
                    setEditUserMsg(data.error || 'Failed to update user');
                  }
                } catch (err) {
                  setEditUserMsg('Error connecting to server');
                }
              }}
            >
              Save
            </button>
            <button
              style={{ 
                background: '#dc2626',
                color: '#ffffff',
                border: 'none',
                borderRadius: 8,
                padding: '12px 24px',
                fontWeight: 600,
                cursor: 'pointer',
                flex: 1
              }}
              onClick={() => setEditingUser(null)}
            >
              Cancel
            </button>
          </div>
          {editUserMsg && (
            <div style={{ color: '#ff4d4f', marginTop: 10, textAlign: 'center', fontWeight: 600 }}>
              {editUserMsg}
            </div>
          )}
        </div>
      ) : userMgmtTab === 'add' ? (
        <div
          style={{
            width: 340,
            background: 'linear-gradient(135deg, #145c2e 0%, #1e4023 60%, #2E8B49 100%)',
            borderRadius: 16,
            boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
            padding: '2rem 1.5rem 1.5rem 1.5rem',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
          onClick={e => e.stopPropagation()}
        >
          <h3 style={{ color: '#fff', fontWeight: 700, fontSize: '1.2rem', letterSpacing: 1, marginBottom: 24 }}>Add User</h3>
          <form onSubmit={handleAddUser} style={{ width: '100%' }}>            <div style={{ marginBottom: 16 }}>
              <label style={{ color: '#fff', display: 'block', marginBottom: 8, fontWeight: 500 }}>Username:</label>
              <input
                type="text"
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: 12,
                  borderRadius: 8,
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: '#fff',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ color: '#fff', display: 'block', marginBottom: 8, fontWeight: 500 }}>Password:</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="text"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  style={{
                    flex: 1,
                    padding: 12,
                    borderRadius: 8,
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    background: 'rgba(255, 255, 255, 0.1)',
                    color: '#fff',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  placeholder="Enter or generate password"
                />
                <button
                  type="button"
                  style={{
                    padding: 0,
                    borderRadius: 6,
                    border: 'none',
                    background: 'transparent',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontFamily: 'Raleway, Inter, Segoe UI, Arial, sans-serif',
                    height: 32,
                    width: 32,
                  }}
                  onClick={e => {
                    setNewPassword(generatePassword());
                    // Animate rotation (forward only, do not reverse)
                    if (regenIconRef.current) {
                      let current = parseInt(regenIconRef.current.getAttribute('data-rot') || '0', 10);
                      current += 360;
                      regenIconRef.current.setAttribute('data-rot', current);
                      regenIconRef.current.classList.add('regen-rotating');
                      regenIconRef.current.style.transform = `rotate(${current}deg) scale(1.25)`;
                      setTimeout(() => {
                        regenIconRef.current.classList.remove('regen-rotating');
                        // Keep the icon at the new rotation, only scale back
                        regenIconRef.current.style.transform = `rotate(${current}deg) scale(1)`;
                      }, 400);
                    }
                  }}
                  onMouseEnter={e => {
                    if (regenIconRef.current) {
                      let current = parseInt(regenIconRef.current.getAttribute('data-rot') || '0', 10);
                      regenIconRef.current.style.transform = `rotate(${current}deg) scale(1.25)`;
                    }
                  }}
                  onMouseLeave={e => {
                    if (regenIconRef.current) {
                      let current = parseInt(regenIconRef.current.getAttribute('data-rot') || '0', 10);
                      regenIconRef.current.style.transform = `rotate(${current}deg) scale(1)`;
                    }
                  }}
                  title="Regenerate Password"
                >
                  <RefreshCw ref={regenIconRef} className="regen-icon-rotate" size={22} data-rot="0" />
                </button>
              </div>
            </div>            <div style={{ marginBottom: 16 }}>
              <label style={{ color: '#fff', display: 'flex', alignItems: 'center', fontWeight: 500, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={newIsAdmin}
                  onChange={e => setNewIsAdmin(e.target.checked)}
                  style={{ marginRight: 8 }}
                />
                Is Admin
              </label>
            </div>
            <div>
              <button
                type="submit"
                className="add-btn-hover"
                style={{
                  width: '100%',
                  padding: '0.8rem 0',
                  borderRadius: 8,
                  border: 'none',
                  background: '#0d1f0d',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '1.08rem',
                  cursor: 'pointer',
                  letterSpacing: 1,
                  fontFamily: 'Raleway, Inter, Segoe UI, Arial, sans-serif',
                  transition: 'background 0.2s, color 0.2s',
                }}                onMouseEnter={e => {
                  e.currentTarget.style.background = '#374151';
                  e.currentTarget.style.color = '#ffffff';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#0d1f0d';
                  e.currentTarget.style.color = '#fff';
                }}
              >
                ADD
              </button>
            </div>
            {addUserMsg && (
              <div style={{ color: addUserMsg.includes('success') ? '#059669' : '#dc2626', marginTop: 10, textAlign: 'center', fontWeight: 600 }}>
                {addUserMsg}
              </div>
            )}
          </form>
          <button
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              background: 'none',
              border: 'none',
              color: '#6b7280',
              cursor: 'pointer',
              fontSize: 24,
              fontWeight: 600,
              padding: 8,
              borderRadius: 6
            }}
            className="umg-close-hover"
            onClick={() => { onClose(); setUserMgmtTab(''); setAddUserMsg(''); }}
            title="Close"
          >
            ×
          </button>
        </div>
      ) : (
        <div
          style={{
            background: 'linear-gradient(135deg, #145c2e 0%, #1e4023 60%, #2E8B49 100%)',
            borderRadius: 16,
            minWidth: 340,
            minHeight: 200,
            boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
            padding: '2rem 1.5rem 1.5rem 1.5rem',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24, width: '100%', justifyContent: 'center', position: 'relative' }}>
            <button
              style={{
                position: 'absolute',
                left: 0,
                top: '50%',
                transform: 'translateY(-50%)',
                background: '#FFD700',
                border: 'none',
                borderRadius: 7,
                width: 38,
                height: 38,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#145c2e',
                boxShadow: '0 2px 8px rgba(0,0,0,0.13)',
                cursor: 'pointer',
                transition: 'background 0.2s, color 0.2s, transform 0.18s',
                fontSize: 22,
                outline: userMgmtTab === 'add' ? `2px solid #fff` : 'none',
                padding: 0,
              }}
              onClick={() => setUserMgmtTab('add')}
              title="Add User"
            >
              <Plus size={22} className="plus-icon-hover" />
            </button>
            <h3 style={{ margin: 0, color: '#fff', fontWeight: 700, fontSize: '1.2rem', letterSpacing: 1 }}>
              User Management
            </h3>
          </div>
          <div style={{
            width: '100%',
            marginTop: 12,
            background: 'rgba(255,255,255,0.07)',
            borderRadius: 10,
            padding: '1rem 1rem 0.5rem 1rem',
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            maxHeight: 260,
            overflowY: 'auto',
          }}>
            <div style={{
              fontWeight: 700,
              color: '#FFD700',
              fontSize: '1.08rem',
              marginBottom: 10,
              letterSpacing: 1,
              textAlign: 'center',
            }}>
              Current Users
            </div>
            <ul style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}>
              {users.length === 0 ? (
                <li style={{
                  color: '#fff',
                  textAlign: 'center',
                  fontWeight: 500,
                  opacity: 0.7,
                }}>No users found.</li>
              ) : (
                users.map((u, idx) => (
                  <li key={idx} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'rgba(46,139,73,0.13)',
                    borderRadius: 8,
                    padding: '0.7rem 1rem',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                    transition: 'background 0.18s',
                  }}>
                    <span style={{
                      color: '#fff',
                      fontWeight: 600,
                      fontSize: '1.05rem',
                      letterSpacing: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                    }}>
                      {u.username}
                    </span>
                    {role === 1 && (
                      <div style={{ display: 'flex', gap: 8, marginLeft: 12 }}>
                        <button
                          style={{
                            background: 'none',
                            border: 'none',
                            borderRadius: 6,
                            padding: 0,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: 32,
                            width: 32,
                          }}
                          title="Edit"
                          onClick={() => handleEditUser(u.username)}
                        >
                          <Edit2 size={20} color="#fff" className="umg-icon-hover" />
                        </button>
                        <button
                          style={{
                            background: 'none',
                            border: 'none',
                            borderRadius: 6,
                            padding: 0,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: 32,
                            width: 32,
                          }}
                          title="Delete"
                          onClick={() => handleDeleteUser(u.username)}
                        >
                          <Trash2 size={20} color="#fff" className="umg-icon-hover" />
                        </button>
                      </div>
                    )}
                  </li>
                ))
              )}
            </ul>
          </div>
          <button            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              background: 'none',
              border: 'none',
              color: '#6b7280',
              cursor: 'pointer',
              fontSize: 24,
              fontWeight: 600,
              padding: 8,
              borderRadius: 6,
              transition: 'transform 0.18s, color 0.2s',
            }}
            className="umg-close-hover"
            onClick={() => { onClose(); setUserMgmtTab(''); setAddUserMsg(''); }}
            title="Close"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
