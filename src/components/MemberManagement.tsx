import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase, CurrentCohort, TasterMember, MainMember } from '../lib/supabase'
import { Users, Edit, Trash2, X, UserPlus, UserCheck, Settings, Search, Upload, FileText, CheckSquare, Square } from 'lucide-react'

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
  const [showCsvUpload, setShowCsvUpload] = useState(false)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvData, setCsvData] = useState<any[]>([])
  const [csvUploading, setCsvUploading] = useState(false)
  const [csvSelectedCohort, setCsvSelectedCohort] = useState<string>('8')

  /** Promote taster → main: target cohort, circle, single or bulk list */
  const [promotionModal, setPromotionModal] = useState<{
    members: TasterMember[]
  } | null>(null)
  const [promotionCohortId, setPromotionCohortId] = useState('')
  const [promotionCircleNumber, setPromotionCircleNumber] = useState('')

  /** Main tab: mark isincurrentcohort false for members not in selected cohort */
  const [mainMemberSelection, setMainMemberSelection] = useState<Set<string>>(new Set())
  const [bulkNotCurrentSaving, setBulkNotCurrentSaving] = useState(false)

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

  useEffect(() => {
    setMainMemberSelection(new Set())
  }, [selectedCohort])

  // Function to get available circles for a cohort
  const getAvailableCircles = (cohortId: string) => {
    if (!cohortId) {
      setAvailableCircles([])
      return
    }

    const cohort = cohorts.find(c => c.id?.toString() === cohortId)
    if (cohort && cohort.circles && Array.isArray(cohort.circles)) {
      const circles = cohort.circles
        .map((circle: any, index: number) => {
          // Handle both old format (string) and new format (object)
          if (typeof circle === 'string' && circle.trim() !== '') {
            return (index + 1).toString() // Return just the number
          } else if (typeof circle === 'object' && circle !== null && circle.circle_whatsapp_link?.trim() !== '') {
            return (index + 1).toString() // Return just the number
          }
          return null
        })
        .filter(circle => circle !== null) as string[]
      setAvailableCircles(circles)
    } else {
      setAvailableCircles([])
    }
  }

  const getCircleOptionsForCohort = (cohortIdStr: string): string[] => {
    if (!cohortIdStr) return []
    const cohort = cohorts.find(c => c.id?.toString() === cohortIdStr)
    if (!cohort || !cohort.circles || !Array.isArray(cohort.circles)) return []
    return cohort.circles
      .map((circle: any, index: number) => {
        if (typeof circle === 'string' && circle.trim() !== '') return (index + 1).toString()
        if (typeof circle === 'object' && circle !== null && circle.circle_whatsapp_link?.trim() !== '')
          return (index + 1).toString()
        return null
      })
      .filter((c): c is string => c !== null)
  }

  const findMainMemberByEmail = async (email: string | null | undefined): Promise<MainMember | null> => {
    if (!email?.trim()) return null
    const em = email.trim()
    const { data: exact } = await supabase.from('main_members').select('*').eq('email', em).maybeSingle()
    if (exact) return exact as MainMember
    const { data: rows } = await supabase.from('main_members').select('*').ilike('email', em)
    if (rows?.length) {
      const lower = em.toLowerCase()
      return (rows.find(r => r.email?.toLowerCase() === lower) || rows[0]) as MainMember
    }
    return null
  }

  const getNextSaIndexForCohort = async (cohortIdNum: number): Promise<number> => {
    const padded = cohortIdNum.toString().padStart(3, '0')
    const prefix = `SA/${padded}/`
    const { data } = await supabase.from('main_members').select('sanumber').like('sanumber', `${prefix}%`)
    let max = 0
    for (const row of data || []) {
      const sn = row.sanumber
      if (!sn?.startsWith(prefix)) continue
      const m = sn.match(/SA\/\d+\/(\d+)$/)
      if (m) max = Math.max(max, parseInt(m[1], 10))
    }
    return max + 1
  }

  const refreshCohortMemberCount = async (cohortId: number) => {
    try {
      const { data, error } = await supabase.from('main_members').select('id').eq('current_cohort_id', cohortId)
      if (error) throw error
      const total = data?.length ?? 0
      await supabase
        .from('current_cohort')
        .update({ member_count: total, updated_at: new Date().toISOString() })
        .eq('id', cohortId)
      setCohorts(prev => prev.map(c => (c.id === cohortId ? { ...c, member_count: total } : c)))
    } catch (e) {
      console.error('refreshCohortMemberCount', e)
    }
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
          current_cohort_id: mainMemberForm.current_cohort_id ? parseInt(mainMemberForm.current_cohort_id) : null
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
          current_cohort_id: mainMemberForm.current_cohort_id ? parseInt(mainMemberForm.current_cohort_id) : null
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

  type PromoteResult = {
    ok: boolean
    error?: string
    created?: MainMember
    updated?: MainMember
    oldCohortId?: number | null
  }

  const promoteSingleTasterMember = async (
    tasterMember: TasterMember,
    cohortIdNum: number,
    circleNumber: string,
    allocSaIndex: () => number
  ): Promise<PromoteResult> => {
    const paddedCohort = cohortIdNum.toString().padStart(3, '0')
    let existing = await findMainMemberByEmail(tasterMember.email)

    const waFromPhone = (phone: string | null | undefined) => {
      if (!phone) return ''
      const clean = phone.replace(/\D/g, '')
      return clean.length >= 10 ? `https://wa.me/${clean}` : ''
    }

    if (existing) {
      const idx = allocSaIndex()
      const paddedIndex = idx.toString().padStart(3, '0')
      const newSanumber = `SA/${paddedCohort}/${paddedIndex}`
      const prevs = [...(existing.prevsanumbers || [])]
      const oldSan = existing.sanumber
      if (oldSan && !prevs.includes(oldSan)) prevs.push(oldSan)

      const circle =
        circleNumber.trim() || (existing.circle_number ?? '') || ''

      const updates = {
        sanumber: newSanumber,
        circle_number: circle || null,
        isincurrentcohort: true,
        prevsanumbers: prevs,
        current_cohort_id: cohortIdNum,
        firstname: tasterMember.firstname ?? existing.firstname,
        lastname: tasterMember.lastname ?? existing.lastname,
        phonenumber: tasterMember.Confirm_Phone_number ?? existing.phonenumber,
        whatsapp:
          waFromPhone(tasterMember.Confirm_Phone_number) || existing.whatsapp || '',
        bio: existing.bio
          ? `${existing.bio}\nRe-enrolled from taster (SAT: ${tasterMember.satnumber})`
          : `Promoted from taster member (SAT: ${tasterMember.satnumber})`
      }

      const oldCohortId = existing.current_cohort_id
      const { data, error } = await supabase.from('main_members').update(updates).eq('id', existing.id).select()

      if (error) return { ok: false, error: error.message, oldCohortId }
      const row = data?.[0] as MainMember | undefined
      if (!row) return { ok: false, error: 'No row returned after update', oldCohortId }
      return { ok: true, updated: row, oldCohortId }
    }

    // No main_members row — create auth + insert (normal path)
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
      const msg = authError.message || ''
      if (/already registered|already been registered|User already registered/i.test(msg)) {
        existing = await findMainMemberByEmail(tasterMember.email)
        if (existing) {
          return promoteSingleTasterMember(tasterMember, cohortIdNum, circleNumber, allocSaIndex)
        }
      }
      return { ok: false, error: `Failed to create user account: ${authError.message}` }
    }

    if (!authData.user) {
      return { ok: false, error: 'Failed to create user account: No user data returned' }
    }

    const idx = allocSaIndex()
    const paddedIndex = idx.toString().padStart(3, '0')
    const sanumber = `SA/${paddedCohort}/${paddedIndex}`

    const mainMemberData = {
      id: authData.user.id,
      firstname: tasterMember.firstname,
      lastname: tasterMember.lastname,
      email: tasterMember.email,
      phonenumber: tasterMember.Confirm_Phone_number,
      whatsapp: waFromPhone(tasterMember.Confirm_Phone_number),
      bio: `Promoted from taster member (SAT: ${tasterMember.satnumber})`,
      fcmtoken: '',
      partnerid: '',
      repid: '',
      role: 'member',
      sanumber,
      status: 'active',
      circle_number: circleNumber.trim() || '',
      probationvisits: 0,
      plancreated: false,
      isincurrentcohort: true,
      prevsanumbers: [] as string[],
      previousgroups: [] as string[],
      current_cohort_id: cohortIdNum
    }

    let insertRetries = 0
    const maxInsertRetries = 5
    let insertSuccess = false
    let data: MainMember[] | null = null
    let lastErr: Error | null = null

    while (insertRetries < maxInsertRetries && !insertSuccess) {
      const result = await supabase.from('main_members').insert([mainMemberData]).select()
      if (result.error) {
        if (result.error.message.includes('foreign key constraint')) {
          await new Promise(r => setTimeout(r, 2000))
          insertRetries++
        } else {
          lastErr = result.error as Error
          break
        }
      } else {
        data = result.data as MainMember[]
        insertSuccess = true
      }
    }

    if (!insertSuccess && lastErr) return { ok: false, error: (lastErr as any).message }
    if (!data?.length) return { ok: false, error: 'Insert did not return a row' }

    return { ok: true, created: data[0] }
  }

  const runPromotionBatch = async (members: TasterMember[], cohortIdNum: number, circleNumber: string) => {
    const idxRef = { current: await getNextSaIndexForCohort(cohortIdNum) }
    const alloc = () => idxRef.current++

    const failed: { member: TasterMember; error: string }[] = []
    const cohortsToRefresh = new Set<number>([cohortIdNum])

    let nextMainState = [...mainMembers]

    for (const tm of members) {
      const res = await promoteSingleTasterMember(tm, cohortIdNum, circleNumber, alloc)
      if (!res.ok) {
        failed.push({ member: tm, error: res.error || 'Unknown error' })
        continue
      }
      if (res.updated) {
        if (res.oldCohortId && res.oldCohortId !== cohortIdNum) cohortsToRefresh.add(res.oldCohortId)
        nextMainState = nextMainState.map(m => (m.id === res.updated!.id ? { ...m, ...res.updated } : m))
        if (!nextMainState.some(m => m.id === res.updated!.id)) {
          nextMainState = [res.updated!, ...nextMainState]
        }
      }
      if (res.created) {
        nextMainState = [res.created, ...nextMainState.filter(m => m.id !== res.created!.id)]
      }
    }

    setMainMembers(nextMainState)

    for (const cid of cohortsToRefresh) {
      await refreshCohortMemberCount(cid)
    }

    try {
      const { data: tasterRows } = await supabase.from('taster_members').select('id').eq('current_cohort_id', cohortIdNum)
      const totalTaster = tasterRows?.length ?? 0
      await supabase
        .from('current_cohort')
        .update({ taster_member_count: totalTaster, updated_at: new Date().toISOString() })
        .eq('id', cohortIdNum)
    } catch (e) {
      console.error('taster count refresh', e)
    }

    return { failed, successCount: members.length - failed.length }
  }

  const openPromotionModal = (members: TasterMember[]) => {
    if (members.length === 0) return
    const defaultCohort =
      selectedCohort !== 'all'
        ? selectedCohort
        : members[0].current_cohort_id?.toString() || ''
    setPromotionCohortId(defaultCohort)
    const circles = getCircleOptionsForCohort(defaultCohort)
    setPromotionCircleNumber(circles[0] || '')
    setPromotionModal({ members })
  }

  const handlePromoteToMain = (tasterMember: TasterMember) => {
    openPromotionModal([tasterMember])
  }

  const handleBulkPromoteToMain = () => {
    if (qualifiedTasterMembers.length === 0) {
      setError('No qualified members to promote')
      return
    }
    openPromotionModal(qualifiedTasterMembers)
  }

  const confirmPromotion = async () => {
    if (!promotionModal) return
    const cohortIdNum = parseInt(promotionCohortId, 10)
    if (!promotionCohortId || Number.isNaN(cohortIdNum)) {
      setError('Select a target cohort for promotion.')
      return
    }

    const n = promotionModal.members.length
    const msg =
      n === 1
        ? `Promote ${promotionModal.members[0].firstname} ${promotionModal.members[0].lastname}? Existing main accounts will be updated with a new SA number for this cohort; new accounts will be created if none exist.`
        : `Promote ${n} qualified members? Existing main accounts will be updated; others will be created.`

    if (!confirm(msg)) return

    setSaving(true)
    setError('')
    try {
      const { failed, successCount } = await runPromotionBatch(
        promotionModal.members,
        cohortIdNum,
        promotionCircleNumber
      )
      setPromotionModal(null)
      let message = `Done: ${successCount} member(s) promoted or updated.`
      if (failed.length > 0) {
        message += `\n\nFailed (${failed.length}):\n`
        failed.forEach(f => {
          message += `- ${f.member.firstname} ${f.member.lastname}: ${f.error}\n`
        })
      }
      alert(message)
    } catch (e: any) {
      console.error(e)
      setError(e.message || 'Promotion failed')
    } finally {
      setSaving(false)
    }
  }

  const handleCircleClick = async (member: MainMember) => {
    if (!member.circle_number || !member.current_cohort_id) {
      setError('Circle information not available for this member')
      return
    }

    try {
      // Find the cohort
      const cohort = cohorts.find(c => c.id === member.current_cohort_id)
      if (!cohort || !cohort.circles || !Array.isArray(cohort.circles)) {
        setError('Circle configuration not found for this cohort')
        return
      }

      // Get the circle index (circle_number is 1-based, array is 0-based)
      const circleIndex = parseInt(member.circle_number) - 1
      const circle = cohort.circles[circleIndex]

      if (!circle) {
        setError(`Circle ${member.circle_number} not found in this cohort`)
        return
      }

      // Extract WhatsApp link from circle data
      let whatsappLink = ''
      if (typeof circle === 'string' && circle.trim() !== '') {
        whatsappLink = circle.trim()
      } else if (typeof circle === 'object' && circle !== null && circle.circle_whatsapp_link?.trim() !== '') {
        whatsappLink = circle.circle_whatsapp_link.trim()
      }

      if (!whatsappLink) {
        setError(`WhatsApp link not available for Circle ${member.circle_number}`)
        return
      }

      // Copy the WhatsApp link to clipboard
      await navigator.clipboard.writeText(whatsappLink)
      
      // Create WhatsApp contact link for the member
      let contactLink = ''
      if (member.phonenumber) {
        // Clean phone number (remove any non-digit characters except +)
        const cleanPhone = member.phonenumber.replace(/[^\d+]/g, '')
        contactLink = `https://wa.me/${cleanPhone}`
      } else if (member.whatsapp) {
        // Extract phone number from existing WhatsApp link
        const phoneMatch = member.whatsapp.match(/wa\.me\/(\d+)/)
        if (phoneMatch) {
          contactLink = `https://wa.me/${phoneMatch[1]}`
        }
      }

      if (contactLink) {
        // Open WhatsApp with the member's contact
        window.open(contactLink, '_blank')
        
        // Show success message
        setError('')
        alert(`Circle ${member.circle_number} WhatsApp link copied to clipboard!\n\nWhatsApp opened for ${member.firstname} ${member.lastname}.\n\nYou can now paste the circle group link to invite them to join.`)
      } else {
        // Just copy the link if no contact info available
        setError('')
        alert(`Circle ${member.circle_number} WhatsApp link copied to clipboard!\n\nMember contact information not available, but you can manually share the link.`)
      }
    } catch (error: any) {
      console.error('Error handling circle click:', error)
      setError(error.message || 'Failed to copy circle link')
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

  // CSV Upload Functions
  const parseCSV = (csvText: string) => {
    const lines = csvText.split('\n')
    const headers = lines[0].split(',').map(h => h.trim())
    const data = []

    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim()) {
        const values = lines[i].split(',').map(v => v.trim())
        const row: any = {}
        
        headers.forEach((header, index) => {
          row[header] = values[index] || ''
        })
        
        data.push(row)
      }
    }
    
    return data
  }

  const handleCsvFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type === 'text/csv') {
      setCsvFile(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        const csvText = e.target?.result as string
        const parsedData = parseCSV(csvText)
        setCsvData(parsedData)
      }
      reader.readAsText(file)
    } else {
      setError('Please select a valid CSV file')
    }
  }

  const handleBulkCreateMainMembers = async () => {
    if (csvData.length === 0) {
      setError('No data to process')
      return
    }

    if (!confirm(`Are you sure you want to create ${csvData.length} main members from the CSV file? This will create new accounts for all members.`)) return

    setCsvUploading(true)
    setError('')

    try {
      const createdMembers: MainMember[] = []
      const failedMembers: { member: any; error: string }[] = []

      for (const row of csvData) {
        // Extract data from CSV row
        const fullName = row['Name'] || ''
        const nameParts = fullName.split(' ')
        const firstname = nameParts[0] || ''
        const lastname = nameParts.slice(1).join(' ') || ''
        const email = row['Email'] || ''
        const phoneNumber = row['Phone Number'] || ''
        const satNumber = row['SAT Number'] || ''
        const volunteer = row['Volunteer'] || ''

        if (!email || !firstname) {
          failedMembers.push({ 
            member: row, 
            error: 'Missing required fields (email or name)' 
          })
          continue
        }

        try {

          // Create auth user for the main member
          const { data: authData, error: authError } = await supabase.auth.signUp({
            email: email,
            password: 'Adventure',
            options: {
              data: {
                first_name: firstname,
                last_name: lastname
              }
            }
          })

          if (authError) {
            console.error('Auth error for', firstname, authError)
            failedMembers.push({ member: row, error: authError.message })
            continue
          }

          if (!authData.user) {
            failedMembers.push({ member: row, error: 'No user data returned' })
            continue
          }

          // Generate SA number for the main member
          const cohortId = csvSelectedCohort
          const paddedCohort = cohortId.padStart(3, '0')
          const existingMembers = mainMembers.filter(m => m.sanumber?.startsWith(`SA/${paddedCohort}/`))
          const nextIndex: number = existingMembers.length + createdMembers.length + 1
          const paddedIndex: string = nextIndex.toString().padStart(3, '0')
          const sanumber: string = `SA/${paddedCohort}/${paddedIndex}`

          // Determine circle assignment - Random distribution
          let circleNumber = ''
          
          // Get available circles from cohort
          const cohort = cohorts.find(c => c.id?.toString() === cohortId)
          let availableCircles: string[] = []
          
          if (cohort && cohort.circles && Array.isArray(cohort.circles)) {
            availableCircles = cohort.circles
              .map((circle: any, index: number) => {
                // Handle both old format (string) and new format (object)
                if (typeof circle === 'string' && circle.trim() !== '') {
                  return (index + 1).toString() // Return just the number
                } else if (typeof circle === 'object' && circle !== null && circle.circle_whatsapp_link?.trim() !== '') {
                  return (index + 1).toString() // Return just the number
                }
                return null
              })
              .filter(circle => circle !== null) as string[]
          }
          
          if (availableCircles.length > 0) {
            // Randomly select a circle
            const randomIndex = Math.floor(Math.random() * availableCircles.length)
            circleNumber = availableCircles[randomIndex]
          } else {
            // Fallback: create circles dynamically if none exist
            const totalMembers = csvData.length
            const estimatedCircles = Math.ceil(totalMembers / 10)
            const randomCircleIndex = Math.floor(Math.random() * estimatedCircles) + 1
            circleNumber = randomCircleIndex.toString() // Store just the number
          }

          // Create main member data
          const mainMemberData: MainMember = {
            id: authData.user.id,
            firstname: firstname,
            lastname: lastname,
            email: email,
            phonenumber: phoneNumber,
            whatsapp: phoneNumber ? `https://wa.me/${phoneNumber}` : '',
            bio: `Created from CSV upload (Original SAT: ${satNumber})${volunteer ? ` | Volunteer: ${volunteer}` : ''}`,
            fcmtoken: '',
            partnerid: '',
            repid: '',
            role: 'member',
            sanumber,
            status: 'active',
            circle_number: circleNumber,
            probationvisits: 0,
            plancreated: false,
            isincurrentcohort: true,
            prevsanumbers: satNumber ? [satNumber] : [],
            previousgroups: [],
            current_cohort_id: parseInt(cohortId)
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
            console.error('Supabase error for', firstname, error)
            failedMembers.push({ member: row, error: error.message })
            continue
          }

          if (data && data.length > 0) {
            createdMembers.push(data[0])
          }
        } catch (error: any) {
          console.error('Error creating member', firstname, error)
          failedMembers.push({ member: row, error: error.message })
        }
      }

      // Update cohort member count
      if (createdMembers.length > 0) {
        try {
          const cohortId = parseInt(csvSelectedCohort)
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

          // Update local cohorts state
          setCohorts(prev => 
            prev.map(cohort => 
              cohort.id === cohortId
                ? { ...cohort, member_count: totalMainMembers }
                : cohort
            )
          )
        } catch (error) {
          console.error('Error updating cohort member count:', error)
        }
      }

      // Show results
      let message = `Successfully created ${createdMembers.length} main members!`
      if (failedMembers.length > 0) {
        message += `\n\nFailed to create ${failedMembers.length} members:\n`
        failedMembers.forEach(failed => {
          message += `- ${failed.member['Name'] || 'Unknown'}: ${failed.error}\n`
        })
      }
      
      alert(message)
      
      // Add all created members to main members list
      if (createdMembers.length > 0) {
        setMainMembers(prev => [...createdMembers, ...prev])
      }

      // Reset CSV upload state
      setCsvData([])
      setCsvFile(null)
      setShowCsvUpload(false)
      setCsvSelectedCohort('8')
    } catch (error: any) {
      console.error('Error in bulk CSV creation:', error)
      setError(error.message || 'Failed to create members from CSV')
    } finally {
      setCsvUploading(false)
    }
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
      member.circle_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (member.circle_number ? `circle ${member.circle_number}`.toLowerCase().includes(searchQuery.toLowerCase()) : false)
    
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
    const isQualified = (member.total_submission || 0) >= 3 && member.sermon_submitted
    if (!isQualified) return false

    // Hide if a main member with this email is already on the same cohort as this taster row
    const main = mainMembers.find(
      m => m.email?.toLowerCase() === member.email?.toLowerCase()
    )
    if (
      main &&
      main.current_cohort_id != null &&
      member.current_cohort_id != null &&
      main.current_cohort_id === member.current_cohort_id
    ) {
      return false
    }

    return true
  })

  /** When a cohort is selected, main tab lists members in that cohort — all visible rows can be bulk-updated */
  const bulkSelectableMainMembers =
    selectedCohort !== 'all' ? filteredMainMembers : []

  const getExistingMainForTasterEmail = (email: string | null | undefined) =>
    mainMembers.find(m => m.email?.toLowerCase() === email?.toLowerCase())

  const toggleMainMemberSelected = (id: string) => {
    setMainMemberSelection(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const selectAllBulkSelectableMainMembers = () => {
    setMainMemberSelection(new Set(bulkSelectableMainMembers.map(m => m.id)))
  }

  const clearMainMemberSelection = () => setMainMemberSelection(new Set())

  const applySetCurrentCohortFlag = async (ids: string[], value: boolean) => {
    if (ids.length === 0) {
      setError('No members selected.')
      return
    }
    if (
      !confirm(
        `Set isincurrentcohort to ${value ? 'true' : 'false'} for ${ids.length} member(s)?`
      )
    )
      return

    setBulkNotCurrentSaving(true)
    setError('')
    try {
      const { data: updatedRows, error } = await supabase
        .from('main_members')
        .update({ isincurrentcohort: value })
        .in('id', ids)
        .select('id')

      if (error) throw error
      const n = updatedRows?.length ?? 0
      if (n === 0) {
        setError(
          'No rows were updated. Check Supabase RLS policies allow updating isincurrentcohort on main_members for your admin user.'
        )
        return
      }

      setMainMembers(prev => prev.map(m => (ids.includes(m.id) ? { ...m, isincurrentcohort: value } : m)))
      clearMainMemberSelection()
      alert(`Updated isincurrentcohort to ${value ? 'true' : 'false'} for ${n} member(s).`)
    } catch (e: any) {
      setError(e.message || 'Update failed')
    } finally {
      setBulkNotCurrentSaving(false)
    }
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
                onClick={() => setShowCsvUpload(true)}
                className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 flex items-center"
              >
                <Upload className="h-5 w-5 mr-2" />
                Upload CSV
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
              placeholder={`Search ${activeTab === 'main' ? 'main' : 'taster'} members by name, email, number, role, circle...`}
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
            <div className="px-6 py-4 border-b border-gray-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h3 className="text-lg font-medium text-gray-900">Main Members</h3>
                {selectedCohort !== 'all' && (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-gray-600">
                      <strong>{bulkSelectableMainMembers.length}</strong> main member
                      {bulkSelectableMainMembers.length !== 1 ? 's' : ''} in this list — set{' '}
                      <code className="text-xs bg-gray-100 px-1 rounded">isincurrentcohort</code> to{' '}
                      <strong>true or false</strong> for selected rows
                    </span>
                    <button
                      type="button"
                      onClick={selectAllBulkSelectableMainMembers}
                      disabled={bulkSelectableMainMembers.length === 0}
                      className="text-primary-600 hover:text-primary-800 font-medium disabled:opacity-40"
                    >
                      Select all in list
                    </button>
                    <button
                      type="button"
                      onClick={clearMainMemberSelection}
                      className="text-gray-600 hover:text-gray-800"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      disabled={mainMemberSelection.size === 0 || bulkNotCurrentSaving}
                      onClick={() => applySetCurrentCohortFlag(Array.from(mainMemberSelection), true)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium"
                    >
                      {bulkNotCurrentSaving
                        ? 'Updating…'
                        : `Set true (${mainMemberSelection.size} selected)`}
                    </button>
                    <button
                      type="button"
                      disabled={mainMemberSelection.size === 0 || bulkNotCurrentSaving}
                      onClick={() => applySetCurrentCohortFlag(Array.from(mainMemberSelection), false)}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 text-sm font-medium"
                    >
                      {bulkNotCurrentSaving
                        ? 'Updating…'
                        : `Set false (${mainMemberSelection.size} selected)`}
                    </button>
                    <button
                      type="button"
                      disabled={bulkNotCurrentSaving || bulkSelectableMainMembers.length === 0}
                      onClick={() =>
                        applySetCurrentCohortFlag(bulkSelectableMainMembers.map(m => m.id), true)
                      }
                      className="px-3 py-1.5 rounded-lg border border-emerald-600 text-emerald-800 hover:bg-emerald-50 text-sm font-medium disabled:opacity-50"
                    >
                      Set true for all ({bulkSelectableMainMembers.length})
                    </button>
                    <button
                      type="button"
                      disabled={bulkNotCurrentSaving || bulkSelectableMainMembers.length === 0}
                      onClick={() =>
                        applySetCurrentCohortFlag(bulkSelectableMainMembers.map(m => m.id), false)
                      }
                      className="px-3 py-1.5 rounded-lg border border-amber-600 text-amber-800 hover:bg-amber-50 text-sm font-medium disabled:opacity-50"
                    >
                      Set false for all ({bulkSelectableMainMembers.length})
                    </button>
                  </div>
                )}
              </div>
              {selectedCohort !== 'all' && (
                <p className="text-xs text-gray-500">
                  Pick a cohort in the filter above, then use the checkboxes (or <strong>Select all in list</strong>) and
                  confirm to update Supabase. Search narrows who appears in the list.
                </p>
              )}
            </div>
            <div className="overflow-x-auto">
              {filteredMainMembers.length > 0 ? (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {selectedCohort !== 'all' && (
                        <th className="px-3 py-3 w-12 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <button
                            type="button"
                            onClick={() => {
                              const ids = new Set(bulkSelectableMainMembers.map(m => m.id))
                              const allSelected =
                                bulkSelectableMainMembers.length > 0 &&
                                bulkSelectableMainMembers.every(m => mainMemberSelection.has(m.id))
                              if (allSelected) clearMainMemberSelection()
                              else setMainMemberSelection(ids)
                            }}
                            className="text-primary-600 hover:text-primary-800 text-xs font-medium"
                            title="Select or deselect all rows in this list"
                          >
                            {bulkSelectableMainMembers.length > 0 &&
                            bulkSelectableMainMembers.every(m => mainMemberSelection.has(m.id))
                              ? 'Deselect'
                              : 'All'}
                          </button>
                        </th>
                      )}
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
                        Circle
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
                        {selectedCohort !== 'all' && (
                          <td className="px-3 py-4 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => toggleMainMemberSelected(member.id)}
                              className="text-gray-600 hover:text-primary-600"
                              title="Select for bulk: set isincurrentcohort to false"
                            >
                              {mainMemberSelection.has(member.id) ? (
                                <CheckSquare className="h-5 w-5 text-primary-600" />
                              ) : (
                                <Square className="h-5 w-5" />
                              )}
                            </button>
                          </td>
                        )}
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
                          <div className="text-sm font-medium">
                            {member.circle_number ? (
                              <button
                                onClick={() => handleCircleClick(member)}
                                className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-colors"
                                title="Click to copy circle WhatsApp link and open WhatsApp"
                              >
                                Circle {member.circle_number}
                              </button>
                            ) : (
                              <span className="text-gray-500">-</span>
                            )}
                          </div>
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
                                title={
                                  mainMembers.some(
                                    m => m.email?.toLowerCase() === member.email?.toLowerCase()
                                  )
                                    ? 'Re-enroll / update existing main member'
                                    : 'Promote to main (new account)'
                                }
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
                        Main account
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
                    {qualifiedTasterMembers.map((member) => {
                      const existingMain = getExistingMainForTasterEmail(member.email)
                      return (
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
                          {existingMain ? (
                            <div className="text-xs">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full font-medium bg-indigo-100 text-indigo-800">
                                Existing
                              </span>
                              <div className="text-gray-600 mt-1 font-mono">{existingMain.sanumber || '—'}</div>
                            </div>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                              New
                            </span>
                          )}
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
                              title={
                                existingMain
                                  ? 'Re-enroll: update existing main member (new SA, cohort, circle)'
                                  : 'Promote: create new main member'
                              }
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
                    )})}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-12">
                  <UserCheck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No qualified members found</h3>
                  <p className="text-gray-600 mb-4">
                    {searchQuery 
                      ? `No qualified members match your search "${searchQuery}". Try adjusting your search terms.`
                      : 'No taster members have met the qualification criteria yet (3+ submissions and sermon submitted). Returning members with an existing main account will appear here too once qualified.'
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
                              circle_number: '' // Reset circle number when cohort changes
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
                              circle_number: circleNumber
                            }))
                          }}
                          className="input-field"
                          disabled={!mainMemberForm.current_cohort_id || availableCircles.length === 0}
                        >
                          <option value="">Select Circle</option>
                          {availableCircles.map((circle) => (
                            <option key={circle} value={circle}>
                              Circle {circle}
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

        {/* CSV Upload Modal */}
        {showCsvUpload && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" style={{zIndex: 9999}}>
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold">Upload CSV for Main Members</h3>
                  <button
                    onClick={() => {
                      setShowCsvUpload(false)
                      setCsvFile(null)
                      setCsvData([])
                      setCsvSelectedCohort('8')
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* CSV Format Instructions */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-2">CSV Format Requirements:</h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• CSV must have headers: Name, Phone Number, SAT Number, Email, Birthday, Volunteer</li>
                      <li>• Name field will be split into firstname and lastname</li>
                      <li>• Phone Number will be used for WhatsApp link generation</li>
                      <li>• SAT Number will be stored in previous SA numbers</li>
                      <li>• Members will be assigned to the selected cohort</li>
                      <li>• SA numbers will be auto-generated (SA/XXX/XXX)</li>
                      <li>• Circle assignment will be random across available circles</li>
                    </ul>
                  </div>

                  {/* Cohort Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Assign to Cohort *
                    </label>
                    <select
                      value={csvSelectedCohort}
                      onChange={(e) => setCsvSelectedCohort(e.target.value)}
                      className="input-field"
                    >
                      {cohorts.map((cohort) => (
                        <option key={cohort.id} value={cohort.id?.toString()}>
                          {cohort.nomenclature || `Cohort ${cohort.id}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Circle Assignment Info */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="font-medium text-green-900 mb-2">Circle Assignment:</h4>
                    <p className="text-sm text-green-800">
                      Members will be randomly distributed across available circles in the selected cohort. 
                      Circle WhatsApp links will be automatically assigned from the cohort's circle configuration.
                    </p>
                  </div>

                  {/* File Upload */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select CSV File *
                    </label>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleCsvFileChange}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    {csvFile && (
                      <p className="text-sm text-green-600 mt-2">
                        ✓ Selected: {csvFile.name}
                      </p>
                    )}
                  </div>

                  {/* CSV Preview */}
                  {csvData.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Preview ({csvData.length} members):</h4>
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="max-h-60 overflow-y-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">SAT</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Circle</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {csvData.slice(0, 10).map((row, index) => {
                                // Calculate random circle assignment for preview
                                let circleNumber = ''
                                const cohort = cohorts.find(c => c.id?.toString() === csvSelectedCohort)
                                let availableCircles: string[] = []
                                
                                if (cohort && cohort.circles && Array.isArray(cohort.circles)) {
                                  availableCircles = cohort.circles
                                    .map((circle: any, circleIndex: number) => {
                                      // Handle both old format (string) and new format (object)
                                      if (typeof circle === 'string' && circle.trim() !== '') {
                                        return (circleIndex + 1).toString() // Return just the number
                                      } else if (typeof circle === 'object' && circle !== null && circle.circle_whatsapp_link?.trim() !== '') {
                                        return (circleIndex + 1).toString() // Return just the number
                                      }
                                      return null
                                    })
                                    .filter(circle => circle !== null) as string[]
                                }
                                
                                if (availableCircles.length > 0) {
                                  // Use a deterministic "random" based on index for preview consistency
                                  const randomIndex = index % availableCircles.length
                                  circleNumber = availableCircles[randomIndex]
                                } else {
                                  // Fallback: estimate circles based on total members
                                  const totalMembers = csvData.length
                                  const estimatedCircles = Math.ceil(totalMembers / 10)
                                  const randomCircleIndex = (index % estimatedCircles) + 1
                                  circleNumber = randomCircleIndex.toString() // Store just the number
                                }
                                
                                return (
                                  <tr key={index}>
                                    <td className="px-3 py-2 text-sm text-gray-900">{row['Name'] || '-'}</td>
                                    <td className="px-3 py-2 text-sm text-gray-900">{row['Email'] || '-'}</td>
                                    <td className="px-3 py-2 text-sm text-gray-900">{row['Phone Number'] || '-'}</td>
                                    <td className="px-3 py-2 text-sm text-gray-900">{row['SAT Number'] || '-'}</td>
                                    <td className="px-3 py-2 text-sm text-blue-600 font-medium">Circle {circleNumber}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                          {csvData.length > 10 && (
                            <div className="px-3 py-2 text-sm text-gray-500 bg-gray-50">
                              ... and {csvData.length - 10} more members
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex justify-end space-x-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCsvUpload(false)
                        setCsvFile(null)
                        setCsvData([])
                        setCsvSelectedCohort('8')
                      }}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleBulkCreateMainMembers}
                      disabled={csvData.length === 0 || csvUploading}
                      className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50 flex items-center"
                    >
                      {csvUploading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Creating...
                        </>
                      ) : (
                        <>
                          <FileText className="h-4 w-4 mr-2" />
                          Create {csvData.length} Members
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {promotionModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[10000]">
            <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Promote to main ({promotionModal.members.length}{' '}
                {promotionModal.members.length === 1 ? 'member' : 'members'})
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Pick the cohort for the new SA number (e.g. SA/009/012). If a main member with the same email
                already exists, their row is updated (previous SA appended to prevsanumbers); otherwise a new account
                is created.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target cohort</label>
                  <select
                    value={promotionCohortId}
                    onChange={(e) => {
                      const v = e.target.value
                      setPromotionCohortId(v)
                      const opts = getCircleOptionsForCohort(v)
                      setPromotionCircleNumber(opts[0] || '')
                    }}
                    className="input-field w-full"
                  >
                    <option value="">Select cohort…</option>
                    {cohorts.map(c => (
                      <option key={c.id} value={c.id?.toString() || ''}>
                        {c.nomenclature || `Cohort ${c.id}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Circle number</label>
                  <select
                    value={promotionCircleNumber}
                    onChange={(e) => setPromotionCircleNumber(e.target.value)}
                    className="input-field w-full"
                  >
                    <option value="">None — keep existing when updating</option>
                    {getCircleOptionsForCohort(promotionCohortId).map(num => (
                      <option key={num} value={num}>
                        Circle {num}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => !saving && setPromotionModal(null)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={confirmPromotion}
                  disabled={saving || !promotionCohortId}
                >
                  {saving ? 'Working…' : 'Confirm promotion'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default MemberManagement
