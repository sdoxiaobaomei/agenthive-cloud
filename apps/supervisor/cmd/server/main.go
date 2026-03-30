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
		log.WithError(err).Fatal("Failed to load configuration")
	}

	// Initialize scheduler
	sched := scheduler.New(cfg, log)
	go sched.Start(context.Background())

	// Setup HTTP server
	router := setupRouter(log, sched)

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

	log.Info("Server exited")
}

func setupRouter(log *logrus.Logger, sched *scheduler.Scheduler) *gin.Engine {
	if gin.Mode() == gin.ReleaseMode {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(api.LoggerMiddleware(log))
	r.Use(api.CORSMiddleware())

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "healthy",
			"service":   "supervisor",
			"timestamp": time.Now().UTC(),
		})
	})

	// API routes
	v1 := r.Group("/api/v1")
	{
		// Agent management
		agents := v1.Group("/agents")
		{
			agents.GET("", api.ListAgents(sched))
			agents.POST("", api.CreateAgent(sched))
			agents.GET("/:id", api.GetAgent(sched))
			agents.POST("/:id/command", api.SendCommand(sched))
			agents.DELETE("/:id", api.DeleteAgent(sched))
		}

		// Task management
		tasks := v1.Group("/tasks")
		{
			tasks.GET("", api.ListTasks(sched))
			tasks.POST("", api.CreateTask(sched))
			tasks.GET("/:id", api.GetTask(sched))
		}

		// Sprint management
		sprints := v1.Group("/sprints")
		{
			sprints.GET("", api.ListSprints)
			sprints.POST("", api.CreateSprint)
			sprints.GET("/:id", api.GetSprint)
			sprints.PUT("/:id", api.UpdateSprint)
		}
	}

	// WebSocket endpoint for real-time updates
	r.GET("/ws", api.WebSocketHandler(sched, log))

	return r
}
