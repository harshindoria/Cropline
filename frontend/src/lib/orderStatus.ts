// How each order status is shown to buyers: its label and badge colours.
export const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'Pending', color: 'text-amber-700', bg: 'bg-amber-100' },
  CONFIRMED: { label: 'Confirmed', color: 'text-blue-700', bg: 'bg-blue-100' },
  READY_FOR_PICKUP: { label: 'Ready', color: 'text-indigo-700', bg: 'bg-indigo-100' },
  DELIVERY_SEARCHING: { label: 'Finding Partner', color: 'text-indigo-700', bg: 'bg-indigo-100' },
  ASSIGNED: { label: 'Assigned', color: 'text-purple-700', bg: 'bg-purple-100' },
  PICKED_UP: { label: 'Picked Up', color: 'text-violet-700', bg: 'bg-violet-100' },
  IN_DELIVERY: { label: 'On the Way', color: 'text-cyan-700', bg: 'bg-cyan-100' },
  DELIVERED: { label: 'Delivered', color: 'text-green-700', bg: 'bg-green-100' },
  COMPLETED: { label: 'Completed', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  CANCELLED: { label: 'Cancelled', color: 'text-red-700', bg: 'bg-red-100' },
  DISPUTED: { label: 'Disputed', color: 'text-orange-700', bg: 'bg-orange-100' },
};

export const statusStyle = (status: string) =>
  STATUS_CONFIG[status] || { label: status, color: 'text-gray-700', bg: 'bg-gray-100' };
