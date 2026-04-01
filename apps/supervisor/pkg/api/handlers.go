package api

import (
	"net/http"
	"strconv"
	"time"

	"github.com/agenthive/supervisor/pkg/scheduler"
	"github.com/agenthive/supervisor/pkg/store"
	"github.com/agenthive/supervisor/pkg/types"
	"github.com/gin-gonic/gin"
)

// Handler holds the dependencies for API handlers
type Handler struct {
	store     *store.MemoryStore
	scheduler *scheduler.Scheduler
}

// NewHandler creates a new handler instance
func NewHandler(store *store.MemoryStore, sched *scheduler.Scheduler) *Handler {
	return &Handler{
		store:     store,
		scheduler: sched,
	}
}

// ListAgents returns all agents
func (h *Handler) ListAgents(c *gin.Context) {
	// teamId := c.Query("team_id") // Currently not used with memory store
	agents := h.store.GetAllAgents()
	
	c.JSON(http.StatusOK, types.AgentsResponse{
		Agents: agents,
		Total:  len(agents),
	})
}

// GetAgent returns a single agent with details
func (h *Handler) GetAgent(c *gin.Context) {
	id := c.Param("id")
	
	agent, err := h.store.GetAgent(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "agent not found"})
		return
	}
	
	tasks := h.store.GetTasksByAgentID(id)
	stats := h.store.GetAgentStats(id)
	
	c.JSON(http.StatusOK, types.AgentDetailResponse{
		Agent: *agent,
		Tasks: tasks,
		Stats: stats,
	})
}

// CreateAgent creates a new agent
func (h *Handler) CreateAgent(c *gin.Context) {
	var req types.CreateAgentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	agent := &types.Agent{
		Name:        req.Name,
		Role:        req.Role,
		Description: req.Description,
		Config:      req.Config,
		Status:      types.StatusIdle,
	}
	
	// Set avatar based on role
	agent.Avatar = getAvatarForRole(req.Role)
	
	if err := h.store.CreateAgent(agent); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	// Broadcast agent creation event
	if h.scheduler != nil {
		h.scheduler.BroadcastEvent(types.WebSocketEvent{
			Type:      "agent_created",
			Payload:   agent,
			Timestamp: time.Now(),
		})
	}
	
	c.JSON(http.StatusCreated, agent)
}

// UpdateAgent updates an existing agent
func (h *Handler) UpdateAgent(c *gin.Context) {
	id := c.Param("id")
	
	agent, err := h.store.GetAgent(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "agent not found"})
		return
	}
	
	var req types.UpdateAgentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	if req.Name != "" {
		agent.Name = req.Name
	}
	if req.Description != "" {
		agent.Description = req.Description
	}
	if req.Config != nil {
		agent.Config = req.Config
	}
	
	if err := h.store.UpdateAgent(agent); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	c.JSON(http.StatusOK, agent)
}

// DeleteAgent deletes an agent
func (h *Handler) DeleteAgent(c *gin.Context) {
	id := c.Param("id")
	
	if err := h.store.DeleteAgent(id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "agent not found"})
		return
	}
	
	// Broadcast agent deletion event
	if h.scheduler != nil {
		h.scheduler.BroadcastEvent(types.WebSocketEvent{
			Type:      "agent_deleted",
			Payload:   gin.H{"agentId": id},
			Timestamp: time.Now(),
		})
	}
	
	c.Status(http.StatusNoContent)
}

// StartAgent starts an agent
func (h *Handler) StartAgent(c *gin.Context) {
	id := c.Param("id")
	
	oldAgent, err := h.store.GetAgent(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "agent not found"})
		return
	}
	
	oldStatus := oldAgent.Status
	agent, err := h.store.UpdateAgentStatus(id, types.StatusWorking)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "agent not found"})
		return
	}
	
	// Broadcast state change event
	if h.scheduler != nil {
		h.scheduler.BroadcastEvent(types.AgentStateChangeEvent{
			Type: "agent_state_change",
			Payload: types.StateChangePayload{
				AgentID:  id,
				OldState: oldStatus,
				NewState: types.StatusWorking,
				Message:  "Agent started",
			},
			Timestamp: time.Now(),
		})
	}
	
	c.JSON(http.StatusOK, agent)
}

// StopAgent stops an agent
func (h *Handler) StopAgent(c *gin.Context) {
	id := c.Param("id")
	
	oldAgent, err := h.store.GetAgent(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "agent not found"})
		return
	}
	
	oldStatus := oldAgent.Status
	agent, err := h.store.UpdateAgentStatus(id, types.StatusIdle)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "agent not found"})
		return
	}
	
	// Clear current task
	agent.CurrentTask = nil
	h.store.UpdateAgent(agent)
	
	// Broadcast state change event
	if h.scheduler != nil {
		h.scheduler.BroadcastEvent(types.AgentStateChangeEvent{
			Type: "agent_state_change",
			Payload: types.StateChangePayload{
				AgentID:  id,
				OldState: oldStatus,
				NewState: types.StatusIdle,
				Message:  "Agent stopped",
			},
			Timestamp: time.Now(),
		})
	}
	
	c.JSON(http.StatusOK, agent)
}

// PauseAgent pauses an agent
func (h *Handler) PauseAgent(c *gin.Context) {
	id := c.Param("id")
	
	oldAgent, err := h.store.GetAgent(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "agent not found"})
		return
	}
	
	oldStatus := oldAgent.Status
	agent, err := h.store.UpdateAgentStatus(id, types.StatusPaused)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "agent not found"})
		return
	}
	
	// Broadcast state change event
	if h.scheduler != nil {
		h.scheduler.BroadcastEvent(types.AgentStateChangeEvent{
			Type: "agent_state_change",
			Payload: types.StateChangePayload{
				AgentID:  id,
				OldState: oldStatus,
				NewState: types.StatusPaused,
				Message:  "Agent paused",
			},
			Timestamp: time.Now(),
		})
	}
	
	c.JSON(http.StatusOK, agent)
}

