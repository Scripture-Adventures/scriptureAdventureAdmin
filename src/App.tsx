import React from 'react'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Admin from './components/Admin'

function App() {
  return (
    <AuthProvider>
      <ProtectedRoute>
        <Admin />
      </ProtectedRoute>
    </AuthProvider>
  )
}

export default App
