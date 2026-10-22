import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import '../../css/Joenet.css';

const tabClass = ({ isActive }) => `joenet-tab${isActive ? ' joenet-tab--active' : ''}`;

/** Layout for /joenet: page title, sub-tab bar, and the routed sub-page. */
function Joenet() {
  return (
    <div className="joenet-container">
      <h1 className="joenet-title">Joenet</h1>
      <nav className="joenet-tabs" aria-label="Joenet sections">
        <NavLink to="/joenet" end className={tabClass}>
          Overview
        </NavLink>
        <NavLink to="/joenet/admin" className={tabClass}>
          Admin Panel
        </NavLink>
      </nav>
      <Outlet />
    </div>
  );
}

export default Joenet;