// ResumeAgent resumes a paused agent
func (h *Handler) ResumeAgent(c *gin.Context) {
	id := c.Param("id")
	
	oldAgent, err := h.store.GetAgent(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "agent not found"})
		return
	}
	
	oldStatus := oldAgent.Status
	agent, err := h.store.UpdateAgentStatus(id, types.StatusWorking)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "agent not found"})
		return
	}
	
	// Broadcast state change event
	if h.scheduler != nil {
		h.scheduler.BroadcastEvent(types.AgentStateChangeEvent{
			Type: "agent_state_change",
			Payload: types.StateChangePayload{
				AgentID:  id,
				OldState: oldStatus,
				NewState: types.StatusWorking,
				Message:  "Agent resumed",
			},
			Timestamp: time.Now(),
		})
	}
	
	c.JSON(http.StatusOK, agent)
}

// SendCommand sends a command to an agent
func (h *Handler) SendCommand(c *gin.Context) {
	id := c.Param("id")
	
	_, err := h.store.GetAgent(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "agent not found"})
		return
	}
	
	var req types.CommandRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	// Log the command
	logMsg := "[COMMAND] " + req.Type
	if payload, ok := req.Payload.(map[string]interface{}); ok && len(payload) > 0 {
		logMsg += ": " + c.Request.URL.RawQuery
	}
	h.store.AppendAgentLog(id, logMsg)
	
	// Broadcast command event
	if h.scheduler != nil {
		h.scheduler.BroadcastEvent(types.WebSocketEvent{
			Type:      "command_received",
			Payload:   gin.H{"agentId": id, "command": req},
			Timestamp: time.Now(),
		})
	}
	
	c.Status(http.StatusNoContent)
}

// GetAgentLogs returns logs for an agent
func (h *Handler) GetAgentLogs(c *gin.Context) {
	id := c.Param("id")
	linesStr := c.DefaultQuery("lines", "100")
	
	lines, err := strconv.Atoi(linesStr)
	if err != nil {
		lines = 100
	}
	
	logs, err := h.store.GetAgentLogs(id, lines)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "agent not found"})
		return
	}
	
	c.JSON(http.StatusOK, logs)
}

// ListTasks returns all tasks
func (h *Handler) ListTasks(c *gin.Context) {
	tasks := h.store.GetAllTasks()
	c.JSON(http.StatusOK, gin.H{"tasks": tasks, "total": len(tasks)})
}

// GetTask returns a single task
func (h *Handler) GetTask(c *gin.Context) {
	id := c.Param("id")
	
	task, err := h.store.GetTask(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
		return
	}
	
	c.JSON(http.StatusOK, task)
}

// CreateTask creates a new task
func (h *Handler) CreateTask(c *gin.Context) {
	var task types.Task
	if err := c.ShouldBindJSON(&task); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	if err := h.store.CreateTask(&task); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	// Broadcast task creation event
	if h.scheduler != nil {
		h.scheduler.BroadcastEvent(types.WebSocketEvent{
			Type:      "task_created",
			Payload:   task,
			Timestamp: time.Now(),
		})
	}
	
	c.JSON(http.StatusCreated, task)
}

// UpdateTask updates an existing task
func (h *Handler) UpdateTask(c *gin.Context) {
	id := c.Param("id")
	
	existingTask, err := h.store.GetTask(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
		return
	}
	
	var updates types.Task
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	// Update fields
	if updates.Title != "" {
		existingTask.Title = updates.Title
	}
	if updates.Description != "" {
		existingTask.Description = updates.Description
	}
	if updates.Status != "" {
		existingTask.Status = updates.Status
	}
	if updates.Priority != "" {
		existingTask.Priority = updates.Priority
	}
	if updates.AssignedTo != "" {
		existingTask.AssignedTo = updates.AssignedTo
	}
	if updates.Progress >= 0 {
		existingTask.Progress = updates.Progress
	}
	
	if err := h.store.UpdateTask(existingTask); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	c.JSON(http.StatusOK, existingTask)
}

// DeleteTask deletes a task
func (h *Handler) DeleteTask(c *gin.Context) {
	id := c.Param("id")
	
	if err := h.store.DeleteTask(id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
		return
	}
	
	c.Status(http.StatusNoContent)
}

// ListSprints returns all sprints (mock implementation)
func (h *Handler) ListSprints(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"sprints": []interface{}{}, "total": 0})
}

// CreateSprint creates a new sprint (mock implementation)
func (h *Handler) CreateSprint(c *gin.Context) {
	c.JSON(http.StatusCreated, gin.H{"id": "sprint-1", "status": "planning"})
}

// GetSprint returns a sprint (mock implementation)
func (h *Handler) GetSprint(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"id": c.Param("id"), "status": "active"})
}

// UpdateSprint updates a sprint (mock implementation)
func (h *Handler) UpdateSprint(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"id": c.Param("id"), "status": "updated"})
}

// Helper function to get avatar emoji based on role
func getAvatarForRole(role types.AgentRole) string {
	switch role {
	case types.RoleDirector:
		return "👑"
	case types.RoleScrumMaster:
		return "📝"
	case types.RoleTechLead:
		return "🎯"
	case types.RoleBackendDev:
		return "⚙️"
	case types.RoleFrontendDev:
		return "🎨"
	case types.RoleQAEngineer:
		return "🧪"
	case types.RoleDevOps:
		return "🚀"
	default:
		return "🤖"
	}
}
