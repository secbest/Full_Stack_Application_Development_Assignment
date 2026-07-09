import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

// Compact inline <Select> used in the pricing-contract "add rate" rows (Contract Form
// and Contract Detail), inside a fixed-width table column (table-fixed + colgroup) or
// grid track (minmax(0, ...)) - the value text needs to truncate with an ellipsis when
// a label is too long for its column, WITHOUT ever squeezing out the chevron icon.
//
// @radix-ui/react-select's Value component destructures `className` and `style` out of
// its props and never applies them to the rendered element (see node_modules/@radix-ui/
// react-select/dist/index.js's SelectValue), so neither can be set on <SelectValue>
// directly - passing them is silently dropped. Wrapping it in a plain <span> we control
// works around that: the span (not SelectValue itself) becomes the flex item that
// actually shrinks/truncates.
//
// Earlier attempt put whitespace-nowrap + overflow-hidden on SelectTrigger itself
// instead. That stopped text from wrapping, but overflow-hidden on the whole flex row
// meant that once the (unshrinkable, nowrap) text plus the icon together exceeded the
// column width, the flex algorithm had nowhere else to take space from and shrank the
// icon toward zero width instead - it didn't wrap, it just vanished. min-w-0 on this
// wrapper gives the text somewhere real to shrink (down to nothing, clipped by its own
// overflow-hidden + ellipsis) so the fixed-size icon (shrink-0 in ui/select.jsx) is
// never touched.
export function MiniSelect({ value, onChange, options, labels, placeholder }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9">
        <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-left">
          <SelectValue placeholder={placeholder} />
        </span>
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => <SelectItem key={o} value={o}>{labels[o]}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}
