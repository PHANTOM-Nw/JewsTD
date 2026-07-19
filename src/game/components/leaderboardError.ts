import { LeaderboardApiError } from '../services/leaderboard'

const ERROR_MESSAGES: Record<string, string> = {
  network_error: '无法连接排行榜服务，请稍后重试',
  invalid_response: '排行榜返回了无法识别的数据，请稍后重试',
  version_mismatch: '本局计分版本已过期，请刷新页面后再开始新游戏',
  run_already_submitted: '本局成绩已经提交，不能重复上传',
  expired: '本局提交凭证已过期，无法再上传成绩',
  submission_token_expired: '本局提交凭证已过期，无法再上传成绩',
  invalid_submission_token: '本局提交凭证无效，无法上传成绩',
  rate_limited: '操作过于频繁，请稍后重试',
  validation_error: '成绩数据未通过校验，无法上传'
}

export function getLeaderboardErrorMessage(error: unknown) {
  if (error instanceof LeaderboardApiError) {
    return ERROR_MESSAGES[error.code]
      ?? '排行榜请求失败，请稍后重试'
  }
  return '排行榜服务暂时不可用，请稍后重试'
}
