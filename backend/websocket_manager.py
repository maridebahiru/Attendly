from fastapi import WebSocket
from typing import List
import json
import logging

logger = logging.getLogger(__name__)

class ConnectionManager:
    """Manages WebSocket connections and broadcasts messages."""
    
    def __init__(self):
        # Maintain a list of active WebSocket connections
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        """Accept a new connection and add it to the list."""
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info("New WebSocket connection. Total: %d", len(self.active_connections))

    def disconnect(self, websocket: WebSocket):
        """Remove a connection from the list when disconnected."""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info("WebSocket disconnected. Total: %d", len(self.active_connections))

    async def broadcast(self, data: dict):
        """Broadcast JSON payload to all connected clients, silently drop disconnected ones."""
        disconnected_clients = []
        for connection in self.active_connections:
            try:
                # Convert datetime objects to string if they exist before JSON serialization
                json_data = json.dumps(data, default=str)
                await connection.send_text(json_data)
            except Exception as e:
                # If sending fails (e.g., client disconnected without closing), mark for removal
                logger.error("Failed to send message over websocket: %s", e)
                disconnected_clients.append(connection)

        # Clean up disconnected clients
        for client in disconnected_clients:
            self.disconnect(client)

# Global instance to be used across the application
manager = ConnectionManager()
