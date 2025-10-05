import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase, CurrentCohort, TasterMember, MainMember } from '../lib/supabase'
import { Users, Edit, Trash2, X, UserPlus, UserCheck, Settings, Search } from 'lucide-react'

const MemberManagement: React.FC = () => {
  const { user, signOut } = useAuth()
  const [cohorts, setCohorts] = useState<CurrentCohort[]>([])
  const [mainMembers, setMainMembers] = useState<MainMember[]>([])
  const [tasterMembers, setTasterMembers] = useState<TasterMember[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'main' | 'taster' | 'qualified'>('main')
  const [showForm, setShowForm] = useState(false)
  const [editingMember, setEditingMember] = useState<MainMember | TasterMember | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [selectedCohort, setSelectedCohort] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [availableCircles, setAvailableCircles] = useState<string[]>([])

  // Form data for main members
  const [mainMemberForm, setMainMemberForm] = useState({
    id: '',
    firstname: '',
    lastname: '',
    email: '',
    phonenumber: '',
    whatsapp: '',
    bio: '',
    fcmtoken: '',
    partnerid: '',
    repid: '',
    role: '',
    sanumber: '',
    status: 'active',
    circle_number: '',
    probationvisits: 0,
    plancreated: false,
    isincurrentcohort: false,
    prevsanumbers: [] as string[],
    previousgroups: [] as string[],
    circleGroupLink: '',
    current_cohort_id: ''
  })

  // Form data for taster members
  const [tasterMemberForm, setTasterMemberForm] = useState({
    id: '',
    firstname: '',
    lastname: '',
    email: '',
    satnumber: '',
    current_cohort_id: '',
    Gender: '',
    Confirm_Phone_number: '',
    Birthday: '',
    total_submission: 0,
    sermon_submitted: false
  })

  useEffect(() => {
    fetchData()
  }, [])

  // Function to get available circles for a cohort
  const getAvailableCircles = (cohortId: string) => {
    if (!cohortId) {
      setAvailableCircles([])
      return
    }

    const cohort = cohorts.find(c => c.id?.toString() === cohortId)
    if (cohort && cohort.circles && Array.isArray(cohort.circles)) {
      const circles = cohort.circles
        .map((circle, index) => circle && circle.trim() !== '' ? `Circle ${index + 1}` : null)
        .filter(circle => circle !== null) as string[]
      setAvailableCircles(circles)
    } else {
      setAvailableCircles([])
    }
  }

  // Function to get circle group link based on circle number
  const getCircleGroupLink = (cohortId: string, circleNumber: string) => {
    if (!cohortId || !circleNumber) return ''

    const cohort = cohorts.find(c => c.id?.toString() === cohortId)
    if (cohort && cohort.circles && Array.isArray(cohort.circles)) {
      const circleIndex = parseInt(circleNumber.replace('Circle ', '')) - 1
      return cohort.circles[circleIndex] || ''
    }
    return ''
  }

  const fetchData = async () => {
    try {
      const [cohortsResult, mainMembersResult, tasterMembersResult] = await Promise.all([
        supabase.from('current_cohort').select('*').order('id', { ascending: false }),
        supabase.from('main_members').select('*').order('sanumber', { ascending: true }),
        supabase.from('taster_members').select('*').order('satnumber', { ascending: true })
      ])

      if (cohortsResult.error) throw cohortsResult.error
      if (mainMembersResult.error) throw mainMembersResult.error
      if (tasterMembersResult.error) throw tasterMembersResult.error

      setCohorts(cohortsResult.data || [])
      setMainMembers(mainMembersResult.data || [])
      setTasterMembers(tasterMembersResult.data || [])
    } catch (error) {
      console.error('Error fetching data:', error)
      setError('Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }

  const generateId = () => {
    return `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  const handleMainMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      // Generate SA number if not provided
      let sanumber = mainMemberForm.sanumber
      if (!sanumber) {
        const cohortId = mainMemberForm.current_cohort_id || '001'
        const paddedCohort = cohortId.padStart(3, '0')
        const existingMembers = mainMembers.filter(m => m.sanumber?.startsWith(`SA/${paddedCohort}/`))
        const nextIndex = existingMembers.length + 1
        const paddedIndex = nextIndex.toString().padStart(3, '0')
        sanumber = `SA/${paddedCohort}/${paddedIndex}`
      }

      if (editingMember) {
        // Update existing member
        const memberData = {
          ...mainMemberForm,
          sanumber,
          probationvisits: parseInt(mainMemberForm.probationvisits.toString()) || 0,
          current_cohort_id: mainMemberForm.current_cohort_id ? parseInt(mainMemberForm.current_cohort_id) : null,
          circleGroupLink: getCircleGroupLink(mainMemberForm.current_cohort_id, mainMemberForm.circle_number)
        }

        const { error } = await supabase
          .from('main_members')
          .update(memberData)
          .eq('id', editingMember.id)

        if (error) throw error

        setMainMembers(prev => 
          prev.map(member => 
            member.id === editingMember.id ? { ...member, ...memberData } : member
          )
        )
      } else {
        // Create new member with auth user using signup
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: mainMemberForm.email,
          password: 'Adventure',
          options: {
            data: {
              first_name: mainMemberForm.firstname,
              last_name: mainMemberForm.lastname
            }
          }
        })

        if (authError) {
          console.error('Auth error:', authError)
          throw new Error(`Failed to create user account: ${authError.message}`)
        }

        if (!authData.user) {
          throw new Error('Failed to create user account: No user data returned')
        }

        const memberData = {
          ...mainMemberForm,
          id: authData.user.id, // Use the auth user's UUID
          sanumber,
          probationvisits: parseInt(mainMemberForm.probationvisits.toString()) || 0,
          current_cohort_id: mainMemberForm.current_cohort_id ? parseInt(mainMemberForm.current_cohort_id) : null,
          circleGroupLink: getCircleGroupLink(mainMemberForm.current_cohort_id, mainMemberForm.circle_number)
        }

        // Try to insert the member with retry logic for foreign key constraint
        let insertRetries = 0
        const maxInsertRetries = 5
        let insertSuccess = false
        let data = null
        let error = null

        while (insertRetries < maxInsertRetries && !insertSuccess) {
          const result = await supabase
            .from('main_members')
            .insert([memberData])
            .select()

          if (result.error) {
            if (result.error.message.includes('foreign key constraint')) {
              // Foreign key constraint error - wait and retry
              await new Promise(resolve => setTimeout(resolve, 2000))
              insertRetries++
            } else {
              // Other error - don't retry
              error = result.error
              break
            }
          } else {
            // Success
            data = result.data
            insertSuccess = true
          }
        }

        if (!insertSuccess && error) {
          console.error('Supabase error:', error)
          throw error
        }

        if (data && data.length > 0) {
          setMainMembers(prev => [data[0], ...prev])

          // Update member_count in current_cohort if current_cohort_id is set
          if (memberData.current_cohort_id) {
            try {
              // Get current count of main members for this cohort
              const { data: existingMembers, error: countError } = await supabase
                .from('main_members')
                .select('id')
                .eq('current_cohort_id', memberData.current_cohort_id)

              if (countError) throw countError

              const totalMainMembers = existingMembers?.length || 0

              // Update member_count in current_cohort table
              const { error: cohortError } = await supabase
                .from('current_cohort')
                .update({ 
                  member_count: totalMainMembers,
                  updated_at: new Date().toISOString()
                })
                .eq('id', memberData.current_cohort_id)

              if (cohortError) throw cohortError

              // Update local cohorts state
              setCohorts(prev => 
                prev.map(cohort => 
                  cohort.id === memberData.current_cohort_id
                    ? { ...cohort, member_count: totalMainMembers }
                    : cohort
                )
              )
            } catch (error) {
              console.error('Error updating cohort member count:', error)
              // Don't throw error here as the main member was already created successfully
            }
          }
        }
      }

      resetMainMemberForm()
      setShowForm(false)
      setError('')
    } catch (error: any) {
      console.error('Error saving main member:', error)
      setError(error.message || 'Failed to save main member')
    } finally {
      setSaving(false)
    }
  }

  const handleTasterMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      // Generate SAT number if not provided
      let satnumber = tasterMemberForm.satnumber
      if (!satnumber && tasterMemberForm.current_cohort_id) {
        const paddedCohort = tasterMemberForm.current_cohort_id.padStart(3, '0')
        const existingMembers = tasterMembers.filter(m => m.satnumber?.startsWith(`SAT/${paddedCohort}/`))
        const nextIndex = existingMembers.length + 1
        const paddedIndex = nextIndex.toString().padStart(3, '0')
        satnumber = `SAT/${paddedCohort}/${paddedIndex}`
      }

      const memberData = {
        ...tasterMemberForm,
        id: editingMember ? editingMember.id : generateId(),
        satnumber,
        current_cohort_id: tasterMemberForm.current_cohort_id ? parseInt(tasterMemberForm.current_cohort_id) : null,
        total_submission: parseInt(tasterMemberForm.total_submission.toString()) || 0,
        sermon_submitted: tasterMemberForm.sermon_submitted
      }

      if (editingMember) {
        const { error } = await supabase
          .from('taster_members')
          .update(memberData)
          .eq('id', editingMember.id)

        if (error) throw error

        setTasterMembers(prev => 
          prev.map(member => 
            member.id === editingMember.id ? { ...member, ...memberData } : member
          )
        )
      } else {
        const { data, error } = await supabase
          .from('taster_members')
          .insert([memberData])
          .select()

        if (error) {
          console.error('Supabase error:', error)
          throw error
        }

        if (data && data.length > 0) {
          setTasterMembers(prev => [data[0], ...prev])

          // Update taster_member_count in current_cohort if current_cohort_id is set
          if (memberData.current_cohort_id) {
            try {
              // Get current count of taster members for this cohort
              const { data: existingMembers, error: countError } = await supabase
                .from('taster_members')
                .select('id')
                .eq('current_cohort_id', memberData.current_cohort_id)

              if (countError) throw countError

              const totalTasterMembers = existingMembers?.length || 0

              // Update taster_member_count in current_cohort table
              const { error: cohortError } = await supabase
                .from('current_cohort')
                .update({ 
                  taster_member_count: totalTasterMembers,
                  updated_at: new Date().toISOString()
                })
                .eq('id', memberData.current_cohort_id)

              if (cohortError) throw cohortError

              // Update local cohorts state
              setCohorts(prev => 
                prev.map(cohort => 
                  cohort.id === memberData.current_cohort_id
                    ? { ...cohort, taster_member_count: totalTasterMembers }
                    : cohort
                )
              )
            } catch (error) {
              console.error('Error updating cohort taster member count:', error)
              // Don't throw error here as the taster member was already created successfully
            }
          }
        }
      }

      resetTasterMemberForm()
      setShowForm(false)
      setError('')
    } catch (error: any) {
      console.error('Error saving taster member:', error)
      setError(error.message || 'Failed to save taster member')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (member: MainMember | TasterMember) => {
    setEditingMember(member)
    setShowForm(true)

    if ('sanumber' in member) {
      // Main member
      setMainMemberForm({
        id: member.id,
        firstname: member.firstname || '',
        lastname: member.lastname || '',
        email: member.email || '',
        phonenumber: member.phonenumber || '',
        whatsapp: member.whatsapp || '',
        bio: member.bio || '',
        fcmtoken: member.fcmtoken || '',
        partnerid: member.partnerid || '',
        repid: member.repid || '',
        role: member.role || '',
        sanumber: member.sanumber || '',
        status: member.status || 'active',
        circle_number: member.circle_number || '',
        probationvisits: member.probationvisits || 0,
        plancreated: member.plancreated || false,
        isincurrentcohort: member.isincurrentcohort || false,
        prevsanumbers: member.prevsanumbers || [],
        previousgroups: member.previousgroups || [],
        circleGroupLink: member.circleGroupLink || '',
        current_cohort_id: member.current_cohort_id?.toString() || ''
      })
      setActiveTab('main')
    } else {
      // Taster member
      setTasterMemberForm({
        id: member.id,
        firstname: member.firstname || '',
        lastname: member.lastname || '',
        email: member.email || '',
        satnumber: member.satnumber || '',
        current_cohort_id: member.current_cohort_id?.toString() || '',
        Gender: member.Gender || '',
        Confirm_Phone_number: member.Confirm_Phone_number || '',
        Birthday: member.Birthday || '',
        total_submission: member.total_submission || 0,
        sermon_submitted: member.sermon_submitted || false
      })
      setActiveTab('taster')
    }
  }

  const handlePromoteToMain = async (tasterMember: TasterMember) => {
    if (!confirm(`Are you sure you want to promote ${tasterMember.firstname} ${tasterMember.lastname} to a main member? This will create a new main member account.`)) return

    setSaving(true)
    setError('')

    try {
      // Create auth user for the main member
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: tasterMember.email || '',
        password: 'Adventure',
        options: {
          data: {
            first_name: tasterMember.firstname,
            last_name: tasterMember.lastname
          }
        }
      })

      if (authError) {
        console.error('Auth error:', authError)
        throw new Error(`Failed to create user account: ${authError.message}`)
      }

      if (!authData.user) {
        throw new Error('Failed to create user account: No user data returned')
      }

      // Generate SA number for the main member
      const cohortId = tasterMember.current_cohort_id?.toString() || '001'
      const paddedCohort = cohortId.padStart(3, '0')
      const existingMembers = mainMembers.filter(m => m.sanumber?.startsWith(`SA/${paddedCohort}/`))
      const nextIndex = existingMembers.length + 1
      const paddedIndex = nextIndex.toString().padStart(3, '0')
      const sanumber = `SA/${paddedCohort}/${paddedIndex}`

      // Create main member data
      const mainMemberData = {
        id: authData.user.id,
        firstname: tasterMember.firstname,
        lastname: tasterMember.lastname,
        email: tasterMember.email,
        phonenumber: tasterMember.Confirm_Phone_number,
        whatsapp: tasterMember.Confirm_Phone_number ? `https://wa.me/${tasterMember.Confirm_Phone_number}` : '',
        bio: `Promoted from taster member (SAT: ${tasterMember.satnumber})`,
        fcmtoken: '',
        partnerid: '',
        repid: '',
        role: 'member',
        sanumber,
        status: 'active',
        circle_number: '',
        probationvisits: 0,
        plancreated: false,
        isincurrentcohort: true,
        prevsanumbers: [],
        previousgroups: [],
        circleGroupLink: '',
        current_cohort_id: tasterMember.current_cohort_id
      }

      // Insert main member with retry logic
      let insertRetries = 0
      const maxInsertRetries = 5
      let insertSuccess = false
      let data = null
      let error = null

      while (insertRetries < maxInsertRetries && !insertSuccess) {
        const result = await supabase
          .from('main_members')
          .insert([mainMemberData])
          .select()

        if (result.error) {
          if (result.error.message.includes('foreign key constraint')) {
            await new Promise(resolve => setTimeout(resolve, 2000))
            insertRetries++
          } else {
            error = result.error
            break
          }
        } else {
          data = result.data
          insertSuccess = true
        }
      }

      if (!insertSuccess && error) {
        console.error('Supabase error:', error)
        throw error
      }

      if (data && data.length > 0) {
        // Update member_count and taster_member_count in current_cohort
        if (mainMemberData.current_cohort_id) {
          try {
            const [mainMembersResult, tasterMembersResult] = await Promise.all([
              supabase.from('main_members').select('id').eq('current_cohort_id', mainMemberData.current_cohort_id),
              supabase.from('taster_members').select('id').eq('current_cohort_id', mainMemberData.current_cohort_id)
            ])

            if (mainMembersResult.error) throw mainMembersResult.error
            if (tasterMembersResult.error) throw tasterMembersResult.error

            const totalMainMembers = mainMembersResult.data?.length || 0
            const totalTasterMembers = tasterMembersResult.data?.length || 0

            const { error: cohortError } = await supabase
              .from('current_cohort')
              .update({ 
                member_count: totalMainMembers,
                taster_member_count: totalTasterMembers,
                updated_at: new Date().toISOString()
              })
              .eq('id', mainMemberData.current_cohort_id)

            if (cohortError) throw cohortError
          } catch (error) {
            console.error('Error updating cohort member counts:', error)
          }
        }

        alert(`Successfully promoted ${tasterMember.firstname} ${tasterMember.lastname} to main member!\nSA Number: ${sanumber}`)
        
        // Add the promoted member to main members list
        setMainMembers(prev => [data[0], ...prev])
      }
    } catch (error: any) {
      console.error('Error promoting taster member:', error)
      setError(error.message || 'Failed to promote taster member')
    } finally {
      setSaving(false)
    }
  }

  const handleBulkPromoteToMain = async () => {
    if (qualifiedTasterMembers.length === 0) {
      setError('No qualified members to promote')
      return
    }

    if (!confirm(`Are you sure you want to promote ${qualifiedTasterMembers.length} qualified taster members to main members? This will create new main member accounts for all of them.`)) return

    setSaving(true)
    setError('')

    try {
      const promotedMembers: (MainMember & { originalTaster: TasterMember })[] = []
      const failedMembers: { member: TasterMember; error: string }[] = []

      for (const tasterMember of qualifiedTasterMembers) {
        try {
          // Create auth user for the main member
          const { data: authData, error: authError } = await supabase.auth.signUp({
            email: tasterMember.email || '',
            password: 'Adventure',
            options: {
              data: {
                first_name: tasterMember.firstname,
                last_name: tasterMember.lastname
              }
            }
          })

          if (authError) {
            console.error('Auth error for', tasterMember.firstname, authError)
            failedMembers.push({ member: tasterMember, error: authError.message })
            continue
          }

          if (!authData.user) {
            failedMembers.push({ member: tasterMember, error: 'No user data returned' })
            continue
          }

          // Generate SA number for the main member
          const cohortId = tasterMember.current_cohort_id?.toString() || '001'
          const paddedCohort = cohortId.padStart(3, '0')
          const existingMembers = mainMembers.filter(m => m.sanumber?.startsWith(`SA/${paddedCohort}/`))
          const nextIndex: number = existingMembers.length + promotedMembers.length + 1
          const paddedIndex: string = nextIndex.toString().padStart(3, '0')
          const sanumber: string = `SA/${paddedCohort}/${paddedIndex}`

          // Create main member data
          const mainMemberData: MainMember = {
            id: authData.user.id,
            firstname: tasterMember.firstname,
            lastname: tasterMember.lastname,
            email: tasterMember.email,
            phonenumber: tasterMember.Confirm_Phone_number,
            whatsapp: tasterMember.Confirm_Phone_number ? `https://wa.me/${tasterMember.Confirm_Phone_number}` : '',
            bio: `Promoted from taster member (SAT: ${tasterMember.satnumber})`,
            fcmtoken: '',
            partnerid: '',
            repid: '',
            role: 'member',
            sanumber,
            status: 'active',
            circle_number: '',
            probationvisits: 0,
            plancreated: false,
            isincurrentcohort: true,
            prevsanumbers: [],
            previousgroups: [],
            circleGroupLink: '',
            current_cohort_id: tasterMember.current_cohort_id
          }

          // Insert main member with retry logic
          let insertRetries = 0
          const maxInsertRetries = 5
          let insertSuccess = false
          let data = null
          let error = null

          while (insertRetries < maxInsertRetries && !insertSuccess) {
            const result = await supabase
              .from('main_members')
              .insert([mainMemberData])
              .select()

            if (result.error) {
              if (result.error.message.includes('foreign key constraint')) {
                await new Promise(resolve => setTimeout(resolve, 2000))
                insertRetries++
              } else {
                error = result.error
                break
              }
            } else {
              data = result.data
              insertSuccess = true
            }
          }

          if (!insertSuccess && error) {
            console.error('Supabase error for', tasterMember.firstname, error)
            failedMembers.push({ member: tasterMember, error: error.message })
            continue
          }

          if (data && data.length > 0) {
            promotedMembers.push({ ...data[0], originalTaster: tasterMember })
          }
        } catch (error: any) {
          console.error('Error promoting', tasterMember.firstname, error)
          failedMembers.push({ member: tasterMember, error: error.message })
        }
      }

      // Update local state with all promoted members
      if (promotedMembers.length > 0) {
        // Update cohort member counts
        const cohortUpdates = new Map()
        promotedMembers.forEach(member => {
          if (member.current_cohort_id) {
            const currentCount = cohortUpdates.get(member.current_cohort_id) || 0
            cohortUpdates.set(member.current_cohort_id, currentCount + 1)
          }
        })

        // Update each affected cohort
        for (const [cohortId] of cohortUpdates) {
          try {
            const { data: existingMembers, error: countError } = await supabase
              .from('main_members')
              .select('id')
              .eq('current_cohort_id', cohortId)

            if (countError) throw countError

            const totalMainMembers = existingMembers?.length || 0

            const { error: cohortError } = await supabase
              .from('current_cohort')
              .update({ 
                member_count: totalMainMembers,
                updated_at: new Date().toISOString()
              })
              .eq('id', cohortId)

            if (cohortError) throw cohortError
          } catch (error) {
            console.error('Error updating cohort member count:', error)
          }
        }
      }

      // Show results
      let message = `Successfully promoted ${promotedMembers.length} members to main members!`
      if (failedMembers.length > 0) {
        message += `\n\nFailed to promote ${failedMembers.length} members:\n`
        failedMembers.forEach(failed => {
          message += `- ${failed.member.firstname} ${failed.member.lastname}: ${failed.error}\n`
        })
      }
      
      alert(message)
      
      // Add all promoted members to main members list
      if (promotedMembers.length > 0) {
        setMainMembers(prev => [...promotedMembers, ...prev])
      }
    } catch (error: any) {
      console.error('Error in bulk promotion:', error)
      setError(error.message || 'Failed to promote members')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (member: MainMember | TasterMember) => {
    if (!confirm('Are you sure you want to delete this member?')) return

    try {
      const table = 'sanumber' in member ? 'main_members' : 'taster_members'
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', member.id)

      if (error) throw error

      // Update cohort counts after deletion
      if ('sanumber' in member) {
        setMainMembers(prev => prev.filter(m => m.id !== member.id))
        
        // Update member_count in current_cohort if current_cohort_id exists
        if (member.current_cohort_id) {
          try {
            const { data: existingMembers, error: countError } = await supabase
              .from('main_members')
              .select('id')
              .eq('current_cohort_id', member.current_cohort_id)

            if (countError) throw countError

            const totalMainMembers = existingMembers?.length || 0

            const { error: cohortError } = await supabase
              .from('current_cohort')
              .update({ 
                member_count: totalMainMembers,
                updated_at: new Date().toISOString()
              })
              .eq('id', member.current_cohort_id)

            if (cohortError) throw cohortError

            setCohorts(prev => 
              prev.map(cohort => 
                cohort.id === member.current_cohort_id
                  ? { ...cohort, member_count: totalMainMembers }
                  : cohort
              )
            )
          } catch (error) {
            console.error('Error updating cohort member count after deletion:', error)
          }
        }
      } else {
        setTasterMembers(prev => prev.filter(m => m.id !== member.id))
        
        // Update taster_member_count in current_cohort if current_cohort_id exists
        if (member.current_cohort_id) {
          try {
            const { data: existingMembers, error: countError } = await supabase
              .from('taster_members')
              .select('id')
              .eq('current_cohort_id', member.current_cohort_id)

            if (countError) throw countError

            const totalTasterMembers = existingMembers?.length || 0

            const { error: cohortError } = await supabase
              .from('current_cohort')
              .update({ 
                taster_member_count: totalTasterMembers,
                updated_at: new Date().toISOString()
              })
              .eq('id', member.current_cohort_id)

            if (cohortError) throw cohortError

            setCohorts(prev => 
              prev.map(cohort => 
                cohort.id === member.current_cohort_id
                  ? { ...cohort, taster_member_count: totalTasterMembers }
                  : cohort
              )
            )
          } catch (error) {
            console.error('Error updating cohort taster member count after deletion:', error)
          }
        }
      }
    } catch (error: any) {
      console.error('Error deleting member:', error)
      setError(error.message || 'Failed to delete member')
    }
  }

  const resetMainMemberForm = () => {
    setMainMemberForm({
      id: '',
      firstname: '',
      lastname: '',
      email: '',
      phonenumber: '',
      whatsapp: '',
      bio: '',
      fcmtoken: '',
      partnerid: '',
      repid: '',
      role: '',
      sanumber: '',
      status: 'active',
      circle_number: '',
      probationvisits: 0,
      plancreated: false,
      isincurrentcohort: false,
      prevsanumbers: [],
      previousgroups: [],
      circleGroupLink: '',
      current_cohort_id: ''
    })
    setEditingMember(null)
  }

  const resetTasterMemberForm = () => {
    setTasterMemberForm({
      id: '',
      firstname: '',
      lastname: '',
      email: '',
      satnumber: '',
      current_cohort_id: '',
      Gender: '',
      Confirm_Phone_number: '',
      Birthday: '',
      total_submission: 0,
      sermon_submitted: false
    })
    setEditingMember(null)
  }

  const filteredMainMembers = mainMembers.filter(member => {
    // Filter by cohort
    const cohortMatch = selectedCohort === 'all' || member.current_cohort_id?.toString() === selectedCohort
    
    // Filter by search query
    const searchMatch = !searchQuery || 
      member.firstname?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.lastname?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.sanumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.phonenumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.whatsapp?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.role?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.circle_number?.toLowerCase().includes(searchQuery.toLowerCase())
    
    return cohortMatch && searchMatch
  })

  const filteredTasterMembers = tasterMembers.filter(member => {
    // Filter by cohort
    const cohortMatch = selectedCohort === 'all' || member.current_cohort_id?.toString() === selectedCohort
    
    // Filter by search query
    const searchMatch = !searchQuery || 
      member.firstname?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.lastname?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.satnumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.Confirm_Phone_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.Gender?.toLowerCase().includes(searchQuery.toLowerCase())
    
    return cohortMatch && searchMatch
  })

  const qualifiedTasterMembers = filteredTasterMembers.filter(member => {
    // Check if member meets qualification criteria
    const isQualified = (member.total_submission || 0) >= 3 && member.sermon_submitted
    
    // Check if member is not already a main member (by email)
    const isNotMainMember = !mainMembers.some(mainMember => 
      mainMember.email?.toLowerCase() === member.email?.toLowerCase()
    )
    
    return isQualified && isNotMainMember
  })

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
              <h1 className="text-xl font-semibold text-gray-900">Member Management</h1>
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
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Manage Members</h2>
              <p className="text-gray-600">Create and manage main members and taster members</p>
            </div>
            <div className="flex space-x-4">
              <button
                onClick={() => {
                  resetMainMemberForm()
                  setActiveTab('main')
                  setShowForm(true)
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 flex items-center"
              >
                <UserPlus className="h-5 w-5 mr-2" />
                Add Main Member
              </button>
              <button
                onClick={() => {
                  resetTasterMemberForm()
                  setActiveTab('taster')
                  setShowForm(true)
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 flex items-center"
              >
                <UserCheck className="h-5 w-5 mr-2" />
                Add Taster Member
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
            <Settings className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
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
              placeholder={`Search ${activeTab === 'main' ? 'main' : 'taster'} members by name, email, number, role...`}
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
                Main Members ({filteredMainMembers.length})
              </button>
              <button
                onClick={() => setActiveTab('taster')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'taster'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Taster Members ({filteredTasterMembers.length})
              </button>
              <button
                onClick={() => setActiveTab('qualified')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'qualified'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Qualified Members ({qualifiedTasterMembers.length})
              </button>
            </nav>
          </div>
        </div>

        {/* Main Members Table */}
        {activeTab === 'main' && (
          <div className="card">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Main Members</h3>
            </div>
            <div className="overflow-x-auto">
              {filteredMainMembers.length > 0 ? (
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
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredMainMembers.map((member) => (
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleEdit(member)}
                              className="text-primary-600 hover:text-primary-900"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(member)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {searchQuery ? 'No matching main members found' : 'No main members found'}
                  </h3>
                  <p className="text-gray-600 mb-4">
                    {searchQuery 
                      ? `No main members match your search "${searchQuery}". Try adjusting your search terms.`
                      : 'Get started by adding your first main member.'
                    }
                  </p>
                  {!searchQuery && (
                    <button
                      onClick={() => {
                        resetMainMemberForm()
                        setActiveTab('main')
                        setShowForm(true)
                      }}
                      className="btn-primary"
                    >
                      Add Main Member
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Taster Members Table */}
        {activeTab === 'taster' && (
          <div className="card">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Taster Members</h3>
            </div>
            <div className="overflow-x-auto">
              {filteredTasterMembers.length > 0 ? (
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
                        SAT Number
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Gender
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredTasterMembers.map((member) => (
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
                          <div className="text-sm text-gray-900">{member.Confirm_Phone_number || '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-blue-600">{member.satnumber}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{member.Gender || '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {cohorts.find(c => c.id === member.current_cohort_id)?.nomenclature || 
                             `Cohort ${member.current_cohort_id}`}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {member.total_submission || 0}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            (member.total_submission || 0) >= 3 && member.sermon_submitted
                              ? 'bg-green-100 text-green-800' 
                              : (member.total_submission || 0) >= 3 && !member.sermon_submitted
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {(member.total_submission || 0) >= 3 && member.sermon_submitted 
                              ? 'Qualified' 
                              : (member.total_submission || 0) >= 3 && !member.sermon_submitted
                              ? 'Need Sermon'
                              : 'In Progress'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            member.sermon_submitted 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {member.sermon_submitted ? 'Submitted' : 'Pending'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleEdit(member)}
                              className="text-primary-600 hover:text-primary-900"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            {(member.total_submission || 0) >= 3 && member.sermon_submitted && (
                              <button
                                onClick={() => handlePromoteToMain(member)}
                                className="text-green-600 hover:text-green-900"
                                title="Promote to Main Member"
                              >
                                <UserPlus className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(member)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {searchQuery ? 'No matching taster members found' : 'No taster members found'}
                  </h3>
                  <p className="text-gray-600 mb-4">
                    {searchQuery 
                      ? `No taster members match your search "${searchQuery}". Try adjusting your search terms.`
                      : 'Get started by adding your first taster member.'
                    }
                  </p>
                  {!searchQuery && (
                    <button
                      onClick={() => {
                        resetTasterMemberForm()
                        setActiveTab('taster')
                        setShowForm(true)
                      }}
                      className="btn-primary"
                    >
                      Add Taster Member
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Qualified Members Table */}
        {activeTab === 'qualified' && (
          <div className="card">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Qualified Taster Members ({qualifiedTasterMembers.length})</h3>
                {qualifiedTasterMembers.length > 0 && (
                  <button
                    onClick={handleBulkPromoteToMain}
                    disabled={saving}
                    className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 flex items-center disabled:opacity-50"
                  >
                    <UserPlus className="h-5 w-5 mr-2" />
                    {saving ? 'Promoting...' : `Promote All ${qualifiedTasterMembers.length} Members`}
                  </button>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              {qualifiedTasterMembers.length > 0 ? (
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {qualifiedTasterMembers.map((member) => (
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
                          <div className="text-sm text-gray-900">{member.Confirm_Phone_number || '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-blue-600">{member.satnumber}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {cohorts.find(c => c.id === member.current_cohort_id)?.nomenclature || 
                             `Cohort ${member.current_cohort_id}`}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {member.total_submission || 0}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Qualified
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Submitted
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleEdit(member)}
                              className="text-primary-600 hover:text-primary-900"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handlePromoteToMain(member)}
                              className="text-green-600 hover:text-green-900"
                              title="Promote to Main Member"
                            >
                              <UserPlus className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(member)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-12">
                  <UserCheck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No qualified members found</h3>
                  <p className="text-gray-600 mb-4">
                    {searchQuery 
                      ? `No qualified members match your search "${searchQuery}". Try adjusting your search terms.`
                      : 'No taster members have met the qualification criteria yet (3+ submissions and sermon submitted).'
                    }
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" style={{zIndex: 9999}}>
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold">
                    {editingMember ? 'Edit Member' : `Add New ${activeTab === 'main' ? 'Main' : 'Taster'} Member`}
                  </h3>
                  <button
                    onClick={() => {
                      resetMainMemberForm()
                      resetTasterMemberForm()
                      setShowForm(false)
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                {/* Main Member Form */}
                {activeTab === 'main' && (
                  <form onSubmit={handleMainMemberSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          First Name *
                        </label>
                        <input
                          type="text"
                          value={mainMemberForm.firstname}
                          onChange={(e) => setMainMemberForm(prev => ({ ...prev, firstname: e.target.value }))}
                          className="input-field"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Last Name *
                        </label>
                        <input
                          type="text"
                          value={mainMemberForm.lastname}
                          onChange={(e) => setMainMemberForm(prev => ({ ...prev, lastname: e.target.value }))}
                          className="input-field"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Email *
                        </label>
                        <input
                          type="email"
                          value={mainMemberForm.email}
                          onChange={(e) => setMainMemberForm(prev => ({ ...prev, email: e.target.value }))}
                          className="input-field"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          value={mainMemberForm.phonenumber}
                          onChange={(e) => {
                            const phoneNumber = e.target.value
                            const whatsappLink = phoneNumber ? `https://wa.me/${phoneNumber}` : ''
                            setMainMemberForm(prev => ({ 
                              ...prev, 
                              phonenumber: phoneNumber,
                              whatsapp: whatsappLink
                            }))
                          }}
                          className="input-field"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          WhatsApp
                        </label>
                        <input
                          type="url"
                          value={mainMemberForm.whatsapp}
                          className="input-field bg-gray-50"
                          placeholder="Auto-generated from phone number"
                          readOnly
                        />
                        <p className="text-xs text-gray-500 mt-1">Automatically generated from phone number</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          SA Number
                        </label>
                        <input
                          type="text"
                          value={mainMemberForm.sanumber}
                          onChange={(e) => setMainMemberForm(prev => ({ ...prev, sanumber: e.target.value }))}
                          className="input-field"
                          placeholder="Auto-generated if empty"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Role
                        </label>
                        <select
                          value={mainMemberForm.role}
                          onChange={(e) => setMainMemberForm(prev => ({ ...prev, role: e.target.value }))}
                          className="input-field"
                        >
                          <option value="">Select Role</option>
                          <option value="member">Member</option>
                          <option value="leader">Leader</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Status
                        </label>
                        <select
                          value={mainMemberForm.status}
                          onChange={(e) => setMainMemberForm(prev => ({ ...prev, status: e.target.value }))}
                          className="input-field"
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                          <option value="suspended">Suspended</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Current Cohort *
                        </label>
                        <select
                          value={mainMemberForm.current_cohort_id}
                          onChange={(e) => {
                            const cohortId = e.target.value
                            setMainMemberForm(prev => ({ 
                              ...prev, 
                              current_cohort_id: cohortId,
                              circle_number: '', // Reset circle number when cohort changes
                              circleGroupLink: '' // Reset circle group link
                            }))
                            getAvailableCircles(cohortId)
                          }}
                          className="input-field"
                          required
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
                          Circle Number
                        </label>
                        <select
                          value={mainMemberForm.circle_number}
                          onChange={(e) => {
                            const circleNumber = e.target.value
                            setMainMemberForm(prev => ({ 
                              ...prev, 
                              circle_number: circleNumber,
                              circleGroupLink: getCircleGroupLink(prev.current_cohort_id, circleNumber)
                            }))
                          }}
                          className="input-field"
                          disabled={!mainMemberForm.current_cohort_id || availableCircles.length === 0}
                        >
                          <option value="">Select Circle</option>
                          {availableCircles.map((circle) => (
                            <option key={circle} value={circle}>
                              {circle}
                            </option>
                          ))}
                        </select>
                        {!mainMemberForm.current_cohort_id && (
                          <p className="text-xs text-gray-500 mt-1">Please select a cohort first</p>
                        )}
                        {mainMemberForm.current_cohort_id && availableCircles.length === 0 && (
                          <p className="text-xs text-gray-500 mt-1">No circles available for this cohort</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Probation Visits
                        </label>
                        <input
                          type="number"
                          value={mainMemberForm.probationvisits}
                          onChange={(e) => setMainMemberForm(prev => ({ ...prev, probationvisits: parseInt(e.target.value) || 0 }))}
                          className="input-field"
                          min="0"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Circle Group Link
                        </label>
                        <input
                          type="url"
                          value={mainMemberForm.circleGroupLink}
                          className="input-field bg-gray-50"
                          placeholder="Auto-populated from selected circle"
                          readOnly
                        />
                        <p className="text-xs text-gray-500 mt-1">Automatically populated when circle is selected</p>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Bio
                      </label>
                      <textarea
                        value={mainMemberForm.bio}
                        onChange={(e) => setMainMemberForm(prev => ({ ...prev, bio: e.target.value }))}
                        className="input-field"
                        rows={3}
                      />
                    </div>
                    <div className="flex items-center space-x-4">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={mainMemberForm.plancreated}
                          onChange={(e) => setMainMemberForm(prev => ({ ...prev, plancreated: e.target.checked }))}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">Plan Created</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={mainMemberForm.isincurrentcohort}
                          onChange={(e) => setMainMemberForm(prev => ({ ...prev, isincurrentcohort: e.target.checked }))}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">In Current Cohort</span>
                      </label>
                    </div>
                    <div className="flex justify-end space-x-4">
                      <button
                        type="button"
                        onClick={() => {
                          resetMainMemberForm()
                          resetTasterMemberForm()
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
                        {saving ? 'Saving...' : editingMember ? 'Update Member' : 'Create Member'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Taster Member Form */}
                {activeTab === 'taster' && (
                  <form onSubmit={handleTasterMemberSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          First Name *
                        </label>
                        <input
                          type="text"
                          value={tasterMemberForm.firstname}
                          onChange={(e) => setTasterMemberForm(prev => ({ ...prev, firstname: e.target.value }))}
                          className="input-field"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Last Name *
                        </label>
                        <input
                          type="text"
                          value={tasterMemberForm.lastname}
                          onChange={(e) => setTasterMemberForm(prev => ({ ...prev, lastname: e.target.value }))}
                          className="input-field"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Email *
                        </label>
                        <input
                          type="email"
                          value={tasterMemberForm.email}
                          onChange={(e) => setTasterMemberForm(prev => ({ ...prev, email: e.target.value }))}
                          className="input-field"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          WhatsApp (Confirm Phone Number)
                        </label>
                        <input
                          type="tel"
                          value={tasterMemberForm.Confirm_Phone_number}
                          onChange={(e) => setTasterMemberForm(prev => ({ ...prev, Confirm_Phone_number: e.target.value }))}
                          className="input-field"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Gender
                        </label>
                        <select
                          value={tasterMemberForm.Gender}
                          onChange={(e) => setTasterMemberForm(prev => ({ ...prev, Gender: e.target.value }))}
                          className="input-field"
                        >
                          <option value="">Select Gender</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Birthday
                        </label>
                        <input
                          type="date"
                          value={tasterMemberForm.Birthday}
                          onChange={(e) => setTasterMemberForm(prev => ({ ...prev, Birthday: e.target.value }))}
                          className="input-field"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Cohort *
                        </label>
                        <select
                          value={tasterMemberForm.current_cohort_id}
                          onChange={(e) => setTasterMemberForm(prev => ({ ...prev, current_cohort_id: e.target.value }))}
                          className="input-field"
                          required
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
                          SAT Number
                        </label>
                        <input
                          type="text"
                          value={tasterMemberForm.satnumber}
                          onChange={(e) => setTasterMemberForm(prev => ({ ...prev, satnumber: e.target.value }))}
                          className="input-field"
                          placeholder="Auto-generated if empty"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Total Submissions
                        </label>
                        <input
                          type="number"
                          value={tasterMemberForm.total_submission}
                          onChange={(e) => setTasterMemberForm(prev => ({ ...prev, total_submission: parseInt(e.target.value) || 0 }))}
                          className="input-field"
                          min="0"
                          placeholder="Number of submissions"
                        />
                        {tasterMemberForm.total_submission >= 3 && tasterMemberForm.sermon_submitted && (
                          <p className="text-xs text-green-600 mt-1 font-medium">
                            ✅ Qualified for main member promotion!
                          </p>
                        )}
                        {tasterMemberForm.total_submission >= 3 && !tasterMemberForm.sermon_submitted && (
                          <p className="text-xs text-yellow-600 mt-1 font-medium">
                            ⚠️ Need sermon submission to qualify
                          </p>
                        )}
                        {tasterMemberForm.total_submission < 3 && (
                          <p className="text-xs text-gray-600 mt-1">
                            Need {3 - tasterMemberForm.total_submission} more submissions
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={tasterMemberForm.sermon_submitted}
                            onChange={(e) => setTasterMemberForm(prev => ({ ...prev, sermon_submitted: e.target.checked }))}
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                          />
                          <span className="ml-2 text-sm text-gray-700">Sermon Submitted</span>
                        </label>
                      </div>
                    </div>
                    <div className="flex justify-end space-x-4">
                      <button
                        type="button"
                        onClick={() => {
                          resetMainMemberForm()
                          resetTasterMemberForm()
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
                        {saving ? 'Saving...' : editingMember ? 'Update Member' : 'Create Member'}
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

export default MemberManagement
