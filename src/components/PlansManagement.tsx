import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase, CurrentCohort, PlansMainAdventure, PlansTaster } from '../lib/supabase'
import { Calendar, Plus, Edit, Trash2, X, BookOpen, Users, Search } from 'lucide-react'

const PlansManagement: React.FC = () => {
  const { user, signOut } = useAuth()
  const [cohorts, setCohorts] = useState<CurrentCohort[]>([])
  const [mainAdventurePlans, setMainAdventurePlans] = useState<PlansMainAdventure[]>([])
  const [tasterPlans, setTasterPlans] = useState<PlansTaster[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'main' | 'taster'>('main')
  const [showForm, setShowForm] = useState(false)
  const [editingPlan, setEditingPlan] = useState<PlansMainAdventure | PlansTaster | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [selectedCohort, setSelectedCohort] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Form data for main adventure plans
  const [mainAdventureForm, setMainAdventureForm] = useState({
    id: '',
    weeklytheme: '',
    themeexposition: '',
    theme: '',
    resource1: '',
    resource2: '',
    resource3: '',
    pauline: '',
    confession: '',
    meditation: '',
    date: '',
    cohort_id: ''
  })

  // Form data for taster plans
  const [tasterForm, setTasterForm] = useState({
    id: '',
    confession: '',
    date: '',
    meditation: '',
    pauline: '',
    resource1: '',
    resource2: '',
    resource3: '',
    theme: '',
    themeexposition: '',
    weeklytheme: '',
    cohort_id: ''
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [cohortsResult, mainPlansResult, tasterPlansResult] = await Promise.all([
        supabase.from('current_cohort').select('*').order('id', { ascending: false }),
        supabase.from('plans_main_adventure').select('*').order('date', { ascending: false }),
        supabase.from('plans_taster').select('*').order('date', { ascending: false })
      ])

      if (cohortsResult.error) throw cohortsResult.error
      if (mainPlansResult.error) throw mainPlansResult.error
      if (tasterPlansResult.error) throw tasterPlansResult.error

      setCohorts(cohortsResult.data || [])
      setMainAdventurePlans(mainPlansResult.data || [])
      setTasterPlans(tasterPlansResult.data || [])
    } catch (error) {
      console.error('Error fetching data:', error)
      setError('Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }


  const handleMainAdventureSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      const planData = {
        ...mainAdventureForm,
        cohort_id: mainAdventureForm.cohort_id ? parseInt(mainAdventureForm.cohort_id) : null,
        updated_at: new Date().toISOString()
      }

      // Remove id from data if creating new plan (let database generate it)
      if (!editingPlan) {
        delete planData.id
      }

      if (editingPlan) {
        const { error } = await supabase
          .from('plans_main_adventure')
          .update(planData)
          .eq('id', editingPlan.id)

        if (error) throw error

        setMainAdventurePlans(prev => 
          prev.map(plan => 
            plan.id === editingPlan.id ? { ...plan, ...planData } : plan
          )
        )
      } else {
        const { data, error } = await supabase
          .from('plans_main_adventure')
          .insert([planData])
          .select()

        if (error) {
          console.error('Supabase error:', error)
          throw error
        }

        if (data && data.length > 0) {
          setMainAdventurePlans(prev => [data[0], ...prev])
        }
      }

      resetMainAdventureForm()
      setShowForm(false)
      setError('')
    } catch (error: any) {
      console.error('Error saving main adventure plan:', error)
      setError(error.message || 'Failed to save main adventure plan')
    } finally {
      setSaving(false)
    }
  }

  const handleTasterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      const planData = {
        ...tasterForm,
        cohort_id: tasterForm.cohort_id ? parseInt(tasterForm.cohort_id) : null,
        updated_at: new Date().toISOString()
      }

      // Remove id from data if creating new plan (let database generate it)
      if (!editingPlan) {
        delete planData.id
      }

      if (editingPlan) {
        const { error } = await supabase
          .from('plans_taster')
          .update(planData)
          .eq('id', editingPlan.id)

        if (error) throw error

        setTasterPlans(prev => 
          prev.map(plan => 
            plan.id === editingPlan.id ? { ...plan, ...planData } : plan
          )
        )
      } else {
        const { data, error } = await supabase
          .from('plans_taster')
          .insert([planData])
          .select()

        if (error) {
          console.error('Supabase error:', error)
          throw error
        }

        if (data && data.length > 0) {
          setTasterPlans(prev => [data[0], ...prev])
        }
      }

      resetTasterForm()
      setShowForm(false)
      setError('')
    } catch (error: any) {
      console.error('Error saving taster plan:', error)
      setError(error.message || 'Failed to save taster plan')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (plan: PlansMainAdventure | PlansTaster) => {
    setEditingPlan(plan)
    setShowForm(true)

    if ('weeklytheme' in plan) {
      // Main adventure plan
      setMainAdventureForm({
        id: plan.id,
        weeklytheme: plan.weeklytheme || '',
        themeexposition: plan.themeexposition || '',
        theme: plan.theme || '',
        resource1: plan.resource1 || '',
        resource2: plan.resource2 || '',
        resource3: plan.resource3 || '',
        pauline: plan.pauline || '',
        confession: plan.confession || '',
        meditation: plan.meditation || '',
        date: plan.date || '',
        cohort_id: plan.cohort_id?.toString() || ''
      })
      setActiveTab('main')
    } else {
      // Taster plan
      setTasterForm({
        id: plan.id,
        confession: plan.confession || '',
        date: plan.date || '',
        meditation: plan.meditation || '',
        pauline: plan.pauline || '',
        resource1: plan.resource1 || '',
        resource2: plan.resource2 || '',
        resource3: plan.resource3 || '',
        theme: plan.theme || '',
        themeexposition: plan.themeexposition || '',
        weeklytheme: plan.weeklytheme || '',
        cohort_id: plan.cohort_id?.toString() || ''
      })
      setActiveTab('taster')
    }
  }

  const handleDelete = async (plan: PlansMainAdventure | PlansTaster) => {
    if (!confirm('Are you sure you want to delete this plan?')) return

    try {
      const table = 'weeklytheme' in plan ? 'plans_main_adventure' : 'plans_taster'
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', plan.id)

      if (error) throw error

      if ('weeklytheme' in plan) {
        setMainAdventurePlans(prev => prev.filter(p => p.id !== plan.id))
      } else {
        setTasterPlans(prev => prev.filter(p => p.id !== plan.id))
      }
    } catch (error: any) {
      console.error('Error deleting plan:', error)
      setError(error.message || 'Failed to delete plan')
    }
  }

  const resetMainAdventureForm = () => {
    setMainAdventureForm({
      id: '',
      weeklytheme: '',
      themeexposition: '',
      theme: '',
      resource1: '',
      resource2: '',
      resource3: '',
      pauline: '',
      confession: '',
      meditation: '',
      date: '',
      cohort_id: ''
    })
    setEditingPlan(null)
  }

  const resetTasterForm = () => {
    setTasterForm({
      id: '',
      confession: '',
      date: '',
      meditation: '',
      pauline: '',
      resource1: '',
      resource2: '',
      resource3: '',
      theme: '',
      themeexposition: '',
      weeklytheme: '',
      cohort_id: ''
    })
    setEditingPlan(null)
  }

  const filteredMainAdventurePlans = mainAdventurePlans.filter(plan => {
    // Filter by cohort
    const cohortMatch = selectedCohort === 'all' || plan.cohort_id?.toString() === selectedCohort
    
    // Filter by search query
    const searchMatch = !searchQuery || 
      plan.weeklytheme?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plan.theme?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plan.themeexposition?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plan.confession?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plan.meditation?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plan.pauline?.toLowerCase().includes(searchQuery.toLowerCase())
    
    return cohortMatch && searchMatch
  })

  const filteredTasterPlans = tasterPlans.filter(plan => {
    // Filter by cohort
    const cohortMatch = selectedCohort === 'all' || plan.cohort_id?.toString() === selectedCohort
    
    // Filter by search query
    const searchMatch = !searchQuery || 
      plan.weeklytheme?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plan.theme?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plan.themeexposition?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plan.confession?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plan.meditation?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plan.pauline?.toLowerCase().includes(searchQuery.toLowerCase())
    
    return cohortMatch && searchMatch
  })

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not set'
    return new Date(dateString).toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading plans...</p>
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
              <BookOpen className="h-8 w-8 text-primary-600 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">Plans Management</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Welcome, {user?.email}</span>
              <button
                onClick={signOut}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                <Users className="h-5 w-5 mr-2" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Manage Plans</h2>
              <p className="text-gray-600">Create and manage daily plans for taster and main adventure</p>
            </div>
            <div className="flex space-x-4">
              <button
                onClick={() => {
                  resetMainAdventureForm()
                  setActiveTab('main')
                  setShowForm(true)
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 flex items-center"
              >
                <Plus className="h-5 w-5 mr-2" />
                Add Main Adventure Plan
              </button>
              <button
                onClick={() => {
                  resetTasterForm()
                  setActiveTab('taster')
                  setShowForm(true)
                }}
                className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 flex items-center"
              >
                <Plus className="h-5 w-5 mr-2" />
                Add Taster Plan
              </button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          {/* Cohort Filter */}
          <div className="relative max-w-xs">
            <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <select
              value={selectedCohort}
              onChange={(e) => setSelectedCohort(e.target.value)}
              className="input-field pl-10 pr-8 appearance-none"
            >
              <option value="all">All Cohorts</option>
              {cohorts.map((cohort) => (
                <option key={cohort.id} value={cohort.id?.toString()}>
                  {cohort.nomenclature || `Cohort ${cohort.id}`}
                </option>
              ))}
            </select>
          </div>

          {/* Search Filter */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${activeTab === 'main' ? 'main adventure' : 'taster'} plans by theme, content...`}
              className="input-field pl-10 pr-4"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('main')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'main'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Main Adventure Plans ({filteredMainAdventurePlans.length})
              </button>
              <button
                onClick={() => setActiveTab('taster')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'taster'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Taster Plans ({filteredTasterPlans.length})
              </button>
            </nav>
          </div>
        </div>

        {/* Main Adventure Plans */}
        {activeTab === 'main' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredMainAdventurePlans.length > 0 ? (
              filteredMainAdventurePlans.map((plan) => (
                <div key={plan.id} className="card p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {plan.theme || 'Untitled Plan'}
                      </h3>
                      <div className="flex items-center text-sm text-gray-600 mb-2">
                        <Calendar className="h-4 w-4 mr-2" />
                        <span>{formatDate(plan.date)}</span>
                      </div>
                      {plan.cohort_id && (
                        <div className="flex items-center text-sm text-gray-600 mb-2">
                          <Users className="h-4 w-4 mr-2" />
                          <span>
                            {cohorts.find(c => c.id === plan.cohort_id)?.nomenclature || 
                             `Cohort ${plan.cohort_id}`}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(plan)}
                        className="text-primary-600 hover:text-primary-900"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(plan)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {plan.weeklytheme && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">Weekly Theme</h4>
                        <p className="text-sm text-gray-600">{plan.weeklytheme}</p>
                      </div>
                    )}
                    {plan.themeexposition && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">Theme Exposition</h4>
                        <p className="text-sm text-gray-600 line-clamp-2">{plan.themeexposition}</p>
                      </div>
                    )}
                    {plan.confession && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">Confession</h4>
                        <p className="text-sm text-gray-600 line-clamp-2">{plan.confession}</p>
                      </div>
                    )}
                    {plan.meditation && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">Meditation</h4>
                        <p className="text-sm text-gray-600 line-clamp-2">{plan.meditation}</p>
                      </div>
                    )}
                    {plan.pauline && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">Pauline</h4>
                        <p className="text-sm text-gray-600 line-clamp-2">{plan.pauline}</p>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {plan.resource1 && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Resource 1
                        </span>
                      )}
                      {plan.resource2 && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Resource 2
                        </span>
                      )}
                      {plan.resource3 && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          Resource 3
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-12">
                <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {searchQuery ? 'No matching main adventure plans found' : 'No main adventure plans found'}
                </h3>
                <p className="text-gray-600 mb-4">
                  {searchQuery 
                    ? `No main adventure plans match your search "${searchQuery}". Try adjusting your search terms.`
                    : 'Get started by creating your first main adventure plan.'
                  }
                </p>
                {!searchQuery && (
                  <button
                    onClick={() => {
                      resetMainAdventureForm()
                      setActiveTab('main')
                      setShowForm(true)
                    }}
                    className="btn-primary"
                  >
                    Add Main Adventure Plan
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Taster Plans */}
        {activeTab === 'taster' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredTasterPlans.length > 0 ? (
              filteredTasterPlans.map((plan) => (
                <div key={plan.id} className="card p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {plan.theme || 'Untitled Plan'}
                      </h3>
                      <div className="flex items-center text-sm text-gray-600 mb-2">
                        <Calendar className="h-4 w-4 mr-2" />
                        <span>{formatDate(plan.date)}</span>
                      </div>
                      {plan.cohort_id && (
                        <div className="flex items-center text-sm text-gray-600 mb-2">
                          <Users className="h-4 w-4 mr-2" />
                          <span>
                            {cohorts.find(c => c.id === plan.cohort_id)?.nomenclature || 
                             `Cohort ${plan.cohort_id}`}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(plan)}
                        className="text-primary-600 hover:text-primary-900"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(plan)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {plan.weeklytheme && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">Weekly Theme</h4>
                        <p className="text-sm text-gray-600">{plan.weeklytheme}</p>
                      </div>
                    )}
                    {plan.themeexposition && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">Theme Exposition</h4>
                        <p className="text-sm text-gray-600 line-clamp-2">{plan.themeexposition}</p>
                      </div>
                    )}
                    {plan.confession && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">Confession</h4>
                        <p className="text-sm text-gray-600 line-clamp-2">{plan.confession}</p>
                      </div>
                    )}
                    {plan.meditation && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">Meditation</h4>
                        <p className="text-sm text-gray-600 line-clamp-2">{plan.meditation}</p>
                      </div>
                    )}
                    {plan.pauline && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">Pauline</h4>
                        <p className="text-sm text-gray-600 line-clamp-2">{plan.pauline}</p>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {plan.resource1 && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Resource 1
                        </span>
                      )}
                      {plan.resource2 && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Resource 2
                        </span>
                      )}
                      {plan.resource3 && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          Resource 3
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-12">
                <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {searchQuery ? 'No matching taster plans found' : 'No taster plans found'}
                </h3>
                <p className="text-gray-600 mb-4">
                  {searchQuery 
                    ? `No taster plans match your search "${searchQuery}". Try adjusting your search terms.`
                    : 'Get started by creating your first taster plan.'
                  }
                </p>
                {!searchQuery && (
                  <button
                    onClick={() => {
                      resetTasterForm()
                      setActiveTab('taster')
                      setShowForm(true)
                    }}
                    className="btn-primary"
                  >
                    Add Taster Plan
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" style={{zIndex: 9999}}>
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold">
                    {editingPlan ? 'Edit Plan' : `Add New ${activeTab === 'main' ? 'Main Adventure' : 'Taster'} Plan`}
                  </h3>
                  <button
                    onClick={() => {
                      resetMainAdventureForm()
                      resetTasterForm()
                      setShowForm(false)
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                {/* Main Adventure Plan Form */}
                {activeTab === 'main' && (
                  <form onSubmit={handleMainAdventureSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Date *
                        </label>
                        <input
                          type="date"
                          value={mainAdventureForm.date}
                          onChange={(e) => setMainAdventureForm(prev => ({ ...prev, date: e.target.value }))}
                          className="input-field"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Cohort
                        </label>
                        <select
                          value={mainAdventureForm.cohort_id}
                          onChange={(e) => setMainAdventureForm(prev => ({ ...prev, cohort_id: e.target.value }))}
                          className="input-field"
                        >
                          <option value="">Select Cohort</option>
                          {cohorts.map((cohort) => (
                            <option key={cohort.id} value={cohort.id?.toString()}>
                              {cohort.nomenclature || `Cohort ${cohort.id}`}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Weekly Theme
                        </label>
                        <input
                          type="text"
                          value={mainAdventureForm.weeklytheme}
                          onChange={(e) => setMainAdventureForm(prev => ({ ...prev, weeklytheme: e.target.value }))}
                          className="input-field"
                          placeholder="Enter weekly theme"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Theme
                        </label>
                        <input
                          type="text"
                          value={mainAdventureForm.theme}
                          onChange={(e) => setMainAdventureForm(prev => ({ ...prev, theme: e.target.value }))}
                          className="input-field"
                          placeholder="Enter theme"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Theme Exposition
                      </label>
                      <textarea
                        value={mainAdventureForm.themeexposition}
                        onChange={(e) => setMainAdventureForm(prev => ({ ...prev, themeexposition: e.target.value }))}
                        className="input-field"
                        rows={3}
                        placeholder="Enter theme exposition"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Confession
                      </label>
                      <textarea
                        value={mainAdventureForm.confession}
                        onChange={(e) => setMainAdventureForm(prev => ({ ...prev, confession: e.target.value }))}
                        className="input-field"
                        rows={3}
                        placeholder="Enter confession content"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Meditation
                      </label>
                      <textarea
                        value={mainAdventureForm.meditation}
                        onChange={(e) => setMainAdventureForm(prev => ({ ...prev, meditation: e.target.value }))}
                        className="input-field"
                        rows={3}
                        placeholder="Enter meditation content"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Pauline
                      </label>
                      <textarea
                        value={mainAdventureForm.pauline}
                        onChange={(e) => setMainAdventureForm(prev => ({ ...prev, pauline: e.target.value }))}
                        className="input-field"
                        rows={3}
                        placeholder="Enter Pauline content"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Resource 1
                        </label>
                        <input
                          type="text"
                          value={mainAdventureForm.resource1}
                          onChange={(e) => setMainAdventureForm(prev => ({ ...prev, resource1: e.target.value }))}
                          className="input-field"
                          placeholder="Enter resource 1"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Resource 2
                        </label>
                        <input
                          type="text"
                          value={mainAdventureForm.resource2}
                          onChange={(e) => setMainAdventureForm(prev => ({ ...prev, resource2: e.target.value }))}
                          className="input-field"
                          placeholder="Enter resource 2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Resource 3
                        </label>
                        <input
                          type="text"
                          value={mainAdventureForm.resource3}
                          onChange={(e) => setMainAdventureForm(prev => ({ ...prev, resource3: e.target.value }))}
                          className="input-field"
                          placeholder="Enter resource 3"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end space-x-4">
                      <button
                        type="button"
                        onClick={() => {
                          resetMainAdventureForm()
                          resetTasterForm()
                          setShowForm(false)
                        }}
                        className="btn-secondary"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={saving}
                        className="btn-primary disabled:opacity-50"
                      >
                        {saving ? 'Saving...' : editingPlan ? 'Update Plan' : 'Create Plan'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Taster Plan Form */}
                {activeTab === 'taster' && (
                  <form onSubmit={handleTasterSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Date *
                        </label>
                        <input
                          type="date"
                          value={tasterForm.date}
                          onChange={(e) => setTasterForm(prev => ({ ...prev, date: e.target.value }))}
                          className="input-field"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Cohort
                        </label>
                        <select
                          value={tasterForm.cohort_id}
                          onChange={(e) => setTasterForm(prev => ({ ...prev, cohort_id: e.target.value }))}
                          className="input-field"
                        >
                          <option value="">Select Cohort</option>
                          {cohorts.map((cohort) => (
                            <option key={cohort.id} value={cohort.id?.toString()}>
                              {cohort.nomenclature || `Cohort ${cohort.id}`}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Weekly Theme
                        </label>
                        <input
                          type="text"
                          value={tasterForm.weeklytheme}
                          onChange={(e) => setTasterForm(prev => ({ ...prev, weeklytheme: e.target.value }))}
                          className="input-field"
                          placeholder="Enter weekly theme"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Theme
                        </label>
                        <input
                          type="text"
                          value={tasterForm.theme}
                          onChange={(e) => setTasterForm(prev => ({ ...prev, theme: e.target.value }))}
                          className="input-field"
                          placeholder="Enter theme"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Theme Exposition
                      </label>
                      <textarea
                        value={tasterForm.themeexposition}
                        onChange={(e) => setTasterForm(prev => ({ ...prev, themeexposition: e.target.value }))}
                        className="input-field"
                        rows={3}
                        placeholder="Enter theme exposition"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Confession
                      </label>
                      <textarea
                        value={tasterForm.confession}
                        onChange={(e) => setTasterForm(prev => ({ ...prev, confession: e.target.value }))}
                        className="input-field"
                        rows={3}
                        placeholder="Enter confession content"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Meditation
                      </label>
                      <textarea
                        value={tasterForm.meditation}
                        onChange={(e) => setTasterForm(prev => ({ ...prev, meditation: e.target.value }))}
                        className="input-field"
                        rows={3}
                        placeholder="Enter meditation content"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Pauline
                      </label>
                      <textarea
                        value={tasterForm.pauline}
                        onChange={(e) => setTasterForm(prev => ({ ...prev, pauline: e.target.value }))}
                        className="input-field"
                        rows={3}
                        placeholder="Enter Pauline content"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Resource 1
                        </label>
                        <input
                          type="text"
                          value={tasterForm.resource1}
                          onChange={(e) => setTasterForm(prev => ({ ...prev, resource1: e.target.value }))}
                          className="input-field"
                          placeholder="Enter resource 1"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Resource 2
                        </label>
                        <input
                          type="text"
                          value={tasterForm.resource2}
                          onChange={(e) => setTasterForm(prev => ({ ...prev, resource2: e.target.value }))}
                          className="input-field"
                          placeholder="Enter resource 2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Resource 3
                        </label>
                        <input
                          type="text"
                          value={tasterForm.resource3}
                          onChange={(e) => setTasterForm(prev => ({ ...prev, resource3: e.target.value }))}
                          className="input-field"
                          placeholder="Enter resource 3"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end space-x-4">
                      <button
                        type="button"
                        onClick={() => {
                          resetMainAdventureForm()
                          resetTasterForm()
                          setShowForm(false)
                        }}
                        className="btn-secondary"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={saving}
                        className="btn-primary disabled:opacity-50"
                      >
                        {saving ? 'Saving...' : editingPlan ? 'Update Plan' : 'Create Plan'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default PlansManagement
