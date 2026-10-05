import React, { useEffect, useState } from "react";
import { Page, SectionTitle, Empty } from "./Dashboard";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import { useAuth } from "../auth/AuthContext";

const INITIAL_FORM = {
  name: "",
  description: "",
  trigger: "",
  conditions: [],
  actions: [],
  isEnabled: true,
};

const TRIGGER_OPTIONS = [
  { value: "deal_created", label: "Deal created" },
  { value: "deal_updated", label: "Deal updated" },
  { value: "deal_stage_changed", label: "Deal stage changed" },
  { value: "deal_deleted", label: "Deal deleted" },
  { value: "lead_created", label: "Lead created" },
  { value: "lead_updated", label: "Lead updated" },
  { value: "lead_status_changed", label: "Lead status changed" },
  { value: "contact_created", label: "Contact created" },
  { value: "contact_updated", label: "Contact updated" },
  { value: "task_created", label: "Task created" },
  { value: "task_completed", label: "Task completed" },
];

const CONDITION_OPERATORS = [
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Not equals" },
  { value: "contains", label: "Contains" },
  { value: "not_contains", label: "Does not contain" },
  { value: "greater_than", label: "Greater than" },
  { value: "less_than", label: "Less than" },
  { value: "exists", label: "Exists" },
  { value: "not_exists", label: "Does not exist" },
];

const ACTION_TYPES = [
  { value: "create_task", label: "Create task" },
  { value: "log_activity", label: "Log activity" },
  { value: "notify", label: "Create notification" },
];

function emptyCondition() {
  return {
    field: "",
    operator: "equals",
    value: "",
  };
}

function emptyAction() {
  return {
    type: "create_task",
    title: "",
    description: "",
    assignedTo: "",
    delayDays: 0,
    activityType: "note",
    subject: "",
    body: "",
    userId: "",
  };
}

function getErrorMessage(error) {
  if (!error) return "Something went wrong.";

  if (typeof error === "string") {
    return error;
  }

  if (error.message) {
    return error.message;
  }

  return "Something went wrong.";
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString();
}

function normalizeRule(rule) {
  return {
    ...rule,
    conditions: Array.isArray(rule.conditions) ? rule.conditions : [],
    actions: Array.isArray(rule.actions) ? rule.actions : [],
  };
}

