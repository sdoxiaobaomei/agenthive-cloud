package store

import (
	"errors"
	"sync"
	"time"

	"github.com/agenthive/supervisor/pkg/types"
	"github.com/google/uuid"
)

var (
	ErrAgentNotFound = errors.New("agent not found")
	ErrTaskNotFound  = errors.New("task not found")
	ErrAgentExists   = errors.New("agent already exists")
)

// MemoryStore is an in-memory store for agents and tasks
type MemoryStore struct {
	agents map[string]*types.Agent
	tasks  map[string]*types.Task
	logs   map[string][]string
	mu     sync.RWMutex
}

// NewMemoryStore creates a new memory store
func NewMemoryStore() *MemoryStore {
	store := &MemoryStore{
		agents: make(map[string]*types.Agent),
		tasks:  make(map[string]*types.Task),
		logs:   make(map[string][]string),
	}
	// Initialize with mock data
	store.initMockData()
	return store
}

// initMockData initializes the store with mock data
func (s *MemoryStore) initMockData() {
	now := time.Now()
	
	// Create mock agents
	agents := []*types.Agent{
		{
			ID:              uuid.New().String(),
			Name:            "Scrum Master",
			Role:            types.RoleScrumMaster,
			Status:          types.StatusWorking,
			Avatar:          "📝",
			Description:     "负责 Sprint 规划和任务分配",
			LastHeartbeatAt: now,
			CreatedAt:       now.Add(-24 * time.Hour),
			UpdatedAt:       now,
		},
		{
			ID:              uuid.New().String(),
			Name:            "Tech Lead",
			Role:            types.RoleTechLead,
			Status:          types.StatusIdle,
			Avatar:          "🎯",
			Description:     "技术架构设计和代码审查",
			LastHeartbeatAt: now,
			CreatedAt:       now.Add(-24 * time.Hour),
			UpdatedAt:       now,
		},
		{
			ID:              uuid.New().String(),
			Name:            "Backend Dev",
			Role:            types.RoleBackendDev,
			Status:          types.StatusWorking,
			Avatar:          "⚙️",
			Description:     "后端 API 开发",
			CurrentTask: &types.CurrentTask{
				ID:       uuid.New().String(),
				Title:    "实现用户认证 API",
				Progress: 65,
			},
			LastHeartbeatAt: now,
			CreatedAt:       now.Add(-24 * time.Hour),
			UpdatedAt:       now,
		},
		{
			ID:              uuid.New().String(),
			Name:            "Frontend Dev",
			Role:            types.RoleFrontendDev,
			Status:          types.StatusPaused,
			Avatar:          "🎨",
			Description:     "前端界面开发",
			LastHeartbeatAt: now,
			CreatedAt:       now.Add(-24 * time.Hour),
			UpdatedAt:       now,
		},
		{
			ID:              uuid.New().String(),
			Name:            "QA Engineer",
			Role:            types.RoleQAEngineer,
			Status:          types.StatusIdle,
			Avatar:          "🧪",
			Description:     "自动化测试和质量保证",
			LastHeartbeatAt: now,
			CreatedAt:       now.Add(-24 * time.Hour),
			UpdatedAt:       now,
		},
		{
			ID:              uuid.New().String(),
			Name:            "DevOps",
			Role:            types.RoleDevOps,
			Status:          types.StatusError,
			Avatar:          "🚀",
			Description:     "CI/CD 和部署自动化",
			LastHeartbeatAt: now,
			CreatedAt:       now.Add(-24 * time.Hour),
			UpdatedAt:       now,
		},
	}
	
	for _, agent := range agents {
		s.agents[agent.ID] = agent
	}
	
	// Create mock tasks
	tasks := []*types.Task{
		{
			ID:          uuid.New().String(),
			Type:        "feature",
			Status:      types.TaskRunning,
			Priority:    types.PriorityHigh,
			Title:       "实现用户认证系统",
			Description: "包括登录、注册、JWT 认证等功能",
			AssignedTo:  agents[2].ID, // Backend Dev
			Input: map[string]interface{}{
				"requirements": []string{"JWT auth", "Password hashing", "Session management"},
			},
			Progress:  65,
			CreatedAt: now.Add(-4 * time.Hour),
			StartedAt: &[]time.Time{now.Add(-2 * time.Hour)}[0],
		},
		{
			ID:          uuid.New().String(),
			Type:        "feature",
			Status:      types.TaskPending,
			Priority:    types.PriorityHigh,
			Title:       "设计 Dashboard UI",
			Description: "设计主控制台的用户界面",
			AssignedTo:  agents[3].ID, // Frontend Dev
			Input: map[string]interface{}{
				"design": "mockup-url",
			},
			Progress:  0,
			CreatedAt: now.Add(-3 * time.Hour),
		},
		{
			ID:          uuid.New().String(),
			Type:        "bugfix",
			Status:      types.TaskCompleted,
			Priority:    types.PriorityMedium,
			Title:       "修复 API 响应格式问题",
			Description: "统一 API 响应格式为 JSON",
			AssignedTo:  agents[2].ID, // Backend Dev
			Input: map[string]interface{}{
				"issue": "inconsistent-response",
			},
			Progress:    100,
			CreatedAt:   now.Add(-6 * time.Hour),
			StartedAt:   &[]time.Time{now.Add(-5 * time.Hour)}[0],
			CompletedAt: &[]time.Time{now.Add(-3 * time.Hour)}[0],
		},
		{
			ID:          uuid.New().String(),
			Type:        "test",
			Status:      types.TaskAssigned,
			Priority:    types.PriorityMedium,
			Title:       "编写单元测试",
			Description: "为核心模块编写单元测试",
			AssignedTo:  agents[4].ID, // QA Engineer
			Input: map[string]interface{}{
				"coverage": "80%",
			},
			Progress:  20,
			CreatedAt: now.Add(-2 * time.Hour),
		},
	}
	
	for _, task := range tasks {
		s.tasks[task.ID] = task
	}
	
	// Initialize mock logs
	s.logs[agents[2].ID] = []string{
		"[INFO] Agent started",
		"[INFO] Connected to message bus",
		"[INFO] Received task: 实现用户认证 API",
		"[DEBUG] Analyzing requirements...",
		"[INFO] Starting implementation",
		"[DEBUG] Creating user model...",
		"[DEBUG] Setting up JWT middleware...",
		"[INFO] Progress: 65%",
	}
}

