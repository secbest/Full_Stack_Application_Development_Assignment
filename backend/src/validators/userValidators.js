const Yup = require('yup')

const userIdParamSchema = Yup.object({
  id: Yup.number().integer().positive().required('A valid user id is required'),
})

module.exports = { userIdParamSchema }
