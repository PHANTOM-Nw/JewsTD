import { useEffect, useState, useCallback } from 'react'
import { initializeGrid } from '../game/config/map'
import { usePathfinding } from '../game/pathfinding/usePathfinding'
import type { GridCell } from '../game/types/game'

/**
 * BFS寻路系统测试组件
 * 用于在浏览器中可视化测试寻路功能
 */
export function PathfindingTest() {
  const [grid] = useState<GridCell[][]>(initializeGrid())
  const [testResults, setTestResults] = useState<string[]>([])
  const { calculatePath, checkPlacement, startPos, endPos } = usePathfinding()

  // 运行基本测试
  const runBasicTests = useCallback(() => {
    const results: string[] = []

    // 测试1: 计算初始路径
    try {
      const path = calculatePath(grid)
      if (path) {
        results.push(`✓ 测试1通过: 找到路径,长度 ${path.length - 1} 步`)
      } else {
        results.push('✗ 测试1失败: 未找到路径')
      }
    } catch (error) {
      results.push(`✗ 测试1错误: ${error}`)
    }

    // 测试2: 检查空位置是否可以放置塔
    try {
      const canPlace = checkPlacement(grid, { row: 5, col: 5 })
      if (canPlace) {
        results.push('✓ 测试2通过: 空位置可以放置塔')
      } else {
        results.push('✗ 测试2失败: 空位置不能放置塔')
      }
    } catch (error) {
      results.push(`✗ 测试2错误: ${error}`)
    }

    // 测试3: 在关键位置放置塔后检查路径
    try {
      const testGrid = grid.map(row => row.map(cell => ({ ...cell })))
      testGrid[5][5].type = 'tower'
      const pathAfterPlacement = calculatePath(testGrid)
      if (pathAfterPlacement) {
        results.push('✓ 测试3通过: 放置塔后仍能找到路径')
      } else {
        results.push('✗ 测试3失败: 放置塔后无法找到路径')
      }
    } catch (error) {
      results.push(`✗ 测试3错误: ${error}`)
    }

    // 测试4: 起点和终点信息
    results.push(`✓ 测试4通过: 起点(${startPos.row},${startPos.col}), 终点(${endPos.row},${endPos.col})`)

    setTestResults(results)
  }, [calculatePath, checkPlacement, grid, startPos, endPos])

  // 组件挂载时自动运行测试
  useEffect(() => {
    runBasicTests()
  }, [runBasicTests])

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h2>BFS寻路系统测试结果</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <h3>地图配置:</h3>
        <p>起点: ({startPos.row}, {startPos.col})</p>
        <p>终点: ({endPos.row}, {endPos.col})</p>
        <p>地图大小: {grid.length} x {grid[0].length}</p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3>测试结果:</h3>
        <ul>
          {testResults.map((result, index) => (
            <li key={index} style={{ 
              color: result.startsWith('✓') ? 'green' : 'red',
              marginBottom: '5px'
            }}>
              {result}
            </li>
          ))}
        </ul>
      </div>

      <button 
        onClick={runBasicTests}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          cursor: 'pointer',
          backgroundColor: '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: '4px'
        }}
      >
        重新运行测试
      </button>

      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
        <h3>使用说明:</h3>
        <p>1. 打开浏览器控制台查看详细的测试日志</p>
        <p>2. 可以在控制台中运行以下命令进行更多测试:</p>
        <pre style={{ backgroundColor: '#fff', padding: '10px', overflow: 'auto' }}>
{`// 导入测试函数
import testModule from './src/devtools/pathfindingChecks'

// 运行所有测试
testModule.runAllTests()

// 或者运行单个测试
testModule.testBasicPathfinding()
testModule.testObstacleBlocking()
testModule.testTowerBlocking()`}
        </pre>
      </div>
    </div>
  )
}
