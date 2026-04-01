package main

import (
	"context"
	"flag"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/agenthive/supervisor/pkg/api"
	"github.com/agenthive/supervisor/pkg/config"
	"github.com/agenthive/supervisor/pkg/scheduler"
	"github.com/agenthive/supervisor/pkg/store"
	"github.com/agenthive/supervisor/pkg/websocket"
	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

var (
	configPath = flag.String("config", "config.yaml", "Path to configuration file")
	port       = flag.String("port", "8080", "Server port")
)

func main() {
	flag.Parse()

	// Initialize logger
	log := logrus.New()
	log.SetFormatter(&logrus.JSONFormatter{})
	log.SetLevel(logrus.InfoLevel)

	log.Info("Starting AgentHive Supervisor...")

	// Load configuration
	cfg, err := config.Load(*configPath)
	if err != nil {
		log.WithError(err).Warn("Failed to load configuration, using defaults")
		cfg = config.DefaultConfig()
	}

	// Initialize memory store
	memStore := store.NewMemoryStore()
	log.Info("Memory store initialized with mock data")

	// Initialize WebSocket hub
	hub := websocket.NewHub(log)
	go hub.Run()
	log.Info("WebSocket hub started")

	// Initialize scheduler
	sched := scheduler.New(cfg, log)
	sched.SetWebSocketHub(hub)
	go sched.Start(context.Background())
	log.Info("Scheduler started")

	// Create API handler
	handler := api.NewHandler(memStore, sched)

	// Setup HTTP server
	router := setupRouter(log, handler, hub)

	srv := &http.Server{
		Addr:    ":" + *port,
		Handler: router,
	}

	// Start server in goroutine
	go func() {
		log.WithField("port", *port).Info("Server starting")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.WithError(err).Fatal("Failed to start server")
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info("Shutting down server...")

	// Graceful shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.WithError(err).Error("Server forced to shutdown")
	}

	sched.Stop()
	log.Info("Server exited")
}

func setupRouter(log *logrus.Logger, handler *api.Handler, hub *websocket.Hub) *gin.Engine {
	// Set Gin mode
	if os.Getenv("GIN_MODE") == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(api.RecoveryMiddleware(log))
	r.Use(api.LoggerMiddleware(log))
	r.Use(api.CORSMiddleware())

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "healthy",
			"service":   "supervisor",
			"timestamp": time.Now().UTC(),
			"version":   "1.0.0",
		})
	})

	// API routes - match frontend expectations
	// Frontend uses: /api/agents, /api/tasks, etc.
	apiGroup := r.Group("/api")
	{
		// Agent management
		agents := apiGroup.Group("/agents")
		{
			agents.GET("", handler.ListAgents)
			agents.POST("", handler.CreateAgent)
			agents.GET("/:id", handler.GetAgent)
			agents.PATCH("/:id", handler.UpdateAgent)
			agents.DELETE("/:id", handler.DeleteAgent)
			
			// Agent control actions
			agents.POST("/:id/start", handler.StartAgent)
			agents.POST("/:id/stop", handler.StopAgent)
			agents.POST("/:id/pause", handler.PauseAgent)
			agents.POST("/:id/resume", handler.ResumeAgent)
			
			// Command and logs
			agents.POST("/:id/command", handler.SendCommand)
			agents.GET("/:id/logs", handler.GetAgentLogs)
		}

		// Task management
		tasks := apiGroup.Group("/tasks")
		{
			tasks.GET("", handler.ListTasks)
			tasks.POST("", handler.CreateTask)
			tasks.GET("/:id", handler.GetTask)
			tasks.PATCH("/:id", handler.UpdateTask)
			tasks.DELETE("/:id", handler.DeleteTask)
		}

		// Sprint management (mock for now)
		sprints := apiGroup.Group("/sprints")
		{
			sprints.GET("", handler.ListSprints)
			sprints.POST("", handler.CreateSprint)
			sprints.GET("/:id", handler.GetSprint)
			sprints.PUT("/:id", handler.UpdateSprint)
		}
	}

	// Legacy API routes for backward compatibility
	v1 := r.Group("/api/v1")
	{
		agents := v1.Group("/agents")
		{
			agents.GET("", handler.ListAgents)
			agents.POST("", handler.CreateAgent)
			agents.GET("/:id", handler.GetAgent)
			agents.POST("/:id/command", handler.SendCommand)
			agents.DELETE("/:id", handler.DeleteAgent)
		}

		tasks := v1.Group("/tasks")
		{
			tasks.GET("", handler.ListTasks)
			tasks.POST("", handler.CreateTask)
			tasks.GET("/:id", handler.GetTask)
		}

		sprints := v1.Group("/sprints")
		{
			sprints.GET("", handler.ListSprints)
			sprints.POST("", handler.CreateSprint)
			sprints.GET("/:id", handler.GetSprint)
			sprints.PUT("/:id", handler.UpdateSprint)
		}
	}

	// WebSocket endpoint for real-time updates
	r.GET("/ws", func(c *gin.Context) {
		websocket.ServeWs(hub, c.Writer, c.Request, log)
	})

	// WebSocket endpoint with /api prefix for consistency
	r.GET("/api/ws", func(c *gin.Context) {
		websocket.ServeWs(hub, c.Writer, c.Request, log)
	})

	return r
}
