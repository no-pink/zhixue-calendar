class AppError extends Error {
  constructor(code, message, status = 400, details = null) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function sendError(res, err) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ code: err.code, message: err.message, details: err.details });
  }
  // Fallback for unexpected errors
  return res.status(500).json({ code: 'INTERNAL_ERROR', message: err.message || '服务器内部错误', details: null });
}

function sendConflict(res, conflictType, overlapping) {
  return res.json({
    code: conflictType === 'same_name' ? 'CONFLICT_SAME_NAME' : 'CONFLICT_OVERLAP',
    message: conflictType === 'same_name' ? '已存在同名任务' : '时段冲突',
    details: { conflictType, overlapping },
  });
}

module.exports = { AppError, sendError, sendConflict };
