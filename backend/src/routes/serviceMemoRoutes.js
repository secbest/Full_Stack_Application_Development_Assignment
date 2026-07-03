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

router.get(
  '/:id',
  authenticate,
  authorise('field_crew', 'ar_specialist', 'managing_director'),
  validate(memoIdParamSchema, 'params'),
  getServiceMemoById
)

module.exports = router
