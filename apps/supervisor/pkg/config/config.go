package config

import (
	"os"

	"gopkg.in/yaml.v3"
)

// Config holds the application configuration
type Config struct {
	Server   ServerConfig   `yaml:"server"`
	Database DatabaseConfig `yaml:"database"`
	Redis    RedisConfig    `yaml:"redis"`
	K8s      K8sConfig     `yaml:"kubernetes"`
}

// ServerConfig holds server-related configuration
type ServerConfig struct {
	Port         string   `yaml:"port"`
	Host         string   `yaml:"host"`
	AllowOrigins []string `yaml:"allow_origins"`
}

// DatabaseConfig holds database-related configuration
type DatabaseConfig struct {
	Host     string `yaml:"host"`
	Port     int    `yaml:"port"`
	User     string `yaml:"user"`
	Password string `yaml:"password"`
	Database string `yaml:"database"`
	SSLMode  string `yaml:"ssl_mode"`
}

// RedisConfig holds Redis-related configuration
type RedisConfig struct {
	Host     string `yaml:"host"`
	Port     int    `yaml:"port"`
	Password string `yaml:"password"`
	DB       int    `yaml:"db"`
}

// K8sConfig holds Kubernetes-related configuration
type K8sConfig struct {
	Namespace   string `yaml:"namespace"`
	KubeConfig  string `yaml:"kubeconfig"`
	InCluster   bool   `yaml:"in_cluster"`
}

// Load loads configuration from a file
func Load(path string) (*Config, error) {
	// Default configuration
	cfg := &Config{
		Server: ServerConfig{
			Port:         "8080",
			Host:         "0.0.0.0",
			AllowOrigins: []string{"*"},
		},
		Database: DatabaseConfig{
			Host:     "localhost",
			Port:     5432,
			User:     "agenthive",
			Password: "agenthive",
			Database: "agenthive",
			SSLMode:  "disable",
		},
		Redis: RedisConfig{
			Host:     "localhost",
			Port:     6379,
			Password: "",
			DB:       0,
		},
		K8s: K8sConfig{
			Namespace:  "default",
			InCluster:  false,
		},
	}

	// Try to load from file if it exists
	data, err := os.ReadFile(path)
	if err != nil {
		// If file doesn't exist, return default config
		if os.IsNotExist(err) {
			return cfg, nil
		}
		return nil, err
	}

	// Parse YAML
	if err := yaml.Unmarshal(data, cfg); err != nil {
		return nil, err
	}

	// Override with environment variables if set
	if port := os.Getenv("SERVER_PORT"); port != "" {
		cfg.Server.Port = port
	}
	if host := os.Getenv("SERVER_HOST"); host != "" {
		cfg.Server.Host = host
	}

	return cfg, nil
}

// DefaultConfig returns a default configuration
func DefaultConfig() *Config {
	return &Config{
		Server: ServerConfig{
			Port:         "8080",
			Host:         "0.0.0.0",
			AllowOrigins: []string{"*"},
		},
		Database: DatabaseConfig{
			Host:     "localhost",
			Port:     5432,
			User:     "agenthive",
			Password: "agenthive",
			Database: "agenthive",
			SSLMode:  "disable",
		},
		Redis: RedisConfig{
			Host:     "localhost",
			Port:     6379,
			Password: "",
			DB:       0,
		},
		K8s: K8sConfig{
			Namespace:  "default",
			InCluster:  false,
		},
	}
}
