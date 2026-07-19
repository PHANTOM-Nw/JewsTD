import { describe, expect, it } from 'vitest'
import { LeaderboardApiError } from '../services/leaderboard'
import { getLeaderboardErrorMessage } from './leaderboardError'

describe('getLeaderboardErrorMessage', () => {
  it.each([
    ['version_mismatch', '本局计分版本已过期，请刷新页面后再开始新游戏'],
    ['run_already_submitted', '本局成绩已经提交，不能重复上传'],
    ['submission_token_expired', '本局提交凭证已过期，无法再上传成绩'],
    ['invalid_submission_token', '本局提交凭证无效，无法上传成绩'],
    ['rate_limited', '操作过于频繁，请稍后重试'],
    ['validation_error', '成绩数据未通过校验，无法上传']
  ])('maps %s without exposing the server message', (code, expected) => {
    expect(getLeaderboardErrorMessage(
      new LeaderboardApiError('English server detail', code, 400)
    )).toBe(expected)
  })

  it('uses a generic Chinese message for unknown errors', () => {
    expect(getLeaderboardErrorMessage(new Error('English failure')))
      .toBe('排行榜服务暂时不可用，请稍后重试')
    expect(getLeaderboardErrorMessage(
      new LeaderboardApiError('English failure', 'unknown_code', 500)
    )).toBe('排行榜请求失败，请稍后重试')
  })
})
