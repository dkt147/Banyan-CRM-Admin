import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Tasks from "./pages/Tasks";
import Inbox from "./pages/Inbox";
import Pipelines from "./pages/Pipelines";
import Deal from "./pages/Deal";
import Contacts from "./pages/Contacts";
import Templates from "./pages/Templates";
import Calendar from "./pages/Calendar";
import Agreements from "./pages/Agreements";
import Invoices from "./pages/Invoices";
import Members from "./pages/Members";
import Loyalty from "./pages/Loyalty";
import Automation from "./pages/Automation";
import Companies from "./pages/Companies";
import Activities from "./pages/Activities";
import Memberships from "./pages/Memberships";
import Payments from "./pages/Payments";
import Documents from "./pages/Documents";
import AuditLogs from "./pages/AuditLogs";
import Integrations from "./pages/Integrations";
import Notifications from "./pages/Notifications";
import Workspace from "./pages/Workspace";

function CRMRoutes() {
  return (
    <ProtectedRoute>
      <AppShell>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/pipelines" element={<Pipelines />} />
          <Route path="/deal" element={<Deal />} />
          <Route path="/contact" element={<Contacts />} />
          <Route path="/companies" element={<Companies />} />
          <Route path="/activities" element={<Activities />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/agreements" element={<Agreements />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/members" element={<Members />} />
          <Route path="/memberships" element={<Memberships />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/loyalty" element={<Loyalty />} />
          <Route path="/automation" element={<Automation />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/integrations" element={<Integrations />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/audit-logs" element={<AuditLogs />} />
          <Route path="/workspace" element={<Workspace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AppShell>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="*" element={<CRMRoutes />} />
    </Routes>
  );
}
