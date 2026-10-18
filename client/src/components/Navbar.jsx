import React from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const isAdmin = user?.role === 'admin';

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to={isAdmin ? '/admin' : '/tickets'} className="navbar-logo">
          📖 BookLeaf<span> Support</span>
        </Link>

        <div className="navbar-links">
          {isAdmin ? (
            <NavLink to="/admin" className={({ isActive }) => 'navbar-link' + (isActive ? ' active' : '')}>
              Ticket Queue
            </NavLink>
          ) : (
            <>
              <NavLink to="/tickets" className={({ isActive }) => 'navbar-link' + (isActive ? ' active' : '')}>
                My Tickets
              </NavLink>
              <NavLink to="/tickets/new" className={({ isActive }) => 'navbar-link' + (isActive ? ' active' : '')}>
                New Ticket
              </NavLink>
              <NavLink to="/books" className={({ isActive }) => 'navbar-link' + (isActive ? ' active' : '')}>
                My Books
              </NavLink>
            </>
          )}
        </div>

        <div className="navbar-user">
          <span className="navbar-username">{user?.name}</span>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
