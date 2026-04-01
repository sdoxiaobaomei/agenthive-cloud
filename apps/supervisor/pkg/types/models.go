package types

import (
	"time"
)

// AgentRole represents the role of an agent
type AgentRole string

const (
	RoleDirector     AgentRole = "director"
	RoleScrumMaster  AgentRole = "scrum_master"
	RoleTechLead     AgentRole = "tech_lead"
	RoleBackendDev   AgentRole = "backend_dev"
	RoleFrontendDev  AgentRole = "frontend_dev"
	RoleQAEngineer   AgentRole = "qa_engineer"
	RoleDevOps       AgentRole = "devops_engineer"
	RoleCustom       AgentRole = "custom"
)

// AgentStatus represents the status of an agent
type AgentStatus string

const (
	StatusIdle      AgentStatus = "idle"
	StatusStarting  AgentStatus = "starting"
	StatusWorking   AgentStatus = "working"
	StatusPaused    AgentStatus = "paused"
	StatusError     AgentStatus = "error"
	StatusCompleted AgentStatus = "completed"
)

// TaskStatus represents the status of a task
type TaskStatus string

const (
	TaskPending    TaskStatus = "pending"
	TaskAssigned   TaskStatus = "assigned"
	TaskRunning    TaskStatus = "running"
	TaskCompleted  TaskStatus = "completed"
	TaskFailed     TaskStatus = "failed"
	TaskCancelled  TaskStatus = "cancelled"
)

// TaskPriority represents the priority of a task
type TaskPriority string

const (
	PriorityLow      TaskPriority = "low"
	PriorityMedium   TaskPriority = "medium"
	PriorityHigh     TaskPriority = "high"
	PriorityCritical TaskPriority = "critical"
)

// CurrentTask represents the current task an agent is working on
type CurrentTask struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Progress int    `json:"progress"`
}

// Agent represents an AI agent
type Agent struct {
	ID              string       `json:"id"`
	Name            string       `json:"name"`
	Role            AgentRole    `json:"role"`
	Status          AgentStatus  `json:"status"`
	Avatar          string       `json:"avatar,omitempty"`
	Description     string       `json:"description,omitempty"`
	Config          interface{}  `json:"config,omitempty"`
	CurrentTask     *CurrentTask `json:"currentTask,omitempty"`
	PodIP           string       `json:"podIp,omitempty"`
	LastHeartbeatAt time.Time    `json:"lastHeartbeatAt"`
	CreatedAt       time.Time    `json:"createdAt"`
	UpdatedAt       time.Time    `json:"updatedAt"`
}

// Task represents a task to be executed by an agent
type Task struct {
	ID          string       `json:"id"`
	Type        string       `json:"type"`
	Status      TaskStatus   `json:"status"`
	Priority    TaskPriority `json:"priority"`
	Title       string       `json:"title"`
	Description string       `json:"description,omitempty"`
	AssignedTo  string       `json:"assignedTo,omitempty"`
	Input       interface{}  `json:"input"`
	Output      interface{}  `json:"output,omitempty"`
	Progress    int          `json:"progress"`
	CreatedAt   time.Time    `json:"createdAt"`
	StartedAt   *time.Time   `json:"startedAt,omitempty"`
	CompletedAt *time.Time   `json:"completedAt,omitempty"`
	ParentID    string       `json:"parentId,omitempty"`
	Subtasks    []Task       `json:"subtasks,omitempty"`
}

// MessageType represents the type of a message
type MessageType string

const (
	MessageText    MessageType = "text"
	MessageCode    MessageType = "code"
	MessageImage   MessageType = "image"
	MessageFile    MessageType = "file"
	MessageCommand MessageType = "command"
)

// SenderType represents the sender of a message
type SenderType string

const (
	SenderUser   SenderType = "user"
	SenderAgent  SenderType = "agent"
	SenderSystem SenderType = "system"
)

// Message represents a chat message
type Message struct {
	ID          string      `json:"id"`
	SenderType  SenderType  `json:"senderType"`
	SenderID    string      `json:"senderId,omitempty"`
	SenderName  string      `json:"senderName,omitempty"`
	SenderRole  AgentRole   `json:"senderRole,omitempty"`
	Content     string      `json:"content"`
	ContentType MessageType `json:"contentType"`
	Language    string      `json:"language,omitempty"`
	Metadata    interface{} `json:"metadata,omitempty"`
	CreatedAt   time.Time   `json:"createdAt"`
	TaskID      string      `json:"taskId,omitempty"`
}

// CreateAgentRequest represents a request to create an agent
type CreateAgentRequest struct {
	Name        string      `json:"name" binding:"required"`
	Role        AgentRole   `json:"role" binding:"required"`
	Description string      `json:"description,omitempty"`
	Config      interface{} `json:"config,omitempty"`
}

// UpdateAgentRequest represents a request to update an agent
type UpdateAgentRequest struct {
	Name        string      `json:"name,omitempty"`
	Description string      `json:"description,omitempty"`
	Config      interface{} `json:"config,omitempty"`
}

// CommandRequest represents a command request
type CommandRequest struct {
	Type    string      `json:"type" binding:"required"`
	Payload interface{} `json:"payload,omitempty"`
}

// AgentsResponse represents the response for listing agents
type AgentsResponse struct {
	Agents []Agent `json:"agents"`
	Total  int     `json:"total"`
}

// AgentDetailResponse represents the response for getting an agent detail
type AgentDetailResponse struct {
	Agent  Agent       `json:"agent"`
	Tasks  []Task      `json:"tasks"`
	Stats  AgentStats  `json:"stats"`
}

// AgentStats represents agent statistics
type AgentStats struct {
	TotalTasks        int     `json:"totalTasks"`
	CompletedTasks    int     `json:"completedTasks"`
	FailedTasks       int     `json:"failedTasks"`
	AvgCompletionTime float64 `json:"avgCompletionTime"`
}

// WebSocketEvent represents a WebSocket event
type WebSocketEvent struct {
	Type      string      `json:"type"`
	Payload   interface{} `json:"payload"`
	Timestamp time.Time   `json:"timestamp"`
}

// AgentStateChangeEvent represents an agent state change event
type AgentStateChangeEvent struct {
	Type    string      `json:"type"`
	Payload StateChangePayload `json:"payload"`
	Timestamp time.Time `json:"timestamp"`
}

// StateChangePayload represents the payload for state change
type StateChangePayload struct {
	AgentID   string      `json:"agentId"`
	OldState  AgentStatus `json:"oldState"`
	NewState  AgentStatus `json:"newState"`
	Progress  int         `json:"progress,omitempty"`
	Message   string      `json:"message,omitempty"`
}

// LogOutputEvent represents a log output event
type LogOutputEvent struct {
	Type    string          `json:"type"`
	Payload LogOutputPayload `json:"payload"`
	Timestamp time.Time     `json:"timestamp"`
}

// LogOutputPayload represents the payload for log output
type LogOutputPayload struct {
	AgentID  string `json:"agentId"`
	Data     string `json:"data"`
	IsError  bool   `json:"isError"`
}