// Agent methods

// GetAllAgents returns all agents
func (s *MemoryStore) GetAllAgents() []types.Agent {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	agents := make([]types.Agent, 0, len(s.agents))
	for _, agent := range s.agents {
		agents = append(agents, *agent)
	}
	return agents
}

// GetAgent returns an agent by ID
func (s *MemoryStore) GetAgent(id string) (*types.Agent, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	agent, exists := s.agents[id]
	if !exists {
		return nil, ErrAgentNotFound
	}
	return agent, nil
}

// CreateAgent creates a new agent
func (s *MemoryStore) CreateAgent(agent *types.Agent) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	if agent.ID == "" {
		agent.ID = uuid.New().String()
	}
	
	now := time.Now()
	agent.CreatedAt = now
	agent.UpdatedAt = now
	agent.LastHeartbeatAt = now
	
	if agent.Status == "" {
		agent.Status = types.StatusIdle
	}
	
	s.agents[agent.ID] = agent
	return nil
}

// UpdateAgent updates an existing agent
func (s *MemoryStore) UpdateAgent(agent *types.Agent) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	if _, exists := s.agents[agent.ID]; !exists {
		return ErrAgentNotFound
	}
	
	agent.UpdatedAt = time.Now()
	s.agents[agent.ID] = agent
	return nil
}

