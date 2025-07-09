import React, { useState, useEffect } from 'react';
import { Upload, Plus, FileText, Folder, Database, PenSquare, Trash2, Users } from 'lucide-react';
import { getBaseUrl } from '../utils';

const KnowledgeBaseTab = () => {
  const [modules, setModules] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [selectedModule, setSelectedModule] = useState('');
  const [newModule, setNewModule] = useState({ name: '', description: '' });
  const [files, setFiles] = useState([]);
  const [titles, setTitles] = useState({});
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState('');
  const [moduleSuccessMsg, setModuleSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [textPreview, setTextPreview] = useState('');
  const [textPreviewFile, setTextPreviewFile] = useState('');

  // Team context state
  const [userTeams, setUserTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [showTeamFilter, setShowTeamFilter] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Fetch modules and documents
  useEffect(() => {
    fetchUserInfo();
    fetchModules();
    fetchDocuments();
  }, []);

  // Update modules when team selection changes
  useEffect(() => {
    if (selectedTeamId) {
      fetchModules();
    }
  }, [selectedTeamId]);

  useEffect(() => {
    if (editingDoc && editingDoc.file_path) {
      const fileName = editingDoc.file_path.split(/[\\/]/).pop();
      const ext = fileName.split('.').pop().toLowerCase();
      
      if (['txt', 'py', 'js', 'md', 'json', 'xml', 'csv', 'doc', 'docx', 'pdf'].includes(ext)) {
        const token = localStorage.getItem('token');
        
        if (['txt', 'py', 'js', 'md', 'json', 'xml', 'csv'].includes(ext)) {
          // For plain text files, use the original file endpoint
          const fileUrl = `${getBaseUrl()}/api/document_file/${editingDoc.module_id}/${encodeURIComponent(fileName)}`;
          setTextPreviewFile(fileUrl);
          
          fetch(fileUrl, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })
            .then(res => {
              if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
              }
              return res.text();
            })
            .then(setTextPreview)
            .catch((error) => {
              console.error('Error loading file:', error);
              setTextPreview('Could not load file.');
            });
        } else {
          // For Word docs and PDFs, use the text extraction endpoint
          const textUrl = `${getBaseUrl()}/api/document_text/${editingDoc.module_id}/${encodeURIComponent(fileName)}`;
          setTextPreviewFile(textUrl);
          
          fetch(textUrl, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })
            .then(res => {
              if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
              }
              return res.json();
            })
            .then(data => {
              if (data.success) {
                setTextPreview(data.text || 'No text content found.');
              } else {
                setTextPreview('Failed to extract text content.');
              }
            })
            .catch((error) => {
              console.error('Error loading file text:', error);
              setTextPreview('Could not extract text from file.');
            });
        }
      } else {
        setTextPreview('');
        setTextPreviewFile('');
      }
    } else {
      setTextPreview('');
      setTextPreviewFile('');
    }
  }, [editingDoc]);

  const fetchUserInfo = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${getBaseUrl()}/api/user-info`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      
      if (data.user) {
        setCurrentUser(data.user);
        console.log('User data:', data.user); // Debug log
        
        // Fetch user's teams (backend handles global admin logic)
        const teamsRes = await fetch(`${getBaseUrl()}/api/user/teams`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const teamsData = await teamsRes.json();
        
        if (teamsData.teams) {
          setUserTeams(teamsData.teams);
          console.log('User teams:', teamsData.teams); // Debug log
          
          // Show team filter if user has access to multiple teams
          if (teamsData.teams.length > 1) {
            setShowTeamFilter(true);
            // Set default to first team where user is admin, or first team
            const adminTeam = teamsData.teams.find(team => team.is_team_admin === 1);
            setSelectedTeamId((adminTeam || teamsData.teams[0]).team_id);
          } else if (teamsData.teams.length === 1) {
            // If user has access to only one team, auto-select it but don't show filter
            setSelectedTeamId(teamsData.teams[0].team_id);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching user info:', err);
    }
  };

  const fetchModules = async () => {
    try {
      const token = localStorage.getItem('token');
      let url = `${getBaseUrl()}/api/modules`;
      
      // Add team filter if a team is selected
      if (selectedTeamId) {
        url += `?team_id=${selectedTeamId}`;
      }
      
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      setModules(data.modules || []);
    } catch (err) {
      console.error('Error fetching modules:', err);
      setModules([]);
    }
  };

  const fetchDocuments = async () => {
    try {
      const res = await fetch(`${getBaseUrl()}/api/documents`);
      const data = await res.json();
      setDocuments(data.documents || []);
    } catch (err) {
      console.error('Error fetching documents:', err);
      setDocuments([]);
    }
  };

  const handleCreateModule = async (e) => {
    e.preventDefault();
    if (!newModule.name.trim()) return;
    
    // Check if user has selected a team when teams are available
    if (userTeams.length > 0 && !selectedTeamId) {
      setUploadError('Please select a team for the new module');
      setTimeout(() => setUploadError(''), 3000);
      return;
    }
    
    setLoading(true);
    setModuleSuccessMsg('');
    setUploadError('');

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('name', newModule.name);
      formData.append('description', newModule.description);
      
      // Include team_id if available
      if (selectedTeamId) {
        formData.append('team_id', selectedTeamId);
      }

      const res = await fetch(`${getBaseUrl()}/api/create_module`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });

      if (res.ok) {
        setModuleSuccessMsg('Module created successfully!');
        setNewModule({ name: '', description: '' });
        fetchModules();
        setTimeout(() => setModuleSuccessMsg(''), 3000);
      } else {
        setUploadError('Failed to create module');
        setTimeout(() => setUploadError(''), 3000);
      }
    } catch (err) {
      console.error('Error creating module:', err);
      setUploadError('Error creating module');
      setTimeout(() => setUploadError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadDocuments = async (e) => {
    e.preventDefault();
    if (!selectedModule || files.length === 0) {
      setUploadError('Please select a module and at least one file');
      setTimeout(() => setUploadError(''), 3000);
      return;
    }

    // Check if user has selected a team when teams are available
    if (userTeams.length > 0 && !selectedTeamId) {
      setUploadError('Please select a team before uploading documents');
      setTimeout(() => setUploadError(''), 3000);
      return;
    }

    setLoading(true);
    setUploadSuccessMsg('');
    setUploadError('');

    try {
      const token = localStorage.getItem('token');
      const uploadPromises = files.map(async (file, index) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('module_id', selectedModule);
        formData.append('title', titles[index] || file.name);

        const response = await fetch(`${getBaseUrl()}/api/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }

        return response.json();
      });

      await Promise.all(uploadPromises);
      setUploadSuccessMsg(`Successfully uploaded ${files.length} file(s)!`);
      setFiles([]);
      setTitles({});
      setSelectedModule('');
      fetchDocuments();
      setTimeout(() => setUploadSuccessMsg(''), 3000);
    } catch (err) {
      console.error('Error uploading files:', err);
      setUploadError('Error uploading files');
      setTimeout(() => setUploadError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(selectedFiles);
    const newTitles = {};
    selectedFiles.forEach((file, i) => {
      newTitles[i] = file.name.split('.')[0];
    });
    setTitles(newTitles);
  };

  const handleDeleteModule = async (moduleId) => {
    if (!window.confirm('Are you sure you want to delete this module and all its documents?')) {
      return;
    }

    try {
      const res = await fetch(`${getBaseUrl()}/api/delete_module/${moduleId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchModules();
        fetchDocuments();
      } else {
        alert('Failed to delete module');
      }
    } catch (err) {
      console.error('Error deleting module:', err);
      alert('Error deleting module');
    }
  };

  const handleDeleteDocument = async (documentId) => {
    if (!window.confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      const res = await fetch(`${getBaseUrl()}/api/delete_document/${documentId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchDocuments();
      } else {
        alert('Failed to delete document');
      }
    } catch (err) {
      console.error('Error deleting document:', err);
      alert('Error deleting document');
    }
  };

  const handleEditDocument = (doc) => {
    setEditingDoc(doc);
  };

  const closeEditPopup = () => {
    setEditingDoc(null);
    setTextPreview('');
    setTextPreviewFile('');
  };

  // Group documents by module
  const documentsByModule = documents.reduce((acc, doc) => {
    if (!acc[doc.module_id]) {
      acc[doc.module_id] = [];
    }
    acc[doc.module_id].push(doc);
    return acc;
  }, {});

  return (
    <div style={{ padding: '40px', maxWidth: '1600px', margin: '0 auto' }}>
      {showTeamFilter && (
        <div style={{
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '24px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px',
          }}>
            <Users size={20} color="#374151" />
            <h4 style={{
              color: '#111827',
              fontSize: '16px',
              fontWeight: 600,
              margin: 0,
            }}>
              Select Team
            </h4>
          </div>
          <div style={{ position: 'relative' }}>
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 40px 12px 16px',
                backgroundColor: '#ffffff',
                border: '2px solid #d1d5db',
                borderRadius: '8px',
                color: selectedTeamId ? '#111827' : '#6b7280',
                fontSize: '14px',
                fontWeight: selectedTeamId ? '500' : '400',
                cursor: 'pointer',
                outline: 'none',
                transition: 'all 0.2s ease',
                appearance: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => { e.target.style.borderColor = '#374151'; }}
              onBlur={(e) => { e.target.style.borderColor = '#d1d5db'; }}
              onMouseEnter={(e) => { 
                if (e.target !== document.activeElement) {
                  e.target.style.borderColor = '#9ca3af'; 
                }
              }}
              onMouseLeave={(e) => { 
                if (e.target !== document.activeElement) {
                  e.target.style.borderColor = '#d1d5db'; 
                }
              }}
            >
              <option value="" style={{ color: '#6b7280', fontWeight: '400' }}>Select a team...</option>
              {userTeams.map((team) => (
                <option key={team.team_id} value={team.team_id} style={{ color: '#111827', fontWeight: '500' }}>
                  {team.name} ({team.is_team_admin === 1 ? 'Admin' : 'Member'})
                </option>
              ))}
            </select>
            <div style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
              color: '#9ca3af',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6,9 12,15 18,9"></polyline>
              </svg>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: '40px', alignItems: 'start' }}>
        <div style={{ opacity: selectedTeamId ? 1 : 0.5, pointerEvents: selectedTeamId ? 'auto' : 'none' }}>
          {/* Upload Documents Section */}
          <div>
            <div style={{
              background: '#ffffff',
              borderRadius: '16px',
              padding: '24px',
              border: '1px solid #e5e7eb',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            }}>
              <h2 style={{
                color: '#111827',
                fontSize: '22px',
                fontWeight: 600,
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}>
                <Upload size={22} />
                Upload Documents
              </h2>

              <div style={{ marginBottom: '32px' }}>
                <div style={{
                  background: '#f9fafb',
                  borderRadius: '12px',
                  padding: '20px',
                  border: '1px solid #e5e7eb',
                  marginBottom: '20px',
                }}>
                  <h3 style={{ 
                    color: '#374151', 
                    fontSize: '16px', 
                    fontWeight: 600,
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}>
                    <Plus size={18} />
                    Create New Module
                  </h3>
                  <form onSubmit={handleCreateModule}>
                    <input
                      type="text"
                      placeholder="Module Name"
                      value={newModule.name}
                      onChange={(e) => setNewModule({ ...newModule, name: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        marginBottom: '12px',
                        background: '#ffffff',
                        border: '2px solid #d1d5db',
                        borderRadius: '8px',
                        color: '#111827',
                        fontSize: '14px',
                        transition: 'border-color 0.2s',
                        boxSizing: 'border-box',
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#374151'}
                      onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                    />
                    <textarea
                      placeholder="Module Description (optional)"
                      value={newModule.description}
                      onChange={(e) => setNewModule({ ...newModule, description: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        marginBottom: '16px',
                        background: '#ffffff',
                        border: '2px solid #d1d5db',
                        borderRadius: '8px',
                        color: '#111827',
                        fontSize: '14px',
                        minHeight: '70px',
                        resize: 'vertical',
                        transition: 'border-color 0.2s',
                        boxSizing: 'border-box',
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#374151'}
                      onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                    />
                    <button
                      type="submit"
                      disabled={loading || !newModule.name.trim()}
                      style={{
                        width: '100%',
                        background: '#111827',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '12px 20px',
                        fontWeight: 600,
                        fontSize: '14px',
                        cursor: 'pointer',
                        opacity: loading || !newModule.name.trim() ? 0.5 : 1,
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                      }}
                    >
                      {loading ? 'Creating...' : (
                        <>
                          <Plus size={16} />
                          Create Module
                        </>
                      )}
                    </button>
                  </form>
                  {moduleSuccessMsg && (
                    <div style={{ 
                      color: '#059669', 
                      marginTop: '16px', 
                      fontSize: '14px',
                      fontWeight: 500,
                      padding: '8px 12px',
                      background: '#ecfdf5',
                      border: '1px solid #a7f3d0',
                      borderRadius: '6px',
                    }}>
                      {moduleSuccessMsg}
                    </div>
                  )}
                </div>

                {/* Upload Documents Form */}
                <div style={{
                  background: '#f3f4f6',
                  borderRadius: '12px',
                  padding: '20px',
                  border: '1px solid #d1d5db',
                }}>
                  <h3 style={{ 
                    color: '#374151', 
                    fontSize: '16px', 
                    fontWeight: 600,
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}>
                    <FileText size={16} />
                    Upload Documents
                  </h3>
                  <form onSubmit={handleUploadDocuments}>
                    <div style={{ position: 'relative', marginBottom: '16px' }}>
                      <select
                        className="modern-dropdown"
                        value={selectedModule}
                        onChange={(e) => setSelectedModule(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '16px 50px 16px 18px',
                          background: selectedModule 
                            ? '#f9fafb'
                            : '#ffffff',
                          border: selectedModule 
                            ? '2px solid #374151' 
                            : '2px solid #d1d5db',
                          borderRadius: '12px',
                          color: selectedModule ? '#111827' : '#6b7280',
                          fontSize: '15px',
                          fontWeight: selectedModule ? '600' : '500',
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          boxSizing: 'border-box',
                          appearance: 'none',
                          cursor: 'pointer',
                          outline: 'none',
                          boxShadow: selectedModule 
                            ? '0 4px 12px rgba(0, 0, 0, 0.1)' 
                            : '0 2px 6px rgba(0, 0, 0, 0.05)',
                          letterSpacing: '0.025em',
                        }}
                      >
                        <option value="" style={{ 
                          background: '#ffffff', 
                          color: '#6b7280',
                          padding: '14px',
                          fontSize: '15px',
                          fontWeight: '500',
                        }}>
                          {modules.length > 0 ? '✨ Select a module...' : '⚠️ No modules available'}
                        </option>
                        {modules.map((module) => (
                          <option 
                            key={module.module_id} 
                            value={module.module_id}
                            style={{ 
                              background: '#ffffff', 
                              color: '#111827',
                              padding: '14px',
                              fontSize: '15px',
                              fontWeight: '500',
                              borderBottom: '1px solid #f3f4f6',
                            }}
                          >
                            📁 {module.name}
                            {documentsByModule[module.module_id]?.length > 0 && ` (${documentsByModule[module.module_id].length} docs)`}
                            {module.description && ` • ${module.description.slice(0, 25)}${module.description.length > 25 ? '...' : ''}`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ position: 'relative', marginBottom: '16px' }}>
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.py,.txt,.js"
                        onChange={handleFileChange}
                        style={{
                          position: 'absolute',
                          opacity: 0,
                          width: '100%',
                          height: '100%',
                          cursor: 'pointer',
                          zIndex: 2,
                        }}
                        id="file-upload"
                      />
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.py,.txt,.js"
                        webkitdirectory=""
                        directory=""
                        onChange={handleFileChange}
                        style={{
                          position: 'absolute',
                          opacity: 0,
                          width: '100%',
                          height: '100%',
                          cursor: 'pointer',
                          zIndex: 1,
                        }}
                        id="folder-upload"
                      />
                      
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '16px',
                        width: '100%',
                        padding: '24px 20px',
                        minHeight: '140px',
                        background: files.length > 0 
                          ? '#f9fafb' 
                          : '#ffffff',
                        border: files.length > 0 
                          ? '3px dashed #374151' 
                          : '3px dashed #d1d5db',
                        borderRadius: '16px',
                        color: files.length > 0 ? '#111827' : '#6b7280',
                        fontSize: '15px',
                        fontWeight: files.length > 0 ? '600' : '500',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxSizing: 'border-box',
                        textAlign: 'center',
                        position: 'relative',
                        overflow: 'hidden',
                        boxShadow: files.length > 0 
                          ? '0 4px 12px rgba(0, 0, 0, 0.1)' 
                          : '0 2px 6px rgba(0, 0, 0, 0.05)',
                      }}>
                        
                        <div style={{
                          padding: '12px',
                          background: files.length > 0 
                            ? '#e5e7eb'
                            : '#f3f4f6',
                          borderRadius: '50%',
                          transition: 'all 0.3s ease',
                          boxShadow: files.length > 0 
                            ? '0 2px 8px rgba(0, 0, 0, 0.1)'
                            : '0 1px 4px rgba(0, 0, 0, 0.05)',
                        }}>
                          <Upload size={24} strokeWidth={2.5} />
                        </div>
                        
                        {files.length > 0 ? (
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ 
                              fontWeight: 700,
                              fontSize: '16px',
                              marginBottom: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '8px',
                            }}>
                              ✅ {files.length} file{files.length > 1 ? 's' : ''} selected
                            </div>
                            <div style={{ 
                              fontSize: '13px', 
                              opacity: 0.9, 
                              fontWeight: '500',
                              color: '#6b7280',
                            }}>
                              Click buttons below to change selection
                            </div>
                          </div>
                        ) : (
                          <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                            <div style={{ 
                              fontWeight: 600,
                              fontSize: '16px',
                              marginBottom: '4px',
                            }}>
                              📄 Choose Files or Folders to Upload
                            </div>
                            <div style={{ 
                              fontSize: '13px', 
                              opacity: 0.8, 
                              fontWeight: '500',
                              color: '#9ca3af',
                            }}>
                              Select individual files or entire folders
                            </div>
                          </div>
                        )}
                        
                        <div style={{ 
                          display: 'flex', 
                          gap: '12px', 
                          width: '100%',
                          justifyContent: 'center'
                        }}>
                          <label
                            htmlFor="file-upload"
                            style={{
                              background: '#f3f4f6',
                              border: '2px solid #d1d5db',
                              borderRadius: '8px',
                              padding: '8px 16px',
                              cursor: 'pointer',
                              color: '#374151',
                              fontSize: '13px',
                              fontWeight: '600',
                              transition: 'all 0.2s',
                              textAlign: 'center',
                              minWidth: '100px',
                            }}
                          >
                            📄 Select Files
                          </label>
                          
                          <label
                            htmlFor="folder-upload"
                            style={{
                              background: '#e5e7eb',
                              border: '2px solid #9ca3af',
                              borderRadius: '8px',
                              padding: '8px 16px',
                              cursor: 'pointer',
                              color: '#111827',
                              fontSize: '13px',
                              fontWeight: '600',
                              transition: 'all 0.2s',
                              textAlign: 'center',
                              minWidth: '100px',
                            }}
                          >
                            📁 Select Folder
                          </label>
                        </div>

                        <div style={{ 
                          fontSize: '11px', 
                          opacity: 0.6, 
                          padding: '4px 8px',
                          background: '#f3f4f6',
                          border: '1px solid #e5e7eb',
                          borderRadius: '6px',
                          display: 'inline-block',
                          marginTop: '4px',
                          color: '#6b7280'
                        }}>
                          PDF, DOC, DOCX, PY, TXT, JS files allowed • Folder upload works in modern browsers
                        </div>
                      </div>
                    </div>

                    {files.length > 0 && (
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{
                          background: '#f9fafb',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          padding: '12px',
                          marginBottom: '16px',
                        }}>
                          <h4 style={{ 
                            color: '#374151', 
                            fontSize: '13px', 
                            margin: '0 0 8px 0', 
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                          }}>
                            Selected Files:
                          </h4>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {files.map((file, index) => (
                              <div
                                key={index}
                                style={{
                                  background: '#ffffff',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '6px',
                                  padding: '4px 8px',
                                  fontSize: '12px',
                                  color: '#374151',
                                  fontWeight: 500,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  maxWidth: '200px',
                                }}
                                title={file.webkitRelativePath || file.name}
                              >
                                <FileText size={12} />
                                {file.webkitRelativePath ? (
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    📁 {file.webkitRelativePath.split('/')[0]}/.../{file.name}
                                  </span>
                                ) : (
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {file.name}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {files.length > 0 && (
                      <div style={{ marginBottom: '20px' }}>
                        <h4 style={{ color: '#111827', fontSize: '14px', marginBottom: '12px', fontWeight: 500 }}>
                          Document Titles:
                        </h4>
                        {files.map((file, index) => (
                          <div key={index} style={{ marginBottom: '12px' }}>
                            <label style={{ 
                              color: '#374151', 
                              fontSize: '13px', 
                              display: 'block', 
                              marginBottom: '4px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}>
                              {file.webkitRelativePath ? (
                                <span title={file.webkitRelativePath}>
                                  📁 {file.webkitRelativePath.split('/')[0]}/.../{file.name}
                                </span>
                              ) : (
                                <span>📄 {file.name}</span>
                              )}
                            </label>
                            <input
                              type="text"
                              placeholder="Document title"
                              value={titles[index] || ''}
                              onChange={(e) => setTitles({ ...titles, [index]: e.target.value })}
                              style={{
                                width: '100%',
                                padding: '10px 12px',
                                background: '#ffffff',
                                border: '1px solid #d1d5db',
                                borderRadius: '8px',
                                color: '#111827',
                                fontSize: '14px',
                                transition: 'border-color 0.2s',
                                boxSizing: 'border-box',
                              }}
                              onFocus={(e) => e.target.style.borderColor = '#374151'}
                              onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading || !selectedModule || files.length === 0}
                      style={{
                        width: '100%',
                        background: '#374151',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '12px 20px',
                        fontWeight: 600,
                        fontSize: '14px',
                        cursor: 'pointer',
                        opacity: loading || !selectedModule || files.length === 0 ? 0.5 : 1,
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                      }}
                    >
                      {loading ? 'Uploading...' : (
                        <>
                          <Upload size={16} />
                          Upload Documents
                        </>
                      )}
                    </button>
                  </form>
                  {uploadSuccessMsg && (
                    <div style={{ 
                      color: '#059669', 
                      marginTop: '16px', 
                      fontSize: '14px',
                      fontWeight: 500,
                      padding: '8px 12px',
                      background: '#ecfdf5',
                      border: '1px solid #a7f3d0',
                      borderRadius: '6px',
                    }}>
                      {uploadSuccessMsg}
                    </div>
                  )}
                  {uploadError && (
                    <div style={{ 
                      color: '#dc2626', 
                      marginTop: '16px', 
                      fontSize: '14px',
                      fontWeight: 500,
                      padding: '8px 12px',
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '6px',
                    }}>
                      {uploadError}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ opacity: selectedTeamId ? 1 : 0.5, pointerEvents: selectedTeamId ? 'auto' : 'none' }}>
          {/* Browse Documents Section */}
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '32px',
            border: '1px solid #e5e7eb',
            minHeight: '600px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          }}>
            <h2 style={{
              color: '#111827',
              fontSize: '24px',
              fontWeight: 600,
              marginBottom: '32px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}>
              <Folder size={24} />
              Browse Documents
            </h2>

            <div style={{ maxHeight: '700px', overflowY: 'auto', paddingRight: '8px' }}>
              {modules.map((module, index) => (
                <div key={module.module_id} style={{
                  marginBottom: '24px',
                  background: '#f9fafb',
                  borderRadius: '12px',
                  border: '1px solid #e5e7eb',
                  overflow: 'hidden',
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                }}>
                  <div style={{
                    padding: '20px 24px',
                    background: index % 2 === 0 ? '#ffffff' : '#f3f4f6',
                    borderBottom: '1px solid #e5e7eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{
                        color: '#111827',
                        fontSize: '18px',
                        fontWeight: 600,
                        margin: 0,
                        marginBottom: '4px',
                      }}>
                        {module.name}
                      </h3>
                      {module.description && (
                        <p style={{
                          color: '#6b7280',
                          fontSize: '14px',
                          margin: 0,
                          lineHeight: '1.4',
                        }}>
                          {module.description}
                        </p>
                      )}
                      <div style={{
                        marginTop: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                      }}>
                        <span style={{
                          background: index % 2 === 0 ? '#f3f4f6' : '#e5e7eb',
                          color: '#374151',
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 500,
                        }}>
                          {documentsByModule[module.module_id]?.length || 0} documents
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteModule(module.module_id)}
                      style={{
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        color: '#dc2626',
                        cursor: 'pointer',
                        padding: '10px',
                        borderRadius: '8px',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title="Delete Module"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  
                  <div style={{ padding: '20px 24px' }}>
                    {documentsByModule[module.module_id]?.length > 0 ? (
                      <div style={{ display: 'grid', gap: '12px' }}>
                        {documentsByModule[module.module_id].map((doc) => (
                          <div key={doc.document_id} style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 16px',
                            background: '#ffffff',
                            borderRadius: '8px',
                            border: '1px solid #e5e7eb',
                            transition: 'all 0.2s',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                              <div style={{
                                background: '#f3f4f6',
                                borderRadius: '6px',
                                padding: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}>
                                <FileText size={16} color="#6b7280" />
                              </div>
                              <span style={{ 
                                color: '#111827', 
                                fontSize: '15px',
                                fontWeight: 500,
                              }}>
                                {doc.title}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <button
                                onClick={() => handleEditDocument(doc)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#6366f1',
                                  cursor: 'pointer',
                                  padding: '6px',
                                  borderRadius: '4px',
                                  transition: 'all 0.2s',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                                title="View Document"
                              >
                                <PenSquare size={16} />
                              </button>
                              <button
                                onClick={() => handleDeleteDocument(doc.document_id)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#dc2626',
                                  cursor: 'pointer',
                                  padding: '6px',
                                  borderRadius: '4px',
                                  transition: 'all 0.2s',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                                title="Delete Document"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{
                        textAlign: 'center',
                        padding: '32px 20px',
                        color: '#6b7280',
                        fontSize: '15px',
                      }}>
                        <FileText size={32} color="#9ca3af" style={{ marginBottom: '12px' }} />
                        <p style={{ margin: 0, fontWeight: 500 }}>
                          No documents in this module
                        </p>
                        <p style={{ margin: '4px 0 0', fontSize: '13px', opacity: 0.8 }}>
                          Upload some documents to get started
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {modules.length === 0 && (
                <div style={{
                  textAlign: 'center',
                  padding: '60px 20px',
                  color: '#6b7280',
                }}>
                  <Database size={48} color="#9ca3af" style={{ marginBottom: '16px' }} />
                  <h3 style={{ color: '#374151', fontSize: '18px', marginBottom: '8px' }}>
                    No modules found
                  </h3>
                  <p style={{ fontSize: '14px', margin: 0, opacity: 0.8 }}>
                    Create your first module to organize your documents
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Document Preview Popup */}
      {editingDoc && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.25)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '20px',
            minWidth: '90vw',
            minHeight: '90vh',
            maxWidth: '95vw',
            maxHeight: '95vh',
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            position: 'relative',
            animation: 'fadeInUp 0.3s',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <button
              onClick={closeEditPopup}
              style={{
                position: 'absolute',
                top: '15px',
                right: '15px',
                background: '#374151',
                color: '#fff',
                border: 'none',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                fontWeight: 'bold',
                zIndex: 10,
              }}
              title="Close"
            >
              ×
            </button>

            <div style={{
              marginBottom: '20px',
              paddingTop: '20px',
              borderBottom: '1px solid #e5e7eb',
              paddingBottom: '15px'
            }}>
              <h3 style={{ 
                margin: 0, 
                color: '#111827', 
                fontSize: '18px', 
                fontWeight: 600 
              }}>
                {editingDoc.title}
              </h3>
              <p style={{ 
                margin: '4px 0 0', 
                color: '#6b7280', 
                fontSize: '14px' 
              }}>
                {editingDoc.file_path}
              </p>
            </div>

            <div style={{ 
              flex: 1, 
              width: '100%', 
              height: '100%',
              overflow: 'auto'
            }}>
              {(() => {
                if (!editingDoc.file_path) {
                  return (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      flexDirection: 'column',
                      gap: '20px',
                      color: '#6b7280',
                    }}>
                      <div style={{ fontSize: '48px' }}>❌</div>
                      <div style={{ fontSize: '18px', fontWeight: 600 }}>
                        No file path available
                      </div>
                    </div>
                  );
                }

                const fileName = editingDoc.file_path.split(/[\\/]/).pop();
                const ext = fileName.split('.').pop().toLowerCase();
                const fileUrl = `${getBaseUrl()}/api/document_file/${editingDoc.module_id}/${encodeURIComponent(fileName)}`;

                console.log('File preview debug:', {
                  fileName,
                  ext,
                  fileUrl,
                  moduleId: editingDoc.module_id,
                  filePath: editingDoc.file_path
                });

                if (ext === 'pdf') {
                  // Try to show text content first, with iframe fallback
                  if (textPreview) {
                    return (
                      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <div style={{
                          background: '#e5e7eb',
                          padding: '12px 16px',
                          borderRadius: '8px 8px 0 0',
                          fontSize: '14px',
                          fontWeight: 600,
                          color: '#374151',
                          borderBottom: '1px solid #d1d5db'
                        }}>
                          📄 PDF Text Content (Extracted)
                        </div>
                        <pre style={{
                          background: '#f8f9fa',
                          border: '1px solid #e5e7eb',
                          borderRadius: '0 0 8px 8px',
                          padding: '20px',
                          flex: 1,
                          overflow: 'auto',
                          fontSize: 14,
                          color: '#374151',
                          whiteSpace: 'pre-wrap',
                          fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                          lineHeight: 1.5,
                          margin: 0
                        }}>
                          {textPreview}
                        </pre>
                      </div>
                    );
                  } else {
                    // Fallback to iframe for PDF
                    return (
                      <iframe
                        src={fileUrl}
                        style={{ 
                          width: '100%', 
                          height: '100%', 
                          border: 'none', 
                          background: '#fff',
                          borderRadius: '8px'
                        }}
                        title="Document Preview"
                        onError={() => console.error('PDF iframe failed to load')}
                      />
                    );
                  }
                }
                
                if (['txt', 'py', 'js', 'md', 'json', 'xml', 'csv'].includes(ext)) {
                  return (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                      <div style={{
                        background: '#e5e7eb',
                        padding: '12px 16px',
                        borderRadius: '8px 8px 0 0',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#374151',
                        borderBottom: '1px solid #d1d5db'
                      }}>
                        📄 {ext.toUpperCase()} File Content
                      </div>
                      <pre style={{
                        background: '#f8f9fa',
                        border: '1px solid #e5e7eb',
                        borderRadius: '0 0 8px 8px',
                        padding: '20px',
                        flex: 1,
                        overflow: 'auto',
                        fontSize: 14,
                        color: '#374151',
                        whiteSpace: 'pre-wrap',
                        fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                        lineHeight: 1.5,
                        margin: 0
                      }}>
                        {textPreview || 'Loading...'}
                      </pre>
                    </div>
                  );
                }
                
                if (['doc', 'docx'].includes(ext)) {
                  if (textPreview) {
                    return (
                      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <div style={{
                          background: '#e5e7eb',
                          padding: '12px 16px',
                          borderRadius: '8px 8px 0 0',
                          fontSize: '14px',
                          fontWeight: 600,
                          color: '#374151',
                          borderBottom: '1px solid #d1d5db',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <span>📄 Word Document Text Content</span>
                          <a 
                            href={fileUrl} 
                            download 
                            style={{ 
                              color: '#6366f1', 
                              textDecoration: 'none',
                              fontWeight: 500,
                              fontSize: '12px',
                              padding: '4px 8px',
                              background: '#f3f4f6',
                              borderRadius: '4px',
                              border: '1px solid #d1d5db'
                            }}
                            title="Download original file"
                          >
                            ⬇️ Download
                          </a>
                        </div>
                        <pre style={{
                          background: '#f8f9fa',
                          border: '1px solid #e5e7eb',
                          borderRadius: '0 0 8px 8px',
                          padding: '20px',
                          flex: 1,
                          overflow: 'auto',
                          fontSize: 14,
                          color: '#374151',
                          whiteSpace: 'pre-wrap',
                          fontFamily: 'system-ui, -apple-system, sans-serif',
                          lineHeight: 1.6,
                          margin: 0
                        }}>
                          {textPreview}
                        </pre>
                      </div>
                    );
                  } else {
                    return (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        flexDirection: 'column',
                        gap: '20px',
                        color: '#6b7280',
                      }}>
                        <div style={{ fontSize: '48px' }}>📄</div>
                        <div style={{ fontSize: '18px', fontWeight: 600 }}>
                          Loading Word Document...
                        </div>
                        <div style={{ fontSize: '14px', textAlign: 'center' }}>
                          Extracting text content from the document.<br/>
                          <a 
                            href={fileUrl} 
                            download 
                            style={{ 
                              color: '#374151', 
                              textDecoration: 'underline',
                              fontWeight: 500 
                            }}
                          >
                            Click here to download the file
                          </a>
                        </div>
                      </div>
                    );
                  }
                }
                
                // For other file types, show download option
                return (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    flexDirection: 'column',
                    gap: '20px',
                    color: '#6b7280',
                  }}>
                    <div style={{ fontSize: '48px' }}>📄</div>
                    <div style={{ fontSize: '18px', fontWeight: 600 }}>
                      Preview not available for .{ext} files
                    </div>
                    <div style={{ fontSize: '14px', textAlign: 'center' }}>
                      This file type cannot be previewed in the browser.<br/>
                      <a 
                        href={fileUrl} 
                        download 
                        style={{ 
                          color: '#374151', 
                          textDecoration: 'underline',
                          fontWeight: 500 
                        }}
                      >
                        Click here to download the file
                      </a>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeBaseTab;
