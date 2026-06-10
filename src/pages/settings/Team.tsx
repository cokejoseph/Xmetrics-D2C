import { useState } from 'react'
import { UserPlus, Trash2, Shield } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { useAuthStore } from '../../stores/authStore'
import { Card, Button, Modal, Input, Select, Badge } from '../../components/ui'
import type { BrandMember } from '../../types'

type Role = BrandMember['role']

const ROLE_COLOR: Record<Role, string> = {
  OWNER: 'danger',
  ADMIN: 'warning',
  EDITOR: 'info',
  VIEWER: 'gray',
}

export default function Team() {
  const { teamMembers, inviteTeamMember, removeTeamMember, updateTeamMember } = useAppStore()
  const { user } = useAuthStore()
  const [showInvite, setShowInvite] = useState(false)
  const [showMatrix, setShowMatrix] = useState(false)
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'EDITOR' as Role })

  const handleInvite = () => {
    inviteTeamMember({ name: inviteForm.name, email: inviteForm.email, role: inviteForm.role })
    setShowInvite(false)
    setInviteForm({ name: '', email: '', role: 'EDITOR' })
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Team</h1>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowMatrix(true)}>
            <Shield size={14} /> RBAC Matrix
          </Button>
          <Button size="sm" onClick={() => setShowInvite(true)}>
            <UserPlus size={14} /> Invite Member
          </Button>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Member</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Joined</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {teamMembers.map(member => {
                const isCurrentUser = member.user_id === user?.id
                const isOwner = member.role === 'OWNER'

                return (
                  <tr key={member.id} className="border-b border-gray-50">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">
                        {member.name}
                        {isCurrentUser && <span className="ml-1.5 text-[10px] text-gray-400">(you)</span>}
                      </p>
                      <p className="text-xs text-gray-500">{member.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      {isOwner || isCurrentUser ? (
                        <Badge variant={ROLE_COLOR[member.role] as any}>{member.role}</Badge>
                      ) : (
                        <Select
                          value={member.role}
                          onChange={e => updateTeamMember(member.id, { role: e.target.value as Role })}
                          className="text-xs py-1 h-auto min-w-[100px]"
                        >
                          <option value="ADMIN">ADMIN</option>
                          <option value="EDITOR">EDITOR</option>
                          <option value="VIEWER">VIEWER</option>
                        </Select>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-xs text-gray-500">
                      {new Date(member.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!isOwner && !isCurrentUser && (
                        <button
                          onClick={() => removeTeamMember(member.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
          {teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''}
        </div>
      </Card>

      {/* Invite modal */}
      <Modal open={showInvite} onClose={() => setShowInvite(false)} title="Invite Team Member">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <Input
              value={inviteForm.name}
              onChange={e => setInviteForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Jane Smith"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <Input
              type="email"
              value={inviteForm.email}
              onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
              placeholder="jane@company.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <Select
              value={inviteForm.role}
              onChange={e => setInviteForm(f => ({ ...f, role: e.target.value as Role }))}
            >
              <option value="ADMIN">Admin — Full access except billing</option>
              <option value="EDITOR">Editor — Can manage orders and products</option>
              <option value="VIEWER">Viewer — Read-only access</option>
            </Select>
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleInvite}
              disabled={!inviteForm.name || !inviteForm.email}
            >
              Send Invite
            </Button>
            <Button variant="secondary" onClick={() => setShowInvite(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>

      {/* RBAC matrix modal */}
      <Modal open={showMatrix} onClose={() => setShowMatrix(false)} title="Role Permissions Matrix" size="lg">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="py-2 text-left font-semibold text-gray-700">Permission</th>
                {(['OWNER', 'ADMIN', 'EDITOR', 'VIEWER'] as Role[]).map(r => (
                  <th key={r} className="py-2 text-center font-semibold text-gray-700">{r}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                'View dashboard', 'Manage orders', 'Fulfillment', 'Manage products',
                'View analytics', 'Manage team', 'Settings', 'Billing',
              ].map((perm, i) => {
                const access = {
                  OWNER: true,
                  ADMIN: i < 7,
                  EDITOR: i < 5,
                  VIEWER: i === 0 || i === 4,
                }
                return (
                  <tr key={perm} className="border-b border-gray-50">
                    <td className="py-2 text-gray-700">{perm}</td>
                    {(['OWNER', 'ADMIN', 'EDITOR', 'VIEWER'] as Role[]).map(r => (
                      <td key={r} className="py-2 text-center">
                        {access[r]
                          ? <span className="text-green-600">✓</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Modal>
    </div>
  )
}
