import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase, CurrentCohort, Circle } from '../lib/supabase'
import { Users, Plus, Edit, Trash2, X, Calendar, Link, Users2, Upload, FileText } from 'lucide-react'

const CohortManagement: React.FC = () => {
  const { user, signOut } = useAuth()
  const [cohorts, setCohorts] = useState<CurrentCohort[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingCohort, setEditingCohort] = useState<CurrentCohort | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvPreview, setCsvPreview] = useState<any[]>([])
  const [uploadingCsv, setUploadingCsv] = useState(false)

  const [formData, setFormData] = useState({
    id: '',
    active: true,
    nomenclature: '',
    main_group_link: '',
    taster_group_link: '',
    probation_page: '',
    start_date: '',
    end_date: '',
    orientation_start_date: '',
    taster_start_date: '',
    taster_session_on: true,
    circles: Array(20).fill({ circle_rep_whatsapp_contact: '', circle_whatsapp_link: '' }),
    sermon_link: ''
  })

  useEffect(() => {
    fetchCohorts()
  }, [])

  const generateSatNumber = (cohortId: string, index: number) => {
    const paddedCohort = cohortId.padStart(3, '0')
    const paddedIndex = (index + 1).toString().padStart(3, '0')
    return `SAT/${paddedCohort}/${paddedIndex}`
  }

  const convertToWhatsAppUrl = (phoneNumber: string) => {
    if (!phoneNumber.trim()) return ''
    
    // Remove any non-digit characters
    const cleanNumber = phoneNumber.replace(/\D/g, '')
    
    // If it starts with country code, use as is, otherwise assume it needs country code
    if (cleanNumber.startsWith('232')) {
      return `https://wa.me/${cleanNumber}`
    } else if (cleanNumber.length >= 9) {
      return `https://wa.me/232${cleanNumber}`
    }
    
    return phoneNumber // Return original if can't determine format
  }

  const formatBirthday = (birthday: string) => {
    try {
      // Parse the date (assuming format like "1/10/2025" or "12/8/2003")
      const date = new Date(birthday)
      if (isNaN(date.getTime())) return birthday // Return original if invalid
      
      // Extract day and month
      const day = date.getDate()
      const month = date.getMonth() + 1 // getMonth() returns 0-11
      
      return `${day}/${month}`
    } catch (error) {
      return birthday // Return original if parsing fails
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
      setError('Failed to fetch cohorts')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }))
  }

  const handleCircleChange = (index: number, field: 'circle_rep_whatsapp_contact' | 'circle_whatsapp_link', value: string) => {
    setFormData(prev => ({
      ...prev,
      circles: prev.circles.map((circle, i) => 
        i === index 
          ? { 
              ...circle, 
              [field]: field === 'circle_rep_whatsapp_contact' 
                ? convertToWhatsAppUrl(value) 
                : value 
            }
          : circle
      )
    }))
  }

  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type === 'text/csv') {
      setCsvFile(file)
      parseCsvFile(file)
    } else {
      setError('Please select a valid CSV file')
    }
  }

  const parseCsvFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const lines = text.split('\n').filter(line => line.trim())
      const headers = lines[0].split(',').map(h => h.trim())
      
      const data = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim())
        const row: any = {}
        headers.forEach((header, index) => {
          row[header.toLowerCase().replace(/\s+/g, '_')] = values[index] || ''
        })
        return row
      })
      
      setCsvPreview(data)
    }
    reader.readAsText(file)
  }

  const getPreviewSatNumbers = async () => {
    if (!formData.id) return []
    
    try {
      const { data: existingMembers } = await supabase
        .from('taster_members')
        .select('satnumber')
        .eq('current_cohort_id', parseInt(formData.id))
        .order('satnumber', { ascending: true })

      let nextSatIndex = 0
      if (existingMembers && existingMembers.length > 0) {
        const lastSatNumber = existingMembers[existingMembers.length - 1].satnumber
        if (lastSatNumber) {
          const match = lastSatNumber.match(/SAT\/\d+\/(\d+)$/)
          if (match) {
            nextSatIndex = parseInt(match[1])
          }
        }
      }

      return csvPreview.map((_, index) => generateSatNumber(formData.id, nextSatIndex + index))
    } catch (error) {
      console.error('Error getting preview SAT numbers:', error)
      return csvPreview.map((_, index) => generateSatNumber(formData.id || '0', index))
    }
  }

  const checkDuplicateEmails = async (emails: string[]) => {
    try {
      const { data, error } = await supabase
        .from('taster_members')
        .select('email')
        .in('email', emails)

      if (error) throw error
      return data?.map(row => row.email) || []
    } catch (error) {
      console.error('Error checking duplicates:', error)
      return []
    }
  }

  const [previewSatNumbers, setPreviewSatNumbers] = useState<string[]>([])

  // Update preview SAT numbers when CSV preview changes
  useEffect(() => {
    if (csvPreview.length > 0 && formData.id) {
      getPreviewSatNumbers().then(setPreviewSatNumbers)
    }
  }, [csvPreview, formData.id])

  const uploadCsvMembers = async () => {
    if (!csvFile || !formData.id) return

    setUploadingCsv(true)
    setError('')

    try {
      const emails = csvPreview.map(row => row.email_address)
      
      // Check for duplicates within the CSV file
      const csvDuplicateEmails = emails.filter((email, index) => emails.indexOf(email) !== index)
      if (csvDuplicateEmails.length > 0) {
        const uniqueDuplicates = [...new Set(csvDuplicateEmails)]
        setError(`Duplicate emails found in CSV file: ${uniqueDuplicates.join(', ')}`)
        setUploadingCsv(false)
        return
      }

      // Check for duplicates in database
      const dbDuplicateEmails = await checkDuplicateEmails(emails)
      if (dbDuplicateEmails.length > 0) {
        setError(`Duplicate emails found in database: ${dbDuplicateEmails.join(', ')}`)
        setUploadingCsv(false)
        return
      }

      // Get existing taster members for this cohort to continue SAT numbering
      const { data: existingMembers, error: existingError } = await supabase
        .from('taster_members')
        .select('satnumber')
        .eq('current_cohort_id', parseInt(formData.id))
        .order('satnumber', { ascending: true })

      if (existingError) throw existingError

      // Find the highest SAT number to continue from
      let nextSatIndex = 0
      if (existingMembers && existingMembers.length > 0) {
        const lastSatNumber = existingMembers[existingMembers.length - 1].satnumber
        if (lastSatNumber) {
          // Extract the number from SAT/008/XXX format
          const match = lastSatNumber.match(/SAT\/\d+\/(\d+)$/)
          if (match) {
            nextSatIndex = parseInt(match[1])
          }
        }
      }

      const membersToCreate = csvPreview.map((row, index) => ({
        id: `${formData.id}_${nextSatIndex + index + 1}`,
        firstname: row.first_name || '',
        lastname: row.last_name || '',
        email: row.email_address || '',
        satnumber: generateSatNumber(formData.id, nextSatIndex + index),
        current_cohort_id: parseInt(formData.id),
        Gender: row.gender || '',
        Confirm_Phone_number: row.confirm_phone_number || '',
        Birthday: row.birthday ? formatBirthday(row.birthday) : '',
        total_submission: 0,
        sermon_submitted: false
      }))

      // Insert members into taster_members table
      const { error: membersError } = await supabase
        .from('taster_members')
        .insert(membersToCreate)

      if (membersError) throw membersError

      // Calculate total taster members for this cohort
      const { data: existingTasterMembers, error: countError } = await supabase
        .from('taster_members')
        .select('id')
        .eq('current_cohort_id', parseInt(formData.id))

      if (countError) throw countError

      const totalTasterMembers = existingTasterMembers?.length || 0

      // Update taster_member_count in current_cohort table
      const { error: cohortError } = await supabase
        .from('current_cohort')
        .update({ 
          taster_member_count: totalTasterMembers,
          updated_at: new Date().toISOString()
        })
        .eq('id', parseInt(formData.id))

      if (cohortError) throw cohortError

      // Update local state
      setCohorts(prev => 
        prev.map(cohort => 
          cohort.id === parseInt(formData.id)
            ? { ...cohort, taster_member_count: totalTasterMembers }
            : cohort
        )
      )

      setCsvFile(null)
      setCsvPreview([])
      setPreviewSatNumbers([])
      setError('')
      
      const firstSatNumber = membersToCreate[0]?.satnumber
      const lastSatNumber = membersToCreate[membersToCreate.length - 1]?.satnumber
      const satRange = firstSatNumber === lastSatNumber 
        ? firstSatNumber 
        : `${firstSatNumber} - ${lastSatNumber}`
      
      alert(`Successfully uploaded ${membersToCreate.length} members! Total taster members for this cohort: ${totalTasterMembers}\nSAT Numbers: ${satRange}`)
    } catch (error: any) {
      console.error('Error uploading CSV:', error)
      setError(error.message || 'Failed to upload CSV members')
    } finally {
      setUploadingCsv(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      const cohortData = {
        ...formData,
        id: formData.id ? parseInt(formData.id) : null,
        circles: formData.circles.filter(circle => 
          circle.circle_whatsapp_link.trim() !== '' || circle.circle_rep_whatsapp_contact.trim() !== ''
        ).length > 0 ? formData.circles.filter(circle => 
          circle.circle_whatsapp_link.trim() !== '' || circle.circle_rep_whatsapp_contact.trim() !== ''
        ) : null
      }

      if (editingCohort) {
        // Update existing cohort
        const { error } = await supabase
          .from('current_cohort')
          .update(cohortData)
          .eq('id', editingCohort.id)

        if (error) throw error

        setCohorts(prev => 
          prev.map(cohort => 
            cohort.id === editingCohort.id 
              ? { ...cohort, ...cohortData }
              : cohort
          )
        )
      } else {
        // Create new cohort
        const { data, error } = await supabase
          .from('current_cohort')
          .insert([cohortData])
          .select()

        if (error) throw error
        setCohorts(prev => [data[0], ...prev])
      }

      resetForm()
    } catch (error: any) {
      console.error('Error saving cohort:', error)
      setError(error.message || 'Failed to save cohort')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (cohort: CurrentCohort) => {
    setEditingCohort(cohort)
    
    // Parse circles from JSON or create empty array
    let circlesArray = Array(20).fill({ circle_rep_whatsapp_contact: '', circle_whatsapp_link: '' })
    if (cohort.circles && Array.isArray(cohort.circles)) {
      // Handle both old format (array of strings) and new format (array of objects)
      const parsedCircles = cohort.circles.map((circle: any) => {
        if (typeof circle === 'string') {
          // Old format - convert to new format
          return {
            circle_rep_whatsapp_contact: '',
            circle_whatsapp_link: circle
          }
        } else if (typeof circle === 'object' && circle !== null) {
          // New format - handle both old and new field names
          return {
            circle_rep_whatsapp_contact: circle.circle_rep_whatsapp_contact || circle.circle_rep_phonemuber || '',
            circle_whatsapp_link: circle.circle_whatsapp_link || ''
          }
        }
        return { circle_rep_whatsapp_contact: '', circle_whatsapp_link: '' }
      })
      
      circlesArray = [...parsedCircles, ...Array(20 - parsedCircles.length).fill({ circle_rep_whatsapp_contact: '', circle_whatsapp_link: '' })].slice(0, 20)
    }
    
    setFormData({
      id: cohort.id?.toString() || '',
      active: cohort.active,
      nomenclature: cohort.nomenclature || '',
      main_group_link: cohort.main_group_link || '',
      taster_group_link: cohort.taster_group_link || '',
      probation_page: cohort.probation_page || '',
      start_date: cohort.start_date || '',
      end_date: cohort.end_date || '',
      orientation_start_date: cohort.orientation_start_date || '',
      taster_start_date: cohort.taster_start_date || '',
      taster_session_on: cohort.taster_session_on,
      circles: circlesArray,
      sermon_link: cohort.sermon_link || ''
    })
    setShowForm(true)
  }

  const handleDelete = async (id: number | null) => {
    if (!confirm('Are you sure you want to delete this cohort?')) return

    try {
      const { error } = await supabase
        .from('current_cohort')
        .delete()
        .eq('id', id)

      if (error) throw error

      setCohorts(prev => prev.filter(cohort => cohort.id !== id))
    } catch (error: any) {
      console.error('Error deleting cohort:', error)
      setError(error.message || 'Failed to delete cohort')
    }
  }

  const resetForm = () => {
    setFormData({
      id: '',
      active: true,
      nomenclature: '',
      main_group_link: '',
      taster_group_link: '',
      probation_page: '',
      start_date: '',
      end_date: '',
      orientation_start_date: '',
      taster_start_date: '',
      taster_session_on: true,
      circles: Array(20).fill({ circle_rep_whatsapp_contact: '', circle_whatsapp_link: '' }),
      sermon_link: ''
    })
    setEditingCohort(null)
    setShowForm(false)
    setCsvFile(null)
    setCsvPreview([])
    setError('')
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not set'
    return new Date(dateString).toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading cohorts...</p>
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
              <h1 className="text-xl font-semibold text-gray-900">Cohort Management</h1>
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
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Current Cohorts</h2>
              <p className="text-gray-600">Manage cohort information and settings</p>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="btn-primary flex items-center"
            >
              <Plus className="h-5 w-5 mr-2" />
              Create Cohort
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold">
                    {editingCohort ? 'Edit Cohort' : 'Create New Cohort'}
                  </h3>
                  <button
                    onClick={resetForm}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Cohort ID
                      </label>
                      <input
                        type="number"
                        name="id"
                        value={formData.id}
                        onChange={handleInputChange}
                        className="input-field"
                        placeholder="Enter cohort ID (e.g., 7)"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nomenclature
                      </label>
                      <input
                        type="text"
                        name="nomenclature"
                        value={formData.nomenclature}
                        onChange={handleInputChange}
                        className="input-field"
                        placeholder="e.g., SA/007/"
                      />
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        name="active"
                        checked={formData.active}
                        onChange={handleInputChange}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <label className="ml-2 text-sm text-gray-700">Active Cohort</label>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        name="taster_session_on"
                        checked={formData.taster_session_on}
                        onChange={handleInputChange}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <label className="ml-2 text-sm text-gray-700">Taster Session On</label>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Start Date
                      </label>
                      <input
                        type="date"
                        name="start_date"
                        value={formData.start_date}
                        onChange={handleInputChange}
                        className="input-field"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        End Date
                      </label>
                      <input
                        type="date"
                        name="end_date"
                        value={formData.end_date}
                        onChange={handleInputChange}
                        className="input-field"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Orientation Start Date
                      </label>
                      <input
                        type="date"
                        name="orientation_start_date"
                        value={formData.orientation_start_date}
                        onChange={handleInputChange}
                        className="input-field"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Taster Start Date
                      </label>
                      <input
                        type="date"
                        name="taster_start_date"
                        value={formData.taster_start_date}
                        onChange={handleInputChange}
                        className="input-field"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Main Group Link
                    </label>
                    <input
                      type="url"
                      name="main_group_link"
                      value={formData.main_group_link}
                      onChange={handleInputChange}
                      className="input-field"
                      placeholder="https://..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Taster Group Link
                    </label>
                    <input
                      type="url"
                      name="taster_group_link"
                      value={formData.taster_group_link}
                      onChange={handleInputChange}
                      className="input-field"
                      placeholder="https://..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Probation Page
                    </label>
                    <input
                      type="url"
                      name="probation_page"
                      value={formData.probation_page}
                      onChange={handleInputChange}
                      className="input-field"
                      placeholder="https://..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sermon Link
                    </label>
                    <input
                      type="url"
                      name="sermon_link"
                      value={formData.sermon_link}
                      onChange={handleInputChange}
                      className="input-field"
                      placeholder="https://..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-4">
                      Circle Configuration (20 circles)
                    </label>
                    <div className="mb-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>Note:</strong> Enter phone numbers (e.g., 23203240304) and they will be automatically converted to WhatsApp contact URLs (wa.me/23203240304)
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-4">
                      {formData.circles.map((circle, index) => (
                        <div key={index} className="flex flex-col space-y-2">
                          <label className="text-xs font-medium text-gray-600">
                            Circle {index + 1}
                          </label>
                          <input
                            type="tel"
                            value={circle.circle_rep_whatsapp_contact.replace('https://wa.me/', '')}
                            onChange={(e) => handleCircleChange(index, 'circle_rep_whatsapp_contact', e.target.value)}
                            className="input-field text-sm"
                            placeholder="Rep Phone Number (e.g., 23203240304)"
                          />
                          <input
                            type="url"
                            value={circle.circle_whatsapp_link}
                            onChange={(e) => handleCircleChange(index, 'circle_whatsapp_link', e.target.value)}
                            className="input-field text-sm"
                            placeholder="Circle WhatsApp Group Link"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* CSV Upload Section */}
                  <div className="border-t pt-6">
                    <h4 className="text-lg font-medium text-gray-900 mb-4">Upload Taster Members (CSV)</h4>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Select CSV File
                        </label>
                        <div className="flex items-center space-x-4">
                          <input
                            type="file"
                            accept=".csv"
                            onChange={handleCsvFileChange}
                            className="hidden"
                            id="csv-upload"
                          />
                          <label
                            htmlFor="csv-upload"
                            className="flex items-center px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50"
                          >
                            <Upload className="h-5 w-5 mr-2" />
                            Choose CSV File
                          </label>
                          {csvFile && (
                            <span className="text-sm text-gray-600">
                              {csvFile.name} ({csvPreview.length} members)
                            </span>
                          )}
                        </div>
                      </div>

                      {csvPreview.length > 0 && (
                        <div>
                          <h5 className="text-sm font-medium text-gray-700 mb-2">Preview (First 5 members):</h5>
                          <div className="bg-gray-50 rounded-lg p-4 max-h-40 overflow-y-auto">
                            <div className="grid grid-cols-6 gap-2 text-xs font-medium text-gray-600 mb-2">
                              <div>Name</div>
                              <div>Email</div>
                              <div>WhatsApp</div>
                              <div>Gender</div>
                              <div>Birthday</div>
                              <div>SAT Number</div>
                            </div>
                            {csvPreview.slice(0, 5).map((row, index) => (
                              <div key={index} className="grid grid-cols-6 gap-2 text-xs py-1">
                                <div>{row.first_name} {row.last_name}</div>
                                <div>{row.email_address}</div>
                                <div>{row.confirm_phone_number || ''}</div>
                                <div>{row.gender || ''}</div>
                                <div>{row.birthday ? formatBirthday(row.birthday) : ''}</div>
                                <div>{previewSatNumbers[index] || `SAT/${(formData.id || '0').padStart(3, '0')}/${(index + 1).toString().padStart(3, '0')}`}</div>
                              </div>
                            ))}
                            {csvPreview.length > 5 && (
                              <div className="text-xs text-gray-500 mt-2">
                                ... and {csvPreview.length - 5} more members
                              </div>
                            )}
                          </div>
                          
                          {/* Duplicate Check Summary */}
                          {(() => {
                            const emails = csvPreview.map(row => row.email_address)
                            const csvDuplicates = emails.filter((email, index) => emails.indexOf(email) !== index)
                            const uniqueDuplicates = [...new Set(csvDuplicates)]
                            
                            if (uniqueDuplicates.length > 0) {
                              return (
                                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                                  ⚠️ {uniqueDuplicates.length} duplicate email(s) found in CSV: {uniqueDuplicates.join(', ')}
                                </div>
                              )
                            } else {
                              return (
                                <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
                                  ✅ No duplicate emails found in CSV file
                                </div>
                              )
                            }
                          })()}
                        </div>
                      )}

                      {csvFile && csvPreview.length > 0 && (
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={uploadCsvMembers}
                            disabled={uploadingCsv || !formData.id}
                            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            {uploadingCsv ? 'Uploading...' : `Upload ${csvPreview.length} Members`}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end space-x-4">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="btn-primary disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : editingCohort ? 'Update Cohort' : 'Create Cohort'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Cohorts List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {cohorts.map((cohort) => (
            <div key={cohort.id} className="card p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {cohort.nomenclature || `Cohort ${cohort.id}`}
                  </h3>
                  <div className="flex flex-col space-y-1">
                    <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      cohort.active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {cohort.active ? 'Active' : 'Inactive'}
                    </div>
                    {cohort.taster_session_on && (
                      <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Taster Session On
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEdit(cohort)}
                    className="text-primary-600 hover:text-primary-900"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(cohort.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center text-sm text-gray-600">
                  <Users2 className="h-4 w-4 mr-2" />
                  <span>{cohort.member_count || 0} members</span>
                  {cohort.taster_member_count && (
                    <span className="ml-2">({cohort.taster_member_count} tasters)</span>
                  )}
                </div>

                <div className="flex items-center text-sm text-gray-600">
                  <Calendar className="h-4 w-4 mr-2" />
                  <span>{formatDate(cohort.start_date)} - {formatDate(cohort.end_date)}</span>
                </div>

                {cohort.main_group_link && (
                  <div className="flex items-center text-sm text-gray-600">
                    <Link className="h-4 w-4 mr-2" />
                    <a 
                      href={cohort.main_group_link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary-600 hover:text-primary-800 truncate"
                    >
                      Main Group
                    </a>
                  </div>
                )}

                {cohort.taster_group_link && (
                  <div className="flex items-center text-sm text-gray-600">
                    <Link className="h-4 w-4 mr-2" />
                    <a 
                      href={cohort.taster_group_link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary-600 hover:text-primary-800 truncate"
                    >
                      Taster Group
                    </a>
                  </div>
                )}

                {cohort.circles && Array.isArray(cohort.circles) && cohort.circles.filter(circle => {
                  if (typeof circle === 'string') {
                    return circle.trim() !== ''
                  } else if (typeof circle === 'object' && circle !== null) {
                    const circleObj = circle as any
                    return circleObj.circle_whatsapp_link?.trim() !== '' || circleObj.circle_rep_whatsapp_contact?.trim() !== '' || circleObj.circle_rep_phonemuber?.trim() !== ''
                  }
                  return false
                }).length > 0 && (
                  <div className="flex items-center text-sm text-gray-600">
                    <Users2 className="h-4 w-4 mr-2" />
                    <span>{cohort.circles.filter(circle => {
                      if (typeof circle === 'string') {
                        return circle.trim() !== ''
                      } else if (typeof circle === 'object' && circle !== null) {
                        const circleObj = circle as any
                        return circleObj.circle_whatsapp_link?.trim() !== '' || circleObj.circle_rep_whatsapp_contact?.trim() !== '' || circleObj.circle_rep_phonemuber?.trim() !== ''
                      }
                      return false
                    }).length} circles configured</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {cohorts.length === 0 && (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No cohorts found</h3>
            <p className="text-gray-600 mb-4">Get started by creating your first cohort.</p>
            <button
              onClick={() => setShowForm(true)}
              className="btn-primary"
            >
              Create Cohort
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

export default CohortManagement
