import React, { useEffect, useMemo, useState } from "react";



import { Page, Empty } from "./Dashboard";



import Badge from "../components/Badge";



import Modal from "../components/Modal";



import { useAuth } from "../auth/AuthContext";







const PLAN_DEFAULT_FORM = {



  name: "",



  type: "membership",



  description: "",



  price: 0,



  currency: "HKD",



  billingInterval: "monthly",



  features: [],



  isActive: true,



};







const MEMBERSHIP_DEFAULT_FORM = {



  contactId: "",



  companyId: "",



  planId: "",



  memberCode: "",



  startAt: "",



  renewalAt: "",



  status: "active",



  monthlyValue: 0,



  currency: "HKD",



  seats: 1,



  riskLevel: "low",



  notes: "",



};







const PLAN_INTERVALS = ["monthly", "quarterly", "yearly", "one-time"];







const MEMBERSHIP_STATUSES = ["active", "paused", "cancelled", "expired"];







const RISK_LEVELS = ["low", "medium", "high"];







function formatMoney(value, currency = "HKD") {



  return `${currency} ${Number(value || 0).toLocaleString()}`;



}







function formatDate(value) {



  if (!value) return "—";







  const date = new Date(value);







  if (Number.isNaN(date.getTime())) {



    return "—";



  }







  return date.toLocaleDateString(undefined, {



    year: "numeric",



    month: "short",



    day: "numeric",



  });



}







function formatDateTime(value) {



  if (!value) return "—";







  const date = new Date(value);







  if (Number.isNaN(date.getTime())) {



    return "—";



  }







  return date.toLocaleString();



}







function toInputDateTime(value) {



  if (!value) return "";







  const date = new Date(value);







  if (Number.isNaN(date.getTime())) {



    return "";



  }







  const offset = date.getTimezoneOffset();



  const local = new Date(date.getTime() - offset * 60 * 1000);







  return local.toISOString().slice(0, 16);



}







function toISOStringOrNull(value) {



  if (!value) return null;







  const date = new Date(value);







  if (Number.isNaN(date.getTime())) {



    return null;



  }







  return date.toISOString();



}







function getContactName(contact) {



  if (!contact) return "—";







  return (



    contact.fullName ||



    `${contact.firstName || ""} ${contact.lastName || ""}`.trim() ||



    contact.email ||



    contact._id ||



    "—"



  );



}







function getCompanyName(company) {



  if (!company) return "—";







  return company.name || company.legalName || company._id || "—";



}







function getPlanName(plan) {



  if (!plan) return "—";







  return plan.name || plan._id || "—";



}







function statusTone(status) {



  switch (status) {



    case "active":



      return "success";







    case "paused":



      return "warn";







    case "cancelled":



    case "expired":



      return "warn";







    default:



      return "";



  }



}







function riskTone(risk) {



  switch (risk) {



    case "low":



      return "success";







    case "medium":



      return "warn";







    case "high":



      return "warn";







    default:



      return "";



  }



}









function getItems(response) {

  const candidates = [

    response?.data?.items,

    response?.items,

    response?.data?.data?.items,

    response?.data?.contacts,

    response?.data?.companies,

    response?.data?.results,

    response?.results,

    Array.isArray(response?.data) ? response.data : null,

    Array.isArray(response) ? response : null,

  ];



  return candidates.find(Array.isArray) || [];

}



