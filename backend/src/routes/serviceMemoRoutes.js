const router = require('express').Router()
const { authenticate, authorise, validate } = require('../middleware')
const { uploadSignatureFile, uploadHospitalStampFile } = require('../middleware/upload')
const {
  createServiceMemoSchema,
  memoIdParamSchema,
  listServiceMemosQuerySchema,
} = require('../validators')
const {
  uploadSignature,
  uploadHospitalStamp,
  createServiceMemo,
  listServiceMemos,
  getServiceMemoById,
} = require('../controllers/serviceMemoController')
const { listPendingReview, approveMemo, returnMemo, resubmitMemo } = require('../controllers/memoReviewController')

// Order matters: authenticate -> authorise (role) -> validate (shape) -> controller.
// Auth failures should never leak whether a payload was well-formed, so auth always runs first.

router.post(
  '/upload-signature',
  authenticate,
  authorise('field_crew', 'managing_director'),
  uploadSignatureFile,
  uploadSignature
)

router.post(
  '/upload-hospital-stamp',
  authenticate,
  authorise('field_crew', 'managing_director'),
  uploadHospitalStampFile,
  uploadHospitalStamp
)

router.post(
  '/',
  authenticate,
  authorise('field_crew', 'managing_director'),
  validate(createServiceMemoSchema),
  createServiceMemo
)

router.get(
  '/',
  authenticate,
  authorise('field_crew', 'ar_specialist', 'managing_director'),
  validate(listServiceMemosQuerySchema, 'query'),
  listServiceMemos
)

// ─── AR Review (Wave 3 - implemented by Kwan Hua; AR design by Jasper) ────────
// Registered before '/:id' so the literal path is not swallowed by the id param.
router.get('/pending-review', authenticate, authorise('ar_specialist', 'managing_director'), listPendingReview)
router.patch('/:id/approve', authenticate, authorise('ar_specialist'), approveMemo)
router.patch('/:id/return', authenticate, authorise('ar_specialist'), returnMemo)

// The crew's half of the return loop - corrects a returned memo and puts it back in the
// review queue. Managing Director included so a stuck memo can be unblocked without Ravi.
router.patch('/:id/resubmit', authenticate, authorise('field_crew', 'managing_director'), resubmitMemo)

router.get(
  '/:id',
  authenticate,
  authorise('field_crew', 'ar_specialist', 'managing_director'),
  validate(memoIdParamSchema, 'params'),
  getServiceMemoById
)

module.exports = router
