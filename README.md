# mcp-trello

Servidor MCP (Model Context Protocol) para gestionar Trello desde Claude Desktop.

## Tools disponibles

| Tool | Descripción |
|------|-------------|
| `list_boards` | Listar todos los tableros |
| `list_lists` | Listar listas de un tablero |
| `list_cards` | Listar tarjetas de una lista |
| `get_card` | Ver detalle de una tarjeta |
| `create_card` | Crear tarjeta |
| `update_card` | Actualizar/mover tarjeta |
| `delete_card` | Eliminar tarjeta |
| `create_list` | Crear lista en un tablero |
| `create_board` | Crear tablero |
| `add_comment` | Agregar comentario a tarjeta |
| `add_checklist` | Agregar checklist a tarjeta |
| `search` | Buscar tarjetas y tableros |

## Requisitos

- Node.js 18+
- macOS / Linux / Windows
- Claude Desktop
- API Key y Token de Trello

## Instalación

```bash
cd mcp-trello
npm install
npm run build
```

## Obtener credenciales de Trello

1. Ve a https://trello.com/power-ups/admin y crea un Power-Up
2. Copia tu **API Key**
3. Genera un **Token** visitando:
   ```
   https://trello.com/1/authorize?expiration=never&scope=read,write&response_type=token&key=TU_API_KEY
   ```

## Configuración en Claude Desktop

Edita `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "trello": {
      "command": "node",
      "args": ["/ruta/absoluta/a/mcp-trello/dist/index.js"],
      "env": {
        "TRELLO_API_KEY": "tu_api_key",
        "TRELLO_TOKEN": "tu_token"
      }
    }
  }
}
```

Reinicia Claude Desktop completamente (Cmd+Q y volver a abrir).

## Ejemplos de uso

- "Muéstrame mis tableros de Trello"
- "Crea una tarjeta en la lista To Do del tablero Tecnología que diga Revisar logs"
- "Mueve la tarjeta X a la lista Done"
- "Agrega un checklist con 3 items a la tarjeta Y"
- "Busca tarjetas que mencionen deploy"
