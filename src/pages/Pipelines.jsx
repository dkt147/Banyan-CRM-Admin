import React, { useEffect, useMemo, useState } from "react";
import { Page, SectionTitle, Empty } from "./Dashboard";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import { useAuth } from "../auth/AuthContext";

const blankPipeline = {
  name: "",
  key: "",
  description: "",
  isActive: true,
  sortOrder: 0,
};

const blankStage = {
  name: "",
  key: "",
  sortOrder: 0,
  probability: 0,
  isClosedWon: false,
  isClosedLost: false,
  isActive: true,
};

const blankDeal = {
  title: "",
  contactId: "",
  companyId: "",
  value: "",
  productType: "membership",
  source: "website",
};

const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const errMsg = (error) => error?.message || "Something went wrong.";

const PIPELINE_STYLES = `
  .pipeline-page-search {
    margin-bottom: 16px;
  }

  .pipeline-search-form {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .pipeline-search-form input[type="text"],
  .pipeline-search-form input:not([type]) {
    min-width: 260px;
  }

  .pipeline-active-filter {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    white-space: nowrap;
  }

  .pipeline-tabs {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding: 2px 2px 10px;
    scrollbar-width: thin;
  }

  .pipeline-tabs button {
    flex: 0 0 auto;
    white-space: nowrap;
  }

  .pipeline-pagination,
  .deal-pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12px;
    margin: 14px 0;
  }

  .pipeline-pagination-info,
  .deal-pagination-info {
    font-size: 13px;
    color: #666;
    white-space: nowrap;
  }

  .pipeline-summary {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 16px;
    padding: 12px 14px;
    border: 1px solid #e5e5e5;
    border-radius: 10px;
    background: #fff;
  }

  .pipeline-summary > b {
    font-size: 14px;
  }

  .pipeline-summary > span {
    font-size: 13px;
    color: #666;
    padding-right: 4px;
  }

  .pipeline-summary .btn {
    margin-left: 2px;
  }

  .pipeline-kanban-scroll {
    width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 4px 2px 16px;
    scrollbar-width: thin;
    scrollbar-color: #aaa #f1f1f1;
  }

  .pipeline-kanban-scroll::-webkit-scrollbar {
    height: 9px;
  }

  .pipeline-kanban-scroll::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 10px;
  }

  .pipeline-kanban-scroll::-webkit-scrollbar-thumb {
    background: #aaa;
    border-radius: 10px;
  }

  .pipeline-kanban {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    min-width: max-content;
  }

  .pipeline-stage {
    flex: 0 0 285px;
    width: 285px;
    min-height: 220px;
    overflow: hidden;
    border: 1px solid #ddd;
    border-radius: 10px;
    background: #fff;
  }

  .pipeline-stage-header {
    padding: 14px;
    border-bottom: 1px solid #e5e5e5;
    background: #fafafa;
  }

  .pipeline-stage-header-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .pipeline-stage-title {
    flex: 1;
    min-width: 0;
  }

  .pipeline-stage-title strong {
    display: block;
    color: #222;
    font-size: 15px;
    line-height: 1.35;
    font-weight: 650;
    overflow-wrap: anywhere;
  }

  .pipeline-stage-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .pipeline-stage-actions .btn {
    height: 32px;
    min-width: 32px;
    padding: 0 9px;
    font-size: 12px;
    white-space: nowrap;
  }

  .pipeline-stage-actions .stage-delete-btn {
    width: 32px;
    padding: 0;
    font-size: 17px;
    line-height: 1;
  }

  .pipeline-stage-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-top: 13px;
  }

  .pipeline-stage-probability {
    font-size: 13px;
    font-weight: 650;
    color: #555;
  }

  .pipeline-stage-status {
    display: inline-flex;
    align-items: center;
    min-height: 24px;
    padding: 3px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    background: #f0f0f0;
    color: #555;
  }

  .pipeline-stage-status.active {
    background: #eef6ff;
    color: #245b8f;
  }

  .pipeline-stage-status.won {
    background: #edf8f0;
    color: #287a3d;
  }

  .pipeline-stage-status.lost {
    background: #fff0f0;
    color: #a33838;
  }

  .pipeline-stage-stats {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid #e9e9e9;
  }

  .pipeline-stage-stats span {
    font-size: 12px;
    color: #666;
  }

  .pipeline-stage-stats strong {
    font-size: 13px;
    color: #222;
  }

  .pipeline-stage-body {
    display: flex;
    flex-direction: column;
    gap: 9px;
    padding: 12px;
    min-height: 130px;
    background: #f8f8f8;
  }

  .pipeline-stage-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100px;
    text-align: center;
    color: #888;
    font-size: 12px;
  }

  .pipeline-deal-card {
    display: flex;
    flex-direction: column;
    gap: 5px;
    width: 100%;
    padding: 12px;
    border: 1px solid #ddd;
    border-radius: 8px;
    background: #fff;
    text-align: left;
    cursor: pointer;
    transition:
      transform 0.15s ease,
      box-shadow 0.15s ease,
      border-color 0.15s ease;
  }

  .pipeline-deal-card:hover {
    transform: translateY(-1px);
    border-color: #bbb;
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.06);
  }

  .pipeline-deal-card b {
    font-size: 13px;
    line-height: 1.35;
    color: #222;
  }

  .pipeline-deal-card span {
    font-size: 12px;
    color: #555;
  }

  .pipeline-deal-card small {
    font-size: 11px;
    color: #888;
  }

  .pipeline-no-stages {
    padding: 20px 0;
  }

  .pipeline-table-row {
    cursor: pointer;
  }

  .pipeline-modal-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }

  .pipeline-checkbox {
    display: flex !important;
    align-items: center;
    gap: 8px;
    margin: 0 !important;
  }

  .pipeline-checkbox input {
    width: auto !important;
  }

  @media (max-width: 760px) {
    .pipeline-stage {
      flex-basis: 270px;
      width: 270px;
    }

    .pipeline-modal-grid {
      grid-template-columns: 1fr;
    }

    .pipeline-search-form input[type="text"],
    .pipeline-search-form input:not([type]) {
      min-width: 100%;
      width: 100%;
    }

    .pipeline-summary {
      align-items: flex-start;
    }
  }
`;