export default function Automation() {
  const { request } = useAuth();

  const [rules, setRules] = useState([]);
  const [integrations, setIntegrations] = useState([]);

  const [modal, setModal] = useState(false);
  const [historyModal, setHistoryModal] = useState(false);
  const [executeModal, setExecuteModal] = useState(false);

  const [editingRule, setEditingRule] = useState(null);
  const [selectedRule, setSelectedRule] = useState(null);

  const [executions, setExecutions] = useState([]);

  const [form, setForm] = useState(INITIAL_FORM);

  const [executeForm, setExecuteForm] = useState({
    entityType: "deal",
    entityId: "",
    context: "{}",
  });

  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [executeError, setExecuteError] = useState("");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [executing, setExecuting] = useState(false);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const [rulesResponse, integrationsResponse] = await Promise.all([
        request("/automations"),
        request("/integrations", {
          query: { limit: 100 },
        }),
      ]);

      setRules(
        Array.isArray(rulesResponse?.data)
          ? rulesResponse.data.map(normalizeRule)
          : [],
      );

      setIntegrations(
        Array.isArray(integrationsResponse?.data?.items)
          ? integrationsResponse.data.items
          : Array.isArray(integrationsResponse?.data)
            ? integrationsResponse.data
            : [],
      );
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function resetForm() {
    setForm({
      ...INITIAL_FORM,
      conditions: [],
      actions: [],
    });

    setEditingRule(null);
    setFormError("");
  }

  function openCreateModal() {
    resetForm();
    setModal(true);
  }

  function openEditModal(rule) {
    setEditingRule(rule);

    setForm({
      name: rule.name || "",
      description: rule.description || "",
      trigger: rule.trigger || "",

      conditions: Array.isArray(rule.conditions)
        ? rule.conditions.map((condition) => ({
            field: condition?.field || "",
            operator: condition?.operator || "equals",
            value:
              condition?.value !== undefined &&
              condition?.value !== null
                ? String(condition.value)
                : "",
          }))
        : [],

      actions: Array.isArray(rule.actions)
        ? rule.actions.map((action) => ({
            type: action?.type || "create_task",
            title: action?.title || "",
            description: action?.description || "",
            assignedTo: action?.assignedTo || "",
            delayDays: action?.delayDays ?? 0,
            activityType: action?.activityType || "note",
            subject: action?.subject || "",
            body: action?.body || "",
            userId: action?.userId || "",
          }))
        : [],

      isEnabled: rule.isEnabled !== false,
    });

    setFormError("");
    setModal(true);
  }

  function closeModal() {
    if (saving) return;

    setModal(false);
    resetForm();
  }

  function updateForm(field, value) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  function addCondition() {
    setForm((previous) => ({
      ...previous,
      conditions: [...previous.conditions, emptyCondition()],
    }));
  }

  function updateCondition(index, field, value) {
    setForm((previous) => ({
      ...previous,
      conditions: previous.conditions.map((condition, conditionIndex) =>
        conditionIndex === index
          ? {
              ...condition,
              [field]: value,
            }
          : condition,
      ),
    }));
  }

  function removeCondition(index) {
    setForm((previous) => ({
      ...previous,
      conditions: previous.conditions.filter(
        (_, conditionIndex) => conditionIndex !== index,
      ),
    }));
  }

  function addAction() {
    setForm((previous) => ({
      ...previous,
      actions: [...previous.actions, emptyAction()],
    }));
  }

  function updateAction(index, field, value) {
    setForm((previous) => ({
      ...previous,
      actions: previous.actions.map((action, actionIndex) =>
        actionIndex === index
          ? {
              ...action,
              [field]: value,
            }
          : action,
      ),
    }));
  }

  function removeAction(index) {
    setForm((previous) => ({
      ...previous,
      actions: previous.actions.filter(
        (_, actionIndex) => actionIndex !== index,
      ),
    }));
  }

  function validateForm() {
    if (!form.name.trim()) {
      return "Automation name is required.";
    }

    if (!form.trigger.trim()) {
      return "Trigger is required.";
    }

    for (let index = 0; index < form.conditions.length; index += 1) {
      const condition = form.conditions[index];

      if (!condition.field.trim()) {
        return `Condition ${index + 1}: field is required.`;
      }

      if (!condition.operator) {
        return `Condition ${index + 1}: operator is required.`;
      }

      if (
        condition.operator !== "exists" &&
        condition.operator !== "not_exists" &&
        !String(condition.value || "").trim()
      ) {
        return `Condition ${index + 1}: value is required.`;
      }
    }

    for (let index = 0; index < form.actions.length; index += 1) {
      const action = form.actions[index];

      if (!ACTION_TYPES.some((item) => item.value === action.type)) {
        return `Action ${index + 1}: select a valid action type.`;
      }

      if (
        action.type === "create_task" &&
        !String(action.title || "").trim()
      ) {
        return `Action ${index + 1}: task title is required.`;
      }

      if (
        action.type === "log_activity" &&
        !String(action.subject || "").trim()
      ) {
        return `Action ${index + 1}: activity subject is required.`;
      }

      if (
        action.type === "notify" &&
        !String(action.title || "").trim()
      ) {
        return `Action ${index + 1}: notification title is required.`;
      }
    }

    return "";
  }

  function buildPayload() {
    return {
      name: form.name.trim(),

      description: form.description.trim(),

      trigger: form.trigger.trim(),

      conditions: form.conditions.map((condition) => ({
        field: condition.field.trim(),

        operator: condition.operator,

        value:
          condition.operator === "exists" ||
          condition.operator === "not_exists"
            ? true
            : condition.value.trim(),
      })),

      actions: form.actions.map((action) => {
        if (action.type === "create_task") {
          return {
            type: "create_task",
            title: action.title.trim(),
            description: action.description.trim() || undefined,
            assignedTo: action.assignedTo.trim() || undefined,
            delayDays: Number(action.delayDays) || 0,
          };
        }

        if (action.type === "log_activity") {
          return {
            type: "log_activity",
            activityType: action.activityType || "note",
            subject: action.subject.trim(),
            body: action.body.trim() || undefined,
          };
        }

        return {
          type: "notify",
          userId: action.userId.trim() || undefined,
          title: action.title.trim(),
          body: action.body.trim() || undefined,
        };
      }),

      isEnabled: Boolean(form.isEnabled),
    };
  }

  async function saveRule() {
    const validationError = validateForm();

    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSaving(true);
    setFormError("");
    setError("");

    try {
      const payload = buildPayload();

      if (editingRule) {
        await request(`/automations/${editingRule._id}`, {
          method: "PATCH",
          body: payload,
        });
      } else {
        await request("/automations", {
          method: "POST",
          body: payload,
        });
      }

      setModal(false);
      resetForm();

      await load();
    } catch (e) {
      setFormError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function toggle(rule) {
    setError("");

    try {
      await request(`/automations/${rule._id}`, {
        method: "PATCH",
        body: {
          isEnabled: !rule.isEnabled,
        },
      });

      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  }

  function openExecuteModal(rule) {
    setSelectedRule(rule);

    setExecuteForm({
      entityType: "deal",
      entityId: "",
      context: "{}",
    });

    setExecuteError("");
    setExecuteModal(true);
  }

  function closeExecuteModal() {
    if (executing) return;

    setExecuteModal(false);
    setSelectedRule(null);
    setExecuteError("");
  }

  async function executeRule() {
    if (!selectedRule) return;

    if (!executeForm.entityType.trim()) {
      setExecuteError("Entity type is required.");
      return;
    }

    if (!executeForm.entityId.trim()) {
      setExecuteError("Entity ID is required.");
      return;
    }

    let parsedContext = {};

    try {
      parsedContext = JSON.parse(executeForm.context || "{}");
    } catch {
      setExecuteError("Context must contain valid JSON.");
      return;
    }

    setExecuting(true);
    setExecuteError("");

    try {
      await request(`/automations/${selectedRule._id}/execute`, {
        method: "POST",
        body: {
          entityType: executeForm.entityType.trim(),
          entityId: executeForm.entityId.trim(),
          context: parsedContext,
        },
      });

      setExecuteModal(false);
      setSelectedRule(null);

      await load();
    } catch (e) {
      setExecuteError(getErrorMessage(e));
    } finally {
      setExecuting(false);
    }
  }

  async function openHistory(rule) {
    setSelectedRule(rule);
    setHistoryModal(true);
    setLoadingHistory(true);
    setError("");

    try {
      const response = await request(
        `/automations/${rule._id}/executions`,
      );

      setExecutions(
        Array.isArray(response?.data) ? response.data : [],
      );
    } catch (e) {
      setExecutions([]);
      setError(getErrorMessage(e));
    } finally {
      setLoadingHistory(false);
    }
  }

  function closeHistory() {
    if (loadingHistory) return;

    setHistoryModal(false);
    setSelectedRule(null);
    setExecutions([]);
  }

  return (
    <Page
      title="Automations & connections"
      kicker="Rules and integration status"
      actions={
        <button
          type="button"
          className="btn primary"
          onClick={openCreateModal}
        >
          New rule
        </button>
      }
    >
      {error && (
        <div className="notice error">
          <b>Automation</b>
          <span>{error}</span>
        </div>
      )}

      <div className="automation-grid">
        <section>
          <SectionTitle title="Rules" />

          {loading ? (
            <div className="panel">
              <span>Loading automation rules...</span>
            </div>
          ) : rules.length === 0 ? (
            <Empty text="No automation rules configured." />
          ) : (
            rules.map((rule) => (
              <div className="rule panel" key={rule._id}>
                <div className="rule-copy">
                  <div>
                    <span>{rule.name}</span>{" "}
                    <Badge>{rule.trigger}</Badge>
                  </div>

                  <small>
                    {rule.description ||
                      `${rule.actions?.length || 0} actions · ${
                        rule.conditions?.length || 0
                      } conditions`}
                  </small>

                  <small>
                    Created {formatDate(rule.createdAt)}
                  </small>
                </div>

                <button
                  type="button"
                  className={`switch ${rule.isEnabled ? "on" : ""}`}
                  onClick={() => toggle(rule)}
                  title={
                    rule.isEnabled
                      ? "Disable rule"
                      : "Enable rule"
                  }
                >
                  <i />
                </button>

                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => openExecuteModal(rule)}
                >
                  Run
                </button>

                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => openHistory(rule)}
                >
                  History
                </button>

                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => openEditModal(rule)}
                >
                  Edit
                </button>
              </div>
            ))
          )}
        </section>

        <section>
          <SectionTitle title="Connected tools" />

          {integrations.length === 0 ? (
            <Empty text="No integration records." />
          ) : (
            integrations.map((integration) => (
              <div
                className="connection panel"
                key={integration._id}
              >
                <div>
                  <b>{integration.provider}</b>

                  <span>
                    {integration.accountName ||
                      integration.externalAccountId ||
                      "No account"}
                  </span>
                </div>

                <Badge
                  tone={
                    integration.status === "connected"
                      ? ""
                      : "warn"
                  }
                >
                  {integration.status}
                </Badge>
              </div>
            ))
          )}
        </section>
      </div>

      {/* CREATE / EDIT MODAL */}

      {modal && (
        <Modal
          title={
            editingRule
              ? "Edit automation rule"
              : "New automation rule"
          }
          onClose={closeModal}
          actions={
            <>
              <button
                type="button"
                className="btn ghost"
                onClick={closeModal}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn primary"
                onClick={saveRule}
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : editingRule
                    ? "Update rule"
                    : "Create rule"}
              </button>
            </>
          }
        >
          {formError && (
            <div className="notice error">
              <b>Validation</b>
              <span>{formError}</span>
            </div>
          )}

          <div className="form-grid">
            <label>
              Name

              <input
                value={form.name}
                onChange={(e) =>
                  updateForm("name", e.target.value)
                }
                placeholder="Deal created notification"
              />
            </label>

            <label>
              Trigger

              <select
                value={form.trigger}
                onChange={(e) =>
                  updateForm("trigger", e.target.value)
                }
              >
                <option value="">Select trigger</option>

                {TRIGGER_OPTIONS.map((trigger) => (
                  <option
                    key={trigger.value}
                    value={trigger.value}
                  >
                    {trigger.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Description

              <textarea
                value={form.description}
                onChange={(e) =>
                  updateForm(
                    "description",
                    e.target.value,
                  )
                }
                placeholder="Describe what this automation does..."
              />
            </label>

            <label>
              Status

              <select
                value={
                  form.isEnabled
                    ? "enabled"
                    : "disabled"
                }
                onChange={(e) =>
                  updateForm(
                    "isEnabled",
                    e.target.value === "enabled",
                  )
                }
              >
                <option value="enabled">
                  Enabled
                </option>

                <option value="disabled">
                  Disabled
                </option>
              </select>
            </label>
          </div>

          {/* CONDITIONS */}

          <div style={{ marginTop: 24 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <div>
                <b>Conditions</b>

                <small
                  style={{
                    display: "block",
                    marginTop: 4,
                  }}
                >
                  Optional rules that must be satisfied.
                </small>
              </div>

              <button
                type="button"
                className="btn ghost"
                onClick={addCondition}
              >
                + Add condition
              </button>
            </div>

            {form.conditions.length === 0 ? (
              <div className="panel">
                <small>No conditions configured.</small>
              </div>
            ) : (
              form.conditions.map((condition, index) => (
                <div
                  className="panel"
                  key={`condition-${index}`}
                  style={{
                    marginBottom: 12,
                  }}
                >
                  <div className="form-grid">
                    <label>
                      Field

                      <input
                        value={condition.field}
                        onChange={(e) =>
                          updateCondition(
                            index,
                            "field",
                            e.target.value,
                          )
                        }
                        placeholder="stage"
                      />
                    </label>

                    <label>
                      Operator

                      <select
                        value={condition.operator}
                        onChange={(e) =>
                          updateCondition(
                            index,
                            "operator",
                            e.target.value,
                          )
                        }
                      >
                        {CONDITION_OPERATORS.map(
                          (operator) => (
                            <option
                              key={operator.value}
                              value={operator.value}
                            >
                              {operator.label}
                            </option>
                          ),
                        )}
                      </select>
                    </label>

                    {condition.operator !== "exists" &&
                      condition.operator !== "not_exists" && (
                        <label>
                          Value

                          <input
                            value={condition.value}
                            onChange={(e) =>
                              updateCondition(
                                index,
                                "value",
                                e.target.value,
                              )
                            }
                            placeholder="qualified"
                          />
                        </label>
                      )}
                  </div>

                  <button
                    type="button"
                    className="btn ghost"
                    style={{ marginTop: 10 }}
                    onClick={() =>
                      removeCondition(index)
                    }
                  >
                    Remove condition
                  </button>
                </div>
              ))
            )}
          </div>

          {/* ACTIONS */}

          <div style={{ marginTop: 24 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <div>
                <b>Actions</b>

                <small
                  style={{
                    display: "block",
                    marginTop: 4,
                  }}
                >
                  Actions executed when the rule runs.
                </small>
              </div>

              <button
                type="button"
                className="btn ghost"
                onClick={addAction}
              >
                + Add action
              </button>
            </div>

            {form.actions.length === 0 ? (
              <div className="panel">
                <small>No actions configured.</small>
              </div>
            ) : (
              form.actions.map((action, index) => (
                <div
                  className="panel"
                  key={`action-${index}`}
                  style={{
                    marginBottom: 12,
                  }}
                >
                  <div className="form-grid">
                    <label>
                      Action type

                      <select
                        value={action.type}
                        onChange={(e) =>
                          updateAction(
                            index,
                            "type",
                            e.target.value,
                          )
                        }
                      >
                        {ACTION_TYPES.map((type) => (
                          <option
                            key={type.value}
                            value={type.value}
                          >
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    {action.type === "create_task" && (
                      <>
                        <label>
                          Task title

                          <input
                            value={action.title}
                            onChange={(e) =>
                              updateAction(
                                index,
                                "title",
                                e.target.value,
                              )
                            }
                          />
                        </label>

                        <label>
                          Assigned member ID

                          <input
                            value={action.assignedTo}
                            onChange={(e) =>
                              updateAction(
                                index,
                                "assignedTo",
                                e.target.value,
                              )
                            }
                          />
                        </label>

                        <label>
                          Delay days

                          <input
                            type="number"
                            min="0"
                            value={action.delayDays}
                            onChange={(e) =>
                              updateAction(
                                index,
                                "delayDays",
                                e.target.value,
                              )
                            }
                          />
                        </label>

                        <label className="form-span-2">
                          Description

                          <textarea
                            value={action.description}
                            onChange={(e) =>
                              updateAction(
                                index,
                                "description",
                                e.target.value,
                              )
                            }
                          />
                        </label>
                      </>
                    )}

                    {action.type === "log_activity" && (
                      <>
                        <label>
                          Activity type

                          <input
                            value={action.activityType}
                            onChange={(e) =>
                              updateAction(
                                index,
                                "activityType",
                                e.target.value,
                              )
                            }
                          />
                        </label>

                        <label>
                          Subject

                          <input
                            value={action.subject}
                            onChange={(e) =>
                              updateAction(
                                index,
                                "subject",
                                e.target.value,
                              )
                            }
                          />
                        </label>

                        <label className="form-span-2">
                          Body

                          <textarea
                            value={action.body}
                            onChange={(e) =>
                              updateAction(
                                index,
                                "body",
                                e.target.value,
                              )
                            }
                          />
                        </label>
                      </>
                    )}

                    {action.type === "notify" && (
                      <>
                        <label>
                          User ID

                          <input
                            value={action.userId}
                            onChange={(e) =>
                              updateAction(
                                index,
                                "userId",
                                e.target.value,
                              )
                            }
                          />
                        </label>

                        <label>
                          Notification title

                          <input
                            value={action.title}
                            onChange={(e) =>
                              updateAction(
                                index,
                                "title",
                                e.target.value,
                              )
                            }
                          />
                        </label>

                        <label className="form-span-2">
                          Body

                          <textarea
                            value={action.body}
                            onChange={(e) =>
                              updateAction(
                                index,
                                "body",
                                e.target.value,
                              )
                            }
                          />
                        </label>
                      </>
                    )}
                  </div>

                  <button
                    type="button"
                    className="btn ghost"
                    style={{ marginTop: 10 }}
                    onClick={() =>
                      removeAction(index)
                    }
                  >
                    Remove action
                  </button>
                </div>
              ))
            )}
          </div>
        </Modal>
      )}

      {/* EXECUTE MODAL */}

      {executeModal && selectedRule && (
        <Modal
          title={`Run: ${selectedRule.name}`}
          onClose={closeExecuteModal}
          actions={
            <>
              <button
                type="button"
                className="btn ghost"
                onClick={closeExecuteModal}
                disabled={executing}
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn primary"
                onClick={executeRule}
                disabled={executing}
              >
                {executing
                  ? "Executing..."
                  : "Execute rule"}
              </button>
            </>
          }
        >
          {executeError && (
            <div className="notice error">
              <b>Execution</b>
              <span>{executeError}</span>
            </div>
          )}

          <div className="form-grid">
            <label>
              Entity type

              <input
                value={executeForm.entityType}
                onChange={(e) =>
                  setExecuteForm({
                    ...executeForm,
                    entityType: e.target.value,
                  })
                }
                placeholder="deal"
              />
            </label>

            <label>
              Entity ID

              <input
                value={executeForm.entityId}
                onChange={(e) =>
                  setExecuteForm({
                    ...executeForm,
                    entityId: e.target.value,
                  })
                }
                placeholder="6abd6e3a9b1876740f15f746"
              />
            </label>

            <label>
              Context JSON

              <textarea
                value={executeForm.context}
                onChange={(e) =>
                  setExecuteForm({
                    ...executeForm,
                    context: e.target.value,
                  })
                }
                placeholder='{"source":"crm-ui"}'
              />
            </label>
          </div>
        </Modal>
      )}

      {/* HISTORY MODAL */}

      {historyModal && selectedRule && (
        <Modal
          title={`Execution history: ${selectedRule.name}`}
          onClose={closeHistory}
          actions={
            <button
              type="button"
              className="btn ghost"
              onClick={closeHistory}
            >
              Close
            </button>
          }
        >
          {loadingHistory ? (
            <div className="panel">
              <span>
                Loading execution history...
              </span>
            </div>
          ) : executions.length === 0 ? (
            <Empty text="No executions found for this rule." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Triggered by</th>
                    <th>Entity</th>
                    <th>Started</th>
                    <th>Completed</th>
                    <th>Result</th>
                  </tr>
                </thead>

                <tbody>
                  {executions.map((execution) => (
                    <tr key={execution._id}>
                      <td>
                        <Badge
                          tone={
                            execution.status ===
                            "completed"
                              ? ""
                              : "warn"
                          }
                        >
                          {execution.status}
                        </Badge>
                      </td>

                      <td>
                        {execution.triggeredBy || "—"}
                      </td>

                      <td>
                        <b>
                          {execution.entityType || "—"}
                        </b>

                        <span>
                          {execution.entityId || "—"}
                        </span>
                      </td>

                      <td>
                        {formatDate(
                          execution.startedAt,
                        )}
                      </td>

                      <td>
                        {formatDate(
                          execution.completedAt,
                        )}
                      </td>

                      <td>
                        {execution.result ? (
                          <code>
                            {JSON.stringify(
                              execution.result,
                            )}
                          </code>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}
    </Page>
  );
}