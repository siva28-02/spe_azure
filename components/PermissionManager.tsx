import React, { useState, useEffect } from 'react';
import { SPEContainer, SPEPermission } from '../types';
import { GraphService } from '../services/graphService';
import { Button } from './Button';
import { Users, UserPlus, ShieldCheck, Loader2, CheckCircle2, AlertCircle, RefreshCw, Trash2, Edit2, Save, X, User as UserIcon } from 'lucide-react';
import { ConfirmationModal } from './Modal';

interface PermissionManagerProps {
  containers: SPEContainer[];
  graphService: GraphService;
  isAdmin: boolean;
}

export const PermissionManager: React.FC<PermissionManagerProps> = ({ containers, graphService, isAdmin }) => {
  const [selectedContainerId, setSelectedContainerId] = useState<string>("");
  
  // Data State
  const [permissions, setPermissions] = useState<SPEPermission[]>([]);
  const [isLoadingPerms, setIsLoadingPerms] = useState(false);

  // Manual User Add State
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<'reader' | 'manager' | 'writer'>('reader');
  const [isAddingUser, setIsAddingUser] = useState(false);
  
  // Bulk Group Provision State
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  // Editing/Deleting State
  const [editingPermId, setEditingPermId] = useState<string | null>(null);
  const [editRoleValue, setEditRoleValue] = useState<'reader' | 'manager' | 'writer'>('reader');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [permToDelete, setPermToDelete] = useState<SPEPermission | null>(null);

  // Feedback State
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const selectedContainer = containers.find(c => c.id === selectedContainerId);

  // Fetch Permissions when container changes
  useEffect(() => {
    if (selectedContainerId) {
        fetchPermissions(selectedContainerId);
    } else {
        setPermissions([]);
    }
  }, [selectedContainerId]);

  const fetchPermissions = async (id: string) => {
      setIsLoadingPerms(true);
      try {
          const perms = await graphService.listContainerPermissions(id);
          setPermissions(perms);
      } catch (e) {
          console.error("Failed to load permissions", e);
      } finally {
          setIsLoadingPerms(false);
      }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContainerId || !email) return;

    setIsAddingUser(true);
    setMessage(null);
    try {
        await graphService.addContainerPermissionUser(selectedContainerId, email, role);
        setMessage({ type: 'success', text: `Successfully added ${email} as ${role} to ${selectedContainer?.displayName}` });
        setEmail("");
        fetchPermissions(selectedContainerId); // Refresh list
    } catch (error: any) {
        let msg = error.message;
        if(msg.includes("Conflict")) msg = "User already has permission on this container.";
        setMessage({ type: 'error', text: msg });
    } finally {
        setIsAddingUser(false);
    }
  };

  const handleBulkProvision = async () => {
    if (!selectedContainerId) return;

    setIsProvisioning(true);
    setLogs([]); // Clear logs
    setMessage(null);

    try {
        await graphService.provisionContainerAccess(selectedContainerId, (msg) => {
            setLogs(prev => [...prev, msg]);
        });
        setLogs(prev => [...prev, "DONE: Standard Security Groups applied."]);
        fetchPermissions(selectedContainerId); // Refresh list
    } catch (error: any) {
        setLogs(prev => [...prev, `ERROR: ${error.message}`]);
    } finally {
        setIsProvisioning(false);
    }
  };

  const handleUpdateRole = async (permId: string) => {
      if(!selectedContainerId) return;
      setIsSavingEdit(true);
      try {
          await graphService.updateContainerPermission(selectedContainerId, permId, editRoleValue);
          setEditingPermId(null);
          fetchPermissions(selectedContainerId);
      } catch(e: any) {
          alert("Failed to update role: " + e.message);
      } finally {
          setIsSavingEdit(false);
      }
  };

  const handleDeletePermission = async () => {
      if(!selectedContainerId || !permToDelete) return;
      try {
          await graphService.deleteContainerPermission(selectedContainerId, permToDelete.id);
          setPermToDelete(null);
          fetchPermissions(selectedContainerId);
      } catch(e: any) {
          alert("Failed to remove user: " + e.message);
      }
  };

  // Fixed: Handle null input gracefully to avoid rendering errors
  const getPrincipalName = (p: SPEPermission | null) => {
      if (!p) return "";
      if (p.grantedToV2?.user) return p.grantedToV2.user.displayName || "Unknown User";
      if (p.grantedToV2?.group) return p.grantedToV2.group.displayName || "Group";
      if (p.grantedToV2?.application) return p.grantedToV2.application.displayName || "Application";
      return "Unknown Principal";
  };

  const getPrincipalEmail = (p: SPEPermission | null) => {
      if (!p) return "-";
      if (p.grantedToV2?.user?.email) return p.grantedToV2.user.email;
      // Some principals don't have email in the default view
      return "-";
  };

  if (!isAdmin) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <ShieldCheck className="w-16 h-16 text-gray-300 mb-4" />
            <h2 className="text-xl font-bold text-gray-900">Access Restricted</h2>
            <p className="text-gray-500 max-w-md mt-2">Only Administrators can manage permissions and container access control.</p>
        </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-brand-600" />
            Access Control Manager
        </h2>
        <p className="text-gray-500 mt-1">Manage user permissions and apply security groups to containers.</p>
      </div>

      {/* Container Selection */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Container to Manage</label>
        <div className="relative">
            <select 
                className="w-full p-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-gray-900 appearance-none"
                value={selectedContainerId}
                onChange={(e) => {
                    setSelectedContainerId(e.target.value);
                    setMessage(null);
                    setLogs([]);
                }}
            >
                <option value="">-- Choose a Container --</option>
                {containers.map(c => (
                    <option key={c.id} value={c.id}>{c.displayName}</option>
                ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
              <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
            </div>
        </div>
      </div>

      {selectedContainerId && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4">
            
            {/* Column 1: Existing Permissions List (Wide) */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
                <div className="p-5 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                    <div>
                        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-brand-600" />
                            Current Permissions
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">Users and groups with access to this container.</p>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => fetchPermissions(selectedContainerId)}>
                        <RefreshCw className={`w-3 h-3 ${isLoadingPerms ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
                
                <div className="flex-1 overflow-auto">
                    {isLoadingPerms ? (
                        <div className="flex items-center justify-center h-40 text-gray-500">
                            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading permissions...
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-white text-gray-500 text-xs font-semibold border-b border-gray-100 sticky top-0">
                                <tr>
                                    <th className="px-6 py-3">User / Group</th>
                                    <th className="px-6 py-3">Current Role</th>
                                    <th className="px-6 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {permissions.map(perm => {
                                    const isEditing = editingPermId === perm.id;
                                    const roleStr = perm.roles[0];
                                    
                                    return (
                                        <tr key={perm.id} className="hover:bg-gray-50 group">
                                            <td className="px-6 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500">
                                                        <UserIcon className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-gray-900">{getPrincipalName(perm)}</p>
                                                        <p className="text-xs text-gray-500">{getPrincipalEmail(perm)}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-3">
                                                {isEditing ? (
                                                    <select 
                                                        className="px-2 py-1 border rounded text-sm"
                                                        value={editRoleValue}
                                                        onChange={(e) => setEditRoleValue(e.target.value as any)}
                                                    >
                                                        <option value="reader">Reader</option>
                                                        <option value="writer">Writer</option>
                                                        <option value="manager">Manager</option>
                                                        <option value="owner">Owner</option>
                                                    </select>
                                                ) : (
                                                    <span className={`px-2 py-1 rounded text-xs font-medium uppercase border 
                                                        ${roleStr === 'owner' || roleStr === 'manager' ? 'bg-purple-50 text-purple-700 border-purple-200' : 
                                                          roleStr === 'writer' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-600 border-gray-200'}
                                                    `}>
                                                        {roleStr}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-3 text-right">
                                                {isEditing ? (
                                                    <div className="flex justify-end gap-1">
                                                        <button 
                                                            onClick={() => handleUpdateRole(perm.id)} 
                                                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                                                            disabled={isSavingEdit}
                                                        >
                                                            {isSavingEdit ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
                                                        </button>
                                                        <button onClick={() => setEditingPermId(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                                                            <X className="w-4 h-4"/>
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button 
                                                            onClick={() => {
                                                                setEditingPermId(perm.id);
                                                                setEditRoleValue(perm.roles[0] as any);
                                                            }}
                                                            className="p-1 text-blue-600 hover:bg-blue-50 rounded" 
                                                            title="Edit Role"
                                                        >
                                                            <Edit2 className="w-4 h-4"/>
                                                        </button>
                                                        <button 
                                                            onClick={() => setPermToDelete(perm)}
                                                            className="p-1 text-red-600 hover:bg-red-50 rounded" 
                                                            title="Remove Access"
                                                        >
                                                            <Trash2 className="w-4 h-4"/>
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Column 2: Actions (Narrow) */}
            <div className="flex flex-col gap-6">
                
                {/* Manual Add */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-gray-100 bg-gray-50">
                        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                            <UserPlus className="w-4 h-4 text-brand-600" />
                            Add User
                        </h3>
                    </div>
                    <div className="p-4 flex-1 flex flex-col">
                        <form onSubmit={handleAddUser} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Email</label>
                                <input 
                                    type="email" 
                                    required
                                    placeholder="user@company.com"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Role</label>
                                <div className="flex flex-col gap-2">
                                    <label className={`border rounded-md p-2 flex items-center gap-2 cursor-pointer transition-colors ${role === 'reader' ? 'bg-brand-50 border-brand-500 text-brand-700' : 'hover:bg-gray-50'}`}>
                                        <input type="radio" name="role" checked={role === 'reader'} onChange={() => setRole('reader')} />
                                        <span className="text-sm">Reader</span>
                                    </label>
                                    <label className={`border rounded-md p-2 flex items-center gap-2 cursor-pointer transition-colors ${role === 'writer' ? 'bg-brand-50 border-brand-500 text-brand-700' : 'hover:bg-gray-50'}`}>
                                        <input type="radio" name="role" checked={role === 'writer'} onChange={() => setRole('writer')} />
                                        <span className="text-sm">Writer</span>
                                    </label>
                                    <label className={`border rounded-md p-2 flex items-center gap-2 cursor-pointer transition-colors ${role === 'manager' ? 'bg-brand-50 border-brand-500 text-brand-700' : 'hover:bg-gray-50'}`}>
                                        <input type="radio" name="role" checked={role === 'manager'} onChange={() => setRole('manager')} />
                                        <span className="text-sm">Manager</span>
                                    </label>
                                </div>
                            </div>

                            {message && (
                                <div className={`p-3 rounded-lg text-xs flex items-start gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                                    {message.type === 'success' ? <CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0"/> : <AlertCircle className="w-3 h-3 mt-0.5 shrink-0"/>}
                                    {message.text}
                                </div>
                            )}

                            <Button className="w-full" disabled={isAddingUser}>
                                {isAddingUser ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : null}
                                Add
                            </Button>
                        </form>
                    </div>
                </div>

                {/* Bulk Sync */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col flex-1">
                    <div className="p-4 border-b border-gray-100 bg-gray-50">
                        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-brand-600" />
                            Sync Standard Groups
                        </h3>
                    </div>
                    <div className="p-4 flex-1 flex flex-col gap-4">
                        <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg text-xs text-blue-800">
                           <p>Use this to sync new members from the Azure AD Admin/Reader groups to this container.</p>
                        </div>

                        {/* Console Log Area */}
                        <div className="bg-gray-900 rounded-lg p-3 font-mono text-[10px] text-green-400 h-32 overflow-y-auto border border-gray-800 shadow-inner">
                            {logs.length === 0 ? (
                                <span className="text-gray-500 italic">Logs will appear here...</span>
                            ) : (
                                logs.map((line, i) => (
                                    <div key={i} className="mb-1 border-b border-gray-800 pb-1 last:border-0">{line}</div>
                                ))
                            )}
                            {isProvisioning && <div className="animate-pulse">_</div>}
                        </div>

                        <div className="mt-auto">
                            <Button 
                                variant="secondary" 
                                className="w-full border-brand-200 text-brand-700 hover:bg-brand-50"
                                onClick={handleBulkProvision}
                                disabled={isProvisioning}
                            >
                                 {isProvisioning ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <RefreshCw className="w-4 h-4 mr-2"/>}
                                Sync Groups
                            </Button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal 
        isOpen={!!permToDelete}
        onClose={() => setPermToDelete(null)}
        onConfirm={handleDeletePermission}
        title="Remove Access"
        // Safe check for permToDelete before accessing properties
        message={permToDelete ? `Are you sure you want to remove access for "${getPrincipalName(permToDelete)}"?` : ""}
        confirmLabel="Remove User"
        isDestructive={true}
      />

    </div>
  );
};
