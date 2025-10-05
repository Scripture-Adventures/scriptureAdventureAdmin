import React, { useState } from 'react'
import Dashboard from './Dashboard'
import CohortManagement from './CohortManagement'
import MemberManagement from './MemberManagement'
import PlansManagement from './PlansManagement'
import { ArrowLeft } from 'lucide-react'

type View = 'dashboard' | 'cohorts' | 'members' | 'plans'

const Admin: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('dashboard')

  const navigateToCohorts = () => setCurrentView('cohorts')
  const navigateToMembers = () => setCurrentView('members')
  const navigateToPlans = () => setCurrentView('plans')
  const navigateToDashboard = () => setCurrentView('dashboard')

  if (currentView === 'cohorts') {
    return (
      <div>
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-16">
              <button
                onClick={navigateToDashboard}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors mr-4"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
        <CohortManagement />
      </div>
    )
  }

  if (currentView === 'members') {
    return (
      <div>
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-16">
              <button
                onClick={navigateToDashboard}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors mr-4"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
        <MemberManagement />
      </div>
    )
  }

  if (currentView === 'plans') {
    return (
      <div>
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-16">
              <button
                onClick={navigateToDashboard}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors mr-4"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
        <PlansManagement />
      </div>
    )
  }

  return <Dashboard onNavigateToCohorts={navigateToCohorts} onNavigateToMembers={navigateToMembers} onNavigateToPlans={navigateToPlans} />
}

export default Admin
