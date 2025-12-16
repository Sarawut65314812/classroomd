import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getGames, GameConfig } from '../services/storage'

const ALLOWED_GAME_IDS = ['coloring', 'puzzle', 'category']

function HomePage() {
  const [tiles, setTiles] = useState<GameConfig[]>([])

  useEffect(() => {
    // Default games configuration
    const defaultGameConfig: GameConfig[] = [
      {
        id: 'coloring',
        name: 'ระบายสี',
        icon: '🎨',
        description: 'สนุกกับการวาดและระบายสีด้วยนิ้ว หรือปากกาสไตลัส',
        path: '/coloring',
        enabled: true,
        order: 1
      },
      {
        id: 'puzzle',
        name: 'จิ๊กซอว์',
        icon: '🧩',
        description: 'ต่อภาพจิ๊กซอว์สนุก ๆ ลากวางชิ้นส่วนให้ถูกที่',
        path: '/puzzle',
        enabled: true,
        order: 2
      },
      {
        id: 'category',
        name: 'จัดหมวดหมู่',
        icon: '🗂️',
        description: 'ลากรายการไปจัดเข้าหมวดหมู่ที่ถูกต้อง',
        path: '/category',
        enabled: true,
        order: 3
      }
    ]

    // Get games from storage
    let games = getGames()
      .filter(game => ALLOWED_GAME_IDS.includes(game.id))
      .sort((a, b) => a.order - b.order)

    // If no games found or missing allowed games, use defaults
    if (games.length === 0) {
      games = defaultGameConfig
    } else {
      // Ensure all allowed games are present, even if disabled
      const gamesMap = new Map(games.map(g => [g.id, g]))
      for (const defaultGame of defaultGameConfig) {
        if (!gamesMap.has(defaultGame.id)) {
          games.push(defaultGame)
        }
      }
      games.sort((a, b) => a.order - b.order)
    }

    // Always show enabled games, or all games if none are enabled
    const enabledGames = games.filter(g => g.enabled)
    setTiles(enabledGames.length > 0 ? enabledGames : games)
  }, [])

  return (
    <div className="home-page">
      <Link to="/teacher" className="teacher-link">
        👩‍🏫 จัดการห้องเรียน
      </Link>
      
      <h1 className="home-title">🎨 สตูดิโอห้องเรียนมหาสนุก 🎮</h1>
      
      <div className="game-cards">
        {tiles.map(tile => (
          <Link key={tile.id} to={tile.path} className="game-card">
            <div className="game-icon">{tile.icon}</div>
            <h2>{tile.name}</h2>
            <p>{tile.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default HomePage