export default function Membership() {



  const { request } = useAuth();







  const [tab, setTab] = useState("plans");







  const [plans, setPlans] = useState([]);



  const [memberships, setMemberships] = useState([]);







  const [planPagination, setPlanPagination] = useState({



    page: 1,



    limit: 25,



    total: 0,



    pages: 1,



  });







  const [membershipPagination, setMembershipPagination] = useState({



    page: 1,



    limit: 25,



    total: 0,



    pages: 1,



  });







  const [planFilters, setPlanFilters] = useState({



    search: "",



    isActive: "",



    billingInterval: "",



  });







  const [membershipFilters, setMembershipFilters] = useState({



    status: "",



    planId: "",



    riskLevel: "",



  });







  const [planModal, setPlanModal] = useState(false);



  const [membershipModal, setMembershipModal] = useState(false);



  const [detailsModal, setDetailsModal] = useState(false);







  const [editingPlan, setEditingPlan] = useState(null);



  const [editingMembership, setEditingMembership] = useState(null);







  const [selectedDetails, setSelectedDetails] = useState(null);



  const [detailsType, setDetailsType] = useState(null);







  const [planForm, setPlanForm] = useState(PLAN_DEFAULT_FORM);



  const [membershipForm, setMembershipForm] = useState(MEMBERSHIP_DEFAULT_FORM);







  const [featureInput, setFeatureInput] = useState("");







  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [dropdownsLoading, setDropdownsLoading] = useState(false);



  const [detailsLoading, setDetailsLoading] = useState(false);







  const [error, setError] = useState("");







  /*



   * ============================================================



   * MEMBERSHIP PLANS



   * ============================================================



   */







  async function loadPlans(page = 1) {



    try {



      setLoading(true);



      setError("");







      const query = {



        page,



        limit: 25,



        sort: "name",



        order: "asc",



      };







      if (planFilters.isActive !== "") {



        query.isActive = planFilters.isActive;



      }







      if (planFilters.billingInterval) {



        query.billingInterval = planFilters.billingInterval;



      }







      /*



       * The API you provided does not document a search parameter.



       * Therefore search is performed client-side below.



       */







      const response = await request("/membership-plans", {



        query,



      });







      setPlans(response.data?.items || []);







      setPlanPagination(



        response.data?.pagination || {



          page,



          limit: 25,



          total: response.data?.items?.length || 0,



          pages: 1,



        },



      );



    } catch (e) {



      setError(e.message || "Failed to load membership plans.");



    } finally {



      setLoading(false);



    }



  }







  async function createPlan() {



    try {



      setError("");







      const payload = {



        ...planForm,



        price: Number(planForm.price) || 0,



        features: planForm.features || [],



        isActive: Boolean(planForm.isActive),



      };







      if (!payload.name.trim()) {



        setError("Plan name is required.");



        return;



      }







      await request("/membership-plans", {



        method: "POST",



        body: payload,



      });







      closePlanModal();



      await loadPlans(planPagination.page);



    } catch (e) {



      setError(e.message || "Failed to create membership plan.");



    }



  }







  async function updatePlan() {



    if (!editingPlan?._id) return;







    try {



      setError("");







      const payload = {



        ...planForm,



        price: Number(planForm.price) || 0,



        features: planForm.features || [],



        isActive: Boolean(planForm.isActive),



      };







      await request(`/membership-plans/${editingPlan._id}`, {



        method: "PATCH",



        body: payload,



      });







      closePlanModal();



      await loadPlans(planPagination.page);



    } catch (e) {



      setError(e.message || "Failed to update membership plan.");



    }



  }







  async function deletePlan(plan) {



    if (!plan?._id) return;







    const confirmed = window.confirm(



      `Delete membership plan "${plan.name}"?\n\nThis action cannot be undone.`,



    );







    if (!confirmed) return;







    try {



      setError("");







      await request(`/membership-plans/${plan._id}`, {



        method: "DELETE",



      });







      await loadPlans(planPagination.page);



    } catch (e) {



      setError(e.message || "Failed to delete membership plan.");



    }



  }







  async function openPlanDetails(plan) {



    if (!plan?._id) return;







    try {



      setDetailsLoading(true);



      setError("");







      const response = await request(`/membership-plans/${plan._id}`);







      setSelectedDetails(response.data);



      setDetailsType("plan");



      setDetailsModal(true);



    } catch (e) {



      setError(e.message || "Failed to load plan details.");



    } finally {



      setDetailsLoading(false);



    }



  }







  function openCreatePlan() {



    setEditingPlan(null);



    setPlanForm(PLAN_DEFAULT_FORM);



    setFeatureInput("");



    setPlanModal(true);



  }







  function openEditPlan(plan) {



    setEditingPlan(plan);







    setPlanForm({



      name: plan.name || "",



      type: plan.type || "membership",



      description: plan.description || "",



      price: plan.price ?? 0,



      currency: plan.currency || "HKD",



      billingInterval: plan.billingInterval || "monthly",



      features: Array.isArray(plan.features) ? plan.features : [],



      isActive: Boolean(plan.isActive),



    });







    setFeatureInput("");



    setPlanModal(true);



  }







  function closePlanModal() {



    setPlanModal(false);



    setEditingPlan(null);



    setFeatureInput("");



  }







  function addFeature() {



    const value = featureInput.trim();







    if (!value) return;







    setPlanForm((prev) => ({



      ...prev,



      features: [...(prev.features || []), value],



    }));







    setFeatureInput("");



  }







  function removeFeature(index) {



    setPlanForm((prev) => ({



      ...prev,



      features: prev.features.filter((_, i) => i !== index),



    }));



  }







  /*



   * ============================================================



   * MEMBERSHIPS



   * ============================================================



   */








  async function loadDropdowns() {
    try {
      setDropdownsLoading(true);

      const [contactsResponse, companiesResponse] = await Promise.all([
        request("/contacts", {
          query: { page: 1, limit: 100 },
        }),
        request("/companies", {
          query: { page: 1, limit: 100 },
        }),
      ]);

      setContacts(getItems(contactsResponse));
      setCompanies(getItems(companiesResponse));
    } catch (e) {
      setError(e.message || "Failed to load contacts and companies.");
      setContacts([]);
      setCompanies([]);
    } finally {
      setDropdownsLoading(false);
    }
  }

  async function loadMemberships(page = 1) {



    try {



      setLoading(true);



      setError("");







      const query = {



        page,



        limit: 25,



        sort: "renewalAt",



        order: "asc",



      };







      if (membershipFilters.status) {



        query.status = membershipFilters.status;



      }







      if (membershipFilters.planId) {



        query.planId = membershipFilters.planId;



      }







      if (membershipFilters.riskLevel) {



        query.riskLevel = membershipFilters.riskLevel;



      }







      const response = await request("/memberships", {



        query,



      });







      setMemberships(response.data?.items || []);







      setMembershipPagination(



        response.data?.pagination || {



          page,



          limit: 25,



          total: response.data?.items?.length || 0,



          pages: 1,



        },



      );



    } catch (e) {



      setError(e.message || "Failed to load memberships.");



    } finally {



      setLoading(false);



    }



  }







  async function createMembership() {



    try {



      setError("");







      if (!membershipForm.contactId.trim()) {



        setError("Contact ID is required.");



        return;



      }







      if (!membershipForm.companyId.trim()) {



        setError("Company ID is required.");



        return;



      }







      if (!membershipForm.planId) {



        setError("Membership plan is required.");



        return;



      }







      if (!membershipForm.memberCode.trim()) {



        setError("Member code is required.");



        return;



      }







      const payload = {



        contactId: membershipForm.contactId.trim(),



        companyId: membershipForm.companyId.trim(),



        planId: membershipForm.planId,



        memberCode: membershipForm.memberCode.trim(),



        startAt: toISOStringOrNull(membershipForm.startAt),



        renewalAt: toISOStringOrNull(membershipForm.renewalAt),



        status: membershipForm.status,



        monthlyValue: Number(membershipForm.monthlyValue) || 0,



        currency: membershipForm.currency,



        seats: Number(membershipForm.seats) || 1,



        riskLevel: membershipForm.riskLevel,



        notes: membershipForm.notes,



        metadata: {},



      };







      await request("/memberships", {



        method: "POST",



        body: payload,



      });







      closeMembershipModal();



      await loadMemberships(membershipPagination.page);



    } catch (e) {



      setError(e.message || "Failed to create membership.");



    }



  }







  async function updateMembership() {



    if (!editingMembership?._id) return;







    try {



      setError("");







      const payload = {



        contactId: membershipForm.contactId.trim(),



        companyId: membershipForm.companyId.trim(),



        planId: membershipForm.planId,



        memberCode: membershipForm.memberCode.trim(),



        startAt: toISOStringOrNull(membershipForm.startAt),



        renewalAt: toISOStringOrNull(membershipForm.renewalAt),



        status: membershipForm.status,



        monthlyValue: Number(membershipForm.monthlyValue) || 0,



        currency: membershipForm.currency,



        seats: Number(membershipForm.seats) || 1,



        riskLevel: membershipForm.riskLevel,



        notes: membershipForm.notes,



        metadata: {},



      };







      await request(`/memberships/${editingMembership._id}`, {



        method: "PATCH",



        body: payload,



      });







      closeMembershipModal();



      await loadMemberships(membershipPagination.page);



    } catch (e) {



      setError(e.message || "Failed to update membership.");



    }



  }







  async function deleteMembership(membership) {



    if (!membership?._id) return;







    const memberName =



      membership.memberCode ||



      getContactName(membership.contactId) ||



      "this membership";







    const confirmed = window.confirm(



      `Delete membership "${memberName}"?\n\nThis action cannot be undone.`,



    );







    if (!confirmed) return;







    try {



      setError("");







      await request(`/memberships/${membership._id}`, {



        method: "DELETE",



      });







      await loadMemberships(membershipPagination.page);



    } catch (e) {



      setError(e.message || "Failed to delete membership.");



    }



  }







  async function openMembershipDetails(membership) {



    if (!membership?._id) return;







    try {



      setDetailsLoading(true);



      setError("");







      const response = await request(`/memberships/${membership._id}`);







      setSelectedDetails(response.data);



      setDetailsType("membership");



      setDetailsModal(true);



    } catch (e) {



      setError(e.message || "Failed to load membership details.");



    } finally {



      setDetailsLoading(false);



    }



  }







  function openCreateMembership() {



    setEditingMembership(null);







    setMembershipForm({



      ...MEMBERSHIP_DEFAULT_FORM,



      planId: plans[0]?._id || "",



    });







    setMembershipModal(true);



  }







  function openEditMembership(membership) {



    setEditingMembership(membership);







    setMembershipForm({



      contactId:



        typeof membership.contactId === "object"



          ? membership.contactId?._id || ""



          : membership.contactId || "",







      companyId:



        typeof membership.companyId === "object"



          ? membership.companyId?._id || ""



          : membership.companyId || "",







      planId:



        typeof membership.planId === "object"



          ? membership.planId?._id || ""



          : membership.planId || "",







      memberCode: membership.memberCode || "",







      startAt: toInputDateTime(membership.startAt),







      renewalAt: toInputDateTime(membership.renewalAt),







      status: membership.status || "active",







      monthlyValue: membership.monthlyValue ?? 0,







      currency: membership.currency || "HKD",







      seats: membership.seats ?? 1,







      riskLevel: membership.riskLevel || "low",







      notes: membership.notes || "",



    });







    setMembershipModal(true);



  }







  function closeMembershipModal() {



    setMembershipModal(false);



    setEditingMembership(null);



  }







  /*



   * ============================================================



   * INITIAL LOAD



   * ============================================================



   */







  useEffect(() => {



    loadPlans(1);



    loadMemberships(1);
    loadDropdowns();



  }, []);







  /*



   * ============================================================



   * FILTERED PLANS



   * ============================================================



   */







  const visiblePlans = useMemo(() => {



    const search = planFilters.search.trim().toLowerCase();







    if (!search) return plans;







    return plans.filter((plan) => {



      return (



        plan.name?.toLowerCase().includes(search) ||



        plan.description?.toLowerCase().includes(search) ||



        plan.type?.toLowerCase().includes(search)



      );



    });



  }, [plans, planFilters.search]);







  /*



   * ============================================================



   * METRICS



   * ============================================================



   */







  const activePlans = plans.filter((x) => x.isActive).length;







  const activeMemberships = memberships.filter(



    (x) => x.status === "active",



  ).length;







  const totalMonthlyValue = memberships.reduce(



    (sum, item) => sum + Number(item.monthlyValue || 0),



    0,



  );







  const highRiskMemberships = memberships.filter(



    (x) => x.riskLevel === "high",



  ).length;







  return (



    <Page



      title="Memberships"



      kicker="Plans, members, billing and renewal management"



      actions={



        <div className="page-actions">



          {tab === "plans" ? (



            <button className="btn primary" onClick={openCreatePlan}>



              + Create plan



            </button>



          ) : (



            <button



              className="btn primary"



              onClick={openCreateMembership}



              disabled={plans.length === 0}



            >



              + Add member



            </button>



          )}



        </div>



      }



    >



      {error && (



        <div className="notice error">



          <b>Memberships</b>



          <span>{error}</span>



          <button



            className="btn ghost"



            onClick={() => setError("")}



            type="button"



          >



            Dismiss



          </button>



        </div>



      )}







      {/* ======================================================



          TOP METRICS



      ======================================================= */}







      <div className="metrics five">



        <MetricX



          label="Membership plans"



          value={planPagination.total || plans.length}



        />







        <MetricX label="Active plans" value={activePlans} />







        <MetricX



          label="Active memberships"



          value={



            membershipPagination.total



              ? membershipPagination.total



              : memberships.length



          }



        />







        <MetricX



          label="Monthly value"



          value={formatMoney(totalMonthlyValue, "HKD")}



        />







        <MetricX label="High risk" value={highRiskMemberships} />



      </div>







      {/* ======================================================



          TABS



      ======================================================= */}







      <div



        className="panel"



        style={{



          padding: 0,



          marginBottom: 16,



          overflow: "hidden",



        }}



      >



        <div



          style={{



            display: "flex",



            alignItems: "center",



            gap: 4,



            padding: 8,



            borderBottom: "1px solid var(--border, #e5e7eb)",



          }}



        >



          <button



            type="button"



            className={`btn ${tab === "plans" ? "primary" : "ghost"}`}



            onClick={() => setTab("plans")}



          >



            Membership Plans



            <span style={{ marginLeft: 6 }}>



              ({planPagination.total || plans.length})



            </span>



          </button>







          <button



            type="button"



            className={`btn ${tab === "memberships" ? "primary" : "ghost"}`}



            onClick={() => setTab("memberships")}



          >



            Members



            <span style={{ marginLeft: 6 }}>



              ({membershipPagination.total || memberships.length})



            </span>



          </button>



        </div>



      </div>







      {/* ======================================================



          PLANS TAB



      ======================================================= */}







      {tab === "plans" && (



        <>



          <section className="panel" style={{ marginBottom: 16 }}>



            <div className="form-grid">



              <label>



                Search plans



                <input



                  placeholder="Search by name or description..."



                  value={planFilters.search}



                  onChange={(e) =>



                    setPlanFilters((prev) => ({



                      ...prev,



                      search: e.target.value,



                    }))



                  }



                />



              </label>







              <label>



                Status



                <select



                  value={planFilters.isActive}



                  onChange={(e) => {



                    setPlanFilters((prev) => ({



                      ...prev,



                      isActive: e.target.value,



                    }));



                  }}



                >



                  <option value="">All statuses</option>



                  <option value="true">Active</option>



                  <option value="false">Inactive</option>



                </select>



              </label>







              <label>



                Billing interval



                <select



                  value={planFilters.billingInterval}



                  onChange={(e) => {



                    setPlanFilters((prev) => ({



                      ...prev,



                      billingInterval: e.target.value,



                    }));



                  }}



                >



                  <option value="">All intervals</option>







                  {PLAN_INTERVALS.map((interval) => (



                    <option key={interval} value={interval}>



                      {interval}



                    </option>



                  ))}



                </select>



              </label>







              <div



                style={{



                  display: "flex",



                  alignItems: "flex-end",



                }}



              >



                <button



                  className="btn ghost"



                  type="button"



                  onClick={() => {



                    setPlanFilters({



                      search: "",



                      isActive: "",



                      billingInterval: "",



                    });







                    setTimeout(() => loadPlans(1), 0);



                  }}



                >



                  Reset filters



                </button>



              </div>



            </div>







            <div



              style={{



                display: "flex",



                justifyContent: "flex-end",



                marginTop: 12,



              }}



            >



              <button



                className="btn ghost"



                type="button"



                onClick={() => loadPlans(1)}



                disabled={loading}



              >



                {loading ? "Loading..." : "Apply filters"}



              </button>



            </div>



          </section>







          <section className="panel table-wrap">



            <table>



              <thead>



                <tr>



                  <th>Plan</th>



                  <th>Price</th>



                  <th>Billing</th>



                  <th>Features</th>



                  <th>Status</th>



                  <th>Updated</th>



                  <th style={{ width: 220 }}>Actions</th>



                </tr>



              </thead>







              <tbody>



                {visiblePlans.map((plan) => (



                  <tr key={plan._id}>



                    <td>



                      <div>



                        <b>{plan.name}</b>







                        {plan.description && (



                          <span



                            style={{



                              display: "block",



                              marginTop: 3,



                              opacity: 0.7,



                            }}



                          >



                            {plan.description}



                          </span>



                        )}



                      </div>



                    </td>







                    <td>



                      <b>{formatMoney(plan.price, plan.currency)}</b>



                    </td>







                    <td>



                      <span style={{ textTransform: "capitalize" }}>



                        {plan.billingInterval || "—"}



                      </span>



                    </td>







                    <td>



                      {Array.isArray(plan.features) &&



                      plan.features.length > 0 ? (



                        <div



                          style={{



                            display: "flex",



                            flexWrap: "wrap",



                            gap: 4,



                          }}



                        >



                          {plan.features.slice(0, 2).map((feature, index) => (



                            <span



                              key={`${feature}-${index}`}



                              style={{



                                fontSize: 12,



                                padding: "4px 7px",



                                borderRadius: 6,



                                background: "var(--surface-2, #f3f4f6)",



                              }}



                            >



                              {feature}



                            </span>



                          ))}







                          {plan.features.length > 2 && (



                            <span



                              style={{



                                fontSize: 12,



                                opacity: 0.65,



                              }}



                            >



                              +{plan.features.length - 2} more



                            </span>



                          )}



                        </div>



                      ) : (



                        "—"



                      )}



                    </td>







                    <td>



                      <Badge tone={plan.isActive ? "success" : "warn"}>



                        {plan.isActive ? "Active" : "Inactive"}



                      </Badge>



                    </td>







                    <td>{formatDate(plan.updatedAt)}</td>







                    <td>



                      <div



                        style={{



                          display: "flex",



                          gap: 6,



                          flexWrap: "wrap",



                        }}



                      >



                        <button



                          className="btn ghost"



                          type="button"



                          onClick={() => openPlanDetails(plan)}



                        >



                          View



                        </button>







                        <button



                          className="btn ghost"



                          type="button"



                          onClick={() => openEditPlan(plan)}



                        >



                          Edit



                        </button>







                        <button



                          className="btn ghost"



                          type="button"



                          onClick={() => deletePlan(plan)}



                        >



                          Delete



                        </button>



                      </div>



                    </td>



                  </tr>



                ))}



              </tbody>



            </table>







            {visiblePlans.length === 0 && (



              <Empty text="No membership plans found." />



            )}







            <Pagination



              pagination={planPagination}



              onChange={(page) => loadPlans(page)}



            />



          </section>



        </>



      )}







      {/* ======================================================



          MEMBERSHIPS TAB



      ======================================================= */}







      {tab === "memberships" && (



        <>



          <section className="panel" style={{ marginBottom: 16 }}>



            <div className="form-grid">



              <label>



                Status



                <select



                  value={membershipFilters.status}



                  onChange={(e) =>



                    setMembershipFilters((prev) => ({



                      ...prev,



                      status: e.target.value,



                    }))



                  }



                >



                  <option value="">All statuses</option>







                  {MEMBERSHIP_STATUSES.map((status) => (



                    <option key={status} value={status}>



                      {status}



                    </option>



                  ))}



                </select>



              </label>







              <label>



                Membership plan



                <select



                  value={membershipFilters.planId}



                  onChange={(e) =>



                    setMembershipFilters((prev) => ({



                      ...prev,



                      planId: e.target.value,



                    }))



                  }



                >



                  <option value="">All plans</option>







                  {plans.map((plan) => (



                    <option key={plan._id} value={plan._id}>



                      {plan.name}



                    </option>



                  ))}



                </select>



              </label>







              <label>



                Risk level



                <select



                  value={membershipFilters.riskLevel}



                  onChange={(e) =>



                    setMembershipFilters((prev) => ({



                      ...prev,



                      riskLevel: e.target.value,



                    }))



                  }



                >



                  <option value="">All risk levels</option>







                  {RISK_LEVELS.map((risk) => (



                    <option key={risk} value={risk}>



                      {risk}



                    </option>



                  ))}



                </select>



              </label>







              <div



                style={{



                  display: "flex",



                  alignItems: "flex-end",



                  gap: 8,



                }}



              >



                <button



                  className="btn primary"



                  type="button"



                  onClick={() => loadMemberships(1)}



                  disabled={loading}



                >



                  {loading ? "Loading..." : "Apply filters"}



                </button>







                <button



                  className="btn ghost"



                  type="button"



                  onClick={() => {



                    setMembershipFilters({



                      status: "",



                      planId: "",



                      riskLevel: "",



                    });







                    setTimeout(() => loadMemberships(1), 0);



                  }}



                >



                  Reset



                </button>



              </div>



            </div>



          </section>







          <section className="panel table-wrap">



            <table>



              <thead>



                <tr>



                  <th>Member</th>



                  <th>Contact / Company</th>



                  <th>Plan</th>



                  <th>Value</th>



                  <th>Renewal</th>



                  <th>Status</th>



                  <th>Risk</th>



                  <th style={{ width: 220 }}>Actions</th>



                </tr>



              </thead>







              <tbody>



                {memberships.map((membership) => {



                  const contact = membership.contactId;



                  const company = membership.companyId;



                  const plan = membership.planId;







                  return (



                    <tr key={membership._id}>



                      <td>



                        <b>{membership.memberCode || "—"}</b>







                        <span



                          style={{



                            display: "block",



                            marginTop: 3,



                            opacity: 0.65,



                            fontSize: 12,



                          }}



                        >



                          {membership.seats || 1} seat



                          {Number(membership.seats || 1) !== 1 ? "s" : ""}



                        </span>



                      </td>







                      <td>



                        <div>



                          <b>{getContactName(contact)}</b>







                          <span



                            style={{



                              display: "block",



                              marginTop: 3,



                              opacity: 0.7,



                            }}



                          >



                            {getCompanyName(company)}



                          </span>



                        </div>



                      </td>







                      <td>



                        <b>{getPlanName(plan)}</b>







                        {plan?.billingInterval && (



                          <span



                            style={{



                              display: "block",



                              marginTop: 3,



                              opacity: 0.65,



                              fontSize: 12,



                            }}



                          >



                            {plan.billingInterval}



                          </span>



                        )}



                      </td>







                      <td>



                        <b>



                          {formatMoney(



                            membership.monthlyValue,



                            membership.currency,



                          )}



                        </b>







                        <span



                          style={{



                            display: "block",



                            marginTop: 3,



                            opacity: 0.65,



                            fontSize: 12,



                          }}



                        >



                          / month



                        </span>



                      </td>







                      <td>



                        <b>{formatDate(membership.renewalAt)}</b>







                        <span



                          style={{



                            display: "block",



                            marginTop: 3,



                            opacity: 0.65,



                            fontSize: 12,



                          }}



                        >



                          Started {formatDate(membership.startAt)}



                        </span>



                      </td>







                      <td>



                        <Badge tone={statusTone(membership.status)}>



                          {membership.status || "unknown"}



                        </Badge>



                      </td>







                      <td>



                        <Badge tone={riskTone(membership.riskLevel)}>



                          {membership.riskLevel || "—"}



                        </Badge>



                      </td>







                      <td>



                        <div



                          style={{



                            display: "flex",



                            gap: 6,



                            flexWrap: "wrap",



                          }}



                        >



                          <button



                            className="btn ghost"



                            type="button"



                            onClick={() => openMembershipDetails(membership)}



                          >



                            View



                          </button>







                          <button



                            className="btn ghost"



                            type="button"



                            onClick={() => openEditMembership(membership)}



                          >



                            Edit



                          </button>







                          <button



                            className="btn ghost"



                            type="button"



                            onClick={() => deleteMembership(membership)}



                          >



                            Delete



                          </button>



                        </div>



                      </td>



                    </tr>



                  );



                })}



              </tbody>



            </table>







            {memberships.length === 0 && <Empty text="No memberships found." />}







            <Pagination



              pagination={membershipPagination}



              onChange={(page) => loadMemberships(page)}



            />



          </section>



        </>



      )}







      {/* ======================================================



          PLAN CREATE / EDIT MODAL



      ======================================================= */}







      {planModal && (



        <Modal



          title={



            editingPlan ? "Edit membership plan" : "Create membership plan"



          }



          onClose={closePlanModal}



          actions={



            <>



              <button



                className="btn ghost"



                type="button"



                onClick={closePlanModal}



              >



                Cancel



              </button>







              <button



                className="btn primary"



                type="button"



                onClick={editingPlan ? updatePlan : createPlan}



              >



                {editingPlan ? "Save changes" : "Create plan"}



              </button>



            </>



          }



        >



          <div className="form-grid">



            <label>



              Plan name *



              <input



                value={planForm.name}



                placeholder="e.g. Premium Membership"



                onChange={(e) =>



                  setPlanForm((prev) => ({



                    ...prev,



                    name: e.target.value,



                  }))



                }



              />



            </label>







            <label>



              Type



              <input



                value={planForm.type}



                onChange={(e) =>



                  setPlanForm((prev) => ({



                    ...prev,



                    type: e.target.value,



                  }))



                }



              />



            </label>



          </div>







          <label>



            Description



            <textarea



              rows={3}



              value={planForm.description}



              placeholder="Describe what this plan includes..."



              onChange={(e) =>



                setPlanForm((prev) => ({



                  ...prev,



                  description: e.target.value,



                }))



              }



            />



          </label>







          <div className="form-grid">



            <label>



              Price *



              <input



                type="number"



                min="0"



                value={planForm.price}



                onChange={(e) =>



                  setPlanForm((prev) => ({



                    ...prev,



                    price: e.target.value,



                  }))



                }



              />



            </label>







            <label>



              Currency



              <input



                value={planForm.currency}



                onChange={(e) =>



                  setPlanForm((prev) => ({



                    ...prev,



                    currency: e.target.value.toUpperCase(),



                  }))



                }



              />



            </label>







            <label>



              Billing interval



              <select



                value={planForm.billingInterval}



                onChange={(e) =>



                  setPlanForm((prev) => ({



                    ...prev,



                    billingInterval: e.target.value,



                  }))



                }



              >



                {PLAN_INTERVALS.map((interval) => (



                  <option key={interval} value={interval}>



                    {interval}



                  </option>



                ))}



              </select>



            </label>







            <label>



              Status



              <select



                value={planForm.isActive ? "active" : "inactive"}



                onChange={(e) =>



                  setPlanForm((prev) => ({



                    ...prev,



                    isActive: e.target.value === "active",



                  }))



                }



              >



                <option value="active">Active</option>



                <option value="inactive">Inactive</option>



              </select>



            </label>



          </div>







          <div style={{ marginTop: 14 }}>



            <label>Features</label>







            <div



              style={{



                display: "flex",



                gap: 8,



                marginTop: 6,



              }}



            >



              <input



                style={{ flex: 1 }}



                value={featureInput}



                placeholder="e.g. Meeting room access"



                onChange={(e) => setFeatureInput(e.target.value)}



                onKeyDown={(e) => {



                  if (e.key === "Enter") {



                    e.preventDefault();



                    addFeature();



                  }



                }}



              />







              <button className="btn ghost" type="button" onClick={addFeature}>



                Add



              </button>



            </div>







            <div



              style={{



                display: "flex",



                flexWrap: "wrap",



                gap: 8,



                marginTop: 10,



              }}



            >



              {(planForm.features || []).map((feature, index) => (



                <div



                  key={`${feature}-${index}`}



                  style={{



                    display: "flex",



                    alignItems: "center",



                    gap: 6,



                    padding: "6px 9px",



                    borderRadius: 8,



                    background: "var(--surface-2, #f3f4f6)",



                  }}



                >



                  <span>{feature}</span>







                  <button



                    type="button"



                    className="btn ghost"



                    style={{



                      padding: "2px 5px",



                      minHeight: 0,



                    }}



                    onClick={() => removeFeature(index)}



                  >



                    ×



                  </button>



                </div>



              ))}







              {planForm.features?.length === 0 && (



                <span style={{ opacity: 0.6 }}>No features added yet.</span>



              )}



            </div>



          </div>



        </Modal>



      )}







      {/* ======================================================



          MEMBERSHIP CREATE / EDIT MODAL



      ======================================================= */}







      {membershipModal && (



        <Modal



          title={editingMembership ? "Edit membership" : "Create membership"}



          onClose={closeMembershipModal}



          actions={



            <>



              <button



                className="btn ghost"



                type="button"



                onClick={closeMembershipModal}



              >



                Cancel



              </button>







              <button



                className="btn primary"



                type="button"



                onClick={



                  editingMembership ? updateMembership : createMembership



                }



              >



                {editingMembership ? "Save changes" : "Create membership"}



              </button>



            </>



          }



        >











          <div className="form-grid">



            <label>

              Contact *

              <select

                value={membershipForm.contactId}

                onChange={(e) =>

                  setMembershipForm((prev) => ({

                    ...prev,

                    contactId: e.target.value,

                  }))

                }

                disabled={dropdownsLoading}

              >

                <option value="">

                  {dropdownsLoading ? "Loading contacts..." : "Select contact"}

                </option>

                {contacts.map((contact) => {

                  const id = contact?._id || contact?.id;

                  if (!id) return null;



                  return (

                    <option key={id} value={id}>

                      {getContactName(contact)}

                    </option>

                  );

                })}

              </select>

            </label>





            <label>

              Company *

              <select

                value={membershipForm.companyId}

                onChange={(e) =>

                  setMembershipForm((prev) => ({

                    ...prev,

                    companyId: e.target.value,

                  }))

                }

                disabled={dropdownsLoading}

              >

                <option value="">

                  {dropdownsLoading ? "Loading companies..." : "Select company"}

                </option>

                {companies.map((company) => {

                  const id = company?._id || company?.id;

                  if (!id) return null;



                  return (

                    <option key={id} value={id}>

                      {getCompanyName(company)}

                    </option>

                  );

                })}

              </select>

            </label>



          </div>







          <div className="form-grid">



            <label>



              Membership plan *



              <select



                value={membershipForm.planId}



                onChange={(e) =>



                  setMembershipForm((prev) => ({



                    ...prev,



                    planId: e.target.value,



                  }))



                }



              >



                <option value="">Select a plan</option>







                {plans.map((plan) => (



                  <option key={plan._id} value={plan._id}>



                    {plan.name} — {formatMoney(plan.price, plan.currency)}



                  </option>



                ))}



              </select>



            </label>







            <label>



              Member code *



              <input



                value={membershipForm.memberCode}



                placeholder="MEM-001"



                onChange={(e) =>



                  setMembershipForm((prev) => ({



                    ...prev,



                    memberCode: e.target.value,



                  }))



                }



              />



            </label>



          </div>







          <div className="form-grid">



            <label>



              Start date *



              <input



                type="datetime-local"



                value={membershipForm.startAt}



                onChange={(e) =>



                  setMembershipForm((prev) => ({



                    ...prev,



                    startAt: e.target.value,



                  }))



                }



              />



            </label>







            <label>



              Renewal date *



              <input



                type="datetime-local"



                value={membershipForm.renewalAt}



                onChange={(e) =>



                  setMembershipForm((prev) => ({



                    ...prev,



                    renewalAt: e.target.value,



                  }))



                }



              />



            </label>



          </div>







          <div className="form-grid">



            <label>



              Status



              <select



                value={membershipForm.status}



                onChange={(e) =>



                  setMembershipForm((prev) => ({



                    ...prev,



                    status: e.target.value,



                  }))



                }



              >



                {MEMBERSHIP_STATUSES.map((status) => (



                  <option key={status} value={status}>



                    {status}



                  </option>



                ))}



              </select>



            </label>







            <label>



              Risk level



              <select



                value={membershipForm.riskLevel}



                onChange={(e) =>



                  setMembershipForm((prev) => ({



                    ...prev,



                    riskLevel: e.target.value,



                  }))



                }



              >



                {RISK_LEVELS.map((risk) => (



                  <option key={risk} value={risk}>



                    {risk}



                  </option>



                ))}



              </select>



            </label>



          </div>







          <div className="form-grid">



            <label>



              Monthly value



              <input



                type="number"



                min="0"



                value={membershipForm.monthlyValue}



                onChange={(e) =>



                  setMembershipForm((prev) => ({



                    ...prev,



                    monthlyValue: e.target.value,



                  }))



                }



              />



            </label>







            <label>



              Currency



              <input



                value={membershipForm.currency}



                onChange={(e) =>



                  setMembershipForm((prev) => ({



                    ...prev,



                    currency: e.target.value.toUpperCase(),



                  }))



                }



              />



            </label>







            <label>



              Seats



              <input



                type="number"



                min="1"



                value={membershipForm.seats}



                onChange={(e) =>



                  setMembershipForm((prev) => ({



                    ...prev,



                    seats: e.target.value,



                  }))



                }



              />



            </label>



          </div>







          <label>



            Notes



            <textarea



              rows={4}



              value={membershipForm.notes}



              placeholder="Membership notes..."



              onChange={(e) =>



                setMembershipForm((prev) => ({



                  ...prev,



                  notes: e.target.value,



                }))



              }



            />



          </label>



        </Modal>



      )}







      {/* ======================================================



          DETAILS MODAL



      ======================================================= */}







      {detailsModal && (



        <Modal



          title={



            detailsType === "plan"



              ? "Membership plan details"



              : "Membership details"



          }



          onClose={() => {



            setDetailsModal(false);



            setSelectedDetails(null);



          }}



          actions={



            <button



              className="btn ghost"



              type="button"



              onClick={() => {



                setDetailsModal(false);



                setSelectedDetails(null);



              }}



            >



              Close



            </button>



          }



        >



          {detailsLoading && <div>Loading details...</div>}







          {!detailsLoading && selectedDetails && detailsType === "plan" && (



            <PlanDetails plan={selectedDetails} />



          )}







          {!detailsLoading &&



            selectedDetails &&



            detailsType === "membership" && (



              <MembershipDetails membership={selectedDetails} />



            )}



        </Modal>



      )}



    </Page>



  );



}







