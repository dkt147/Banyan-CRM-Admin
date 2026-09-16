import React from "react";
import { Routes, Route } from "react-router-dom";
import AppShell from "./components/AppShell";
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
export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/inbox" element={<Inbox />} />
        <Route path="/pipelines" element={<Pipelines />} />
        <Route path="/deal" element={<Deal />} />
        <Route path="/contact" element={<Contacts />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/agreements" element={<Agreements />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/members" element={<Members />} />
        <Route path="/loyalty" element={<Loyalty />} />
        <Route path="/automation" element={<Automation />} />
        <Route path="*" element={<Dashboard />} />
      </Routes>
    </AppShell>
  );
}
