import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase, MainMember, CurrentCohort, TasterMember } from '../lib/supabase'
import { Users, LogOut, Search, Edit, Save, X, Settings, Filter, UserCheck, UserPlus, BookOpen } from 'lucide-react'

interface DashboardProps {
  onNavigateToCohorts?: () => void
  onNavigateToMembers?: () => void
  onNavigateToPlans?: () => void
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigateToCohorts, onNavigateToMembers, onNavigateToPlans }) => {
  const { user, signOut } = useAuth()
  const [members, setMembers] = useState<MainMember[]>([])
  const [tasterMembers, setTasterMembers] = useState<TasterMember[]>([])
  const [cohorts, setCohorts] = useState<CurrentCohort[]>([])
  const [selectedCohort, setSelectedCohort] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [editingMember, setEditingMember] = useState<string | null>(null)
  const [editCohort, setEditCohort] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchMembers()
    fetchTasterMembers()
    fetchCohorts()
  }, [])

  const fetchMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('main_members')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setMembers(data || [])
    } catch (error) {
      console.error('Error fetching members:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTasterMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('taster_members')
        .select('*')
        .order('satnumber', { ascending: true })

      if (error) throw error
      setTasterMembers(data || [])
    } catch (error) {
      console.error('Error fetching taster members:', error)
    }
  }

  const fetchCohorts = async () => {
    try {
      const { data, error } = await supabase
        .from('current_cohort')
        .select('*')
        .order('id', { ascending: false })

      if (error) throw error
      setCohorts(data || [])
    } catch (error) {
      console.error('Error fetching cohorts:', error)
    }
  }

  const handleEdit = (member: MainMember) => {
    setEditingMember(member.id)
    setEditCohort(member.current_cohort_id?.toString() || '')
  }

  const handleSave = async (memberId: string) => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('main_members')
        .update({ current_cohort_id: editCohort ? parseInt(editCohort) : null })
        .eq('id', memberId)

      if (error) throw error

      // Update local state
      setMembers(prev => 
        prev.map(member => 
          member.id === memberId 
            ? { ...member, current_cohort_id: editCohort ? parseInt(editCohort) : null }
            : member
        )
      )

      setEditingMember(null)
      setEditCohort('')
    } catch (error) {
      console.error('Error updating member:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEditingMember(null)
    setEditCohort('')
  }

  const filteredMembers = members.filter(member => {
    const fullName = `${member.firstname || ''} ${member.lastname || ''}`.toLowerCase()
    const matchesSearch = fullName.includes(searchTerm.toLowerCase()) ||
      (member.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (member.sanumber || '').toLowerCase().includes(searchTerm.toLowerCase())
    
    if (selectedCohort === 'all') {
      return matchesSearch
    }
    
    // Find cohort by nomenclature or ID
    const cohort = cohorts.find(c => 
      c.nomenclature === selectedCohort || 
      c.id?.toString() === selectedCohort
    )
    
    return matchesSearch && member.current_cohort_id === cohort?.id
  })

  const filteredTasterMembers = tasterMembers.filter(tasterMember => {
    const fullName = `${tasterMember.firstname || ''} ${tasterMember.lastname || ''}`.toLowerCase()
    const matchesSearch = fullName.includes(searchTerm.toLowerCase()) ||
      (tasterMember.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tasterMember.satnumber || '').toLowerCase().includes(searchTerm.toLowerCase())
    
    if (selectedCohort === 'all') {
      return matchesSearch
    }
    
    // Find cohort by nomenclature or ID
    const cohort = cohorts.find(c => 
      c.nomenclature === selectedCohort || 
      c.id?.toString() === selectedCohort
    )
    
    return matchesSearch && tasterMember.current_cohort_id === cohort?.id
  })

  // Calculate taster member count for selected cohort
  const getTasterMemberCount = () => {
    if (selectedCohort === 'all') {
      return filteredTasterMembers.length
    }
    
    const cohort = cohorts.find(c => 
      c.nomenclature === selectedCohort || 
      c.id?.toString() === selectedCohort
    )
    
    return tasterMembers.filter(tm => tm.current_cohort_id === cohort?.id).length
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading members...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-primary-600 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">Scripture Adventure Admin</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={onNavigateToCohorts}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                <Settings className="h-5 w-5 mr-2" />
                Manage Cohorts
              </button>
              <button
                onClick={onNavigateToMembers}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                <UserPlus className="h-5 w-5 mr-2" />
                Manage Members
              </button>
              <button
                onClick={onNavigateToPlans}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                <BookOpen className="h-5 w-5 mr-2" />
                Manage Plans
              </button>
              <span className="text-sm text-gray-600">Welcome, {user?.email}</span>
              <button
                onClick={signOut}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                <LogOut className="h-5 w-5 mr-2" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Member Management</h2>
          <p className="text-gray-600">Manage member cohorts and information</p>
        </div>

        {/* Search and Filter */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <select
              value={selectedCohort}
              onChange={(e) => setSelectedCohort(e.target.value)}
              className="input-field pl-10 pr-8 appearance-none"
            >
              <option value="all">All Cohorts</option>
              {cohorts.map((cohort) => (
                <option key={cohort.id} value={cohort.nomenclature || `Cohort ${cohort.id}`}>
                  {cohort.nomenclature || `Cohort ${cohort.id}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="card p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-primary-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  {selectedCohort === 'all' ? 'Total Members' : 'Cohort Members'}
                </p>
                <p className="text-2xl font-bold text-gray-900">{filteredMembers.length}</p>
              </div>
            </div>
          </div>
          <div className="card p-6">
            <div className="flex items-center">
              <UserCheck className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  {selectedCohort === 'all' ? 'Total Taster Members' : 'Cohort Taster Members'}
                </p>
                <p className="text-2xl font-bold text-gray-900">{getTasterMemberCount()}</p>
              </div>
            </div>
          </div>
          <div className="card p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">With Cohort</p>
                <p className="text-2xl font-bold text-gray-900">
                  {filteredMembers.filter(m => m.current_cohort_id).length}
                </p>
              </div>
            </div>
          </div>
          <div className="card p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Without Cohort</p>
                <p className="text-2xl font-bold text-gray-900">
                  {filteredMembers.filter(m => !m.current_cohort_id).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Members Table */}
        <div className="card mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Members ({filteredMembers.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    SA Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Current Cohort
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredMembers.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {member.firstname} {member.lastname}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{member.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-blue-600">{member.sanumber}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{member.role || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        member.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {member.status || 'inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingMember === member.id ? (
                        <select
                          value={editCohort}
                          onChange={(e) => setEditCohort(e.target.value)}
                          className="input-field text-sm"
                        >
                          <option value="">No cohort</option>
                          {cohorts.map((cohort) => (
                            <option key={cohort.id} value={cohort.id?.toString()}>
                              {cohort.nomenclature || `Cohort ${cohort.id}`}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={`text-sm ${member.current_cohort_id ? 'text-gray-900' : 'text-gray-400'}`}>
                          {cohorts.find(c => c.id === member.current_cohort_id)?.nomenclature || 
                           `Cohort ${member.current_cohort_id}` || 'No cohort assigned'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {editingMember === member.id ? (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleSave(member.id)}
                            disabled={saving}
                            className="text-green-600 hover:text-green-900 disabled:opacity-50"
                          >
                            <Save className="h-4 w-4" />
                          </button>
                          <button
                            onClick={handleCancel}
                            className="text-red-600 hover:text-red-900"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleEdit(member)}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Taster Members Table */}
        <div className="card">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Taster Members ({filteredTasterMembers.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    WhatsApp
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Gender
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Birthday
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    SAT Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cohort
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Submissions
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sermon
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTasterMembers.map((tasterMember) => (
                  <tr key={tasterMember.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {tasterMember.firstname} {tasterMember.lastname}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{tasterMember.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{tasterMember.Confirm_Phone_number || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{tasterMember.Gender || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{tasterMember.Birthday || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-blue-600">{tasterMember.satnumber}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {cohorts.find(c => c.id === tasterMember.current_cohort_id)?.nomenclature || 
                         `Cohort ${tasterMember.current_cohort_id}`}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {tasterMember.total_submission || 0}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        (tasterMember.total_submission || 0) >= 3 && tasterMember.sermon_submitted
                          ? 'bg-green-100 text-green-800' 
                          : (tasterMember.total_submission || 0) >= 3 && !tasterMember.sermon_submitted
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {(tasterMember.total_submission || 0) >= 3 && tasterMember.sermon_submitted 
                          ? 'Qualified' 
                          : (tasterMember.total_submission || 0) >= 3 && !tasterMember.sermon_submitted
                          ? 'Need Sermon'
                          : 'In Progress'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        tasterMember.sermon_submitted 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {tasterMember.sermon_submitted ? 'Submitted' : 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}

export default Dashboard