export default function Pipelines() {
  const { request } = useAuth();

  const [pipelines, setPipelines] = useState([]);
  const [pipe, setPipe] = useState(null);
  const [stages, setStages] = useState([]);
  const [deals, setDeals] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [companies, setCompanies] = useState([]);

  const [view, setView] = useState("Kanban");
  const [drawer, setDrawer] = useState(null);
  const [newDeal, setNewDeal] = useState(false);

  const [pipelineModal, setPipelineModal] = useState(null);
  const [stageModal, setStageModal] = useState(null);

  const [pipelineForm, setPipelineForm] = useState(blankPipeline);
  const [stageForm, setStageForm] = useState(blankStage);
  const [form, setForm] = useState(blankDeal);

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [pipelinePage, setPipelinePage] = useState(1);
  const [pipelineSearch, setPipelineSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);

  const [pipelinePagination, setPipelinePagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    pages: 1,
  });

  const [dealPage, setDealPage] = useState(1);
  const [dealPagination, setDealPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 1,
  });

  async function loadPipelines(page = pipelinePage, search = pipelineSearch) {
    try {
      setError("");

      const r = await request("/pipelines", {
        query: {
          page,
          limit: 25,
          search,
          isActive: activeOnly,
          sort: "sortOrder",
          order: "asc",
        },
      });

      const rows = r.data?.items || r.data || [];

      setPipelines(rows);

      setPipelinePagination(
        r.data?.pagination ||
          r.pagination || {
            page,
            limit: 25,
            total: rows.length,
            pages: 1,
          },
      );

      setPipe((current) => {
        if (current) {
          return rows.find((x) => x._id === current._id) || rows[0] || null;
        }

        return rows[0] || null;
      });
    } catch (e) {
      setError(errMsg(e));
    }
  }

  async function loadPipeline(id) {
    if (!id) return null;

    try {
      const r = await request(`/pipelines/${id}`);

      if (r.data?._id) {
        setPipe(r.data);

        setPipelines((items) =>
          items.map((item) => (item._id === r.data._id ? r.data : item)),
        );
      }

      return r.data;
    } catch (e) {
      setError(errMsg(e));
      return null;
    }
  }

  async function loadData(p = pipe, page = dealPage) {
    if (!p?._id) {
      setStages([]);
      setDeals([]);
      return;
    }

    try {
      const [stageResponse, dealResponse, contactResponse, companyResponse] =
        await Promise.all([
          request(`/pipelines/${p._id}/stages`),

          request("/deals", {
            query: {
              pipelineId: p._id,
              page,
              limit: 20,
            },
          }),

          request("/contacts", {
            query: {
              page: 1,
              limit: 100,
            },
          }),

          request("/companies", {
            query: {
              page: 1,
              limit: 100,
            },
          }),
        ]);

      setStages(
        Array.isArray(stageResponse.data)
          ? stageResponse.data
          : stageResponse.data?.items || [],
      );

      const dealItems = dealResponse.data?.items || dealResponse.data || [];

      setDeals(dealItems);

      setDealPagination(
        dealResponse.data?.pagination ||
          dealResponse.pagination || {
            page,
            limit: 20,
            total: dealItems.length,
            pages: 1,
          },
      );

      setContacts(contactResponse.data?.items || contactResponse.data || []);

      setCompanies(companyResponse.data?.items || companyResponse.data || []);
    } catch (e) {
      setError(errMsg(e));
    }
  }

  useEffect(() => {
    loadPipelines(1, "");
  }, [activeOnly]);

  useEffect(() => {
    if (!pipe?._id) return;

    setDealPage(1);

    loadPipeline(pipe._id);
    loadData(pipe, 1);
  }, [pipe?._id]);

  useEffect(() => {
    if (pipe?._id && dealPage > 1) {
      loadData(pipe, dealPage);
    }
  }, [dealPage]);

  const grouped = useMemo(() => {
    return Object.fromEntries(
      stages.map((stage) => [
        stage._id,
        deals.filter(
          (deal) =>
            String(deal.stageId?._id || deal.stageId) === String(stage._id),
        ),
      ]),
    );
  }, [stages, deals]);

  function openCreatePipeline() {
    setError("");

    setPipelineForm({
      ...blankPipeline,
      sortOrder: pipelines.length,
    });

    setPipelineModal("create");
  }

  function openEditPipeline() {
    if (!pipe) return;

    setError("");

    setPipelineForm({
      name: pipe.name || "",
      key: pipe.key || "",
      description: pipe.description || "",
      isActive: pipe.isActive !== false,
      sortOrder: Number(pipe.sortOrder || 0),
    });

    setPipelineModal("edit");
  }

  async function savePipeline() {
    if (!pipelineForm.name.trim()) {
      setError("Pipeline name is required.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const body = {
        name: pipelineForm.name.trim(),
        key: (pipelineForm.key || slugify(pipelineForm.name)).trim(),
        description: pipelineForm.description.trim(),
        isActive: !!pipelineForm.isActive,
        sortOrder: Number(pipelineForm.sortOrder) || 0,
      };

      const response =
        pipelineModal === "edit"
          ? await request(`/pipelines/${pipe._id}`, {
              method: "PATCH",
              body,
            })
          : await request("/pipelines", {
              method: "POST",
              body,
            });

      setPipelineModal(null);

      if (response.data?._id) {
        setPipe(response.data);

        await loadPipeline(response.data._id);
      }

      await loadPipelines(pipelinePage, pipelineSearch);

      if (response.data?._id) {
        await loadData(response.data, 1);
      }
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  }

  async function deletePipeline() {
    if (!pipe) return;

    const confirmed = window.confirm(`Delete pipeline "${pipe.name}"?`);

    if (!confirmed) return;

    try {
      await request(`/pipelines/${pipe._id}`, {
        method: "DELETE",
      });

      setPipe(null);
      setStages([]);
      setDeals([]);

      const nextPage =
        pipelines.length === 1 && pipelinePage > 1
          ? pipelinePage - 1
          : pipelinePage;

      setPipelinePage(nextPage);

      await loadPipelines(nextPage, pipelineSearch);
    } catch (e) {
      setError(errMsg(e));
    }
  }

  function openCreateStage() {
    if (!pipe) return;

    setStageForm({
      ...blankStage,
      sortOrder: stages.length,
    });

    setStageModal("create");
    setError("");
  }

  function openEditStage(stage) {
    setStageForm({
      name: stage.name || "",
      key: stage.key || "",
      sortOrder: Number(stage.sortOrder || 0),
      probability: Number(stage.probability || 0),
      isClosedWon: !!stage.isClosedWon,
      isClosedLost: !!stage.isClosedLost,
      isActive: stage.isActive !== false,
    });

    setStageModal({
      mode: "edit",
      stage,
    });

    setError("");
  }

  async function saveStage() {
    if (!stageForm.name.trim()) {
      setError("Stage name is required.");
      return;
    }

    const probability = Number(stageForm.probability);

    if (probability < 0 || probability > 100) {
      setError("Probability must be between 0 and 100.");
      return;
    }

    if (stageForm.isClosedWon && stageForm.isClosedLost) {
      setError("A stage cannot be both Closed Won and Closed Lost.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const body = {
        name: stageForm.name.trim(),
        key: (stageForm.key || slugify(stageForm.name)).trim(),
        sortOrder: Number(stageForm.sortOrder) || 0,
        probability,
        isClosedWon: !!stageForm.isClosedWon,
        isClosedLost: !!stageForm.isClosedLost,
        isActive: !!stageForm.isActive,
      };

      if (stageModal?.mode === "edit") {
        await request(`/pipelines/stages/${stageModal.stage._id}`, {
          method: "PATCH",
          body,
        });
      } else {
        await request(`/pipelines/${pipe._id}/stages`, {
          method: "POST",
          body,
        });
      }

      setStageModal(null);

      await loadData(pipe, dealPage);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  }

  async function deleteStage(stage) {
    const confirmed = window.confirm(`Delete stage "${stage.name}"?`);

    if (!confirmed) return;

    try {
      await request(`/pipelines/stages/${stage._id}`, {
        method: "DELETE",
      });

      await loadData(pipe, dealPage);
    } catch (e) {
      setError(errMsg(e));
    }
  }

  async function createDeal() {
    setSaving(true);
    setError("");

    try {
      if (!stages[0]) {
        throw new Error("Selected pipeline has no stages.");
      }

      if (!form.title.trim()) {
        throw new Error("Deal title is required.");
      }

      if (!form.contactId) {
        throw new Error("Please select a contact.");
      }

      const body = {
        ...form,
        value: Number(form.value) || 0,
        pipelineId: pipe._id,
        stageId: stages[0]._id,
      };

      if (!body.companyId) {
        delete body.companyId;
      }

      await request("/deals", {
        method: "POST",
        body,
      });

      setNewDeal(false);
      setForm(blankDeal);
      setDealPage(1);

      await loadData(pipe, 1);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  }

  async function moveDeal(deal, stageId) {
    try {
      const response = await request(`/deals/${deal._id}/move`, {
        method: "PATCH",
        body: {
          stageId,
        },
      });

      setDeals((items) =>
        items.map((item) => (item._id === deal._id ? response.data : item)),
      );

      setDrawer(response.data);
    } catch (e) {
      setError(errMsg(e));
    }
  }

  async function changePipelinePage(page) {
    const totalPages = Number(pipelinePagination.pages || 1);

    if (page < 1 || page > totalPages) return;

    setPipelinePage(page);

    await loadPipelines(page, pipelineSearch);
  }

  async function searchPipelines(event) {
    event.preventDefault();

    setPipelinePage(1);

    await loadPipelines(1, pipelineSearch);
  }

  function getStageStatus(stage) {
    if (stage.isClosedWon) {
      return {
        label: "Won",
        className: "won",
      };
    }

    if (stage.isClosedLost) {
      return {
        label: "Lost",
        className: "lost",
      };
    }

    if (stage.isActive) {
      return {
        label: "Active",
        className: "active",
      };
    }

    return {
      label: "Inactive",
      className: "",
    };
  }

  return (
    <Page
      title="Pipelines"
      kicker={`${deals.length} deals on this page`}
      actions={
        <>
          <div className="seg">
            <button
              className={view === "Kanban" ? "on" : ""}
              onClick={() => setView("Kanban")}
            >
              Kanban
            </button>

            <button
              className={view === "Table" ? "on" : ""}
              onClick={() => setView("Table")}
            >
              Table
            </button>
          </div>

          <button className="btn ghost" onClick={openCreatePipeline}>
            New pipeline
          </button>

          <button
            className="btn primary"
            onClick={() => setNewDeal(true)}
            disabled={!pipe}
          >
            New deal
          </button>
        </>
      }
    >
      <style>{PIPELINE_STYLES}</style>

      {error && (
        <div className="notice error">
          <b>Pipelines</b>
          <span>{error}</span>
        </div>
      )}

      <section className="panel pipeline-page-search">
        <form onSubmit={searchPipelines} className="pipeline-search-form">
          <input
            type="text"
            value={pipelineSearch}
            onChange={(event) => setPipelineSearch(event.target.value)}
            placeholder="Search pipelines..."
          />

          <label className="pipeline-active-filter">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(event) => setActiveOnly(event.target.checked)}
            />
            Active only
          </label>

          <button className="btn ghost" type="submit">
            Search
          </button>
        </form>
      </section>

      <div className="pipeline-tabs">
        {pipelines.map((pipeline) => (
          <button
            key={pipeline._id}
            className={pipe?._id === pipeline._id ? "active" : ""}
            onClick={() => setPipe(pipeline)}
          >
            {pipeline.name}
          </button>
        ))}

        {!pipelines.length && <Empty text="No pipelines found." />}
      </div>

      <div className="pipeline-pagination">
        <button
          className="btn ghost"
          disabled={pipelinePagination.page <= 1}
          onClick={() => changePipelinePage(pipelinePagination.page - 1)}
        >
          Previous
        </button>

        <span className="pipeline-pagination-info">
          Page {pipelinePagination.page || pipelinePage} of{" "}
          {pipelinePagination.pages || 1}
          {" · "}
          {pipelinePagination.total || 0} pipelines
        </span>

        <button
          className="btn ghost"
          disabled={pipelinePagination.page >= (pipelinePagination.pages || 1)}
          onClick={() => changePipelinePage(pipelinePagination.page + 1)}
        >
          Next
        </button>
      </div>

      <div className="pipeline-summary">
        <b>{deals.length} deals</b>

        <span>{pipe?.name || "Pipeline"}</span>

        <span>{stages.length} stages</span>

        {pipe && (
          <>
            <button className="btn ghost" onClick={openEditPipeline}>
              Edit pipeline
            </button>

            <button className="btn ghost" onClick={openCreateStage}>
              Add stage
            </button>

            <button className="btn ghost" onClick={deletePipeline}>
              Delete pipeline
            </button>
          </>
        )}
      </div>

      {view === "Kanban" ? (
        <>
          <div className="pipeline-kanban-scroll">
            <div className="pipeline-kanban">
              {stages.map((stage) => {
                const stageDeals = grouped[stage._id] || [];

                const totalValue = stageDeals.reduce(
                  (total, deal) => total + Number(deal.value || 0),
                  0,
                );

                const status = getStageStatus(stage);

                return (
                  <div className="pipeline-stage" key={stage._id}>
                    <div className="pipeline-stage-header">
                      <div className="pipeline-stage-header-top">
                        <div className="pipeline-stage-title">
                          <strong>{stage.name}</strong>
                        </div>

                        <div className="pipeline-stage-actions">
                          <button
                            type="button"
                            className="btn ghost"
                            onClick={(event) => {
                              event.stopPropagation();
                              openEditStage(stage);
                            }}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            className="btn ghost stage-delete-btn"
                            title="Delete stage"
                            onClick={(event) => {
                              event.stopPropagation();
                              deleteStage(stage);
                            }}
                          >
                            ×
                          </button>
                        </div>
                      </div>

                      <div className="pipeline-stage-meta">
                        <span className="pipeline-stage-probability">
                          {stage.probability ?? 0}% probability
                        </span>

                        <span
                          className={`pipeline-stage-status ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </div>

                      <div className="pipeline-stage-stats">
                        <span>
                          <strong>{stageDeals.length}</strong>{" "}
                          {stageDeals.length === 1 ? "deal" : "deals"}
                        </span>

                        <span>
                          <strong>
                            {Number(totalValue).toLocaleString("en-HK")}
                          </strong>
                        </span>
                      </div>
                    </div>

                    <div className="pipeline-stage-body">
                      {stageDeals.length ? (
                        stageDeals.map((deal) => (
                          <button
                            type="button"
                            className="pipeline-deal-card"
                            key={deal._id}
                            onClick={() => setDrawer(deal)}
                          >
                            <b>{deal.title}</b>

                            <span>
                              {deal.productType || "Deal"} ·{" "}
                              {deal.currency || "HKD"}{" "}
                              {Number(deal.value || 0).toLocaleString()}
                            </span>

                            <small>
                              {deal.contactId?.firstName || "Contact"}{" "}
                              {deal.contactId?.lastName || ""}
                            </small>
                          </button>
                        ))
                      ) : (
                        <div className="pipeline-stage-empty">
                          No deals in this stage
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {!stages.length && (
            <div className="pipeline-no-stages">
              <Empty text="This pipeline has no stages. Add a stage to start." />
            </div>
          )}
        </>
      ) : (
        <div className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Deal</th>
                <th>Contact</th>
                <th>Stage</th>
                <th>Value</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {deals.map((deal) => (
                <tr
                  className="pipeline-table-row"
                  key={deal._id}
                  onClick={() => setDrawer(deal)}
                >
                  <td>
                    <b>{deal.title}</b>
                  </td>

                  <td>
                    {deal.contactId?.firstName || "—"}{" "}
                    {deal.contactId?.lastName || ""}
                  </td>

                  <td>
                    <Badge>{deal.stageId?.name || "—"}</Badge>
                  </td>

                  <td>
                    {deal.currency || "HKD"}{" "}
                    {Number(deal.value || 0).toLocaleString()}
                  </td>

                  <td>{deal.status}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {!deals.length && <Empty text="No deals found." />}
        </div>
      )}

      <div className="deal-pagination">
        <button
          className="btn ghost"
          disabled={dealPage <= 1}
          onClick={() => setDealPage((page) => page - 1)}
        >
          Previous deals
        </button>

        <span className="deal-pagination-info">
          Page {dealPagination.page || dealPage} of {dealPagination.pages || 1}
        </span>

        <button
          className="btn ghost"
          disabled={dealPage >= Number(dealPagination.pages || 1)}
          onClick={() => setDealPage((page) => page + 1)}
        >
          Next deals
        </button>
      </div>

      {drawer && (
        <DealDrawer
          deal={drawer}
          stages={stages}
          onMove={moveDeal}
          onClose={() => setDrawer(null)}
        />
      )}

      {pipelineModal && (
        <Modal
          title={pipelineModal === "edit" ? "Edit pipeline" : "Create pipeline"}
          onClose={() => setPipelineModal(null)}
          actions={
            <>
              <button
                className="btn ghost"
                onClick={() => setPipelineModal(null)}
              >
                Cancel
              </button>

              <button
                className="btn primary"
                disabled={saving}
                onClick={savePipeline}
              >
                {saving
                  ? "Saving…"
                  : pipelineModal === "edit"
                    ? "Save changes"
                    : "Create pipeline"}
              </button>
            </>
          }
        >
          <label>
            Pipeline name
            <input
              value={pipelineForm.name}
              onChange={(event) => {
                const name = event.target.value;

                setPipelineForm((current) => ({
                  ...current,
                  name,
                  key:
                    pipelineModal === "create" &&
                    (!current.key || current.key === slugify(current.name))
                      ? slugify(name)
                      : current.key,
                }));
              }}
              placeholder="Sales Pipeline"
            />
          </label>

          <label>
            Key
            <input
              value={pipelineForm.key}
              onChange={(event) =>
                setPipelineForm((current) => ({
                  ...current,
                  key: event.target.value,
                }))
              }
              placeholder="sales-pipeline"
            />
          </label>

          <label>
            Description
            <textarea
              value={pipelineForm.description}
              onChange={(event) =>
                setPipelineForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              placeholder="Describe this pipeline"
            />
          </label>

          <div className="pipeline-modal-grid">
            <label>
              Sort order
              <input
                type="number"
                min="0"
                value={pipelineForm.sortOrder}
                onChange={(event) =>
                  setPipelineForm((current) => ({
                    ...current,
                    sortOrder: event.target.value,
                  }))
                }
              />
            </label>

            <label className="pipeline-checkbox">
              <input
                type="checkbox"
                checked={pipelineForm.isActive}
                onChange={(event) =>
                  setPipelineForm((current) => ({
                    ...current,
                    isActive: event.target.checked,
                  }))
                }
              />
              Active
            </label>
          </div>
        </Modal>
      )}

      {stageModal && (
        <Modal
          title={
            stageModal === "create"
              ? "Create pipeline stage"
              : "Edit pipeline stage"
          }
          onClose={() => setStageModal(null)}
          actions={
            <>
              <button className="btn ghost" onClick={() => setStageModal(null)}>
                Cancel
              </button>

              <button
                className="btn primary"
                disabled={saving}
                onClick={saveStage}
              >
                {saving
                  ? "Saving…"
                  : stageModal === "create"
                    ? "Create stage"
                    : "Save changes"}
              </button>
            </>
          }
        >
          <label>
            Stage name
            <input
              value={stageForm.name}
              onChange={(event) => {
                const name = event.target.value;

                setStageForm((current) => ({
                  ...current,
                  name,
                  key:
                    stageModal === "create" &&
                    (!current.key || current.key === slugify(current.name))
                      ? slugify(name)
                      : current.key,
                }));
              }}
              placeholder="Qualified"
            />
          </label>

          <label>
            Key
            <input
              value={stageForm.key}
              onChange={(event) =>
                setStageForm((current) => ({
                  ...current,
                  key: event.target.value,
                }))
              }
              placeholder="qualified"
            />
          </label>

          <div className="pipeline-modal-grid">
            <label>
              Sort order
              <input
                type="number"
                min="0"
                value={stageForm.sortOrder}
                onChange={(event) =>
                  setStageForm((current) => ({
                    ...current,
                    sortOrder: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Probability (%)
              <input
                type="number"
                min="0"
                max="100"
                value={stageForm.probability}
                onChange={(event) =>
                  setStageForm((current) => ({
                    ...current,
                    probability: event.target.value,
                  }))
                }
              />
            </label>
          </div>

          <div className="pipeline-modal-grid">
            <label className="pipeline-checkbox">
              <input
                type="checkbox"
                checked={stageForm.isClosedWon}
                onChange={(event) =>
                  setStageForm((current) => ({
                    ...current,
                    isClosedWon: event.target.checked,
                    isClosedLost: event.target.checked
                      ? false
                      : current.isClosedLost,
                  }))
                }
              />
              Closed Won
            </label>

            <label className="pipeline-checkbox">
              <input
                type="checkbox"
                checked={stageForm.isClosedLost}
                onChange={(event) =>
                  setStageForm((current) => ({
                    ...current,
                    isClosedLost: event.target.checked,
                    isClosedWon: event.target.checked
                      ? false
                      : current.isClosedWon,
                  }))
                }
              />
              Closed Lost
            </label>
          </div>

          <label className="pipeline-checkbox">
            <input
              type="checkbox"
              checked={stageForm.isActive}
              onChange={(event) =>
                setStageForm((current) => ({
                  ...current,
                  isActive: event.target.checked,
                }))
              }
            />
            Active
          </label>
        </Modal>
      )}

      {newDeal && (
        <Modal
          title="New deal"
          onClose={() => setNewDeal(false)}
          actions={
            <>
              <button className="btn ghost" onClick={() => setNewDeal(false)}>
                Cancel
              </button>

              <button
                className="btn primary"
                disabled={saving}
                onClick={createDeal}
              >
                {saving ? "Creating…" : "Create deal"}
              </button>
            </>
          }
        >
          <label>
            Title
            <input
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              placeholder="Private office — 4 desks"
            />
          </label>

          <label>
            Contact
            <select
              value={form.contactId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  contactId: event.target.value,
                }))
              }
            >
              <option value="">Select contact</option>

              {contacts.map((contact) => (
                <option key={contact._id} value={contact._id}>
                  {contact.firstName} {contact.lastName}
                </option>
              ))}
            </select>
          </label>

          <label>
            Company
            <select
              value={form.companyId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  companyId: event.target.value,
                }))
              }
            >
              <option value="">No company</option>

              {companies.map((company) => (
                <option key={company._id} value={company._id}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>

          <div className="pipeline-modal-grid">
            <label>
              Value
              <input
                type="number"
                min="0"
                value={form.value}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    value: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Product type
              <select
                value={form.productType}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    productType: event.target.value,
                  }))
                }
              >
                <option value="membership">Membership</option>

                <option value="private_office">Private office</option>

                <option value="venue_hire">Venue hire</option>

                <option value="transactional">Transactional</option>
              </select>
            </label>
          </div>
        </Modal>
      )}
    </Page>
  );
}

function DealDrawer({ deal, stages, onMove, onClose }) {
  return (
    <div className="drawer">
      <div className="drawer-head">
        <div>
          <span className="eyebrow">Deal · {deal.productType || "CRM"}</span>

          <h2>{deal.title}</h2>
        </div>

        <button className="icon-btn" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="drawer-body">
        <div className="deal-meta">
          <Badge>{deal.status}</Badge>

          <Badge>
            {deal.currency || "HKD"} {Number(deal.value || 0).toLocaleString()}
          </Badge>
        </div>

        <dl>
          <dt>Contact</dt>

          <dd>
            {deal.contactId?.firstName || "—"} {deal.contactId?.lastName || ""}
          </dd>

          <dt>Company</dt>

          <dd>{deal.companyId?.name || "—"}</dd>

          <dt>Stage</dt>

          <dd>{deal.stageId?.name || "—"}</dd>

          <dt>Source</dt>

          <dd>{deal.source || "—"}</dd>
        </dl>

        <SectionTitle title="Move stage" />

        <div className="form-grid">
          {stages.map((stage) => (
            <button
              key={stage._id}
              className="btn ghost"
              onClick={() => onMove(deal, stage._id)}
            >
              {stage.name}
            </button>
          ))}
        </div>
      </div>

      <div className="drawer-actions">
        <button className="btn ghost" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
