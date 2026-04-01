package scheduler

import (
	"context"
	"sync"
	"time"

	"github.com/agenthive/supervisor/pkg/config"
	"github.com/agenthive/supervisor/pkg/types"
	"github.com/sirupsen/logrus"
)

// Scheduler manages agent scheduling and task distribution
type Scheduler struct {
	config   *config.Config
	log      *logrus.Logger
	mu       sync.RWMutex
	stopCh   chan struct{}
	hub      WebSocketHub
}

// WebSocketHub interface for broadcasting events
type WebSocketHub interface {
	BroadcastEvent(event interface{})
}

// New creates a new scheduler instance
func New(cfg *config.Config, log *logrus.Logger) *Scheduler {
	return &Scheduler{
		config: cfg,
		log:    log,
		stopCh: make(chan struct{}),
	}
}

// SetWebSocketHub sets the WebSocket hub for broadcasting events
func (s *Scheduler) SetWebSocketHub(hub WebSocketHub) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.hub = hub
}

// BroadcastEvent broadcasts an event through the WebSocket hub
func (s *Scheduler) BroadcastEvent(event interface{}) {
	s.mu.RLock()
	hub := s.hub
	s.mu.RUnlock()
	
	if hub != nil {
		hub.BroadcastEvent(event)
	}
}

// Start starts the scheduler
func (s *Scheduler) Start(ctx context.Context) {
	s.log.Info("Scheduler started")
	
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	
	for {
		select {
		case <-ctx.Done():
			s.log.Info("Scheduler stopped")
			return
		case <-s.stopCh:
			s.log.Info("Scheduler stopped")
			return
		case <-ticker.C:
			s.performHeartbeat()
		}
	}
}

// Stop stops the scheduler
func (s *Scheduler) Stop() {
	close(s.stopCh)
}

// performHeartbeat performs periodic tasks
func (s *Scheduler) performHeartbeat() {
	// Simulate sending heartbeat events
	s.log.Debug("Performing scheduler heartbeat")
	
	// Broadcast a heartbeat event to all connected clients
	if s.hub != nil {
		s.hub.BroadcastEvent(types.WebSocketEvent{
			Type:      "heartbeat",
			Payload:   map[string]interface{}{"timestamp": time.Now().Unix()},
			Timestamp: time.Now(),
		})
	}
}

// ScheduleTask schedules a task to an agent
func (s *Scheduler) ScheduleTask(task *types.Task, agentID string) error {
	s.log.WithFields(logrus.Fields{
		"task_id":  task.ID,
		"agent_id": agentID,
	}).Info("Scheduling task")
	
	// In a real implementation, this would communicate with the agent
	// For now, we just broadcast the assignment
	if s.hub != nil {
		s.hub.BroadcastEvent(types.WebSocketEvent{
			Type: "task_assigned",
			Payload: map[string]interface{}{
				"task_id":  task.ID,
				"agent_id": agentID,
			},
			Timestamp: time.Now(),
		})
	}
	
	return nil
}

// AssignAgent assigns an agent to a task
func (s *Scheduler) AssignAgent(taskID string, agentID string) error {
	s.log.WithFields(logrus.Fields{
		"task_id":  taskID,
		"agent_id": agentID,
	}).Info("Assigning agent to task")
	
	return nil
}

// GetAgentStatus gets the status of an agent
func (s *Scheduler) GetAgentStatus(agentID string) (types.AgentStatus, error) {
	return types.StatusIdle, nil
}

// ScaleAgent scales an agent up or down
func (s *Scheduler) ScaleAgent(agentID string, replicas int) error {
	s.log.WithFields(logrus.Fields{
		"agent_id": agentID,
		"replicas": replicas,
	}).Info("Scaling agent")
	
	return nil
}