/*



 * ============================================================



 * PLAN DETAILS



 * ============================================================



 */







function PlanDetails({ plan }) {



  return (



    <div>



      <div



        style={{



          display: "flex",



          justifyContent: "space-between",



          gap: 16,



          alignItems: "flex-start",



          marginBottom: 20,



        }}



      >



        <div>



          <h2 style={{ margin: 0 }}>{plan.name}</h2>







          <p style={{ marginTop: 6, opacity: 0.7 }}>



            {plan.description || "No description provided."}



          </p>



        </div>







        <Badge tone={plan.isActive ? "success" : "warn"}>



          {plan.isActive ? "Active" : "Inactive"}



        </Badge>



      </div>







      <div className="metrics four">



        <MetricX label="Price" value={formatMoney(plan.price, plan.currency)} />







        <MetricX label="Billing" value={plan.billingInterval || "—"} />







        <MetricX label="Type" value={plan.type || "—"} />







        <MetricX label="Features" value={plan.features?.length || 0} />



      </div>







      <div



        style={{



          marginTop: 20,



        }}



      >



        <h4>Features</h4>







        {Array.isArray(plan.features) && plan.features.length > 0 ? (



          <ul>



            {plan.features.map((feature, index) => (



              <li key={`${feature}-${index}`}>{feature}</li>



            ))}



          </ul>



        ) : (



          <span style={{ opacity: 0.6 }}>No features configured.</span>



        )}



      </div>







      <div



        style={{



          marginTop: 20,



          paddingTop: 16,



          borderTop: "1px solid var(--border, #e5e7eb)",



          fontSize: 13,



          opacity: 0.7,



        }}



      >



        <div>



          <b>ID:</b> {plan._id}



        </div>







        <div>



          <b>Created:</b> {formatDateTime(plan.createdAt)}



        </div>







        <div>



          <b>Updated:</b> {formatDateTime(plan.updatedAt)}



        </div>



      </div>



    </div>



  );



}







