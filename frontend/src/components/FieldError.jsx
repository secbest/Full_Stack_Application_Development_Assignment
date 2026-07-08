// Shared inline Formik field-error renderer. Previously copy-pasted per form
// (e.g. jobs/memo-wizard/Step2ServiceCharges.jsx) - extracted since a third form
// (Pricing Contracts) now needs the identical touched+error check.
export function FieldError({ formik, name }) {
  if (!formik.touched[name] || !formik.errors[name]) return null
  return <p className="text-xs text-[#EF4444] mt-1">{formik.errors[name]}</p>
}
