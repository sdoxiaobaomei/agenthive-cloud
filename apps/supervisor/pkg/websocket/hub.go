package websocket

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/agenthive/supervisor/pkg/types"
	"github.com/gorilla/websocket"
	"github.com/sirupsen/logrus"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins in development
	},
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

// Client represents a WebSocket client connection
type Client struct {
	Hub      *Hub
	Conn     *websocket.Conn
	Send     chan []byte
	ClientID string
}

// Hub maintains the set of active clients and broadcasts messages
type Hub struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
	log        *logrus.Logger
}

// NewHub creates a new WebSocket hub
func NewHub(log *logrus.Logger) *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		broadcast:  make(chan []byte, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		log:        log,
	}
}

// Run starts the hub's event loop
func (h *Hub) Run() {
	h.log.Info("WebSocket Hub started")
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()
			h.log.WithField("client_id", client.ClientID).Info("Client connected")

			// Send welcome message
			welcome := types.WebSocketEvent{
				Type:      "connected",
				Payload:   map[string]string{"client_id": client.ClientID},
				Timestamp: time.Now(),
			}
			if data, err := json.Marshal(welcome); err == nil {
				select {
				case client.Send <- data:
				default:
					close(client.Send)
				}
			}

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.Send)
			}
			h.mu.Unlock()
			h.log.WithField("client_id", client.ClientID).Info("Client disconnected")

		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.Send <- message:
				default:
					// Client's send channel is full, close and remove
					close(client.Send)
					delete(h.clients, client)
				}
			}
			h.mu.RUnlock()
		}
	}
}

// Broadcast sends a message to all connected clients
func (h *Hub) Broadcast(message []byte) {
	h.broadcast <- message
}

// BroadcastEvent broadcasts a typed event to all clients
func (h *Hub) BroadcastEvent(event interface{}) {
	data, err := json.Marshal(event)
	if err != nil {
		h.log.WithError(err).Error("Failed to marshal WebSocket event")
		return
	}
	h.Broadcast(data)
}

// GetClientCount returns the number of connected clients
func (h *Hub) GetClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}

// ServeWs handles WebSocket requests from clients
func ServeWs(hub *Hub, w http.ResponseWriter, r *http.Request, log *logrus.Logger) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.WithError(err).Error("Failed to upgrade WebSocket connection")
		return
	}

	clientID := r.URL.Query().Get("client_id")
	if clientID == "" {
		clientID = generateClientID()
	}

	client := &Client{
		Hub:      hub,
		Conn:     conn,
		Send:     make(chan []byte, 256),
		ClientID: clientID,
	}

	hub.register <- client

	// Start goroutines for reading and writing
	go client.writePump()
	go client.readPump()
}

// readPump pumps messages from the WebSocket connection to the hub
func (c *Client) readPump() {
	defer func() {
		c.Hub.unregister <- c
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(512 * 1024) // 512KB max message size
	c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				c.Hub.log.WithError(err).Warn("WebSocket unexpected close error")
			}
			break
		}

		// Handle incoming messages (echo for now, can be extended)
		c.Hub.log.WithField("client_id", c.ClientID).Debug("Received WebSocket message")
		
		// Parse and handle different message types
		var event types.WebSocketEvent
		if err := json.Unmarshal(message, &event); err == nil {
			handleClientMessage(c, event)
		}
	}
}

// writePump pumps messages from the hub to the WebSocket connection
func (c *Client) writePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				// Hub closed the channel
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Add queued messages to the current WebSocket message
			n := len(c.Send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.Send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// handleClientMessage handles incoming messages from clients
func handleClientMessage(client *Client, event types.WebSocketEvent) {
	switch event.Type {
	case "ping":
		// Respond with pong
		pong := types.WebSocketEvent{
			Type:      "pong",
			Payload:   map[string]string{"client_id": client.ClientID},
			Timestamp: time.Now(),
		}
		if data, err := json.Marshal(pong); err == nil {
			client.Send <- data
		}
	case "subscribe":
		// Handle subscription to specific events
		if payload, ok := event.Payload.(map[string]interface{}); ok {
			channels, _ := payload["channels"].([]interface{})
			client.Hub.log.WithFields(logrus.Fields{
				"client_id": client.ClientID,
				"channels":  channels,
			}).Debug("Client subscribed to channels")
		}
	default:
		client.Hub.log.WithField("type", event.Type).Debug("Unknown message type received")
	}
}

// generateClientID generates a unique client ID
func generateClientID() string {
	return "client-" + time.Now().Format("20060102150405") + "-" + randomString(6)
}

// randomString generates a random string of the specified length
func randomString(length int) string {
	const charset = "abcdefghijklmnopqrstuvwxyz0123456789"
	result := make([]byte, length)
	for i := range result {
		result[i] = charset[time.Now().UnixNano()%int64(len(charset))]
	}
	return string(result)
}