/*



 * ============================================================



 * MEMBERSHIP DETAILS



 * ============================================================



 */







function MembershipDetails({ membership }) {



  const contact = membership.contactId;



  const company = membership.companyId;



  const plan = membership.planId;







  return (



    <div>



      <div



        style={{



          display: "flex",



          justifyContent: "space-between",



          gap: 16,



          alignItems: "flex-start",



          marginBottom: 20,



        }}



      >



        <div>



          <div



            style={{



              fontSize: 13,



              opacity: 0.6,



              marginBottom: 5,



            }}



          >



            Member code



          </div>







          <h2 style={{ margin: 0 }}>{membership.memberCode || "Membership"}</h2>



        </div>







        <div



          style={{



            display: "flex",



            gap: 8,



            flexWrap: "wrap",



          }}



        >



          <Badge tone={statusTone(membership.status)}>



            {membership.status || "unknown"}



          </Badge>







          <Badge tone={riskTone(membership.riskLevel)}>



            {membership.riskLevel || "—"} risk



          </Badge>



        </div>



      </div>







      <div className="metrics four">



        <MetricX



          label="Monthly value"



          value={formatMoney(membership.monthlyValue, membership.currency)}



        />







        <MetricX label="Seats" value={membership.seats || 1} />







        <MetricX label="Start" value={formatDate(membership.startAt)} />







        <MetricX label="Renewal" value={formatDate(membership.renewalAt)} />



      </div>







      <div



        className="form-grid"



        style={{



          marginTop: 20,



        }}



      >



        <InfoItem label="Contact" value={getContactName(contact)} />







        <InfoItem label="Email" value={contact?.email || "—"} />







        <InfoItem label="Company" value={getCompanyName(company)} />







        <InfoItem label="Plan" value={getPlanName(plan)} />



      </div>







      <div



        style={{



          marginTop: 20,



        }}



      >



        <h4>Notes</h4>







        <div



          style={{



            padding: 12,



            borderRadius: 8,



            background: "var(--surface-2, #f5f5f5)",



          }}



        >



          {membership.notes || "No notes added."}



        </div>



      </div>







      <div



        style={{



          marginTop: 20,



          paddingTop: 16,



          borderTop: "1px solid var(--border, #e5e7eb)",



          fontSize: 13,



          opacity: 0.7,



        }}



      >



        <div>



          <b>Membership ID:</b> {membership._id}



        </div>







        <div>



          <b>Contact ID:</b>{" "}



          {typeof contact === "object" ? contact?._id : contact || "—"}



        </div>







        <div>



          <b>Company ID:</b>{" "}



          {typeof company === "object" ? company?._id : company || "—"}



        </div>







        <div>



          <b>Plan ID:</b> {typeof plan === "object" ? plan?._id : plan || "—"}



        </div>







        <div>



          <b>Created:</b> {formatDateTime(membership.createdAt)}



        </div>







        <div>



          <b>Updated:</b> {formatDateTime(membership.updatedAt)}



        </div>



      </div>



    </div>



  );



}







