import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';

// Pages
import Login from './pages/Login';
import Books from './pages/author/Books';
import NewTicket from './pages/author/NewTicket';
import AuthorTickets from './pages/author/Tickets';
import AuthorTicketDetail from './pages/author/TicketDetail';
import AdminQueue from './pages/admin/Queue';
import AdminTicketDetail from './pages/admin/TicketDetail';

/** Layout wrapper that renders Navbar above child routes */
function WithNavbar() {
  return (
    <>
      <Navbar />
      <Outlet />
    </>
  );
}

function AppShell() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <Routes>
      {/* Public */}
      <Route
        path="/login"
        element={
          user
            ? <Navigate to={user.role === 'admin' ? '/admin' : '/tickets'} replace />
            : <Login />
        }
      />

      {/* Author routes — nested under ProtectedRoute+Navbar layout */}
      <Route
        element={
          <ProtectedRoute role="author">
            <WithNavbar />
          </ProtectedRoute>
        }
      >
        <Route path="/tickets" element={<AuthorTickets />} />
        <Route path="/tickets/new" element={<NewTicket />} />
        <Route path="/tickets/:id" element={<AuthorTicketDetail />} />
        <Route path="/books" element={<Books />} />
      </Route>

      {/* Admin routes — nested under ProtectedRoute+Navbar layout */}
      <Route
        element={
          <ProtectedRoute role="admin">
            <WithNavbar />
          </ProtectedRoute>
        }
      >
        <Route path="/admin" element={<AdminQueue />} />
        <Route path="/admin/tickets/:id" element={<AdminTicketDetail />} />
      </Route>

      {/* Root redirect */}
      <Route
        path="/"
        element={
          !user
            ? <Navigate to="/login" replace />
            : user.role === 'admin'
              ? <Navigate to="/admin" replace />
              : <Navigate to="/tickets" replace />
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppShell />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
