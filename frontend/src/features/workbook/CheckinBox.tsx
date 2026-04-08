interface Props {
  checked: boolean
  onChange: () => void
}

export function CheckinBox({ checked, onChange }: Props) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="h-5 w-5 cursor-pointer rounded border-gray-300 text-green-600 focus:ring-green-500"
    />
  )
}