// DeleteAgent deletes an agent by ID
func (s *MemoryStore) DeleteAgent(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	if _, exists := s.agents[id]; !exists {
		return ErrAgentNotFound
	}
	
	delete(s.agents, id)
	delete(s.logs, id)
	return nil
}

// UpdateAgentStatus updates an agent's status
func (s *MemoryStore) UpdateAgentStatus(id string, status types.AgentStatus) (*types.Agent, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	agent, exists := s.agents[id]
	if !exists {
		return nil, ErrAgentNotFound
	}
	
	agent.Status = status
	agent.UpdatedAt = time.Now()
	agent.LastHeartbeatAt = time.Now()
	
	return agent, nil
}

// GetTasksByAgentID returns tasks assigned to an agent
func (s *MemoryStore) GetTasksByAgentID(agentID string) []types.Task {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	tasks := make([]types.Task, 0)
	for _, task := range s.tasks {
		if task.AssignedTo == agentID {
			tasks = append(tasks, *task)
		}
	}
	return tasks
}

// GetAgentStats returns statistics for an agent
func (s *MemoryStore) GetAgentStats(agentID string) types.AgentStats {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	stats := types.AgentStats{}
	
	for _, task := range s.tasks {
		if task.AssignedTo == agentID {
			stats.TotalTasks++
			if task.Status == types.TaskCompleted {
				stats.CompletedTasks++
				if task.CompletedAt != nil && task.StartedAt != nil {
					duration := task.CompletedAt.Sub(*task.StartedAt).Minutes()
					stats.AvgCompletionTime = (stats.AvgCompletionTime*float64(stats.CompletedTasks-1) + duration) / float64(stats.CompletedTasks)
				}
			} else if task.Status == types.TaskFailed {
				stats.FailedTasks++
			}
		}
	}
	
	return stats
}

// Task methods

// GetAllTasks returns all tasks
func (s *MemoryStore) GetAllTasks() []types.Task {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	tasks := make([]types.Task, 0, len(s.tasks))
	for _, task := range s.tasks {
		tasks = append(tasks, *task)
	}
	return tasks
}

// GetTask returns a task by ID
func (s *MemoryStore) GetTask(id string) (*types.Task, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	task, exists := s.tasks[id]
	if !exists {
		return nil, ErrTaskNotFound
	}
	return task, nil
}

// CreateTask creates a new task
func (s *MemoryStore) CreateTask(task *types.Task) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	if task.ID == "" {
		task.ID = uuid.New().String()
	}
	
	task.CreatedAt = time.Now()
	if task.Status == "" {
		task.Status = types.TaskPending
	}
	if task.Priority == "" {
		task.Priority = types.PriorityMedium
	}
	
	s.tasks[task.ID] = task
	return nil
}

// UpdateTask updates an existing task
func (s *MemoryStore) UpdateTask(task *types.Task) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	if _, exists := s.tasks[task.ID]; !exists {
		return ErrTaskNotFound
	}
	
	s.tasks[task.ID] = task
	return nil
}

// DeleteTask deletes a task by ID
func (s *MemoryStore) DeleteTask(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	if _, exists := s.tasks[id]; !exists {
		return ErrTaskNotFound
	}
	
	delete(s.tasks, id)
	return nil
}

// Log methods

// GetAgentLogs returns logs for an agent
func (s *MemoryStore) GetAgentLogs(agentID string, lines int) ([]string, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	if _, exists := s.agents[agentID]; !exists {
		return nil, ErrAgentNotFound
	}
	
	logs := s.logs[agentID]
	if len(logs) == 0 {
		return []string{}, nil
	}
	
	if lines > 0 && lines < len(logs) {
		return logs[len(logs)-lines:], nil
	}
	return logs, nil
}

// AppendAgentLog appends a log entry for an agent
func (s *MemoryStore) AppendAgentLog(agentID string, log string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	if _, exists := s.agents[agentID]; !exists {
		return ErrAgentNotFound
	}
	
	s.logs[agentID] = append(s.logs[agentID], log)
	return nil
}