/*



 * ============================================================



 * SMALL COMPONENTS



 * ============================================================



 */







function MetricX({ label, value }) {



  return (



    <div className="metric">



      <span className="eyebrow">{label}</span>



      <strong>{value}</strong>



    </div>



  );



}







function InfoItem({ label, value }) {



  return (



    <div>



      <div



        style={{



          fontSize: 12,



          opacity: 0.6,



          marginBottom: 4,



        }}



      >



        {label}



      </div>







      <div>



        <b>{value}</b>



      </div>



    </div>



  );



}







function Pagination({ pagination, onChange }) {



  if (!pagination || pagination.pages <= 1) {



    return null;



  }







  const currentPage = pagination.page || 1;



  const totalPages = pagination.pages || 1;







  return (



    <div



      style={{



        display: "flex",



        justifyContent: "space-between",



        alignItems: "center",



        gap: 12,



        paddingTop: 16,



      }}



    >



      <span style={{ opacity: 0.65, fontSize: 13 }}>



        Page {currentPage} of {totalPages} · {pagination.total || 0} total



      </span>







      <div



        style={{



          display: "flex",



          gap: 6,



        }}



      >



        <button



          className="btn ghost"



          type="button"



          disabled={currentPage <= 1}



          onClick={() => onChange(currentPage - 1)}



        >



          Previous



        </button>







        <button



          className="btn ghost"



          type="button"



          disabled={currentPage >= totalPages}



          onClick={() => onChange(currentPage + 1)}



        >



          Next



        </button>



      </div>



    </div>



  );



}
